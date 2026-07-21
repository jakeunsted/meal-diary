# Meal Diary Mobile (Expo)

React Native app for iOS and Android. Calls the Express API directly (no Nuxt BFF).

## Prerequisites

- Node.js >= 26.3.0
- Android Studio + emulator (primary dev target for now)
- API running on port 3001 (`npm run dev --workspace=meal-diary-api`)

## Setup

From the monorepo root:

```bash
npm install
cp apps/mobile/.env.example apps/mobile/.env
```

## Development

```bash
# Start Expo dev server
npm run dev:mobile

# Or from apps/mobile
npm run dev --workspace=meal-diary-mobile
```

Press **`a`** in the Expo CLI to open on the Android emulator, or scan the QR code with **Expo Go** on a physical device. Expo web is also supported for development (`w` in the CLI) at [http://localhost:3002](http://localhost:3002).

**Android emulator:** use `npm run dev:mobile:android`. That advertises `exp://10.0.2.2:3002` (the emulator’s host loopback). Do not use `--localhost` on macOS — Metro can bind IPv6-only (`[::1]`), which breaks Expo Go with `Failed to download remote update`.

**`Failed to download remote update` on emulator/device:** the dev server is probably advertising `dev-app.mealdiary.co.uk` (from `EXPO_PACKAGER_PROXY_URL` / `dev:mobile:proxy:https` or a Cursor/IDE launch config). That hostname only resolves on your Mac (`/etc/hosts` → `127.0.0.1`); emulators and phones cannot reach it. Stop Metro and restart with `npm run dev:mobile:android` (emulator) or `npm run dev:mobile` (physical device). Use `dev:mobile:proxy:https` only for browser/web dev.

**Physical device:** phone and Mac must be on the same Wi‑Fi (client isolation off). If the QR code fails, use a tunnel:

```bash
npm run dev:mobile:tunnel
```

### Custom dev domain (nginx)

To serve Expo web via a local reverse proxy (e.g. `dev-app.mealdiary.co.uk` → `127.0.0.1:3002`):

1. Point `/etc/hosts` at your machine and proxy port 3002 with WebSocket upgrade headers (see nginx example below).
2. Start Expo with the proxy URL so bundle/HMR links use the public host:

```bash
# HTTPS required for Google Sign-In on web (WebCrypto / PKCE)
npm run dev:mobile:proxy:https
# or: EXPO_PACKAGER_PROXY_URL=https://dev-app.mealdiary.co.uk npm run dev:mobile
```

3. Set `EXPO_PUBLIC_API_URL` in `.env` to an API URL reachable from the browser (e.g. `http://localhost:3001` or your dev API host). The API allows `dev-app.mealdiary.co.uk` in development CORS by default.
4. **Google Sign-In on web** uses client-side PKCE (`expo-auth-session`), which requires a secure origin — serve `dev-app.mealdiary.co.uk` over **HTTPS** (e.g. mkcert + nginx `listen 443 ssl`). `http://localhost:3002` also works without a cert.

Example nginx `location /` block (HTTP):

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_pass http://127.0.0.1:3002;
proxy_buffering off;
```

For Google Sign-In on web, add a `listen 443 ssl` server block with your mkcert certificates and the same `location /` proxy settings.

### API URL

| Environment | `EXPO_PUBLIC_API_URL` |
|-------------|----------------------|
| Android emulator | `http://10.0.2.2:3001` |
| Physical device | `http://<your-lan-ip>:3001` |
| Browser (localhost) | `http://localhost:3001` |
| Browser (`https://dev-app.mealdiary.co.uk`) | `http://localhost:3001` (or your dev API host) |
| Production | `https://api.mealdiary.co.uk` |
| Production web app | `https://app.mealdiary.co.uk` (`EXPO_PUBLIC_WEB_URL`) |

### Google Sign-In (optional)

Set the same **Web application** OAuth client ID as the API `GOOGLE_CLIENT_ID`. When unset, Google buttons are hidden and email login still works.

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Web client ID (required — used as `webClientId` for native ID tokens + API audience check) |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Android OAuth client for `uk.co.mealdiary.app` (Console setup; native SDK picks it via package + SHA-1) |

**Android uses the native Google Sign-In SDK** (`@react-native-google-signin/google-signin`), not browser/`expo-auth-session` redirects. Web still uses `expo-auth-session`.

**Google Cloud Console setup:**

1. Create or reuse the Web OAuth client (same as backend `GOOGLE_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`).
2. Create an Android OAuth client for package `uk.co.mealdiary.app` and add **both** SHA-1 fingerprints (debug + release):

   ```bash
   # Debug (android/app/debug.keystore)
   keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android

   # Release (path from android/keystore.properties → storeFile)
   keytool -list -v -keystore ./meal-diary-release.keystore -alias meal-diary
   ```

   Current fingerprints for this repo:
   - Debug SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
   - Release SHA-1: `E7:AF:4A:A9:D9:5B:79:A8:9C:EC:AF:32:9F:06:CE:C4:8C:18:DB:39`
3. For **web** only, add Authorized redirect URIs on the Web client:
   - `https://dev-app.mealdiary.co.uk`
   - `http://localhost:3002`

   Native Android does **not** use `uk.co.mealdiary.app:/oauthredirect` anymore.

Flow: Google ID token → `POST /auth/google/verify-token` on the Express API.

After changing Google native config, re-run prebuild so the config plugin is applied:

```bash
cd apps/mobile
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

## Native builds (Android-first)

```bash
cd apps/mobile
npx expo prebuild --platform android
npx expo run:android
```

EAS Build profiles are in [`eas.json`](./eas.json). iOS builds require an Apple Developer Program membership and a physical device or simulator setup — identifiers are pre-configured in `app.json` but iOS is deferred for now.

## Stack

- Expo SDK 57 + Expo Router
- NativeWind v5 + Gluestack UI v5
- TanStack Query, Zustand, i18next
- `@meal-diary/shared` workspace package
- PostHog (`posthog-react-native`) for analytics + feature flags

### Feature flags

Flag keys are shared in `@meal-diary/shared` (`FEATURE_FLAGS`). Add a key there first, then create the matching flag in the PostHog UI.

```ts
import { FEATURE_FLAGS } from '@meal-diary/shared';
import { useFeatureFlag } from '@/lib/feature-flags/useFeatureFlag';

const enabled = useFeatureFlag(FEATURE_FLAGS.featureFlagsEnabled);
```

Set `EXPO_PUBLIC_POSTHOG_KEY` (and optional `EXPO_PUBLIC_POSTHOG_HOST`) in `.env`. Leave the key empty to disable PostHog. In `__DEV__`, analytics capture is opted out while flags still evaluate. Mobile has no analytics consent UI yet (Nuxt gates capture via Silktide separately).

## Gotchas

- **`lightningcss` is pinned to `1.30.1`** in this workspace's `package.json`. Versions 1.30.2+ have a
  [visitor deserialization regression](https://github.com/parcel-bundler/lightningcss/issues/1081) that breaks
  react-native-css / NativeWind bundling (`failed to deserialize; expected an object-like struct named Specifier`).
  The root `patches/react-native-css+3.0.7.patch` also makes the compiler prefer this project-local copy over the
  hoisted monorepo copy (which other workspaces like Tailwind/Vite keep at a newer version). Don't remove either
  without re-testing `npx expo export --platform android`.

## Typecheck

```bash
npm run build --workspace=meal-diary-mobile
```
