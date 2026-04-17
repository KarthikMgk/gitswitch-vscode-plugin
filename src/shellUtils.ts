/**
 * Builds the value for GIT_SSH_COMMAND that forces git to use a specific SSH key.
 * Returns a double-quoted bash string safe for use in `export GIT_SSH_COMMAND=<result>`.
 *
 * Escapes backslashes and double quotes in the path so the assignment is valid
 * even when the path contains special characters or spaces.
 *
 * Example output: "ssh -i \"/Users/foo/.ssh/id_rsa_work\" -o IdentitiesOnly=yes"
 */
export function buildSshCommand(identityFile: string): string {
  const safePath = identityFile.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"ssh -i \\"${safePath}\\" -o IdentitiesOnly=yes"`;
}
