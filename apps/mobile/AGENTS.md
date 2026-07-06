# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Running on web

`platforms` in `app.json` includes `"web"` — required, otherwise Expo falls back to the legacy `App.js`
entry instead of `expo-router/entry` and bundling fails with "Unable to resolve '../../App'".

Run web dev **from `apps/mobile`**, not the repo root (`cd apps/mobile && npx expo start --web`) — running
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
