# PowerShell installation script for Windows
param(
    [string]$InstallDir = "$env:USERPROFILE\bin"
)

# Repository information
$RepoOwner = "Kirana-Labs"
$RepoName = "codegen-cloner"
$BinaryName = "codegen-cloner"

# Colors for output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")

    switch ($Color) {
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Blue" { Write-Host $Message -ForegroundColor Blue }
        "Cyan" { Write-Host $Message -ForegroundColor Cyan }
        default { Write-Host $Message }
    }
}

# Detect architecture
function Get-Architecture {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64" { return "x64" }
        "ARM64" { return "arm64" }
        default {
            Write-ColorOutput "Error: Unsupported architecture: $arch" "Red"
            exit 1
        }
    }
}

# Get latest release information
function Get-LatestRelease {
    Write-ColorOutput "🔍 Fetching latest release information..." "Blue"

    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/releases/latest"
        return $response.tag_name
    }
    catch {
        Write-ColorOutput "Error: Could not fetch latest release information" "Red"
        exit 1
    }
}

# Download and install binary
function Install-Binary {
    param([string]$Version, [string]$Architecture)

    $BinaryFile = "$BinaryName-win-$Architecture.exe"
    $DownloadUrl = "https://github.com/$RepoOwner/$RepoName/releases/download/$Version/$BinaryFile"

    Write-ColorOutput "📥 Downloading $BinaryFile..." "Blue"

    # Create installation directory
    if (!(Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $InstallPath = Join-Path $InstallDir "$BinaryName.exe"

    try {
        # Download binary
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $InstallPath
        Write-ColorOutput "📦 Installing to $InstallPath..." "Blue"
        Write-ColorOutput "✅ Successfully installed $BinaryName to $InstallPath" "Green"
        return $InstallPath
    }
    catch {
        Write-ColorOutput "Error: Failed to download or install binary" "Red"
        Write-ColorOutput "URL: $DownloadUrl" "Yellow"
        exit 1
    }
}

# Check and update PATH
function Update-Path {
    param([string]$InstallDirectory)

    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")

    if ($currentPath -notlike "*$InstallDirectory*") {
        Write-ColorOutput "⚠️  Adding $InstallDirectory to your PATH..." "Yellow"
        $newPath = "$currentPath;$InstallDirectory"
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        $env:PATH = "$env:PATH;$InstallDirectory"
        Write-ColorOutput "✅ Updated PATH environment variable" "Green"
        Write-ColorOutput "   You may need to restart your terminal for the changes to take effect" "Yellow"
    } else {
        Write-ColorOutput "✅ $InstallDirectory is already in your PATH" "Green"
    }
}

# Test installation
function Test-Installation {
    try {
        $version = & "$InstallDir\$BinaryName.exe" --version 2>$null
        Write-ColorOutput "✅ $BinaryName is working correctly" "Green"
        Write-ColorOutput "🚀 You can now run: $BinaryName" "Blue"
        return $true
    }
    catch {
        Write-ColorOutput "⚠️  Installation completed but binary test failed" "Yellow"
        Write-ColorOutput "   Try restarting your terminal" "Yellow"
        return $false
    }
}

# Show usage information
function Show-Usage {
    Write-ColorOutput ""
    Write-ColorOutput "╭─────────────────────────────────────╮" "Blue"
    Write-ColorOutput "│       Codegen Cloner Installed     │" "Blue"
    Write-ColorOutput "╰─────────────────────────────────────╯" "Blue"
    Write-ColorOutput ""
    Write-ColorOutput "Usage:" "Green"
    Write-ColorOutput "  $BinaryName                          # Interactive mode"
    Write-ColorOutput "  $BinaryName <pr-url>                 # Clone specific PR"
    Write-ColorOutput "  $BinaryName env                      # Edit project .env files"
    Write-ColorOutput "  $BinaryName prune                    # Clean up old projects"
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" "Blue"
    Write-ColorOutput "  $BinaryName https://github.com/owner/repo/pull/123"
    Write-ColorOutput "  $BinaryName env"
    Write-ColorOutput ""
    Write-ColorOutput "For more information, visit: https://github.com/$RepoOwner/$RepoName" "Yellow"
}

# Main installation flow
function Main {
    Write-ColorOutput ""
    Write-ColorOutput "╭─────────────────────────────────────╮" "Blue"
    Write-ColorOutput "│      Codegen Cloner Installer      │" "Blue"
    Write-ColorOutput "╰─────────────────────────────────────╯" "Blue"
    Write-ColorOutput ""

    $architecture = Get-Architecture
    Write-ColorOutput "Detected platform: Windows-$architecture" "Green"

    $latestVersion = Get-LatestRelease
    Write-ColorOutput "Latest version: $latestVersion" "Green"

    $installPath = Install-Binary -Version $latestVersion -Architecture $architecture
    Update-Path -InstallDirectory $InstallDir
    Test-Installation
    Show-Usage

    Write-ColorOutput "🎉 Installation complete!" "Green"
}

# Run installer
Main