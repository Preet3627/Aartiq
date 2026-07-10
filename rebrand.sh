#!/bin/bash
set -e

echo "Rebranding from Comet -> Aartiq..."

# === LANDING PAGE ===
LP="/Users/sandipkumarpatel/Developer/Microsoft Store/Aartiq/Landing_Page"

# App config token
sed -i '' 's|COMET_APP_TOKEN|AARTIQ_APP_TOKEN|g' "$LP/src/app/api/config/route.ts"

# Auth page
sed -i '' 's|comet-auth-|aartiq-auth-|g' "$LP/src/app/auth/page.tsx"
sed -i '' 's|"comet-auth-success"|"aartiq-auth-success"|g' "$LP/src/app/auth/page.tsx"
sed -i '' 's|'\''comet-auth-success'\''|'\''aartiq-auth-success'\''|g' "$LP/src/app/auth/page.tsx"
sed -i '' 's|comet-browser://|aartiq-browser://|g' "$LP/src/app/auth/page.tsx"

# Deep links docs
sed -i '' 's|comet-ai|aartiq|g' "$LP/src/app/docs/deep-links/page.tsx"
sed -i '' 's|com.cometai.app|com.aartiq.app|g' "$LP/src/app/docs/deep-links/page.tsx"

# Windows integration
sed -i '' 's|"Hey Comet"|"Hey Aartiq"|g' "$LP/src/app/docs/windows-integration/page.tsx"
sed -i '' 's|Hey Comet, |Hey Aartiq, |g' "$LP/src/app/docs/windows-integration/page.tsx"
sed -i '' 's|comet-ai|aartiq|g' "$LP/src/app/docs/windows-integration/page.tsx"
sed -i '' 's|CometAI_Automation|Aartiq_Automation|g' "$LP/src/app/docs/windows-integration/page.tsx"
sed -i '' 's|CometCommands|AartiqCommands|g' "$LP/src/app/docs/windows-integration/page.tsx"
sed -i '' 's|com.cometai.app|com.aartiq.app|g' "$LP/src/app/docs/windows-integration/page.tsx"

# Apple integration
sed -i '' 's|Comet'\''s|Aartiq'\''s|g' "$LP/src/app/docs/apple-integration/page.tsx"

# Doc pages (Comet -> Aartiq)
for f in getting-started ai-commands automation components extensions native-api troubleshooting metadata; do
  if [ -f "$LP/src/app/docs/$f/page.tsx" ]; then
    sed -i '' 's|Comet|Aartiq|g' "$LP/src/app/docs/$f/page.tsx"
  fi
done
if [ -f "$LP/src/app/docs/metadata.ts" ]; then
  sed -i '' 's|Comet|Aartiq|g' "$LP/src/app/docs/metadata.ts"
fi

# Lib files
sed -i '' 's|Comet|Aartiq|g' "$LP/src/lib/release-notes.ts"
sed -i '' 's|Comet|Aartiq|g' "$LP/src/lib/search-index.ts"
sed -i '' 's|"Comet"|"Aartiq"|g' "$LP/src/lib/firebase.ts"
sed -i '' 's|comet-ai|aartiq|g' "$LP/src/lib/firebase.ts"

# Component data (COMET_CAPABILITIES)
sed -i '' 's|COMET_CAPABILITIES|AARTIQ_CAPABILITIES|g' "$LP/src/data/component-data.json"

# verify-license
sed -i '' 's|comet-ai|aartiq|g' "$LP/src/app/api/verify-license/route.ts"

# google auth
sed -i '' 's|"Comet"|"Aartiq"|g' "$LP/src/app/api/auth/_lib/googleAuth.ts"

echo "Landing page done!"

# === BROWSER APP ===
BR="/Users/sandipkumarpatel/Developer/Microsoft Store/Aartiq/aartiq-browser"

# package.json
sed -i '' 's|"CometAI"|"Aartiq"|g' "$BR/package.json"

# main.js
sed -i '' 's|COMET_URL_SCHEME|AARTIQ_URL_SCHEME|g' "$BR/main.js"
sed -i '' 's|COMET_NATIVE_MAC_UI_PORT|AARTIQ_NATIVE_MAC_UI_PORT|g' "$BR/main.js"
sed -i '' 's|resolveCometIcon|resolveAartiqIcon|g' "$BR/main.js"
sed -i '' 's|generateCometPDFTemplate|generateAartiqPDFTemplate|g' "$BR/main.js"
sed -i '' 's|COMET_CAPABILITIES|AARTIQ_CAPABILITIES|g' "$BR/main.js"
sed -i '' 's|"Comet Vault"|"Aartiq Vault"|g' "$BR/main.js"
sed -i '' 's|CometAlarm_|AartiqAlarm_|g' "$BR/main.js"
sed -i '' 's|"Comet Alarm"|"Aartiq Alarm"|g' "$BR/main.js"
sed -i '' 's|Comet Response|Aartiq Response|g' "$BR/main.js"

