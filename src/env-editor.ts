import chalk from 'chalk';
import prompts from 'prompts';
import { existsSync } from 'fs';
import { join } from 'path';
import { listExistingProjects, openInTextEditor } from './utils/projects';

export class EnvEditor {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async editProjectEnv(): Promise<void> {
    console.log(chalk.blue.bold('📝 Edit Project Environment File\n'));

    const projects = listExistingProjects(this.baseDir);

    if (projects.length === 0) {
      console.log(chalk.yellow('No projects found in'), chalk.cyan(this.baseDir));
      console.log(chalk.gray('Clone a PR first to create some projects!\n'));
      return;
    }

    console.log(chalk.green(`Found ${projects.length} project${projects.length === 1 ? '' : 's'} in`), chalk.cyan(this.baseDir));

    const choices = projects.map((project) => ({
      title: `${project.name}`,
      description: `Modified: ${this.formatDate(project.lastModified)}`,
      value: project
    }));

    const response = await prompts({
      type: 'select',
      name: 'project',
      message: 'Select a project to edit its .env file:',
      choices,
      initial: 0
    });

    if (response.project === undefined) {
      console.log(chalk.yellow('Operation cancelled.'));
      return;
    }

    const envPath = join(response.project.path, '.env');

    // Check if .env file exists
    if (!existsSync(envPath)) {
      console.log(chalk.yellow(`\n⚠️  No .env file found in ${response.project.name}`));

      // Check if .env.example exists
      const envExamplePath = join(response.project.path, '.env.example');
      if (existsSync(envExamplePath)) {
        const createResponse = await prompts({
          type: 'confirm',
          name: 'createEnv',
          message: 'Would you like to create .env from .env.example?',
          initial: true
        });

        if (createResponse.createEnv) {
          try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            await execAsync(`cp "${envExamplePath}" "${envPath}"`);
            console.log(chalk.green('✅ Created .env file from .env.example'));
          } catch (error) {
            console.error(chalk.red('❌ Failed to create .env file:', error instanceof Error ? error.message : 'Unknown error'));
            return;
          }
        } else {
          console.log(chalk.yellow('Operation cancelled.'));
          return;
        }
      } else {
        const createEmptyResponse = await prompts({
          type: 'confirm',
          name: 'createEmpty',
          message: 'Would you like to create an empty .env file?',
          initial: true
        });

        if (createEmptyResponse.createEmpty) {
          try {
            const { writeFileSync } = await import('fs');
            writeFileSync(envPath, '# Environment variables\n# Add your configuration here\n\n');
            console.log(chalk.green('✅ Created empty .env file'));
          } catch (error) {
            console.error(chalk.red('❌ Failed to create .env file:', error instanceof Error ? error.message : 'Unknown error'));
            return;
          }
        } else {
          console.log(chalk.yellow('Operation cancelled.'));
          return;
        }
      }
    }

    try {
      console.log(chalk.blue(`\nOpening .env file for ${response.project.name} in text editor...\n`));
      console.log(chalk.gray(`File path: ${envPath}`));

      await openInTextEditor(envPath);
      console.log(chalk.green(`✅ Opened .env file in text editor`));

      console.log(chalk.cyan('\n💡 Tips:'));
      console.log(chalk.gray('• Save the file when done editing'));
      console.log(chalk.gray('• Restart your development server to apply changes'));
      console.log(chalk.gray('• Never commit sensitive data like API keys to version control'));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red(`❌ Failed to open .env file: ${errorMessage}`));

      // Provide fallback instructions
      console.log(chalk.yellow(`\n💡 Fallback: You can manually edit the file at:`));
      console.log(chalk.cyan(envPath));
    }
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}