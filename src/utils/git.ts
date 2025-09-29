import { exec } from 'child_process';
import { promisify } from 'util';
import { PRInfo } from '../types';

const execAsync = promisify(exec);

export async function cloneRepository(prInfo: PRInfo, targetPath: string): Promise<void> {
  const repoUrl = `https://github.com/${prInfo.owner}/${prInfo.repo}.git`;

  try {
    // First clone the repository
    await execAsync(`git clone ${repoUrl} "${targetPath}"`);

    // Then fetch the PR and create/checkout the branch
    await execAsync(`git fetch origin pull/${prInfo.prNumber}/head:${prInfo.branch}`, { cwd: targetPath });
    await execAsync(`git checkout ${prInfo.branch}`, { cwd: targetPath });

  } catch (error) {
    // If the above fails, try the fallback method of cloning the specific branch
    try {
      // Clean up if partial clone happened
      await execAsync(`rm -rf "${targetPath}"`).catch(() => {});

      // Try to clone the branch directly (if it's a regular branch)
      await execAsync(`git clone -b ${prInfo.branch} ${repoUrl} "${targetPath}"`);
    } catch (fallbackError) {
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export async function pullLatestChanges(projectPath: string, branch: string): Promise<void> {
  try {
    // Fetch latest changes
    await execAsync('git fetch origin', { cwd: projectPath });

    // Checkout the correct branch
    await execAsync(`git checkout ${branch}`, { cwd: projectPath });

    // Pull latest changes
    await execAsync(`git pull origin ${branch}`, { cwd: projectPath });
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