# preload.js
sed -i '' 's|getCometIcon|getAartiqIcon|g' "$BR/preload.js"

# Setup files
sed -i '' 's|COMET_SERVICE_MODE|AARTIQ_SERVICE_MODE|g' "$BR/scripts/install-service.sh"

# aartiq-cli.js
sed -i '' 's|COMET_NATIVE_MAC_UI_PORT|AARTIQ_NATIVE_MAC_UI_PORT|g' "$BR/scripts/aartiq-cli.js"
sed -i '' 's|X-Comet-Native-Token|X-Aartiq-Native-Token|g' "$BR/scripts/aartiq-cli.js"

# electron types
sed -i '' 's|getCometIcon|getAartiqIcon|g' "$BR/src/types/electron.d.ts"

# Source files - Comet -> Aartiq (UI strings, comments etc)
sed -i '' 's|COMET_CAPABILITIES|AARTIQ_CAPABILITIES|g' "$BR/src/components/ai/AIConstants.ts"
sed -i '' 's|COMET_CAPABILITIES|AARTIQ_CAPABILITIES|g' "$BR/src/data/component-data.json"

# CSS
sed -i '' 's|Comet Response|Aartiq Response|g' "$BR/src/app/globals.css"

# Source components - replace UI text "Comet" -> "Aartiq"  
sed -i '' 's|"Comet (Default)"|"Aartiq (Default)"|g' "$BR/src/components/UserAgentSettings.tsx"
sed -i '' 's|Comet Pay|Aartiq Pay|g' "$BR/src/components/UnifiedCartPanel.tsx"
sed -i '' 's|augment your Comet environment|augment your Aartiq environment|g' "$BR/src/components/WebStore.tsx"
sed -i '' 's|Sync automation, clipboard, and control flows across Comet devices|Sync automation, clipboard, and control flows across Aartiq devices|g' "$BR/src/components/WelcomeScreen.tsx"
sed -i '' 's|Comet gives you a modern|Aartiq gives you a modern|g' "$BR/src/components/WelcomeScreen.tsx"
sed -i '' 's|Extend Comet with AI|Extend Aartiq with AI|g' "$BR/src/components/PluginSettings.tsx"
sed -i '' 's|Search Comet for|Search Aartiq for|g' "$BR/main.js"
sed -i '' 's|inside-Comet safe actions|inside-Aartiq safe actions|g' "$BR/src/components/PermissionSettings.tsx"
sed -i '' 's|Synchronized with Comet Cloud|Synchronized with Aartiq Cloud|g' "$BR/src/components/SettingsPanel.tsx"
sed -i '' 's|Make Comet your primary|Make Aartiq your primary|g' "$BR/src/components/SettingsPanel.tsx"
sed -i '' 's|Comet is now your default browser|Aartiq is now your default browser|g' "$BR/src/components/SettingsPanel.tsx"
sed -i '' 's|Comet Intelligence System|Aartiq Intelligence System|g' "$BR/src/components/SettingsPanel.tsx"

# AI components - UI refs
sed -i '' 's|Comet Logo|Aartiq Logo|g' "$BR/src/components/ai/AIUtils.ts"
sed -i '' 's|preloadCometIcon|preloadAartiqIcon|g' "$BR/src/components/ai/AIUtils.ts"
sed -i '' 's|preloadCometIcon|preloadAartiqIcon|g' "$BR/src/components/AIChatSidebar.tsx"
sed -i '' 's|Restart Ollama if needed. Comet connects|Restart Ollama if needed. Aartiq connects|g' "$BR/src/components/ai/AISetupGuide.tsx"
sed -i '' 's|Comet remembers your choice|Aartiq remembers your choice|g' "$BR/src/components/ai/AISetupGuide.tsx"
sed -i '' 's|Comet vault secures|Aartiq vault secures|g' "$BR/src/components/ai/AISetupGuide.tsx"
sed -i '' 's|Allows Comet to bridge|Allows Aartiq to bridge|g' "$BR/src/components/ai/AISetupGuide.tsx"

# Click permission
sed -i '' 's|After approval, Comet will|After approval, Aartiq will|g' "$BR/src/components/ai/ClickPermissionModal.tsx"

echo "Browser app done!"
echo "Rebrand complete!"