#!/bin/bash
# Aartiq macOS Service Installer
# Installs the background service as a LaunchDaemon (runs without login)
# Requires admin privileges

set -e

# Configuration
SERVICE_NAME="com.ai.aartiq-service"
SERVICE_LABEL="com.ai.aartiq-service"
APP_NAME="Aartiq"
LAUNCH_DAEMON_PLIST="/Library/LaunchDaemons/${SERVICE_NAME}.plist"
USER_LAUNCH_AGENT_PLIST="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    echo "Aartiq Background Service Installer for macOS"
    echo ""
    echo "Usage: ./install-service.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  install          Install the service"
    echo "  uninstall        Remove the service"
    echo "  start            Start the service"
    echo "  stop             Stop the service"
    echo "  restart          Restart the service"
    echo "  status           Check service status"
    echo ""
    echo "Options:"
    echo "  --user           Install for current user only (LaunchAgent)"
    echo "  --system         Install system-wide (LaunchDaemon) [default]"
    echo "  --auto-start     Start service automatically on boot [default]"
    echo "  --no-auto-start  Don't auto-start on boot"
    echo ""
}

# Check if running as root (for LaunchDaemon)
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_warn "Not running as root. Some operations may require sudo."
        return 1
    fi
    return 0
}

# Get the service executable path
get_service_path() {
    # Try to find the service executable
    if [[ -f "/Applications/${APP_NAME}.app/Contents/MacOS/aartiq-service" ]]; then
        echo "/Applications/${APP_NAME}.app/Contents/MacOS/aartiq-service"
    elif [[ -f "$HOME/Applications/${APP_NAME}.app/Contents/MacOS/aartiq-service" ]]; then
        echo "$HOME/Applications/${APP_NAME}.app/Contents/MacOS/aartiq-service"
    elif [[ -f "./out/mac-arm64/${APP_NAME}.app/Contents/MacOS/aartiq-service" ]]; then
        echo "$(pwd)/out/mac-arm64/${APP_NAME}.app/Contents/MacOS/aartiq-service"
    else
        # Default path for development
        echo "$(pwd)/out/mac-arm64/${APP_NAME}.app/Contents/MacOS/aartiq-service"
    fi
}

# Create LaunchDaemon plist
create_launchdaemon_plist() {
    local service_path=$(get_service_path)
    
    cat > "$LAUNCH_DAEMON_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_LABEL}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${service_path}</string>
        <string>--service</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    
    <key>ProcessType</key>
    <string>Background</string>
    
    <key>LowPriorityIO</key>
    <true/>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>AARTIQ_SERVICE_MODE</key>
        <string>background</string>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/var/log/aartiq-service.log</string>
    
    <key>StandardErrorPath</key>
    <string>/var/log/aartiq-service-error.log</string>
    
    <key>ThrottleInterval</key>
    <integer>10</integer>
    
    <key>HardResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>1024</integer>
    </dict>
    
    <key>SoftResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>512</integer>
    </dict>
</dict>
</plist>
EOF

    log_info "Created LaunchDaemon plist at ${LAUNCH_DAEMON_PLIST}"
}

# Create LaunchAgent plist (for user-level installation)
create_launchagent_plist() {
    local service_path=$(get_service_path)
    
    cat > "$USER_LAUNCH_AGENT_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_LABEL}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${service_path}</string>
        <string>--service</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    
    <key>ProcessType</key>
    <string>Background</string>
    
    <key>LowPriorityIO</key>
    <true/>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>AARTIQ_SERVICE_MODE</key>
        <string>background</string>
    </dict>
    
    <key>StandardOutPath</key>
    <string>~/Library/Logs/aartiq-service.log</string>
    
    <key>StandardErrorPath</key>
    <string>~/Library/Logs/aartiq-service-error.log</string>
</dict>
</plist>
EOF

    log_info "Created LaunchAgent plist at ${USER_LAUNCH_AGENT_PLIST}"
}

