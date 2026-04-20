<div align="center">
  <img src="images/logo.png" width="128" height="128" alt="GitSwitch logo" />

  # GitSwitch

  **Switch between GitHub SSH profiles from the VS Code status bar.**

  [![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC?style=flat-square&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=karthikeyanmg.gitswitch)
  [![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
  [![GitHub](https://img.shields.io/badge/GitHub-KarthikMgk%2Fgitswitch--vscode--plugin-181717?style=flat-square&logo=github)](https://github.com/KarthikMgk/gitswitch-vscode-plugin)

</div>

---

## The Problem

If you manage multiple GitHub accounts — personal, work, client — you've hit this before:

```
remote: Permission denied to KarthikMgk.
fatal: unable to access 'https://github.com/work-org/repo.git/'
```

Or worse: the push succeeds, but the commit lands under the wrong account because git used the wrong SSH key. Fixing that means rewriting history, and nobody has time for that.

The usual workaround — SSH host aliases in `~/.ssh/config` — works, but it's invisible. There's no indication in VS Code which identity is active, and nothing stops you from using the wrong one.

## The Solution

GitSwitch lives in the VS Code status bar. One click shows your GitHub profiles. One more click switches to it — setting both the correct SSH key **and** your git commit identity for that terminal session.

```
# GitSwitch: github-work → your-username (12345678+your-username@users.noreply.github.com)
```

No config files touched. No global git settings changed. Everything is terminal-scoped and disappears when the session ends.

## Features

- **Zero configuration** — reads your existing `~/.ssh/config` automatically. If you already manage SSH profiles, you're already set up.
- **GitHub-only filter** — shows only `HostName github.com` entries. Your VPN, servers, and other SSH hosts stay out of the list.
- **Complete identity switch** — sets both the SSH key (`GIT_SSH_COMMAND`) and git commit identity (`GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_EMAIL`) from the same click.
- **Correct noreply email** — resolves the `{id}+{username}@users.noreply.github.com` format via the GitHub API, so commits are properly attributed even with "keep email private" enabled.
- **Auto-inject on new terminals** — select a profile once; every terminal you open in that workspace inherits it automatically.
- **Workspace persistence** — remembers your last profile per workspace across VS Code reloads.
- **Status bar display** — shows your active GitHub username at a glance. No need to run `ssh -T git@github.com` to check.

## How It Works

When you select a profile, GitSwitch:

1. Identifies the GitHub account that owns the SSH key by running `ssh -T git@github.com` with that key in isolation (`-F /dev/null` prevents other SSH config from interfering)
2. Fetches the account's numeric ID from the GitHub public API to construct the correct noreply email
3. Injects six environment variables into your terminal:

```bash
export GIT_SSH_COMMAND="ssh -i \"/path/to/key\" -o IdentitiesOnly=yes"
export GIT_AUTHOR_NAME="your-github-username"
export GIT_COMMITTER_NAME="your-github-username"
export GIT_AUTHOR_EMAIL="12345678+your-github-username@users.noreply.github.com"
export GIT_COMMITTER_EMAIL="12345678+your-github-username@users.noreply.github.com"
```

Everything is environment-variable-based — nothing is written to disk, nothing affects other terminals or other repos, and everything resets when you close the terminal.

## Requirements

- VS Code 1.85 or later
- macOS or Linux
- One or more GitHub SSH profiles configured in `~/.ssh/config`, e.g.:

```ssh-config
Host github-work
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_work

Host github-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_personal
```

## Installation

### From VSIX (local)

```bash
# Clone and build
git clone https://github.com/KarthikMgk/gitswitch-vscode-plugin.git
cd gitswitch-vscode-plugin
npm install
npm run package

# Install
code --install-extension gitswitch-0.0.1.vsix
```

### From source (development)

```bash
git clone https://github.com/KarthikMgk/gitswitch-vscode-plugin.git
cd gitswitch-vscode-plugin
npm install
```

Open the folder in VS Code and press **F5** to launch the Extension Development Host.

## Usage

1. Click the **`$(key) GitSwitch`** icon in the status bar (bottom left)
2. Select a GitHub profile from the picker
3. The status bar updates to show your active GitHub username
4. Every terminal in this workspace now uses that profile automatically

To switch profiles, click the status bar icon again and choose a different profile. To clear the active profile, select **Clear active profile** at the bottom of the list.

## Verifying the Switch

After switching, confirm both layers are correct:

```bash
# Check the SSH key and commit identity
echo $GIT_SSH_COMMAND
echo $GIT_AUTHOR_EMAIL

# Confirm which GitHub account the key authenticates as
eval "$GIT_SSH_COMMAND -T git@github.com"
# → Hi your-username! You've successfully authenticated...
```

## Running Tests

```bash
npm test
```

39 unit tests covering SSH config parsing, shell command construction, and GitHub username/ID resolution.

## License

MIT — see [LICENSE](LICENSE).
