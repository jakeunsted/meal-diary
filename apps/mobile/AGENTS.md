# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Running on web

`platforms` in `app.json` includes `"web"` — required, otherwise Expo falls back to the legacy `App.js`
entry instead of `expo-router/entry` and bundling fails with "Unable to resolve '../../App'".

Run web dev **from `apps/mobile`**, not the repo root (`cd apps/mobile && npx expo start --web --port 3002`) — running
it from the monorepo root points Expo at the wrong project and hits the same wrong-entry-point error.

### react-native-css / react-native-web patch

`patches/react-native-css+3.0.7.patch` (applied via `patch-package`, root `postinstall`) fixes a blank-page
crash on web: `TypeError: Cannot read properties of undefined (reading 'default')` in
`react-native-web/dist/index.js`, thrown for every core RN component (View, Text, FlatList, ScrollView,
SectionList, Image) as soon as anything touches `Animated`.

Root cause: react-native-css (nativewind v5's styling engine) globally rewrites relative imports that
resolve into `react-native-web/dist` to its own css-aware wrapper, so app code importing `FlatList` from
`react-native` gets className support. But it doesn't exclude react-native-web's *own internal* files —
e.g. `AnimatedFlatList.js` importing the plain `FlatList` — so that internal import also gets redirected,
creating a circular self-import back into `react-native-web/dist/index.js` while it's still mid-evaluation.
The patch skips the rewrite when the importing file is itself inside `react-native-web`.

If `npm install` ever seems to silently drop this fix (blank white/dark page on web, same error in console),
run `npx patch-package` manually to reapply, and verify with:
```
grep -q "self-referential circular" node_modules/react-native-css/dist/commonjs/babel/react-native-web.js
```
If nativewind/react-native-css ship an upstream fix, drop the patch and this section.

## RevenueCat / in-app subscriptions

Mobile premium uses **RevenueCat + App Store / Google Play Billing** (not Stripe). Web Stripe stays on the Nuxt app. The Express API already syncs RevenueCat webhooks into `subscriptions`.

### App env

Mode-specific URLs:

- `.env.development` — emulator/dev API + `dev-app.mealdiary.co.uk`
- `.env.production` — `https://api.mealdiary.co.uk` + `https://app.mealdiary.co.uk`

Keys in `apps/mobile/.env` / `.env.local` (see `.env.example`):

- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` — RevenueCat public Google SDK key
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` — RevenueCat public Apple SDK key

Without these keys (or on Expo web), upgrade CTAs open `${EXPO_PUBLIC_WEB_URL}/plans` instead of the in-app plans screen. Do not put `EXPO_PUBLIC_API_URL` in `.env.local` — that file outranks `.env.production` during `./gradlew bundleRelease`. Release builds still refuse local hosts in `constants/env.ts`.

### API env

- `REVENUECAT_WEBHOOK_SECRET` — Bearer token RevenueCat sends to `POST /billing/revenuecat-webhook`
- `REVENUECAT_ENTITLEMENT_ID` — entitlement identifier in RevenueCat (e.g. `family_plus`)

### Store + RevenueCat checklist

1. Create subscription products in Google Play Console (and later App Store Connect): monthly + yearly. Optional 7-day free trial to mirror web.
2. Product IDs **must** include `month` or `year`/`annual` so the API can map billing interval.
3. In RevenueCat: add apps, attach store products, create an offering with both packages, create an entitlement whose id matches `REVENUECAT_ENTITLEMENT_ID`.
4. Webhook URL: `POST {API_BASE}/billing/revenuecat-webhook` with Authorization `Bearer {REVENUECAT_WEBHOOK_SECRET}`.
5. App user id convention: `fg_{familyGroupId}` (set via `POST /billing/link-revenuecat` before purchase).
6. Add Play (and later App Store) sandbox testers.

### Dev builds

Real purchases need a **Play testing / EAS / `expo run:android` build** with native modules. Expo Go only runs RevenueCat Browser Mode and cannot fetch Play products. After installing `react-native-purchases`, rebuild the native app (`npx expo run:android` or EAS).
