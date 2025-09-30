#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Repository information
REPO_OWNER="Kirana-Labs"
REPO_NAME="codegen-cloner"
GITHUB_REPO="https://github.com/${REPO_OWNER}/${REPO_NAME}"
BINARY_NAME="codegen-cloner"

# Detect OS and architecture
detect_platform() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)

    case $os in
        linux*)
            OS="linux"
            ;;
        darwin*)
            OS="macos"
            ;;
        mingw*|cygwin*|msys*)
            OS="win"
            ;;
        *)
            echo -e "${RED}Error: Unsupported operating system: $os${NC}"
            exit 1
            ;;
    esac

    case $arch in
        x86_64|amd64)
            ARCH="x64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            echo -e "${RED}Error: Unsupported architecture: $arch${NC}"
            exit 1
            ;;
    esac

    # Construct binary name
    if [ "$OS" = "win" ]; then
        BINARY_FILE="${BINARY_NAME}-${OS}-${ARCH}.exe"
    else
        BINARY_FILE="${BINARY_NAME}-${OS}-${ARCH}"
    fi
}

# Get latest release info from GitHub
get_latest_release() {
    echo -e "${BLUE}🔍 Fetching latest release information...${NC}"

    # Try to get latest release tag
    LATEST_TAG=$(curl -s "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest" | grep -o '"tag_name": "[^"]*' | cut -d'"' -f4)

    if [ -z "$LATEST_TAG" ]; then
        echo -e "${RED}Error: Could not fetch latest release information${NC}"
        exit 1
    fi

    DOWNLOAD_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${LATEST_TAG}/${BINARY_FILE}"
    echo -e "${GREEN}Latest version: ${LATEST_TAG}${NC}"
}

# Download and install binary
install_binary() {
    echo -e "${BLUE}📥 Downloading ${BINARY_FILE}...${NC}"

    # Create temporary directory
    TMP_DIR=$(mktemp -d)
    cd "$TMP_DIR"

    # Download binary
    if ! curl -L -o "$BINARY_NAME" "$DOWNLOAD_URL"; then
        echo -e "${RED}Error: Failed to download binary${NC}"
        echo -e "${YELLOW}URL: $DOWNLOAD_URL${NC}"
        exit 1
    fi

    # Make binary executable
    chmod +x "$BINARY_NAME"

    # Determine installation directory
    if [ "$OS" = "win" ]; then
        # Windows: try to install to a directory in PATH
        INSTALL_DIR="$HOME/bin"
        mkdir -p "$INSTALL_DIR"
        INSTALL_PATH="$INSTALL_DIR/${BINARY_NAME}.exe"
    else
        # Unix-like: try /usr/local/bin first, fallback to ~/bin
        if [ -w "/usr/local/bin" ]; then
            INSTALL_DIR="/usr/local/bin"
        else
            INSTALL_DIR="$HOME/bin"
            mkdir -p "$INSTALL_DIR"
        fi
        INSTALL_PATH="$INSTALL_DIR/$BINARY_NAME"
    fi

    # Check if binary already exists and get current version
    CURRENT_VERSION=""
    if [ -f "$INSTALL_PATH" ]; then
        CURRENT_VERSION=$("$INSTALL_PATH" --version 2>/dev/null || echo "unknown")
        echo -e "${BLUE}📦 Updating existing installation (v${CURRENT_VERSION} → ${LATEST_TAG})...${NC}"
    else
        echo -e "${BLUE}📦 Installing to ${INSTALL_PATH}...${NC}"
    fi

    # Install binary
    if ! mv "$BINARY_NAME" "$INSTALL_PATH"; then
        echo -e "${RED}Error: Failed to install binary to $INSTALL_PATH${NC}"
        echo -e "${YELLOW}You may need to run with sudo or choose a different installation directory${NC}"
        exit 1
    fi

    # Ad-hoc code sign on macOS to prevent kernel from killing the binary
    if [ "$OS" = "macos" ]; then
        echo -e "${BLUE}🔏 Code signing binary for macOS...${NC}"
        codesign --sign - "$INSTALL_PATH" 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Could not code sign binary. If you get 'killed' errors, run:${NC}"
            echo -e "${YELLOW}   codesign --sign - $INSTALL_PATH${NC}"
        }
    fi

    # Clean up
    cd - > /dev/null
    rm -rf "$TMP_DIR"

    if [ -n "$CURRENT_VERSION" ] && [ "$CURRENT_VERSION" != "unknown" ]; then
        if [ "$CURRENT_VERSION" = "${LATEST_TAG#v}" ]; then
            echo -e "${GREEN}✅ ${BINARY_NAME} is already up to date (${LATEST_TAG})${NC}"
        elif [ "$CURRENT_VERSION" \< "${LATEST_TAG#v}" ]; then
            echo -e "${GREEN}✅ Successfully upgraded ${BINARY_NAME} (v${CURRENT_VERSION} → ${LATEST_TAG})${NC}"
        else
            echo -e "${YELLOW}⚠️  Downgraded ${BINARY_NAME} (v${CURRENT_VERSION} → ${LATEST_TAG})${NC}"
        fi
    else
        echo -e "${GREEN}✅ Successfully installed ${BINARY_NAME} ${LATEST_TAG} to ${INSTALL_PATH}${NC}"
    fi
}

