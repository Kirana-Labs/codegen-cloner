import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ProjectStatus, PRInfo } from '../types';

const execAsync = promisify(exec);

export function getProjectPath(baseDir: string, prInfo: PRInfo): string {
  // Escape forward slashes and other problematic characters in branch names
  const safeBranchName = prInfo.branch
    .replace(/\//g, '-')           // Replace / with -
    .replace(/\\/g, '-')           // Replace \ with -
    .replace(/:/g, '-')            // Replace : with -
    .replace(/\*/g, '-')           // Replace * with -
    .replace(/\?/g, '-')           // Replace ? with -
    .replace(/"/g, '-')            // Replace " with -
    .replace(/</g, '-')            // Replace < with -
    .replace(/>/g, '-')            // Replace > with -
    .replace(/\|/g, '-');          // Replace | with -

  return join(baseDir, `${prInfo.owner}-${prInfo.repo}-${safeBranchName}`);
}

export function checkProjectExists(projectPath: string): ProjectStatus {
  const exists = existsSync(projectPath);
  return {
    exists,
    path: projectPath
  };
}

export function ensureDirectoryExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export async function isGitRepo(path: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: path });
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(path: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git branch --show-current', { cwd: path });
    return stdout.trim();
  } catch {
    return '';
  }
}