# Shipping Aria to TestFlight

Aria is a standalone Expo SDK 57 app. iOS builds run **free** on a GitHub Actions
macOS runner (`eas build --local` + `eas submit`), mirroring the other apps
(see the `github-actions-ios-builds` memory). A brand-new app needs **one
interactive setup** by you before GitHub can build it.

## What's already done
- Full app: Chat (Qwen3-1.7B on iPhone / Qwen3-0.6B on iPad) + Vision (LFM2.5-VL-450M), both on-device.
- `app.json` (bundle `com.solyapps.aria`, increased-memory-limit entitlement, iOS 17 target).
- `eas.json`, `.github/workflows/ios-testflight.yml`, `scripts/check-sdk.cjs`.
- Verified: web UI renders, `npx expo export --platform ios` exits 0.

## One-time setup (you / interactive)
1. **Create the EAS project** (from `tests/aria`):
   ```
   npx eas-cli@latest init
   ```
   This writes `extra.eas.projectId` + the `updates.url` into `app.json`. Owner: `solomonsasson`.

2. **Create a GitHub repo and push** (PUBLIC — private-repo macOS builds are currently blocked
   on the account per the `github-actions-ios-builds` memory):
   ```
   "C:/Program Files/GitHub CLI/gh.exe" repo create theprojectmaker/aria-ios --public --source . --remote origin --push
   ```

3. **Set the EXPO_TOKEN secret** on the repo (expo.dev → Account settings → Access tokens),
   same as the other apps' set-expo-token script.

4. **Create iOS credentials** (no build minutes used):
   ```
   npx eas-cli@latest credentials
   ```
   Pick iOS → production → let it create the Distribution Certificate + Provisioning Profile
   (the profile must include the **Increased Memory Limit** capability — accept when prompted,
   since `app.json` declares the entitlement). Log in with the Apple ID when asked.

5. **First build (no submit) to confirm green on GitHub:**
   ```
   "C:/Program Files/GitHub CLI/gh.exe" workflow run ios-testflight.yml -R theprojectmaker/aria-ios -f submit=false
   ```

6. **Create the App Store Connect app** with one interactive submit of that build, then copy the
   `ascAppId` into `eas.json` (`submit.production.ios.ascAppId`, currently `REPLACE_WITH_ASC_APP_ID`):
   ```
   npx eas-cli@latest submit --platform ios --profile production --latest
   ```

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
