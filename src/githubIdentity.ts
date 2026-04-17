import * as https from 'https';
import { execFile } from 'child_process';

export interface GitHubIdentity {
  username: string;
  email: string;
}

// In-memory cache keyed by identityFile path.
// Cleared on VS Code restart — a fresh lookup on each session is fine since
// GitHub usernames and IDs never change.
const identityCache = new Map<string, GitHubIdentity>();

export async function resolveGitHubIdentity(
  identityFile: string
): Promise<GitHubIdentity | null> {
  if (identityCache.has(identityFile)) {
    return identityCache.get(identityFile)!;
  }

  try {
    const sshOutput = await sshTestGitHub(identityFile);
    const username = parseGitHubUsername(sshOutput);
    if (!username) {
      return null;
    }

    // Fetch the numeric user ID from the GitHub public API so we can construct
    // the correct noreply email: {id}+{username}@users.noreply.github.com
    // This format is what GitHub generates and reliably links commits to the
    // right account, even when the user has "keep email private" enabled.
    const userId = await fetchGitHubUserId(username);
    const email = userId
      ? `${userId}+${username}@users.noreply.github.com`
      : `${username}@users.noreply.github.com`; // fallback if API is unreachable

    const identity: GitHubIdentity = { username, email };
    identityCache.set(identityFile, identity);
    return identity;
  } catch {
    return null;
  }
}

/**
 * Parses the GitHub username from the SSH -T response.
 * GitHub always writes "Hi <username>! You've successfully authenticated..."
 * to stderr, with exit code 1 (expected — not an error).
 */
export function parseGitHubUsername(sshOutput: string): string | null {
  const match = sshOutput.match(/Hi ([^!]+)!/);
  return match ? match[1].trim() : null;
}

/**
 * Fetches the numeric GitHub user ID via the public API.
 * No authentication required. Returns null if the request fails.
 */
export async function fetchGitHubUserId(username: string): Promise<number | null> {
  try {
    const body = await httpsGet(`https://api.github.com/users/${encodeURIComponent(username)}`);
    const data = JSON.parse(body) as { id?: number };
    return typeof data.id === 'number' ? data.id : null;
  } catch {
    return null;
  }
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'gitswitch-vscode',
          'Accept': 'application/vnd.github.v3+json',
        },
        timeout: 8000,
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
    });
    req.on('error', reject);
  });
}

function sshTestGitHub(identityFile: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'ssh',
      [
        '-F', '/dev/null',       // ignore ~/.ssh/config so only the explicit key is tried
        '-i', identityFile,
        '-o', 'IdentitiesOnly=yes',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=5',
        '-T',
        'git@github.com',
      ],
      { timeout: 8000 },
      (_error, stdout, stderr) => {
        // GitHub exits with code 1 (no shell access), which Node treats as an
        // error — but stderr still contains the "Hi username!" message we need.
        resolve(stderr + stdout);
      }
    );
  });
}
