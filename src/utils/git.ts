import { exec } from 'child_process';
import { promisify } from 'util';
import { PRInfo } from '../types';
import { executeWithStreaming } from './streaming-exec';

const execAsync = promisify(exec);

export async function isGitHubCLIInstalled(): Promise<boolean> {
  try {
    await execAsync('gh --version');
    return true;
  } catch {
    return false;
  }
}

export async function isGitHubCLIAuthenticated(): Promise<boolean> {
  try {
    await execAsync('gh auth status');
    return true;
  } catch {
    return false;
  }
}

export async function setupGitHubAuth(): Promise<void> {
  const hasGH = await isGitHubCLIInstalled();
  
  if (!hasGH) {
    throw new Error('GitHub CLI is not installed. Install it from https://cli.github.com/ and run: gh auth login');
  }
  
  const isAuthenticated = await isGitHubCLIAuthenticated();
  
  if (!isAuthenticated) {
    throw new Error('GitHub CLI is not authenticated. Run: gh auth login');
  }
  
  // Set git to use GitHub CLI as credential helper
  await execAsync('gh auth setup-git');
}

export async function cloneRepository(prInfo: PRInfo, targetPath: string): Promise<void> {
  const repoUrl = `https://github.com/${prInfo.owner}/${prInfo.repo}.git`;

  try {
    // First clone the repository
    await executeWithStreaming(
      'git',
      ['clone', repoUrl, targetPath],
      'Cloning repository...'
    );

    // Then fetch the PR and create/checkout the branch
    await executeWithStreaming(
      'git',
      ['fetch', 'origin', `pull/${prInfo.prNumber}/head:${prInfo.branch}`],
      `Fetching PR #${prInfo.prNumber}...`,
      { cwd: targetPath }
    );
    await execAsync(`git checkout ${prInfo.branch}`, { cwd: targetPath });

  } catch (error) {
    // If the above fails, try the fallback method of cloning the specific branch
    try {
      // Clean up if partial clone happened
      await execAsync(`rm -rf "${targetPath}"`).catch(() => {});

      // Try to clone the branch directly (if it's a regular branch)
      await executeWithStreaming(
        'git',
        ['clone', '-b', prInfo.branch, repoUrl, targetPath],
        `Cloning branch ${prInfo.branch}...`
      );
    } catch (fallbackError) {
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export async function pullLatestChanges(projectPath: string, branch: string): Promise<void> {
  try {
    // Fetch latest changes
    await executeWithStreaming(
      'git',
      ['fetch', 'origin'],
      'Fetching latest changes...',
      { cwd: projectPath }
    );

    // Checkout the correct branch
    await execAsync(`git checkout ${branch}`, { cwd: projectPath });

    // Pull latest changes
    await executeWithStreaming(
      'git',
      ['pull', 'origin', branch],
      `Pulling latest changes from ${branch}...`,
      { cwd: projectPath }
    );
  } catch (error) {
    throw new Error(`Failed to pull latest changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function isRepositoryUpToDate(projectPath: string, branch: string): Promise<boolean> {
  try {
    // Fetch to get latest remote info
    await execAsync('git fetch origin', { cwd: projectPath });

    // Check if local is behind remote
    const { stdout } = await execAsync(`git rev-list --count HEAD..origin/${branch}`, { cwd: projectPath });
    const commitsBehind = parseInt(stdout.trim(), 10);

    return commitsBehind === 0;
  } catch {
    return false;
  }
}