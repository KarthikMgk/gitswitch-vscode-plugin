import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { readGitHubProfiles, SshProfile } from './sshConfigReader';
import { buildSshCommand } from './shellUtils';
import { resolveGitHubIdentity, GitHubIdentity } from './githubIdentity';

const STATE_KEY = 'gitswitch.activeProfile';
const INJECT_DELAY_MS = 500;

let statusBarItem: vscode.StatusBarItem;
let activeProfile: SshProfile | null = null;
let activeIdentity: GitHubIdentity | null = null;

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'gitswitch.selectProfile';
  statusBarItem.tooltip = 'GitSwitch: Click to switch GitHub SSH profile';
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('gitswitch.selectProfile', () =>
      selectProfile(context)
    )
  );

  restoreProfile(context);
  updateStatusBar();

  context.subscriptions.push(
    vscode.window.onDidOpenTerminal(async (terminal) => {
      if (activeProfile) {
        await delay(INJECT_DELAY_MS);
        injectProfile(terminal, activeProfile, activeIdentity);
      }
    })
  );
}

function restoreProfile(context: vscode.ExtensionContext): void {
  const stored = context.workspaceState.get<SshProfile>(STATE_KEY);
  if (!stored) {
    return;
  }
  if (!fs.existsSync(stored.identityFile)) {
    context.workspaceState.update(STATE_KEY, undefined);
    return;
  }
  activeProfile = stored;

  // Resolve identity in the background so it's ready before the user opens
  // their first terminal. No await — activation must stay synchronous.
  resolveGitHubIdentity(stored.identityFile).then((identity) => {
    if (identity && activeProfile?.identityFile === stored.identityFile) {
      activeIdentity = identity;
      updateStatusBar();
    }
  });
}

async function selectProfile(context: vscode.ExtensionContext): Promise<void> {
  const profiles = readGitHubProfiles();

  type ProfileItem = vscode.QuickPickItem & { profile: SshProfile | null };

  const items: ProfileItem[] = profiles.map((p) => ({
    label: activeProfile?.host === p.host ? `$(check) ${p.host}` : p.host,
    description: p.identityFile,
    profile: p,
  }));

  if (items.length === 0) {
    vscode.window.showInformationMessage(
      'GitSwitch: No GitHub SSH profiles found in ~/.ssh/config'
    );
    return;
  }

  if (activeProfile) {
    items.push({
      label: '$(x) Clear active profile',
      description: '',
      profile: null,
    });
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a GitHub SSH profile',
    matchOnDescription: true,
  });

  if (selected === undefined) {
    return;
  }

  if (selected.profile === null) {
    activeProfile = null;
    activeIdentity = null;
    await context.workspaceState.update(STATE_KEY, undefined);
    updateStatusBar();
    return;
  }

  activeProfile = selected.profile;
  await context.workspaceState.update(STATE_KEY, activeProfile);

  // Show a spinner while the SSH identity lookup runs (~1-2 s)
  statusBarItem.text = '$(key) $(sync~spin) detecting...';

  const identity = await resolveGitHubIdentity(selected.profile.identityFile);
  activeIdentity = identity;
  updateStatusBar();

  const terminal = vscode.window.activeTerminal;
  if (terminal) {
    injectProfile(terminal, activeProfile, activeIdentity);
  }
}

function injectProfile(
  terminal: vscode.Terminal,
  profile: SshProfile,
  identity: GitHubIdentity | null
): void {
  const sshCommand = buildSshCommand(profile.identityFile);
  const keyName = path.basename(profile.identityFile);

  terminal.sendText(`export GIT_SSH_COMMAND=${sshCommand}`, true);

  if (identity) {
    terminal.sendText(`export GIT_AUTHOR_NAME="${identity.username}"`, true);
    terminal.sendText(`export GIT_COMMITTER_NAME="${identity.username}"`, true);
    terminal.sendText(`export GIT_AUTHOR_EMAIL="${identity.email}"`, true);
    terminal.sendText(`export GIT_COMMITTER_EMAIL="${identity.email}"`, true);
    terminal.sendText(
      `echo "# GitSwitch: ${profile.host} → ${identity.username} (${identity.email})"`,
      true
    );
  } else {
    // Identity lookup failed (offline, key not on GitHub) — SSH auth still works
    terminal.sendText(
      `echo "# GitSwitch: ${profile.host} (${keyName}) — commit identity unknown"`,
      true
    );
  }
}

function updateStatusBar(): void {
  if (activeProfile) {
    const label = activeIdentity ? activeIdentity.username : activeProfile.host;
    statusBarItem.text = `$(key) ${label}`;
  } else {
    statusBarItem.text = '$(key) GitSwitch';
  }
  statusBarItem.show();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function deactivate(): void {}