# Check if binary is in PATH and add to shell profile if needed
check_path() {
    if command -v "$BINARY_NAME" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ ${BINARY_NAME} is available in your PATH${NC}"
        echo -e "${BLUE}🚀 You can now run: ${BINARY_NAME}${NC}"
    else
        echo -e "${YELLOW}⚠️  ${BINARY_NAME} is not in your PATH${NC}"
        
        # Detect shell and appropriate config file
        SHELL_CONFIG=""
        if [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ]; then
            SHELL_CONFIG="$HOME/.bashrc"
            [ ! -f "$SHELL_CONFIG" ] && SHELL_CONFIG="$HOME/.bash_profile"
        elif [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ]; then
            SHELL_CONFIG="$HOME/.zshrc"
        else
            # Default to .bashrc if shell is unknown
            SHELL_CONFIG="$HOME/.bashrc"
        fi
        
        # Check if PATH export already exists in the config file
        EXPORT_LINE="export PATH=\"${INSTALL_DIR}:\$PATH\""
        if [ -f "$SHELL_CONFIG" ] && grep -q "export PATH=.*${INSTALL_DIR}" "$SHELL_CONFIG"; then
            echo -e "${BLUE}PATH already configured in ${SHELL_CONFIG}${NC}"
        else
            # Add PATH export to shell config
            echo "" >> "$SHELL_CONFIG"
            echo "# Added by codegen-cloner installer" >> "$SHELL_CONFIG"
            echo "$EXPORT_LINE" >> "$SHELL_CONFIG"
            echo -e "${GREEN}✅ Added ${INSTALL_DIR} to PATH in ${SHELL_CONFIG}${NC}"
        fi
        
        echo -e "${YELLOW}   To use ${BINARY_NAME} now, run: source ${SHELL_CONFIG}${NC}"
        echo -e "${YELLOW}   Or restart your terminal${NC}"
    fi
}

# Show usage information
show_usage() {
    echo -e "${BLUE}"
    echo "╭─────────────────────────────────────╮"
    echo "│       Codegen Cloner Installed      │"
    echo "╰─────────────────────────────────────╯"
    echo -e "${NC}"
    echo -e "${GREEN}Usage:${NC}"
    echo -e "  ${BINARY_NAME}                          # Interactive mode"
    echo -e "  ${BINARY_NAME} <pr-url>                 # Clone specific PR"
    echo -e "  ${BINARY_NAME} env                      # Edit project .env files"
    echo -e "  ${BINARY_NAME} prune                    # Clean up old projects"
    echo ""
    echo -e "${BLUE}Examples:${NC}"
    echo -e "  ${BINARY_NAME} https://github.com/owner/repo/pull/123"
    echo -e "  ${BINARY_NAME} env"
    echo ""
    echo -e "${YELLOW}For more information, visit: ${GITHUB_REPO}${NC}"
}

# Main installation flow
main() {
    echo -e "${BLUE}"
    echo "╭─────────────────────────────────────╮"
    echo "│      Codegen Cloner Installer       │"
    echo "╰─────────────────────────────────────╯"
    echo -e "${NC}"

    detect_platform
    echo -e "${GREEN}Detected platform: ${OS}-${ARCH}${NC}"

    get_latest_release
    install_binary
    check_path
    show_usage

    echo -e "${GREEN}🎉 Installation complete!${NC}"
}

# Run installer
main "$@"