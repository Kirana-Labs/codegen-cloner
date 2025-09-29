# Codegen Cloner

A CLI tool that helps PMs clone and setup PR projects from Codegen quickly and efficiently.

## Features

- 🔍 **Smart Project Detection**: Checks if a project already exists and updates it if needed
- 🔧 **Automatic Tool Installation**: Installs Docker and pnpm if missing
- 🐘 **PostgreSQL Management**: Automatically starts PostgreSQL in Docker
- 📦 **Dependency Management**: Runs `pnpm install` and `pnpm seed`
- 🚀 **Development Server**: Starts the project with `pnpm dev`
- 📂 **Project Browser**: Browse and open existing cloned projects
- 🎨 **Beautiful CLI**: Colorful output with progress indicators
- 🖥️ **Cross-Platform**: Works on macOS, Windows, and Linux

## Installation

### Quick Install (Recommended)

**macOS & Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/Kirana-Labs/codegen-cloner/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/Kirana-Labs/codegen-cloner/main/install.ps1'))
```

### Manual Installation

1. Download the binary for your platform from the [latest release](https://github.com/Kirana-Labs/codegen-cloner/releases/latest)
2. Make it executable and move to your PATH:

**macOS/Linux:**
```bash
chmod +x codegen-cloner-*
sudo mv codegen-cloner-* /usr/local/bin/codegen-cloner
```

**Windows:**
```powershell
# Move to a directory in your PATH
Move-Item codegen-cloner-win-*.exe C:\Windows\System32\codegen-cloner.exe
```

### Development Installation

1. Clone this repository:
```bash
git clone https://github.com/Kirana-Labs/codegen-cloner.git
cd codegen-cloner
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Run locally:
```bash
npm start
```

### Building Binaries

To build binaries for all platforms:
```bash
npm run build:all
```

This creates binaries in the `binaries/` directory for:
- Linux x64
- macOS x64 (Intel)
- macOS ARM64 (Apple Silicon)
- Windows x64

## Usage

### Basic Usage

```bash
# Clone a specific PR
codegen-cloner https://github.com/owner/repo/pull/123

# Interactive mode - choose to clone new PR or browse existing projects
codegen-cloner

# Clean up old projects (older than 2 weeks)
codegen-cloner prune

# Edit .env file for a project
codegen-cloner env
```

### Project Browsing

When you run `codegen-cloner` without arguments, you can:

1. **🆕 Clone a new PR** - Enter a GitHub PR URL to clone and setup
2. **📂 Browse existing projects** - View all previously cloned projects

The project browser shows:
- All projects in your `~/codegen-projects` directory
- Last modified dates (Today, Yesterday, X days ago, etc.)
- Option to open any project in your file manager (Finder/Explorer/file browser)
- Option to open the main projects directory

### Project Cleanup

The `prune` command helps you clean up disk space by removing old, unused projects:

```bash
codegen-cloner prune
```

**What it does:**
- Scans for projects older than 2 weeks (based on last modified date)
- Shows you exactly which projects will be deleted
- Displays estimated disk space to be freed
- Asks for confirmation before deleting (destructive operation)
- Provides detailed progress and results

**Safety features:**
- ✅ Shows preview before deletion
- ✅ Requires explicit confirmation
- ✅ Handles errors gracefully
- ✅ Reports success/failure for each project

### Environment File Editing

The `env` command provides an easy way for PMs to edit environment variables:

```bash
codegen-cloner env
```

**What it does:**
- Shows a list of all your cloned projects
- Lets you select which project's .env file to edit
- Opens the .env file in your preferred text editor
- Creates .env from .env.example if it doesn't exist
- Can create an empty .env file if needed

**Cross-platform editor support:**
- **macOS**: VS Code → TextEdit (fallback)
- **Windows**: VS Code → Notepad (fallback)
- **Linux**: VS Code → nano → vim → gedit → xdg-open

**Safety features:**
- ✅ Provides helpful tips about environment variables
- ✅ Shows full file path for manual editing if needed
- ✅ Warns about not committing sensitive data
- ✅ Graceful fallbacks if preferred editor isn't available

### What it does

1. **Parses the GitHub PR URL** to extract owner, repo, and PR number
2. **Fetches the PR branch** from GitHub API
3. **Checks if the project exists** in the specified directory
   - If it exists: pulls latest changes
   - If it doesn't: clones the repository
4. **Ensures Docker is installed and running**
   - Installs Docker if missing (Linux only, manual install required for macOS/Windows)
   - Starts Docker daemon if not running
5. **Ensures pnpm is installed**
   - Installs pnpm globally if missing
6. **Sets up environment file**
   - Copies `.env.example` to `.env` if it doesn't exist
   - Skips if no `.env.example` file is found
7. **Starts PostgreSQL with docker-compose**
   - Runs `docker compose up -d db` in the project directory
   - Uses the project's existing docker-compose.yml configuration
8. **Installs project dependencies** with `pnpm install`
9. **Runs seed data** with `pnpm seed` (optional, skips if not available)
10. **Starts development server** with `pnpm dev`

## Configuration

The tool uses sensible defaults - no configuration needed:

- **Project directory**: `~/codegen-projects` (created automatically)
- **PostgreSQL**: Uses project's `docker-compose.yml` to start the `db` service

## Requirements

- Node.js 18+
- Git with configured authentication (SSH keys or HTTPS credentials)
- Internet connection

## Troubleshooting

### macOS: "killed" or Security Warning

If you see `[1] killed codegen-cloner` or a security warning, macOS Gatekeeper is blocking the unsigned binary. Fix this by:

1. **Allow the binary to run:**
   ```bash
   sudo xattr -d com.apple.quarantine $(which codegen-cloner)
   ```

2. **Or go to System Preferences:**
   - System Preferences → Security & Privacy → General
   - Click "Allow Anyway" next to the blocked app message

3. **Or reinstall** (the installer now automatically removes quarantine):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/Kirana-Labs/codegen-cloner/main/install.sh | bash
   ```

### Windows: "Windows protected your PC"

If Windows Defender blocks the binary:

1. Click "More info"
2. Click "Run anyway"
3. Or add an exclusion in Windows Defender settings

### Command Not Found

If `codegen-cloner` command is not found:

1. **Check if it's in your PATH:**
   ```bash
   echo $PATH
   ```

2. **Add to PATH manually:**
   ```bash
   export PATH="$HOME/bin:$PATH"
   # Add to ~/.bashrc or ~/.zshrc to make permanent
   ```

3. **Verify installation location:**
   ```bash
   which codegen-cloner
   ls -la $(which codegen-cloner)
   ```

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Start built version
npm start
```

## Error Handling

The tool provides clear error messages and handles common scenarios:
- Invalid GitHub PR URLs
- Network connectivity issues
- Missing system requirements
- Git repository problems
- Docker/PostgreSQL startup issues

## License

MIT