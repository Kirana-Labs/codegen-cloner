import chalk from 'chalk';
import prompts from 'prompts';
import ora from 'ora';
import { getOldProjects, deleteProject, ProjectInfo, listExistingProjects } from './utils/projects';

export class ProjectPruner {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async pruneAllProjects(): Promise<void> {
    console.log(chalk.blue.bold('🗑️  Force deleting ALL projects\n'));

    const spinner = ora('Scanning for all projects...').start();
    const allProjects = listExistingProjects(this.baseDir);
    spinner.stop();

    if (allProjects.length === 0) {
      console.log(chalk.green('✅ No projects found in the directory.'));
      return;
    }

    console.log(chalk.red.bold(`⚠️  WARNING: This will delete ALL ${allProjects.length} project${allProjects.length === 1 ? '' : 's'}!\n`));

    // Show list of projects to be deleted
    allProjects.forEach((project, index) => {
      const ageText = this.getAgeText(project.lastModified);
      console.log(chalk.gray(`  ${index + 1}. ${project.name} (${ageText})`));
    });

    console.log();

    // Calculate total size
    const totalSize = await this.estimateTotalSize(allProjects);
    if (totalSize) {
      console.log(chalk.blue(`💾 Estimated disk space to be freed: ${totalSize}\n`));
    }

    // Double confirmation for force delete
    const response1 = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: chalk.red(`⚠️  Are you ABSOLUTELY SURE you want to delete ALL ${allProjects.length} project${allProjects.length === 1 ? '' : 's'}?`),
      initial: false
    });

    if (!response1.confirmed) {
      console.log(chalk.yellow('Operation cancelled. No projects were deleted.'));
      return;
    }

    // Second confirmation
    const response2 = await prompts({
      type: 'text',
      name: 'confirmation',
      message: chalk.red(`Type "DELETE ALL" to confirm (this cannot be undone):`),
    });

    if (response2.confirmation !== 'DELETE ALL') {
      console.log(chalk.yellow('Operation cancelled. No projects were deleted.'));
      return;
    }

    // Delete all projects
    console.log(chalk.blue('\nDeleting all projects...\n'));

    let deletedCount = 0;
    let errorCount = 0;
    let freedSpace = 0;

    for (const project of allProjects) {
      const deleteSpinner = ora(`Deleting ${project.name}...`).start();

      try {
        // Get size before deleting
        const projectSize = await this.getProjectSize(project.path);
        await deleteProject(project.path);
        deleteSpinner.succeed(`Deleted ${project.name}`);
        deletedCount++;
        freedSpace += projectSize;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        deleteSpinner.fail(`Failed to delete ${project.name}: ${errorMessage}`);
        errorCount++;
      }
    }

    console.log();

    if (deletedCount > 0) {
      console.log(chalk.green(`✅ Successfully deleted ${deletedCount} project${deletedCount === 1 ? '' : 's'}`));
      console.log(chalk.blue(`💾 Freed up ${this.formatSize(freedSpace)} of disk space`));
    }

    if (errorCount > 0) {
      console.log(chalk.red(`❌ Failed to delete ${errorCount} project${errorCount === 1 ? '' : 's'}`));
    }
  }

  async pruneProjects(): Promise<void> {
    console.log(chalk.blue.bold('🗂️  Pruning old projects\n'));

    const spinner = ora('Scanning for projects older than 2 weeks...').start();
    const oldProjects = getOldProjects(this.baseDir, 14);
    spinner.stop();

    if (oldProjects.length === 0) {
      console.log(chalk.green('✅ No projects older than 2 weeks found.'));
      console.log(chalk.gray('All projects are recently used!\n'));
      return;
    }

    console.log(chalk.yellow(`Found ${oldProjects.length} project${oldProjects.length === 1 ? '' : 's'} older than 2 weeks:\n`));

    // Show list of projects to be deleted
    oldProjects.forEach((project, index) => {
      const ageText = this.getAgeText(project.lastModified);
      console.log(chalk.gray(`  ${index + 1}. ${project.name} (${ageText})`));
    });

    console.log();

    // Calculate total size if possible
    const totalSize = await this.estimateTotalSize(oldProjects);
    if (totalSize) {
      console.log(chalk.blue(`💾 Estimated disk space to be freed: ${totalSize}\n`));
    }

    // Confirmation prompt
    const response = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: chalk.red(`⚠️  Are you sure you want to delete these ${oldProjects.length} project${oldProjects.length === 1 ? '' : 's'}? This cannot be undone.`),
      initial: false
    });

    if (!response.confirmed) {
      console.log(chalk.yellow('Operation cancelled. No projects were deleted.'));
      return;
    }

    // Delete projects
    console.log(chalk.blue('\nDeleting projects...\n'));

    let deletedCount = 0;
    let errorCount = 0;

    for (const project of oldProjects) {
      const deleteSpinner = ora(`Deleting ${project.name}...`).start();

      try {
        await deleteProject(project.path);
        deleteSpinner.succeed(`Deleted ${project.name}`);
        deletedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        deleteSpinner.fail(`Failed to delete ${project.name}: ${errorMessage}`);
        errorCount++;
      }
    }

    console.log();

    if (deletedCount > 0) {
      console.log(chalk.green(`✅ Successfully deleted ${deletedCount} project${deletedCount === 1 ? '' : 's'}`));
    }

    if (errorCount > 0) {
      console.log(chalk.red(`❌ Failed to delete ${errorCount} project${errorCount === 1 ? '' : 's'}`));
    }

    if (totalSize && deletedCount > 0) {
      console.log(chalk.blue(`💾 Freed up approximately ${totalSize} of disk space`));
    }
  }

  private getAgeText(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  private async getProjectSize(projectPath: string): Promise<number> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(`du -sk "${projectPath}"`);
      const sizeKb = parseInt(stdout.split('\t')[0], 10);
      return isNaN(sizeKb) ? 0 : sizeKb * 1024; // Convert to bytes
    } catch {
      return 0;
    }
  }

  private formatSize(bytes: number): string {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    const gb = mb / 1024;

    if (gb >= 1) {
      return `${gb.toFixed(2)}GB`;
    } else if (mb >= 1) {
      return `${Math.round(mb)}MB`;
    } else {
      return `${Math.round(kb)}KB`;
    }
  }

  private async estimateTotalSize(projects: ProjectInfo[]): Promise<string | null> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      let totalSizeKb = 0;

      for (const project of projects) {
        try {
          const { stdout } = await execAsync(`du -sk "${project.path}"`);
          const sizeKb = parseInt(stdout.split('\t')[0], 10);
          if (!isNaN(sizeKb)) {
            totalSizeKb += sizeKb;
          }
        } catch {
          // Skip if can't calculate size for this project
        }
      }

      if (totalSizeKb === 0) {
        return null;
      }

      // Convert to human readable format
      const sizeMb = totalSizeKb / 1024;
      if (sizeMb < 1024) {
        return `${Math.round(sizeMb)}MB`;
      } else {
        const sizeGb = sizeMb / 1024;
        return `${sizeGb.toFixed(1)}GB`;
      }
    } catch {
      return null;
    }
  }
}