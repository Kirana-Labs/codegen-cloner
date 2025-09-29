import chalk from 'chalk';
import prompts from 'prompts';
import { listExistingProjects, openInFileManager, ProjectInfo } from './utils/projects.js';

export class ProjectBrowser {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async browseProjects(): Promise<void> {
    console.log(chalk.blue.bold('🗂️  Browsing existing projects\n'));

    const projects = listExistingProjects(this.baseDir);

    if (projects.length === 0) {
      console.log(chalk.yellow('No projects found in'), chalk.cyan(this.baseDir));
      console.log(chalk.gray('Clone a PR first to create some projects!\n'));
      return;
    }

    console.log(chalk.green(`Found ${projects.length} project${projects.length === 1 ? '' : 's'} in`), chalk.cyan(this.baseDir));

    const choices = projects.map((project, index) => ({
      title: `${project.name}`,
      description: `Modified: ${this.formatDate(project.lastModified)}`,
      value: project
    }));

    // Add option to open the base directory
    choices.push({
      title: chalk.gray('📁 Open projects directory'),
      description: chalk.gray('Open the main projects folder'),
      value: 'base-directory' as any
    });

    const response = await prompts({
      type: 'select',
      name: 'project',
      message: 'Select a project to open:',
      choices,
      initial: 0
    });

    if (response.project === undefined) {
      console.log(chalk.yellow('Operation cancelled.'));
      return;
    }

    try {
      const pathToOpen = response.project === 'base-directory' ? this.baseDir : response.project.path;
      const displayName = response.project === 'base-directory' ? 'projects directory' : response.project.name;

      console.log(chalk.blue(`\nOpening ${displayName} in file manager...`));
      await openInFileManager(pathToOpen);
      console.log(chalk.green(`✅ Opened ${displayName}`));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red(`❌ Failed to open file manager: ${errorMessage}`));
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