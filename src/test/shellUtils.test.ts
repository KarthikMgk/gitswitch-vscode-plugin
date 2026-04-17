import * as assert from 'assert';
import { buildSshCommand } from '../shellUtils';

// Helper: simulate what bash does when it evaluates:
//   export GIT_SSH_COMMAND=<buildSshCommand(path)>
// The outer double-quoted string is stripped and \" sequences become ".
function bashEval(shellValue: string): string {
  // Strip surrounding double quotes
  assert.ok(shellValue.startsWith('"') && shellValue.endsWith('"'),
    `Expected double-quoted string, got: ${shellValue}`);
  const inner = shellValue.slice(1, -1);
  // Resolve escape sequences bash honors inside double quotes: \\ → \, \" → "
  return inner.replace(/\\(["\\])/g, '$1');
}

describe('buildSshCommand', () => {
  // ---------------------------------------------------------------------------
  // Output format
  // ---------------------------------------------------------------------------

  it('returns a double-quoted string', () => {
    const result = buildSshCommand('/Users/foo/.ssh/id_rsa');
    assert.ok(result.startsWith('"'), 'Should start with "');
    assert.ok(result.endsWith('"'), 'Should end with "');
  });

  it('includes -o IdentitiesOnly=yes', () => {
    const result = buildSshCommand('/Users/foo/.ssh/id_rsa');
    assert.ok(result.includes('IdentitiesOnly=yes'), 'Should include IdentitiesOnly=yes');
  });

  it('includes the ssh command', () => {
    const result = buildSshCommand('/Users/foo/.ssh/id_rsa');
    assert.ok(result.includes('ssh -i'), 'Should start the ssh command');
  });

  // ---------------------------------------------------------------------------
  // Path embedding — the GIT_SSH_COMMAND value after bash evaluation
  // ---------------------------------------------------------------------------

  it('embeds a simple path correctly', () => {
    const identityFile = '/Users/foo/.ssh/id_rsa_work';
    const value = bashEval(buildSshCommand(identityFile));
    assert.ok(
      value.includes(identityFile),
      `Expected "${identityFile}" in evaluated value: ${value}`
    );
  });

  it('handles paths with spaces', () => {
    const identityFile = '/Users/foo/my keys/id_rsa_work';
    const value = bashEval(buildSshCommand(identityFile));
    assert.ok(
      value.includes(identityFile),
      `Expected path with spaces in evaluated value: ${value}`
    );
  });

  it('handles paths with double quotes', () => {
    const identityFile = '/Users/foo/.ssh/weird"key';
    const value = bashEval(buildSshCommand(identityFile));
    assert.ok(
      value.includes(identityFile),
      `Expected escaped-quote path in evaluated value: ${value}`
    );
  });

  it('handles paths with backslashes', () => {
    const identityFile = '/Users/foo/.ssh/back\\slash';
    const value = bashEval(buildSshCommand(identityFile));
    assert.ok(
      value.includes(identityFile),
      `Expected backslash path in evaluated value: ${value}`
    );
  });

  it('handles a typical macOS SSH key path', () => {
    const identityFile = '/Users/karthikmg/.ssh/id_ed25519_github';
    const result = buildSshCommand(identityFile);
    const value = bashEval(result);
    assert.strictEqual(
      value,
      `ssh -i "${identityFile}" -o IdentitiesOnly=yes`
    );
  });

  it('handles home-expanded path (no tilde — tilde expansion is done before this function)', () => {
    const identityFile = '/Users/karthikmg/.ssh/id_rsa';
    const value = bashEval(buildSshCommand(identityFile));
    assert.ok(value.includes(identityFile));
  });

  // ---------------------------------------------------------------------------
  // Full command string sanity check
  // ---------------------------------------------------------------------------

  it('produces the exact expected shell assignment for a standard path', () => {
    const result = buildSshCommand('/Users/foo/.ssh/id_rsa');
    assert.strictEqual(
      result,
      '"ssh -i \\"/Users/foo/.ssh/id_rsa\\" -o IdentitiesOnly=yes"'
    );
  });
});
