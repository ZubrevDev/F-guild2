# Firebase App Distribution Setup

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" -> name: `f-guild`
3. Disable Google Analytics (not needed for App Distribution)
4. Click "Create project"

## 2. Register Android App

1. In the Firebase project, click Android icon (or "Add app")
2. Package name: `com.fguild.app`
3. App nickname: `F-Guild Android`
4. Debug signing certificate SHA-1:
   ```bash
   cd android && keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android 2>/dev/null | grep SHA1
   ```
5. Click "Register app"
6. Download `google-services.json` -> place in `android/app/`
7. Skip "Add Firebase SDK" steps (not needed for App Distribution only)

## 3. Enable App Distribution

1. In Firebase Console sidebar -> "Release & Monitor" -> "App Distribution"
2. Click "Get started"
3. Create tester group: `internal-testers`
4. Add tester emails to the group

## 4. Create Service Account for CI

1. Go to [Google Cloud Console](https://console.cloud.google.com/) -> IAM -> Service Accounts
2. Select the Firebase project
3. Create service account: `github-actions-firebase`
4. Role: `Firebase App Distribution Admin`
5. Create JSON key -> download

## 5. Add GitHub Secrets

In the GitHub repository -> Settings -> Secrets and variables -> Actions:

| Secret | Value |
|--------|-------|
| `FIREBASE_APP_ID` | From Firebase Console -> Project Settings -> Your Apps -> App ID (e.g., `1:123456789:android:abc123`) |
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON content of the service account key file |
| `CAPACITOR_SERVER_URL` | Deployed web app URL (e.g., `https://f-guild.example.com`) |

## 6. Test the Pipeline

1. Push to `main` branch
2. Go to GitHub Actions -> "Android Build" workflow
3. Or trigger manually: Actions -> "Android Build" -> "Run workflow"
4. APK will be uploaded to Firebase App Distribution
5. Testers receive email invitation to download

## 7. Install on Android Device

Testers:
1. Check email for Firebase App Distribution invite
2. Install "Firebase App Tester" app from Play Store
3. Accept the invitation
4. Download and install the APK
