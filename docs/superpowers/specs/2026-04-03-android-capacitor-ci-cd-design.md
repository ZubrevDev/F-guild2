# Android Capacitor Build & CI/CD for Testing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wrap F-Guild Next.js PWA in Capacitor for Android, set up Firebase App Distribution for test builds, and create a GitHub Actions CI/CD pipeline that builds and distributes APK on every push to main.

**Architecture:** Capacitor WebView pointing to deployed web app URL. The Android app is a thin native shell — all app logic stays in the existing Next.js codebase. CI/CD pipeline builds the APK in GitHub Actions and uploads to Firebase App Distribution.

**Tech Stack:** Capacitor 6, Android (Gradle/Java), Firebase App Distribution, GitHub Actions

---

## 1. Capacitor Setup

### Init & Config

Add Capacitor to the existing project:

```bash
pnpm add @capacitor/core @capacitor/cli
pnpm add @capacitor/splash-screen @capacitor/status-bar
npx cap init "F-Guild" "com.fguild.app" --web-dir=dist
npx cap add android
```

Note: `--web-dir=dist` is required by Capacitor init but unused — we load a remote URL, not local files. Create an empty `dist/index.html` placeholder.

**`capacitor.config.ts`:**

Capacitor config is evaluated statically (no `process.env`). Use a build-time script to set the server URL, or maintain a simple config with the staging URL hardcoded:

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fguild.app",
  appName: "F-Guild",
  webDir: "dist",
  server: {
    // Remote URL — app loads the deployed web app
    // Override per environment via scripts/set-capacitor-url.sh before cap sync
    url: "https://f-guild.example.com",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#110b20",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#110b20",
    },
  },
};

export default config;
```

**`scripts/set-capacitor-url.sh`:**

```bash
#!/bin/bash
# Usage: ./scripts/set-capacitor-url.sh https://staging.f-guild.example.com
URL="${1:?Usage: set-capacitor-url.sh <URL>}"
sed -i "s|url: \"https://.*\"|url: \"${URL}\"|" capacitor.config.ts
```

### Server URL Strategy

- **Development:** `http://10.0.2.2:3000` (Android emulator -> host machine localhost)
- **Staging/Testing:** `https://staging.f-guild.example.com`
- **Production:** `https://f-guild.example.com`

CI sets the URL before `cap sync` via the `set-capacitor-url.sh` script.

---

## 2. Android App Icons & Splash Screen

### Icons

Convert existing SVG icons to required Android formats:

| Asset | Size | Source |
|-------|------|--------|
| `ic_launcher.png` | 48/72/96/144/192dp (mdpi→xxxhdpi) | `public/icons/icon-512.svg` |
| `ic_launcher_round.png` | Same sizes | `public/icons/icon-maskable-512.svg` |
| `ic_launcher_foreground.png` | 108dp adaptive | `public/icons/icon-maskable-512.svg` |

Place in `android/app/src/main/res/mipmap-*` directories.

### Splash Screen

- Background: `#110b20` (matches app theme)
- No image — just branded color, auto-hides after 2s
- Capacitor SplashScreen plugin handles this

---

## 3. Safe Area / Status Bar

The app already uses Tailwind responsive classes. For Android:

- Status bar color: `#110b20` (dark purple, matches background)
- Status bar style: light text on dark background
- Navigation bar: handled by `standalone` display mode

**Code change:** Add Capacitor status bar initialization in the app's root layout:

```typescript
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform()) {
  StatusBar.setBackgroundColor({ color: "#110b20" });
  StatusBar.setStyle({ style: Style.Dark });
}
```

---

## 4. Firebase App Distribution

### Firebase Project Setup

Create Firebase project `f-guild` with:
- Android app registered: package `com.fguild.app`
- SHA-1 fingerprint from debug keystore
- App Distribution enabled
- Tester group: `internal-testers`

### Required Files

- `google-services.json` — downloaded from Firebase Console, placed in `android/app/`
- Firebase CLI service account key — stored as GitHub secret for CI

---

## 5. GitHub Actions CI/CD Pipeline

### Workflow: `android-build.yml`

**Triggers:**
- Push to `main` branch
- Manual dispatch (workflow_dispatch)

**Steps:**
1. Checkout code
2. Setup Java 17 + Gradle
3. Setup Node.js 20 + pnpm
4. Install dependencies
5. Sync Capacitor (`npx cap sync android`)
6. Build debug APK (`./gradlew assembleDebug`)
7. Upload APK to Firebase App Distribution
8. Upload APK as GitHub Actions artifact (backup)

**Secrets required:**
- `FIREBASE_SERVICE_ACCOUNT` — JSON key for Firebase CLI
- `FIREBASE_APP_ID` — Android app ID from Firebase
- `CAPACITOR_SERVER_URL` — URL of deployed web app

### Build Variants

- **Debug APK** — for Firebase App Distribution (no signing required)
- **Release AAB** — for Google Play (future, requires keystore)

---

## 6. Package Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "cap:sync": "cap sync",
    "cap:open:android": "cap open android",
    "cap:build:android": "cap sync android && cd android && ./gradlew assembleDebug",
    "cap:run:android": "cap run android"
  }
}
```

---

## 7. CSP Adjustment

Current CSP `connect-src 'self'` will block the Capacitor WebView from connecting to the remote server. Update for native platform:

```
connect-src 'self' https://f-guild.example.com https://staging.f-guild.example.com capacitor: https:
```

Also add `capacitor:` and `https:` to `img-src` for loading remote images.

---

## 8. Scope Boundaries

**In scope:**
- Capacitor init + Android project generation
- App icons (PNG from existing SVG)
- Splash screen (solid color)
- Status bar configuration
- Firebase project setup instructions
- GitHub Actions workflow for debug APK build + Firebase distribution
- CSP adjustments for Capacitor
- npm scripts for local development

**Out of scope:**
- iOS build (phase 2)
- Release signing / Google Play publishing
- Native plugins beyond StatusBar/SplashScreen
- Push notification migration to Firebase Cloud Messaging (web-push works in WebView)
- Automated testing (E2E) in CI
- Web app deployment (already has CI placeholder for Vercel)
