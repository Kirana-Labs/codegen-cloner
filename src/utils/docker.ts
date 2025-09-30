import { exec } from 'child_process';
import { promisify } from 'util';
import { executeWithStreaming } from './streaming-exec';

const execAsync = promisify(exec);

export async function isDockerInstalled(): Promise<boolean> {
  try {
    await execAsync('docker --version');
    return true;
  } catch {
    return false;
  }
}

export async function installDocker(): Promise<void> {
  const platform = process.platform;

  if (platform === 'darwin') {
    throw new Error('Please install Docker Desktop for Mac manually from https://docs.docker.com/desktop/install/mac-install/');
  } else if (platform === 'linux') {
    // Install Docker on Linux
    const commands = [
      'curl -fsSL https://get.docker.com -o get-docker.sh',
      'sudo sh get-docker.sh',
      'sudo usermod -aG docker $USER',
      'rm get-docker.sh'
    ];

    for (const command of commands) {
      await execAsync(command);
    }
  } else if (platform === 'win32') {
    throw new Error('Please install Docker Desktop for Windows manually from https://docs.docker.com/desktop/install/windows-install/');
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function isDockerRunning(): Promise<boolean> {
  try {
    await execAsync('docker info');
    return true;
  } catch {
    return false;
  }
}

export async function startDocker(): Promise<void> {
  const platform = process.platform;

  if (platform === 'darwin') {
    // Try Docker Desktop first
    try {
      await execAsync('open /Applications/Docker.app');
      await waitForDocker();
      return;
    } catch {
      // Docker Desktop not found, check if OrbStack or other Docker setup is available
      if (await isDockerRunning()) {
        return; // Docker is already running via other means
      }
      throw new Error('Docker is not running. Please start Docker Desktop, OrbStack, or your Docker setup manually.');
    }
  } else if (platform === 'linux') {
    await execAsync('sudo systemctl start docker');
    await waitForDocker();
  } else {
    throw new Error('Docker must be started manually on Windows');
  }
}

async function waitForDocker(timeoutMs: number = 120000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await isDockerRunning()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Docker failed to start within timeout period');
}

export async function isPostgresContainerRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('docker ps --filter "name=db" --format "{{.Names}}"');
    return stdout.trim().includes('db');
  } catch {
    return false;
  }
}

export async function startPostgresContainer(projectPath: string): Promise<void> {
  try {
    // Use docker-compose to start the db service with streaming output
    await executeWithStreaming(
      'docker',
      ['compose', 'up', '-d', 'db'],
      'Starting PostgreSQL container with docker-compose...',
      { cwd: projectPath }
    );

    // Wait for postgres to be ready
    await waitForPostgres();
  } catch (error) {
    throw new Error(`Failed to start PostgreSQL container: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function waitForPostgres(timeoutMs: number = 180000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      await execAsync('docker exec db pg_isready -U postgres');
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error('PostgreSQL failed to be ready within timeout period');
}