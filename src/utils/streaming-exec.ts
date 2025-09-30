import { spawn } from 'child_process';
import chalk from 'chalk';

interface StreamingExecOptions {
  cwd?: string;
  maxLines?: number;
  showOutput?: boolean;
}

export class StreamingExecutor {
  private outputBuffer: string[] = [];
  private maxLines: number;
  private currentSpinner: any = null;

  constructor(maxLines: number = 10) {
    this.maxLines = maxLines;
  }

  private addToBuffer(line: string) {
    this.outputBuffer.push(line);
    if (this.outputBuffer.length > this.maxLines) {
      this.outputBuffer.shift();
    }
  }

  private updateDisplay(command: string) {
    if (this.currentSpinner) {
      // Clear current spinner
      this.currentSpinner.stop();
    }

    // Move cursor up to clear previous output
    if (this.outputBuffer.length > 0) {
      process.stdout.write(`\u001B[${this.outputBuffer.length + 1}A`);
      process.stdout.write('\u001B[0J'); // Clear from cursor to end of screen
    }

    // Show command being executed
    console.log(chalk.blue(`▶ ${command}`));

    // Show buffered output
    this.outputBuffer.forEach(line => {
      console.log(chalk.gray(`  ${line}`));
    });
  }

  private clearDisplay() {
    if (this.outputBuffer.length > 0) {
      // Move cursor up and clear the output
      process.stdout.write(`\u001B[${this.outputBuffer.length + 1}A`);
      process.stdout.write('\u001B[0J');
    }
    this.outputBuffer = [];
  }

  async execute(command: string, args: string[] = [], options: StreamingExecOptions = {}): Promise<void> {
    const { cwd, showOutput = true } = options;

    return new Promise((resolve, reject) => {
      this.outputBuffer = [];

      const child = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let hasOutput = false;

      const processOutput = (data: Buffer, isError: boolean = false) => {
        const lines = data.toString().split('\n').filter(line => line.trim());

        lines.forEach(line => {
          this.addToBuffer(line.trim());
          hasOutput = true;
        });

        if (showOutput && hasOutput) {
          this.updateDisplay(`${command} ${args.join(' ')}`);
        }
      };

      child.stdout?.on('data', (data) => processOutput(data));
      child.stderr?.on('data', (data) => processOutput(data, true));

      child.on('close', (code) => {
        if (showOutput) {
          this.clearDisplay();
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        if (showOutput) {
          this.clearDisplay();
        }
        reject(error);
      });
    });
  }

  async executeWithSpinner(
    command: string,
    args: string[] = [],
    spinnerText: string,
    options: StreamingExecOptions = {}
  ): Promise<void> {
    const ora = require('ora');
    const spinner = ora(spinnerText).start();
    this.currentSpinner = spinner;

    try {
      await this.execute(command, args, { ...options, showOutput: true });
      spinner.succeed(spinnerText);
    } catch (error) {
      spinner.fail(`${spinnerText} - Failed`);
      throw error;
    } finally {
      this.currentSpinner = null;
    }
  }
}

// Convenience function for one-off executions
export async function executeWithStreaming(
  command: string,
  args: string[] = [],
  spinnerText: string,
  options: StreamingExecOptions = {}
): Promise<void> {
  const executor = new StreamingExecutor();
  await executor.executeWithSpinner(command, args, spinnerText, options);
}