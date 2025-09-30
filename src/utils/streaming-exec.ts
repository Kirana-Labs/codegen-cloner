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
    const hadSpinner = !!this.currentSpinner;
    
    if (this.currentSpinner) {
      // Clear current spinner
      this.currentSpinner.stop();
    }

    // Only do cursor manipulation if there was no spinner
    // (spinner handles its own cursor positioning)
    if (!hadSpinner && this.outputBuffer.length > 0) {
      // Move cursor up to clear previous output
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
        stdio: ['ignore', 'pipe', 'pipe'],  // Use 'ignore' for stdin to prevent hanging
        detached: false
      });

      let hasOutput = false;
      let resolved = false;
      let lastDisplayUpdate = 0;
      const DISPLAY_THROTTLE_MS = 100; // Only update display every 100ms
      
      // Overall timeout to prevent infinite hangs (30 seconds)
      const overallTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          if (showOutput) {
            this.clearDisplay();
          }
          reject(new Error(`Command timed out after 30 seconds: ${command} ${args.join(' ')}`));
        }
      }, 30000);

      const processOutput = (data: Buffer, isError: boolean = false) => {
        const lines = data.toString().split('\n').filter(line => line.trim());

        lines.forEach(line => {
          this.addToBuffer(line.trim());
          hasOutput = true;
        });

        // Throttle display updates to avoid excessive cursor movements
        // Only show live updates when there's no spinner (to avoid duplication)
        if (showOutput && hasOutput && !this.currentSpinner) {
          const now = Date.now();
          if (now - lastDisplayUpdate >= DISPLAY_THROTTLE_MS) {
            this.updateDisplay(`${command} ${args.join(' ')}`);
            lastDisplayUpdate = now;
          }
        }
      };

      // Set up handlers for stream end
      // Initialize as true if streams don't exist
      let stdoutEnded = !child.stdout;
      let stderrEnded = !child.stderr;
      let processExited = false;
      let exitCode: number | null = null;
      
      const checkCompletion = () => {
        // Only resolve when process has exited AND both streams have ended
        if (processExited && stdoutEnded && stderrEnded && !resolved) {
          resolved = true;
          clearTimeout(overallTimeout);
          
          // Don't clear display when showOutput is true - let the spinner handle it
          if (!showOutput) {
            this.clearDisplay();
          }

          if (exitCode === 0 || exitCode === null) {
            resolve();
          } else {
            const errorOutput = this.outputBuffer.length > 0 
              ? `\n${this.outputBuffer.join('\n')}` 
              : '';
            reject(new Error(`Command failed with exit code ${exitCode}${errorOutput}`));
          }
        }
      };
      
      if (child.stdout) {
        child.stdout.on('data', (data) => processOutput(data));
        child.stdout.on('end', () => {
          stdoutEnded = true;
          checkCompletion();
        });
      }
      
      if (child.stderr) {
        child.stderr.on('data', (data) => processOutput(data, true));
        child.stderr.on('end', () => {
          stderrEnded = true;
          checkCompletion();
        });
      }

      // Handle process exit - fires when process terminates
      child.on('exit', (code) => {
        processExited = true;
        exitCode = code;
        
        // Set a timeout to force completion if streams don't close
        setTimeout(() => {
          if (!resolved) {
            stdoutEnded = true;
            stderrEnded = true;
            checkCompletion();
          }
        }, 100);
        
        checkCompletion();
      });

      child.on('error', (error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(overallTimeout);

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