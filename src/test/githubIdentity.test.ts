import * as assert from 'assert';
import { parseGitHubUsername, fetchGitHubUserId } from '../githubIdentity';

describe('parseGitHubUsername', () => {
  it('parses a standard GitHub SSH -T response', () => {
    const output =
      "Hi karthikmg! You've successfully authenticated, but GitHub does not provide shell access.";
    assert.strictEqual(parseGitHubUsername(output), 'karthikmg');
  });

  it('parses a username with hyphens', () => {
    const output =
      "Hi karthikmg-tw! You've successfully authenticated, but GitHub does not provide shell access.";
    assert.strictEqual(parseGitHubUsername(output), 'karthikmg-tw');
  });

  it('parses a username with numbers', () => {
    const output = "Hi user123! You've successfully authenticated...";
    assert.strictEqual(parseGitHubUsername(output), 'user123');
  });

  it('returns null when the response contains no Hi greeting', () => {
    assert.strictEqual(parseGitHubUsername('Permission denied (publickey).'), null);
  });

  it('returns null for empty output', () => {
    assert.strictEqual(parseGitHubUsername(''), null);
  });

  it('returns null for a connection timeout message', () => {
    assert.strictEqual(
      parseGitHubUsername('ssh: connect to host github.com port 22: Operation timed out'),
      null
    );
  });

  it('handles trailing whitespace around the username', () => {
    const output = 'Hi  karthikmg ! authenticated';
    assert.strictEqual(parseGitHubUsername(output), 'karthikmg');
  });

  it('works when the response arrives on stderr (concatenated with empty stdout)', () => {
    const stderr =
      "Hi KarthikMgk! You've successfully authenticated, but GitHub does not provide shell access.";
    const stdout = '';
    assert.strictEqual(parseGitHubUsername(stderr + stdout), 'KarthikMgk');
  });
});

describe('fetchGitHubUserId', () => {
  it('returns a numeric ID for a real GitHub user', async () => {
    // Uses the real GitHub API — verifies the full lookup works end-to-end.
    // karthikmg is a real public account; its ID is stable.
    const id = await fetchGitHubUserId('karthikmg');
    assert.ok(typeof id === 'number', `Expected a number, got: ${id}`);
    assert.ok(id > 0, `Expected a positive ID, got: ${id}`);
  });

  it('returns null for a username that does not exist', async () => {
    const id = await fetchGitHubUserId('this-user-definitely-does-not-exist-xyzzy-12345');
    assert.strictEqual(id, null);
  });
});
