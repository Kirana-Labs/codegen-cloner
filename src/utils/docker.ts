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
    throw new Error('Please install OrbStack manually from https://orbstack.dev/download');
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
    // Check which Docker provider is installed and try to start it
    const hasOrbStack = await checkIfAppExists('/Applications/OrbStack.app');
    const hasDockerDesktop = await checkIfAppExists('/Applications/Docker.app');

    if (hasOrbStack) {
      try {
        await execAsync('open -a OrbStack');
        await waitForDocker();
        return;
      } catch (error) {
        // OrbStack failed to start, try Docker Desktop if available
        if (hasDockerDesktop) {
          try {
            await execAsync('open /Applications/Docker.app');
            await waitForDocker();
            return;
          } catch {
            // Both failed
          }
        }
      }
    } else if (hasDockerDesktop) {
      try {
        await execAsync('open /Applications/Docker.app');
        await waitForDocker();
        return;
      } catch {
        // Docker Desktop failed to start
      }
    }

    // Check if Docker is running via other means
    if (await isDockerRunning()) {
      return;
    }

    // Nothing worked
    throw new Error('Docker is not running and could not be started. Please install OrbStack (https://orbstack.dev/download) or Docker Desktop and ensure it can start.');
  } else if (platform === 'linux') {
    await execAsync('sudo systemctl start docker');
    await waitForDocker();
  } else {
    throw new Error('Docker must be started manually on Windows');
  }
}

async function checkIfAppExists(appPath: string): Promise<boolean> {
  try {
    await execAsync(`test -d "${appPath}"`);
    return true;
  } catch {
    return false;
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
    await waitForPostgres(projectPath);
  } catch (error) {
    throw new Error(`Failed to start PostgreSQL container: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function waitForPostgres(projectPath: string, timeoutMs: number = 180000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Use docker compose exec instead of docker exec to handle container naming automatically
      await execAsync('docker compose exec -T db pg_isready -U postgres', { cwd: projectPath });
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error('PostgreSQL failed to be ready within timeout period');
}