# Code Signing Setup Guide for Aartiq Browser

## Windows Code Signing

### Prerequisites
1. **Code Signing Certificate** - Purchase from a trusted Certificate Authority (CA):
   - DigiCert (Recommended)
   - Sectigo (formerly Comodo)
   - GlobalSign
   - Cost: ~$100-$400/year

### Local Development Setup

1. **Export your certificate as PFX**:
   - If you have a `.cer` and `.key` file:
     ```powershell
     openssl pkcs12 -export -out aartiq-browser.pfx -inkey private.key -in certificate.cer
     ```
   - Enter a strong password when prompted

2. **Place certificate in project**:
   ```
   aartiq-browser/
   └── certs/
       └── aartiq-browser.pfx
   ```

3. **Set environment variable**:
   ```powershell
   $env:CSC_KEY_PASSWORD="your-certificate-password"
   ```

4. **Build signed executable**:
   ```bash
   npm run dist:win
   ```

### GitHub Actions Setup

1. **Prepare certificate for GitHub Secrets**:
   ```powershell
   # Convert PFX to Base64
   $bytes = [System.IO.File]::ReadAllBytes("certs/aartiq-browser.pfx")
   $base64 = [System.Convert]::ToBase64String($bytes)
   $base64 | Out-File -FilePath "certificate-base64.txt"
   ```

2. **Add GitHub Secrets**:
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Add secrets:
     - `WINDOWS_CERTIFICATE`: Paste the Base64 string from `certificate-base64.txt`
     - `WINDOWS_CERTIFICATE_PASSWORD`: Your certificate password

3. **Workflow will automatically**:
   - Decode the Base64 certificate
   - Save it to `certs/aartiq-browser.pfx`
   - Sign the executable during build
   - Sign all DLLs in the package

### Configuration Details

**package.json** (already configured):
```json
{
  "build": {
    "win": {
      "certificateFile": "certs/aartiq-browser.pfx",
      "certificatePassword": "",
      "signingHashAlgorithms": ["sha256"],
      "signDlls": true,
      "rfc3161TimeStampServer": "http://timestamp.digicert.com"
    }
  }
}
```

**Environment Variables**:
- `CSC_LINK`: Path to certificate file
- `CSC_KEY_PASSWORD`: Certificate password
- `CSC_NAME`: (Optional) Certificate subject name

### Verification

After building, verify the signature:
```powershell
# Check if executable is signed
Get-AuthenticodeSignature "release\Aartiq Browser Setup 0.1.8.exe"

# Should show:
# Status: Valid
# SignerCertificate: CN=Your Company Name
```

### Troubleshooting

**"Unknown Publisher" warning still appears**:
- Certificate might not be from a trusted CA
- Certificate might be expired
- Windows SmartScreen needs time to build reputation (can take weeks)

**Build fails with signing error**:
- Check certificate password is correct
- Ensure certificate hasn't expired
- Verify certificate is code-signing type (not SSL/TLS)

**GitHub Actions fails**:
- Verify Base64 encoding is correct (no line breaks)
- Check secret names match exactly
- Ensure certificate password is set

### Alternative: Self-Signed Certificate (Development Only)

For testing purposes only (will still show warnings):

```powershell
# Create self-signed certificate
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Aartiq Browser Dev" -CertStoreLocation "Cert:\CurrentUser\My"

# Export to PFX
$password = ConvertTo-SecureString -String "dev-password" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "certs\aartiq-browser-dev.pfx" -Password $password
```

**Note**: Self-signed certificates will still trigger SmartScreen warnings. Only use for development/testing.

---

## macOS Code Signing

### Prerequisites
1. **Apple Developer Account** ($99/year)
2. **Developer ID Application Certificate**

### Setup
1. Download certificate from Apple Developer Portal
2. Install in Keychain Access
3. Set environment variables:
   ```bash
   export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
   ```

### Notarization (Required for macOS 10.15+)
```bash
export APPLE_ID="your-apple-id@email.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

---

## Linux Code Signing

Linux AppImages don't require code signing, but you can:
1. Sign with GPG key
2. Provide checksums (SHA256)
3. Distribute via trusted repositories

---

## Best Practices

1. **Never commit certificates** to version control
   - Add `certs/` to `.gitignore`
   - Use environment variables or secrets

2. **Use strong passwords** for certificate files

3. **Rotate certificates** before expiration

4. **Test signing** in CI/CD before release

5. **Keep backups** of certificates in secure storage

6. **Monitor certificate expiration** dates

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Windows Code Signing Cert | $100-$400 | Annual |
| Apple Developer Account | $99 | Annual |
| Linux (GPG) | Free | - |

**Total**: ~$200-$500/year for full cross-platform signing
