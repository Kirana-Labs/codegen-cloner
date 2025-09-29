import chalk from 'chalk';
import ora from 'ora';
import { parsePRUrl, fetchPRBranch } from './utils/github.js';
import { getProjectPath, checkProjectExists, ensureDirectoryExists, isGitRepo, getCurrentBranch } from './utils/filesystem.js';
import { cloneRepository, pullLatestChanges, isRepositoryUpToDate } from './utils/git.js';
import { isDockerInstalled, installDocker, isDockerRunning, startDocker, isPostgresContainerRunning, startPostgresContainer } from './utils/docker.js';
import { isPnpmInstalled, installPnpm, runPnpmInstall, runPnpmSeed, runPnpmDev } from './utils/pnpm.js';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PRInfo } from './types.js';

const execAsync = promisify(exec);

export class CodegenCloner {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async run(prUrl: string): Promise<void> {
    console.log(chalk.blue.bold('🚀 Starting Codegen Cloner workflow\n'));

    try {
      // Step 1: Parse PR URL
      const spinner = ora('Parsing PR URL...').start();
      const prInfo = parsePRUrl(prUrl);
      spinner.succeed(`Parsed PR: ${prInfo.owner}/${prInfo.repo}#${prInfo.prNumber}`);

      // Step 2: Fetch PR branch
      spinner.start('Fetching PR branch information...');
      prInfo.branch = await fetchPRBranch(prInfo);
      spinner.succeed(`Branch: ${prInfo.branch}`);

      // Step 3: Check project directory
      const projectPath = getProjectPath(this.baseDir, prInfo);
      const projectStatus = checkProjectExists(projectPath);

      if (projectStatus.exists) {
        spinner.start('Checking if project is up to date...');
        if (await isGitRepo(projectPath)) {
          const currentBranch = await getCurrentBranch(projectPath);
          if (currentBranch === prInfo.branch) {
            const isUpToDate = await isRepositoryUpToDate(projectPath, prInfo.branch);
            if (!isUpToDate) {
              spinner.text = 'Pulling latest changes...';
              await pullLatestChanges(projectPath, prInfo.branch);
              spinner.succeed('Project updated with latest changes');
            } else {
              spinner.succeed('Project is up to date');
            }
          } else {
            spinner.text = 'Switching to PR branch and pulling latest changes...';
            await pullLatestChanges(projectPath, prInfo.branch);
            spinner.succeed('Switched to PR branch and updated');
          }
        } else {
          spinner.fail('Project directory exists but is not a git repository');
          return;
        }
      } else {
        // Step 4: Clone repository
        spinner.start('Cloning repository...');
        ensureDirectoryExists(this.baseDir);
        await cloneRepository(prInfo, projectPath);
        spinner.succeed(`Repository cloned to ${projectPath}`);
      }

      // Step 5: Check Docker installation
      await this.ensureDockerReady();

      // Step 6: Check pnpm installation
      await this.ensurePnpmReady();

      // Step 7: Setup environment file
      await this.setupEnvironmentFile(projectPath);

      // Step 8: Start PostgreSQL
      await this.ensurePostgresReady(projectPath);

      // Step 9: Install dependencies
      spinner.start('Installing project dependencies...');
      await runPnpmInstall(projectPath);
      spinner.succeed('Dependencies installed');

      // Step 10: Run seed data
      spinner.start('Running seed data...');
      try {
        await runPnpmSeed(projectPath);
        spinner.succeed('Seed data completed');
      } catch (error) {
        spinner.warn('Seed script not found or failed - skipping');
      }

      // Step 11: Start development server
      console.log(chalk.green.bold('\n✅ Setup complete! Starting development server...\n'));
      console.log(chalk.yellow('Press Ctrl+C to stop the development server\n'));

      await runPnpmDev(projectPath);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red.bold(`\n❌ Error: ${errorMessage}`));
      process.exit(1);
    }
  }

  private async ensureDockerReady(): Promise<void> {
    const spinner = ora('Checking Docker installation...').start();

    if (!(await isDockerInstalled())) {
      spinner.text = 'Installing Docker...';
      try {
        await installDocker();
        spinner.succeed('Docker installed');
      } catch (error) {
        spinner.fail(`Docker installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }
    } else {
      spinner.succeed('Docker is installed');
    }

    spinner.start('Checking if Docker is running...');
    if (!(await isDockerRunning())) {
      spinner.text = 'Starting Docker...';
      try {
        await startDocker();
        spinner.succeed('Docker started');
      } catch (error) {
        spinner.fail(`Failed to start Docker: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return;
      }
    } else {
      spinner.succeed('Docker is running');
    }
  }

  private async ensurePnpmReady(): Promise<void> {
    const spinner = ora('Checking pnpm installation...').start();

    if (!(await isPnpmInstalled())) {
      spinner.text = 'Installing pnpm...';
      await installPnpm();
      spinner.succeed('pnpm installed');
    } else {
      spinner.succeed('pnpm is installed');
    }
  }

  private async setupEnvironmentFile(projectPath: string): Promise<void> {
    const spinner = ora('Setting up environment file...').start();

    const envExamplePath = `${projectPath}/.env.example`;
    const envPath = `${projectPath}/.env`;

    if (existsSync(envExamplePath)) {
      if (!existsSync(envPath)) {
        spinner.text = 'Copying .env.example to .env...';
        await execAsync(`cp "${envExamplePath}" "${envPath}"`);
        spinner.succeed('Environment file created from .env.example');
      } else {
        spinner.succeed('Environment file already exists');
      }
    } else {
      spinner.warn('No .env.example file found - skipping');
    }
  }

  private async ensurePostgresReady(projectPath: string): Promise<void> {
    const spinner = ora('Checking PostgreSQL container...').start();

    if (!(await isPostgresContainerRunning())) {
      spinner.text = 'Starting PostgreSQL container with docker-compose...';
      await startPostgresContainer(projectPath);
      spinner.succeed('PostgreSQL container started');
    } else {
      spinner.succeed('PostgreSQL container is running');
    }
  }
}