import { exec } from 'child_process';
import { promisify } from 'util';
import { PRInfo } from '../types';

const execAsync = promisify(exec);

export function parsePRUrl(url: string): PRInfo {
  const prUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
  const match = url.match(prUrlPattern);

  if (!match) {
    throw new Error('Invalid GitHub PR URL format. Expected: https://github.com/owner/repo/pull/123');
  }

  const [, owner, repo, prNumber] = match;

  return {
    owner,
    repo,
    branch: '', // Will be fetched using git CLI
    prNumber: parseInt(prNumber, 10)
  };
}

export async function fetchPRBranch(prInfo: PRInfo): Promise<string> {
  const repoUrl = `https://github.com/${prInfo.owner}/${prInfo.repo}.git`;

  try {
    // Use git ls-remote to get PR branch information without cloning
    // This uses the user's existing git credentials
    const { stdout } = await execAsync(`git ls-remote ${repoUrl} "refs/pull/${prInfo.prNumber}/head"`);

    if (!stdout.trim()) {
      throw new Error(`PR #${prInfo.prNumber} not found in ${prInfo.owner}/${prInfo.repo}. Please check that the PR exists and you have access to the repository.`);
    }

    // The output format is: "<commit-hash>\trefs/pull/<pr-number>/head"
    // We need to get the actual branch name, so let's fetch all PR refs
    const { stdout: allRefs } = await execAsync(`git ls-remote ${repoUrl} "refs/pull/${prInfo.prNumber}/*"`);

    // Look for the head ref to get the branch name
    // We'll use a fallback approach: try to get branch from GitHub's PR ref naming
    const lines = allRefs.split('\n').filter(line => line.includes('/head'));
    if (lines.length > 0) {
      // For now, we'll use a conventional approach and try to fetch the branch name
      // by attempting to list all branches and match the commit
      try {
        const { stdout: branches } = await execAsync(`git ls-remote --heads ${repoUrl}`);
        const prCommit = lines[0].split('\t')[0];

        const branchLine = branches.split('\n').find(line => line.startsWith(prCommit));
        if (branchLine) {
          const branchName = branchLine.split('\t')[1].replace('refs/heads/', '');
          return branchName;
        }
      } catch {
        // Fallback: use pr-<number> as branch name
      }
    }

    // Fallback: create a local branch name for the PR
    return `pr-${prInfo.prNumber}`;

  } catch (error) {
    if (error instanceof Error && error.message.includes('PR #')) {
      throw error; // Re-throw our custom error messages
    }

    // Check if it's an authentication issue
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    if (errorMsg.includes('Authentication failed') || errorMsg.includes('access denied')) {
      throw new Error(`Authentication failed for ${prInfo.owner}/${prInfo.repo}. Please ensure you have access to the repository and your git credentials are set up correctly.`);
    }

    throw new Error(`Failed to fetch PR information: ${errorMsg}`);
  }
}