# Install the service
install_service() {
    local user_mode=$1
    local auto_start=$2
    
    log_info "Installing Aartiq Background Service..."
    
    if [[ "$user_mode" == "true" ]]; then
        # User-level installation (LaunchAgent)
        create_launchagent_plist
        
        # Load the agent
        launchctl load "$USER_LAUNCH_AGENT_PLIST" 2>/dev/null || true
        log_info "Service installed as LaunchAgent for user: $(whoami)"
    else
        # System-level installation (LaunchDaemon)
        check_root || true
        
        create_launchdaemon_plist
        
        # Set proper permissions
        chmod 644 "$LAUNCH_DAEMON_PLIST"
        chown root:wheel "$LAUNCH_DAEMON_PLIST"
        
        # Load the daemon
        launchctl load "$LAUNCH_DAEMON_PLIST" 2>/dev/null || true
        log_info "Service installed as LaunchDaemon (system-wide)"
    fi
    
    log_info "Service installed successfully!"
}

# Uninstall the service
uninstall_service() {
    local user_mode=$1
    
    log_info "Uninstalling Aartiq Background Service..."
    
    if [[ "$user_mode" == "true" ]]; then
        # Stop and unload LaunchAgent
        launchctl unload "$USER_LAUNCH_AGENT_PLIST" 2>/dev/null || true
        rm -f "$USER_LAUNCH_AGENT_PLIST"
        log_info "LaunchAgent removed"
    else
        # Stop and unload LaunchDaemon
        check_root || true
        launchctl unload "$LAUNCH_DAEMON_PLIST" 2>/dev/null || true
        rm -f "$LAUNCH_DAEMON_PLIST"
        log_info "LaunchDaemon removed"
    fi
    
    log_info "Service uninstalled successfully!"
}

# Start the service
start_service() {
    local user_mode=$1
    
    log_info "Starting Aartiq Background Service..."
    
    if [[ "$user_mode" == "true" ]]; then
        launchctl start "$SERVICE_LABEL" 2>/dev/null || launchctl load "$USER_LAUNCH_AGENT_PLIST" 2>/dev/null
    else
        check_root || true
        launchctl start "$SERVICE_LABEL" 2>/dev/null || launchctl load "$LAUNCH_DAEMON_PLIST" 2>/dev/null
    fi
    
    log_info "Service started"
}

# Stop the service
stop_service() {
    local user_mode=$1
    
    log_info "Stopping Aartiq Background Service..."
    
    if [[ "$user_mode" == "true" ]]; then
        launchctl stop "$SERVICE_LABEL" 2>/dev/null || true
    else
        check_root || true
        launchctl stop "$SERVICE_LABEL" 2>/dev/null || true
    fi
    
    log_info "Service stopped"
}

# Check service status
check_status() {
    local user_mode=$1
    local plist_path
    
    if [[ "$user_mode" == "true" ]]; then
        plist_path="$USER_LAUNCH_AGENT_PLIST"
    else
        plist_path="$LAUNCH_DAEMON_PLIST"
    fi
    
    echo ""
    echo "Aartiq Service Status"
    echo "======================="
    
    if launchctl list | grep -q "$SERVICE_LABEL"; then
        echo -e "${GREEN}● Running${NC}"
        launchctl list | grep "$SERVICE_LABEL"
    else
        echo -e "${RED}○ Not Running${NC}"
    fi
    
    echo ""
    if [[ -f "$plist_path" ]]; then
        echo "Configuration: Installed at $plist_path"
    else
        echo "Configuration: Not installed"
    fi
    
    echo ""
}

# Main script
# Parse arguments
COMMAND=""
USER_MODE="false"
AUTO_START="true"

while [[ $# -gt 0 ]]; do
    case $1 in
        install|uninstall|start|stop|restart|status)
            COMMAND=$1
            shift
            ;;
        --user)
            USER_MODE="true"
            shift
            ;;
        --system)
            USER_MODE="false"
            shift
            ;;
        --auto-start)
            AUTO_START="true"
            shift
            ;;
        --no-auto-start)
            AUTO_START="false"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Execute command
case $COMMAND in
    install)
        install_service "$USER_MODE" "$AUTO_START"
        ;;
    uninstall)
        uninstall_service "$USER_MODE"
        ;;
    start)
        start_service "$USER_MODE"
        ;;
    stop)
        stop_service "$USER_MODE"
        ;;
    restart)
        stop_service "$USER_MODE"
        sleep 1
        start_service "$USER_MODE"
        ;;
    status)
        check_status "$USER_MODE"
        ;;
    *)
        show_help
        exit 1
        ;;
esac
