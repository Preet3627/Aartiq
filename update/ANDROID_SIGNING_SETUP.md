# GitHub Actions Setup for Android Release Signing

## Step 1: Add the following secrets to your GitHub repository

Go to: **Settings → Secrets and variables → Actions → New repository secret**

Add these 4 secrets:

### 1. ANDROID_KEYSTORE_BASE64
Copy the entire content from `flutter_browser_app/android/app/keystore-base64.txt` (all 61 lines including the BEGIN and END lines)

### 2. ANDROID_KEYSTORE_PASSWORD
Value: `aartiqbrowser`

### 3. ANDROID_KEY_ALIAS
Value: `upload`

### 4. ANDROID_KEY_PASSWORD
Value: `aartiqbrowser`

---

## Step 2: The workflow will automatically:
1. Decode the base64 keystore
2. Create the key.properties file
3. Build and sign the release APK

## Important Notes:
- The keystore file (`upload-keystore.jks`) is already gitignored for security
- The base64 version in `keystore-base64.txt` should also NOT be committed to git
- Keep these passwords secure - they're needed to update your app in the future
- If you lose the keystore, you cannot update the app on Play Store (you'd need to publish as a new app)

## Local Development:
For local builds, the `key.properties` file has been created in `flutter_browser_app/android/`
This is also gitignored, so it won't be committed.
