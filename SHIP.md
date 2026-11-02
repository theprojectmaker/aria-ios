# Shipping Aria to TestFlight

Aria is a standalone Expo SDK 57 app. iOS builds run **free** on a GitHub Actions
macOS runner (`eas build --local` + `eas submit`), mirroring the other apps
(see the `github-actions-ios-builds` memory). A brand-new app needs **one
interactive setup** by you before GitHub can build it.

## Already done (by Claude, 2026-11-01)
- Full app: Chat (Qwen3-1.7B on iPhone / Qwen3-0.6B on iPad) + Vision (LFM2.5-VL-450M), both on-device.
- `app.json` (bundle `com.solyapps.aria`, increased-memory-limit entitlement, iOS 17 target).
- `eas.json`, `.github/workflows/ios-testflight.yml`, `scripts/check-sdk.cjs`.
- Verified: web UI renders, `npx expo export --platform ios` exits 0, lock in sync.
- **EAS project created**: `@solomonsasson/aria`, projectId `97e7ddaf-b7ee-42ae-a873-e2ad7450733c`
  (in `app.json`). EAS Update configured (`updates.url`, `production` channel/branch, buildNumber 1).
- **GitHub repo created + pushed**: PUBLIC `theprojectmaker/aria-ios`, workflow active.

## What's left — needs YOUR logins (I can't do these)
These two require your Apple ID (with 2FA) and your Expo token, which I can't enter.

### Fastest path — one interactive command does it all
From `tests/aria`, in your own terminal:
```
npx eas-cli@latest build --platform ios --profile production --auto-submit
```
Log in to Apple when prompted (2FA). This creates the signing credentials (accept the
**Increased Memory Limit** capability), builds Aria in the EAS cloud, and submits it to
TestFlight — creating the App Store Connect app. After it finishes, copy the new `ascAppId`
it reports into `eas.json` (`submit.production.ios.ascAppId`, currently `REPLACE_WITH_ASC_APP_ID`),
then commit + push.

### To use the FREE GitHub builds afterward
Set the Expo token secret once (run in PowerShell, paste your token):
```
powershell -ExecutionPolicy Bypass -File tests/set-expo-token-aria.ps1
```
Make a token at https://expo.dev/accounts/solomonsasson/settings/access-tokens.
After that, every build is free on GitHub:

## Every build after that
```
"C:/Program Files/GitHub CLI/gh.exe" workflow run ios-testflight.yml -R theprojectmaker/aria-ios -f submit=true
```
Push the tree before running — the runner builds the pushed commit, not local edits.

## Notes
- The on-device models download on first use **inside the app** (not in the repo, not in the build).
  Chat ≈ 1.2 GB (iPhone) / 0.5 GB (iPad); Vision ≈ 0.65 GB. One-time, over Wi-Fi.
- One heavy model is resident at a time: the Chat model unloads on the Vision tab and vice-versa
  (prevents OOM on device).
- The real AI only runs on a device build. Web/Expo Go shows a polished demo of the UI.
