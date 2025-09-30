import { exec } from 'child_process';
import { promisify } from 'util';
import { executeWithStreaming } from './streaming-exec';
import readline from 'readline';

const execAsync = promisify(exec);

async function askForConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export async function isPnpmInstalled(): Promise<boolean> {
  try {
    await execAsync('pnpm --version');
    return true;
  } catch {
    return false;
  }
}

async function isNpmInstalled(): Promise<boolean> {
  try {
    await execAsync('npm --version');
    return true;
  } catch {
    return false;
  }
}

export async function installPnpm(): Promise<void> {
  const hasNpm = await isNpmInstalled();
  
  if (!hasNpm) {
    // npm is not available, install pnpm directly
    const platform = process.platform;
    
    console.log('\nnpm is not installed. pnpm can be installed directly from https://get.pnpm.io/\n');
    
    const confirmed = await askForConfirmation('Would you like to install pnpm now?');
    
    if (!confirmed) {
      throw new Error('pnpm installation cancelled by user');
    }
    
    try {
      if (platform === 'win32') {
        // Windows: Use PowerShell
        await executeWithStreaming(
          'powershell',
          ['-Command', 'Invoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression'],
          'Installing pnpm from https://get.pnpm.io/...'
        );
      } else {
        // POSIX systems (macOS, Linux, etc.)
        await executeWithStreaming(
          'sh',
          ['-c', 'curl -fsSL https://get.pnpm.io/install.sh | sh -'],
          'Installing pnpm from https://get.pnpm.io/...'
        );
      }
      
      // Try to add pnpm to PATH for the current process
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (homeDir) {
        const pnpmPaths = [
          `${homeDir}/.local/share/pnpm`,
          `${homeDir}/.pnpm`,
          `${homeDir}/Library/pnpm`, // macOS Homebrew location
        ];
        
        // Add potential pnpm paths to the current process PATH
        for (const pnpmPath of pnpmPaths) {
          if (!process.env.PATH?.includes(pnpmPath)) {
            process.env.PATH = `${pnpmPath}:${process.env.PATH}`;
          }
        }
      }
      
      // Verify pnpm is now available
      if (await isPnpmInstalled()) {
        console.log('\n✅ pnpm installed successfully and is now available!\n');
        return;
      }
      
      console.log('\n⚠️  pnpm was installed but may not be in PATH. You may need to restart your terminal or run: source ~/.bashrc (or ~/.zshrc)\n');
      return;
    } catch (error) {
      throw new Error(`Failed to install pnpm directly: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  try {
    // Install pnpm using npm
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