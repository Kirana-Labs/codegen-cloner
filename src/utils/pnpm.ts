import { exec } from 'child_process';
import { promisify } from 'util';
import { executeWithStreaming } from './streaming-exec';

const execAsync = promisify(exec);

export async function isPnpmInstalled(): Promise<boolean> {
  try {
    await execAsync('pnpm --version');
    return true;
  } catch {
    return false;
  }
}

export async function installPnpm(): Promise<void> {
  try {
    // Install pnpm using npm (most universal method)
    await executeWithStreaming(
      'npm',
      ['install', '-g', 'pnpm'],
      'Installing pnpm globally...'
    );
  } catch (error) {
    throw new Error(`Failed to install pnpm: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function runPnpmInstall(projectPath: string): Promise<void> {
  try {
    await executeWithStreaming(
      'pnpm',
      ['install'],
      'Installing dependencies with pnpm...',
      { cwd: projectPath }
    );
  } catch (error) {
    throw new Error(`Failed to run pnpm install: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function runPnpmSeed(projectPath: string): Promise<void> {
  try {
    await executeWithStreaming(
      'pnpm',
      ['seed'],
      'Running database seed...',
      { cwd: projectPath }
    );
  } catch (error) {
    throw new Error(`Failed to run pnpm seed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function runPnpmDev(projectPath: string): Promise<void> {
  try {
    // This will run in the background, so we don't await it
    const child = exec('pnpm dev', { cwd: projectPath });

    child.stdout?.on('data', (data) => {
      process.stdout.write(data);
    });

    child.stderr?.on('data', (data) => {
      process.stderr.write(data);
    });

    // Handle process termination
    process.on('SIGINT', () => {
      child.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      child.kill('SIGTERM');
      process.exit(0);
    });

  } catch (error) {
    throw new Error(`Failed to run pnpm dev: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}