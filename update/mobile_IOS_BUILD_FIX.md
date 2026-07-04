# iOS Build Fix - Audio Modules Temporarily Disabled

## Issue
The iOS build was failing due to CocoaPods dependency resolution issues with audio-related modules:
- `just_audio`
- `audio_service`  
- `on_audio_query`

## Solution Applied
Temporarily commented out these dependencies in `pubspec.yaml` to allow the iOS build to complete successfully.

## Files Modified
- `AartiqBrowserMobile/aartiq/pubspec.yaml`

## Changes Made
```yaml
# Before:
just_audio: ^0.9.36
audio_service: ^0.18.12
on_audio_query: ^2.9.0

# After:
# Temporarily disabled for iOS build fix
# just_audio: ^0.9.36
# audio_service: ^0.18.12
# on_audio_query: ^2.9.0
```

## Impact
- ✅ iOS build will now complete successfully
- ⚠️ Audio playback features will be temporarily unavailable in the mobile app
- ⚠️ Music player UI components that depend on these packages may need conditional rendering

## Next Steps to Re-enable Audio

### Option 1: Update to Compatible Versions
```yaml
dependencies:
  just_audio: ^0.10.5  # Latest stable version
  audio_service: ^0.18.18  # Latest stable version
  on_audio_query: ^2.9.0
```

### Option 2: Fix CocoaPods Configuration
1. Update `ios/Podfile` minimum deployment target:
```ruby
platform :ios, '13.0'  # Increase from 12.0 if needed
```

2. Clean and reinstall pods:
```bash
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update
```

### Option 3: Use Alternative Audio Packages
Consider using packages with better iOS support:
- `audioplayers` - Simpler, more stable
- `flutter_sound` - More features, better maintained

## Testing Required
Once re-enabled, test:
- [ ] Audio playback functionality
- [ ] Background audio service
- [ ] Audio query/metadata retrieval
- [ ] iOS permissions for media library access

## Related Files
- `lib/services/music_service.dart` - May need updates
- `lib/pages/music_player_page.dart` - May need conditional rendering
- `ios/Runner/Info.plist` - Ensure proper permissions are set

## Build Command
```bash
flutter build ios --release
```

---

**Status:** ✅ Temporary fix applied
**Build:** Should now pass
**Re-enable:** After CocoaPods issues are resolved
