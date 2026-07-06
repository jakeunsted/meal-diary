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

Press **`a`** in the Expo CLI to open on the Android emulator, or scan the QR code with **Expo Go** on a physical device.

> **Web is disabled** (`platforms: ios, android` only). NativeWind v5 + Gluestack do not support web bundling yet.

### API URL

| Environment | `EXPO_PUBLIC_API_URL` |
|-------------|----------------------|
| Android emulator | `http://10.0.2.2:3001` |
| Physical device | `http://<your-lan-ip>:3001` |
| Browser (unsupported) | `http://localhost:3001` |
| Production | `https://api.mealdiary.co.uk` |

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

## Typecheck

```bash
npm run build --workspace=meal-diary-mobile
```
