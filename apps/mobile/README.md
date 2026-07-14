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
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Web client ID (audience verified by API) |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Android OAuth client for `uk.co.mealdiary.app` (recommended for dev builds) |

**Google Cloud Console setup:**

1. Create or reuse the Web OAuth client (same as backend `GOOGLE_CLIENT_ID`).
2. Create an Android OAuth client for package `uk.co.mealdiary.app` with your debug/release SHA-1 fingerprints.
3. Add **Authorized redirect URIs** on the **Web application** OAuth client (same ID as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`). Register the exact origin — not the API callback URL:
   - `https://dev-app.mealdiary.co.uk`
   - `http://localhost:3002`
   - `uk.co.mealdiary.app:/oauthredirect` (Android release/dev builds — required for `expo-auth-session`)
   - `com.mealdiary.app:/oauthredirect` (iOS, still on `com.mealdiary.app`)
   
   The app uses `window.location.origin` on web (e.g. `https://dev-app.mealdiary.co.uk`, not `/login`). Override with `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` if needed. Check the Metro console for `[Google Auth] redirectUri:` when debugging.
4. For Android native builds, `expo-auth-session` uses `uk.co.mealdiary.app:/oauthredirect` (not `mealdiary://`). Do not set `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` on Android unless you know the exact URI registered in Google Cloud Console.

Flow: Google ID token → `POST /auth/google/verify-token` on the Express API (same as the Capacitor frontend native path).

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
