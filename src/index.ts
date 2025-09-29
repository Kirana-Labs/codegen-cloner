#!/usr/bin/env node

import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';
import { CodegenCloner } from './workflow';
import { ProjectBrowser } from './project-browser';
import { ProjectPruner } from './project-pruner';
import { EnvEditor } from './env-editor';

const program = new Command();

program
  .name('codegen-cloner')
  .description('CLI tool to clone and setup PR projects from Codegen')
  .version('1.0.0');

// Add prune command
program
  .command('prune')
  .description('Delete projects older than 2 weeks')
  .action(async () => {
    try {
      console.log(chalk.blue.bold('🤖 Codegen Cloner v1.0.0\n'));

      const defaultDir = join(homedir(), 'codegen-projects');
      const pruner = new ProjectPruner(defaultDir);
      await pruner.pruneProjects();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red.bold(`\n❌ Fatal error: ${errorMessage}`));
      process.exit(1);
    }
  });

// Add env command
program
  .command('env')
  .description('Edit .env file for a project')
  .action(async () => {
    try {
      console.log(chalk.blue.bold('🤖 Codegen Cloner v1.0.0\n'));

      const defaultDir = join(homedir(), 'codegen-projects');
      const envEditor = new EnvEditor(defaultDir);
      await envEditor.editProjectEnv();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red.bold(`\n❌ Fatal error: ${errorMessage}`));
      process.exit(1);
    }
  });

program
  .argument('[pr-url]', 'GitHub PR URL')
  .action(async (prUrl: string | undefined) => {
    try {
      console.log(chalk.blue.bold('🤖 Codegen Cloner v1.0.0\n'));

      const defaultDir = join(homedir(), 'codegen-projects');

      let url = prUrl;

      // If no PR URL provided, show options
      if (!url) {
        const response = await prompts({
          type: 'select',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { title: '🆕 Clone a new PR', description: 'Enter a GitHub PR URL to clone and setup', value: 'clone' },
            { title: '📂 Browse existing projects', description: 'View and open existing cloned projects', value: 'browse' }
          ],
          initial: 0
        });

        if (response.action === undefined) {
          console.log(chalk.yellow('Operation cancelled.'));
          process.exit(0);
        }

        if (response.action === 'browse') {
          const browser = new ProjectBrowser(defaultDir);
          await browser.browseProjects();
          return;
        }

        // If they chose clone, prompt for PR URL
        const urlResponse = await prompts({
          type: 'text',
          name: 'url',
          message: 'Enter GitHub PR URL:',
          validate: (value: string) => {
            if (!value) return 'PR URL is required';
            if (!value.includes('github.com') || !value.includes('/pull/')) {
              return 'Invalid GitHub PR URL format';
            }
            return true;
          }
        });

        if (!urlResponse.url) {
          console.log(chalk.yellow('Operation cancelled.'));
          process.exit(0);
        }

        url = urlResponse.url;
      }

      const cloner = new CodegenCloner(defaultDir);
      await cloner.run(url!);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red.bold(`\n❌ Fatal error: ${errorMessage}`));
      process.exit(1);
    }
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red.bold('Unhandled Rejection at:'), promise, chalk.red.bold('reason:'), reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red.bold('Uncaught Exception:'), error);
  process.exit(1);
});

program.parse();