#!/bin/bash
# Aartiq Native MCP Approval Dialog for Linux
# Uses zenity for native GTK dialog, falls back to yad, then to terminal
#
# Usage: ./native-approval-dialog.sh --tool "tool_name" --risk "high" --args "command args" --request-id "id"

TOOL_NAME="Unknown Tool"
RISK="medium"
ARGS=""
REQUEST_ID=""
SOURCE="Claude Desktop via MCP"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --tool) TOOL_NAME="$2"; shift ;;
        --risk) RISK="$2"; shift ;;
        --args) ARGS="$2"; shift ;;
        --request-id) REQUEST_ID="$2"; shift ;;
        *) shift ;;
    esac
done

DIALOG_TITLE="Aartiq - MCP Approval"

build_zenity_dialog() {
    local risk_color=""
    local warning=""
    
    case "$RISK" in
        high)
            risk_color="#EF4444"
            warning="<b><span color='#EF4444'>⚠ DESTRUCTIVE COMMAND DETECTED</span></b>
<span color='#FCA5A5'>This command can permanently modify or destroy data.</span>"
            ;;
        medium)
            risk_color="#F59E0B"
            ;;
        *)
            risk_color="#22C55E"
            ;;
    esac

    zenity --question \
        --title="$DIALOG_TITLE" \
        --width=450 \
        --text="<b><span size='large'>MCP Tool Approval</span></b>

<span size='small' color='#64748B'>TOOL</span>
<b><tt>$TOOL_NAME</tt></b>

<span size='small' color='#64748B'>ARGUMENTS</span>
<tt>$(echo "$ARGS" | head -c 500)</tt>

$warning

<span size='small' color='#64748B'>SOURCE</span>
<span color='#7C3AED'>$SOURCE</span>" \
        --ok-label="Approve" \
        --cancel-label="Deny" \
        2>/dev/null
    
    return $?
}

build_yad_dialog() {
    local warning=""
    
    if [ "$RISK" = "high" ]; then
        warning="<b><span color='red'>⚠ DESTRUCTIVE COMMAND DETECTED</span></b>
<span color='#FCA5A5'>This command can permanently modify or destroy data.</span>"
    fi

    yad --question \
        --title="$DIALOG_TITLE" \
        --width=450 \
        --text="<b><span size='large'>MCP Tool Approval</span></b>

<b>Tool:</b> <tt>$TOOL_NAME</tt>
<b>Arguments:</b> <tt>$(echo "$ARGS" | head -c 500)</tt>

$warning

<b>Source:</b> <span color='#7C3AED'>$SOURCE</span>" \
        --button="Deny:1" \
        --button="Approve:0" \
        2>/dev/null
    
    return $?
}

build_terminal_dialog() {
    echo ""
    echo "========================================="
    echo "  Aartiq - MCP Tool Approval"
    echo "========================================="
    echo ""
    echo "  Tool:     $TOOL_NAME"
    echo "  Risk:     $RISK"
    echo "  Source:   $SOURCE"
    echo ""
    if [ -n "$ARGS" ]; then
        echo "  Arguments:"
        echo "  $(echo "$ARGS" | head -c 400)"
        echo ""
    fi
    
    if [ "$RISK" = "high" ]; then
        echo "  ⚠ DESTRUCTIVE COMMAND DETECTED"
        echo "  This command can permanently modify or destroy data."
        echo ""
    fi
    
    echo "  [Shift+Tab] Approve  |  [Esc/Enter] Deny"
    echo "-----------------------------------------"
    echo -n "  Approve? (y/N): "
    
    read -r -s -n1 key
    
    if [ "$key" = "y" ] || [ "$key" = "Y" ]; then
        echo "y"
        return 0
    else
        echo "n"
        return 1
    fi
}

APPROVED="false"

if command -v zenity &>/dev/null; then
    if build_zenity_dialog; then
        APPROVED="true"
    fi
elif command -v yad &>/dev/null; then
    if build_yad_dialog; then
        APPROVED="true"
    fi
else
    if build_terminal_dialog; then
        APPROVED="true"
    fi
fi

echo "{\"requestId\":\"$REQUEST_ID\",\"approved\":$APPROVED}"
