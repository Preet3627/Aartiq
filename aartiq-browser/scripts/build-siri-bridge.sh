#!/bin/bash
# build-siri-bridge.sh
# Compiles the native macOS panels + wraps in .app bundle for Siri/Shortcuts/AppIntents discovery.
# Uses ad-hoc signing (no paid Apple Developer account needed).
#
# Usage: ./scripts/build-siri-bridge.sh [--mode all|sidebar|settings|...] [--no-sign]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$ROOT_DIR/src/lib/native-panels"
BIN_DIR="$ROOT_DIR/bin"
APP_NAME="Aartiq-SiriBridge"
BUNDLE_NAME="${APP_NAME}.app"
BUNDLE_PATH="$BIN_DIR/$BUNDLE_NAME"
INFO_PLIST="$BUNDLE_PATH/Contents/Info.plist"
MODE="${1:-all}"
SIGN="${2:-yes}"

echo "[build-siri-bridge] Building native panels for mode: $MODE"
echo "[build-siri-bridge] Source: $SRC_DIR"

if [ ! -d "$SRC_DIR" ]; then
  echo "[build-siri-bridge] ERROR: Swift source directory not found at $SRC_DIR"
  exit 1
fi

# Collect Swift files
SWIFT_FILES=()
while IFS= read -r -d '' file; do
  SWIFT_FILES+=("$file")
done < <(find "$SRC_DIR" -name "*.swift" -print0)

if [ ${#SWIFT_FILES[@]} -eq 0 ]; then
  echo "[build-siri-bridge] ERROR: No Swift files found in $SRC_DIR"
  exit 1
fi

echo "[build-siri-bridge] Found ${#SWIFT_FILES[@]} Swift files"

# Build compilation flags based on mode
COMPILER_FLAGS=("-parse-as-library" "-D" "COMPILE_ALL")
if [ "$MODE" != "all" ]; then
  MACRO_NAME=$(echo "$MODE" | tr '-' '_' | tr '[:lower:]' '[:upper:]')
  COMPILER_FLAGS=("-parse-as-library" "-D" "COMPILE_${MACRO_NAME}")
fi

# Create .app bundle structure
rm -rf "$BUNDLE_PATH"
mkdir -p "$BUNDLE_PATH/Contents/MacOS"
mkdir -p "$BUNDLE_PATH/Contents/Resources"

# Compile the binary
BINARY_PATH="$BUNDLE_PATH/Contents/MacOS/$APP_NAME"
echo "[build-siri-bridge] Compiling ${#SWIFT_FILES[@]} files → $BINARY_PATH"
swiftc "${COMPILER_FLAGS[@]}" "${SWIFT_FILES[@]}" \
  -o "$BINARY_PATH" \
  -framework SwiftUI \
  -framework AppKit \
  -framework AppIntents \
  -framework Foundation

echo "[build-siri-bridge] Compilation successful"

# Create Info.plist
cat > "$INFO_PLIST" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Aartiq Siri Bridge</string>
  <key>CFBundleExecutable</key>
  <string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>com.aartiq.siri-bridge</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
  <key>NSSupportsAutomaticTermination</key>
  <true/>
</dict>
</plist>
PLISTEOF

echo "[build-siri-bridge] Created Info.plist"

# Copy app icon if available
ICON_SRC="$ROOT_DIR/build/icon.icns"
if [ -f "$ICON_SRC" ]; then
  cp "$ICON_SRC" "$BUNDLE_PATH/Contents/Resources/icon.icns"
fi

# Sign the bundle (ad-hoc: no paid cert needed)
if [ "$SIGN" = "yes" ]; then
  echo "[build-siri-bridge] Ad-hoc signing bundle..."
  codesign --force --deep --sign - "$BUNDLE_PATH" 2>&1 || {
    echo "[build-siri-bridge] Signing failed (non-fatal). AppIntents may not register without signing."
  }
  echo "[build-siri-bridge] Signing complete"
fi

echo ""
echo "[build-siri-bridge] ✓ Bundle created at: $BUNDLE_PATH"
echo "[build-siri-bridge] ✓ Register with:      open '$BUNDLE_PATH'"
echo "[build-siri-bridge] ✓ Shortcuts will discover AppIntents on first launch"
echo ""
