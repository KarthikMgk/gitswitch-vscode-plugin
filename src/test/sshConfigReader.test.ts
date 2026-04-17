import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { parseProfiles } from '../sshConfigReader';

describe('parseProfiles', () => {
  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  it('parses a single GitHub profile', () => {
    const input = `
Host github-work
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_rsa_work
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
    assert.strictEqual(profiles[0].host, 'github-work');
    assert.strictEqual(
      profiles[0].identityFile,
      path.join(os.homedir(), '.ssh', 'id_rsa_work')
    );
  });

  it('parses multiple GitHub profiles', () => {
    const input = `
Host github-personal
  HostName github.com
  IdentityFile ~/.ssh/id_rsa_personal

Host github-work
  HostName github.com
  IdentityFile ~/.ssh/id_rsa_work
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 2);
    assert.strictEqual(profiles[0].host, 'github-personal');
    assert.strictEqual(profiles[1].host, 'github-work');
  });

  it('preserves order of profiles as they appear in the config', () => {
    const input = `
Host github-c
  HostName github.com
  IdentityFile ~/.ssh/id_c

Host github-a
  HostName github.com
  IdentityFile ~/.ssh/id_a

Host github-b
  HostName github.com
  IdentityFile ~/.ssh/id_b
`;
    const profiles = parseProfiles(input);
    assert.deepStrictEqual(
      profiles.map((p) => p.host),
      ['github-c', 'github-a', 'github-b']
    );
  });

  // ---------------------------------------------------------------------------
  // GitHub filter
  // ---------------------------------------------------------------------------

  it('excludes non-GitHub hosts', () => {
    const input = `
Host github-work
  HostName github.com
  IdentityFile ~/.ssh/id_work

Host vpn-server
  HostName 10.0.0.1
  IdentityFile ~/.ssh/id_vpn

Host my-box
  HostName myserver.example.com
  IdentityFile ~/.ssh/id_server
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
    assert.strictEqual(profiles[0].host, 'github-work');
  });

  it('is case-insensitive for HostName matching', () => {
    const input = `
Host github-upper
  HostName GitHub.COM
  IdentityFile ~/.ssh/id_upper
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
    assert.strictEqual(profiles[0].host, 'github-upper');
  });

  it('is case-insensitive for SSH config directive keywords', () => {
    const input = `
HOST github-upper
  HOSTNAME github.com
  IDENTITYFILE ~/.ssh/id_upper
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
  });

  // ---------------------------------------------------------------------------
  // Tilde expansion
  // ---------------------------------------------------------------------------

  it('expands ~ to the home directory', () => {
    const input = `
Host github-work
  HostName github.com
  IdentityFile ~/.ssh/id_rsa_work
`;
    const profiles = parseProfiles(input);
    assert.ok(
      profiles[0].identityFile.startsWith(os.homedir()),
      `Expected path to start with home dir, got: ${profiles[0].identityFile}`
    );
    assert.ok(!profiles[0].identityFile.includes('~'));
  });

  it('leaves absolute paths unchanged', () => {
    const input = `
Host github-work
  HostName github.com
  IdentityFile /Users/somebody/.ssh/id_rsa_work
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles[0].identityFile, '/Users/somebody/.ssh/id_rsa_work');
  });

  // ---------------------------------------------------------------------------
  // Line ending handling
  // ---------------------------------------------------------------------------

  it('handles CRLF line endings', () => {
    const input =
      'Host github-work\r\n  HostName github.com\r\n  IdentityFile ~/.ssh/id_rsa\r\n';
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
    assert.strictEqual(profiles[0].host, 'github-work');
  });

  it('handles mixed CRLF and LF in the same file', () => {
    const input =
      'Host github-work\r\n  HostName github.com\n  IdentityFile ~/.ssh/id_rsa\r\n';
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
  });

  // ---------------------------------------------------------------------------
  // Wildcard and glob Host patterns
  // ---------------------------------------------------------------------------

  it('skips wildcard Host * entries', () => {
    const input = `
Host *
  AddKeysToAgent yes
  ServerAliveInterval 60

Host github-work
  HostName github.com
  IdentityFile ~/.ssh/id_rsa_work
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
    assert.strictEqual(profiles[0].host, 'github-work');
  });

  it('skips glob Host patterns containing ?', () => {
    const input = `
Host *.internal
  ProxyJump bastion

Host github-work
  HostName github.com
  IdentityFile ~/.ssh/id_rsa_work
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
  });

  // ---------------------------------------------------------------------------
  // Malformed / incomplete entries — must not crash
  // ---------------------------------------------------------------------------

  it('returns empty array for empty input', () => {
    assert.deepStrictEqual(parseProfiles(''), []);
  });

  it('ignores entries that are missing HostName', () => {
    const input = `
Host github-work
  IdentityFile ~/.ssh/id_rsa_work
`;
    assert.deepStrictEqual(parseProfiles(input), []);
  });

  it('ignores entries that are missing IdentityFile', () => {
    const input = `
Host github-work
  HostName github.com
`;
    assert.deepStrictEqual(parseProfiles(input), []);
  });

  it('skips comment lines without crashing', () => {
    const input = `
# My SSH config
# Work profile below
Host github-work
  HostName github.com
  # Use the work key
  IdentityFile ~/.ssh/id_rsa_work
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
  });

  it('skips blank lines without crashing', () => {
    const input = `

Host github-work

  HostName github.com

  IdentityFile ~/.ssh/id_rsa_work

`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
  });

  it('handles directives that appear before any Host block', () => {
    const input = `
IdentityFile ~/.ssh/default_key

Host github-work
  HostName github.com
  IdentityFile ~/.ssh/id_rsa_work
`;
    // Directives before first Host block should not crash the parser
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles.length, 1);
    assert.strictEqual(profiles[0].host, 'github-work');
  });

  // ---------------------------------------------------------------------------
  // Real-world patterns
  // ---------------------------------------------------------------------------

  it('handles IdentityFile path with spaces (absolute path)', () => {
    const input = `
Host github-work
  HostName github.com
  IdentityFile /Users/foo/my keys/id_rsa_work
`;
    const profiles = parseProfiles(input);
    assert.strictEqual(profiles[0].identityFile, '/Users/foo/my keys/id_rsa_work');
  });
});
