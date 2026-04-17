import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface SshProfile {
  host: string;
  identityFile: string;
}

const GITHUB_HOSTNAME_RE = /^github\.com$/i;

export function readGitHubProfiles(): SshProfile[] {
  const configPath = path.join(os.homedir(), '.ssh', 'config');

  let content: string;
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch {
    return [];
  }

  return parseProfiles(content);
}

export function parseProfiles(content: string): SshProfile[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const profiles: SshProfile[] = [];

  let currentHost: string | null = null;
  let currentHostName: string | null = null;
  let currentIdentityFile: string | null = null;

  const flush = () => {
    if (currentHost && currentHostName && currentIdentityFile) {
      if (GITHUB_HOSTNAME_RE.test(currentHostName)) {
        profiles.push({
          host: currentHost,
          identityFile: expandTilde(currentIdentityFile),
        });
      }
    }
    currentHost = null;
    currentHostName = null;
    currentIdentityFile = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const hostMatch = line.match(/^Host\s+(.+)$/i);
    if (hostMatch) {
      flush();
      const hostValue = hostMatch[1].trim();
      // Skip wildcard patterns like "Host *"
      if (!hostValue.includes('*') && !hostValue.includes('?')) {
        currentHost = hostValue;
      }
      continue;
    }

    if (!currentHost) {
      continue;
    }

    const hostNameMatch = line.match(/^HostName\s+(\S+)$/i);
    if (hostNameMatch) {
      currentHostName = hostNameMatch[1];
      continue;
    }

    const identityFileMatch = line.match(/^IdentityFile\s+(.+)$/i);
    if (identityFileMatch) {
      currentIdentityFile = identityFileMatch[1].trim();
      continue;
    }
  }

  flush();
  return profiles;
}

function expandTilde(filePath: string): string {
  if (filePath === '~' || filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}
