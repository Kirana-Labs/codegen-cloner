import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProjectInfo {
  name: string;
  path: string;
  lastModified: Date;
}

export function listExistingProjects(baseDir: string): ProjectInfo[] {
  if (!existsSync(baseDir)) {
    return [];
  }

  try {
    const entries = readdirSync(baseDir);
    const projects: ProjectInfo[] = [];

    for (const entry of entries) {
      const fullPath = join(baseDir, entry);

      try {
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
          projects.push({
            name: entry,
            path: fullPath,
            lastModified: stats.mtime
          });
        }
      } catch {
        // Skip entries that can't be accessed
        continue;
      }
    }

    // Sort by most recently modified first
    return projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

  } catch {
    return [];
  }
}

export function getOldProjects(baseDir: string, maxAgeInDays: number = 14): ProjectInfo[] {
  const projects = listExistingProjects(baseDir);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

  return projects.filter(project => project.lastModified < cutoffDate);
}

export async function deleteProject(projectPath: string): Promise<void> {
  try {
    await execAsync(`rm -rf "${projectPath}"`);
  } catch (error) {
    throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function openInTextEditor(filePath: string): Promise<void> {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      // macOS - try VS Code first, then TextEdit as fallback
      try {
        await execAsync(`code "${filePath}"`);
      } catch {
        await execAsync(`open -t "${filePath}"`);
      }
    } else if (platform === 'win32') {
      // Windows - try VS Code first, then notepad as fallback
      try {
        await execAsync(`code "${filePath}"`);
      } catch {
        await execAsync(`notepad "${filePath}"`);
      }
    } else {
      // Linux - try various editors in order of preference
      const editors = ['code', 'nano', 'vim', 'gedit', 'xdg-open'];

      for (const editor of editors) {
        try {
          if (editor === 'nano' || editor === 'vim') {
            // For terminal editors, we need to spawn them differently
            const { spawn } = await import('child_process');
            console.log(`Opening ${filePath} with ${editor}...`);

            return new Promise<void>((resolve, reject) => {
              const child = spawn(editor, [filePath], { stdio: 'inherit' });
              child.on('exit', (code) => {
                if (code === 0) {
                  resolve();
                } else {
                  reject(new Error(`${editor} exited with code ${code}`));
                }
              });
              child.on('error', reject);
            });
          } else {
            await execAsync(`${editor} "${filePath}"`);
            return;
          }
        } catch {
          continue;
        }
      }

      throw new Error('No suitable text editor found');
    }
  } catch (error) {
    throw new Error(`Failed to open text editor: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function openInFileManager(path: string): Promise<void> {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      // macOS - open in Finder
      await execAsync(`open "${path}"`);
    } else if (platform === 'win32') {
      // Windows - open in Explorer
      await execAsync(`start "" "${path}"`);
    } else {
      // Linux - try xdg-open
      await execAsync(`xdg-open "${path}"`);
    }
  } catch (error) {
    throw new Error(`Failed to open file manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}