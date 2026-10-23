# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Meal Diary is a full-stack meal planning app in an npm workspaces monorepo:
- **API** (`/workspace/api`): Express 5 + Sequelize + PostgreSQL on port 3001
- **Frontend** (`/workspace/frontend`): Nuxt 3 SSR product app on port 3000 (`app.mealdiary.co.uk`)
- **Marketing** (`/workspace/apps/marketing`): Nuxt 3 SSR SEO site on port 3010 (`mealdiary.co.uk`) — package `meal-diary-marketing`
- **Mobile** (`/workspace/apps/mobile`): Expo React Native app (Android-first dev)
- **Shared** (`/workspace/packages/shared`): Shared types and constants (`@meal-diary/shared`)

See `readme.md` for standard setup steps.

### Starting services

1. **Install dependencies** (once from repo root): `npm install`
2. **PostgreSQL**: `sudo dockerd &>/tmp/dockerd.log &` then `sudo docker compose up -d postgres` from `/workspace`. Requires Docker + fuse-overlayfs + iptables-legacy (see below).
3. **API**: `npm run dev --workspace=meal-diary-api` — runs on port 3001. Requires `api/.env` with `DEV_DB_*`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=development`.
4. **Frontend**: `npm run dev --workspace=nuxt-app` — runs on port 3000. Requires `frontend/.env` with `BASE_URL=http://localhost:3001`.
5. **Marketing** (optional): `npm run dev:marketing` — Nuxt marketing site on port **3010**. Copy `apps/marketing/.env.example` → `apps/marketing/.env`. Uses Silktide Consent Manager (same assets/API pattern as product web): Essential is site-only (no analytics SDKs); Analytics consent gates GA4 + PostHog (including error reporting and `marketing_*` events). Fail closed — no PostHog/GA network until accept. No product API calls.
6. **Mobile**: `npm run dev:mobile` — Expo dev server on port **3002**. Requires `apps/mobile/.env.development` with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001` (Android emulator) or your LAN IP for a physical device. Release builds use `apps/mobile/.env.production`. For web via `dev-app.mealdiary.co.uk`, use `npm run dev:mobile:proxy:https` (HTTPS required for Google Sign-In). Calls the Express API directly (not Nuxt). iOS builds are deferred (Apple Developer Program required).
7. **All services via Docker Compose**: `sudo docker compose up` from `/workspace` (installs from monorepo root). Optional marketing: `sudo docker compose --profile marketing up marketing`.

### Docker in Cloud VM

Docker requires these workarounds in the Cloud Agent environment:
- Storage driver must be `fuse-overlayfs` (configured via `/etc/docker/daemon.json`)
- iptables must use legacy mode: `sudo update-alternatives --set iptables /usr/sbin/iptables-legacy`
- Start dockerd manually: `sudo dockerd &>/tmp/dockerd.log &`
- Use `sudo docker compose` (not `docker compose`) since the user may not be in the docker group

### Environment files

- `api/.env` — copy from `api/.env.example`. Dev DB defaults: name=`meal-diary-dev`, user=`postgres`, password=`postgres`, port=`5432`. Use `DEV_DB_HOST=localhost` when the API runs on the host; use `DEV_DB_HOST=postgres` when the API runs via `docker compose`. Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to any string. Set `NODE_ENV=development`. If you change Postgres credentials, run `docker compose down -v` once so the volume is recreated.
- `apps/mobile/.env.development` — dev API URL (`http://10.0.2.2:3001` for Android emulator, LAN IP for a physical device) and `https://dev-app.mealdiary.co.uk`. `apps/mobile/.env.production` — `https://api.mealdiary.co.uk` and `https://app.mealdiary.co.uk`. Optional PostHog: `EXPO_PUBLIC_POSTHOG_KEY` + `EXPO_PUBLIC_POSTHOG_HOST`. Do not add `.env` or `.env.local`; `.env.local` overrides production during `bundleRelease`.
- `frontend/.env` — copy from `frontend/.env.example`. Set `BASE_URL=http://localhost:3001` (public API URL for browser/OAuth redirects). For `docker compose`, set `API_INTERNAL_URL=http://api:3001` for Nuxt server routes; leave it empty when running the frontend on the host (falls back to `BASE_URL`). Optional: `POSTHOG_PUBLIC_KEY` for client feature flags (falls back to the baked-in production key).
- `apps/marketing/.env` — copy from `apps/marketing/.env.example`. Set `SITE_URL` (e.g. `http://localhost:3010` locally, `https://mealdiary.co.uk` in prod) and `APP_URL` (product app, e.g. `https://app.mealdiary.co.uk`). Optional: `GA_MEASUREMENT_ID`, `POSTHOG_PUBLIC_KEY`, `POSTHOG_HOST` (same project as product web).

### Testing

- **Unit tests (all workspaces)**: `npm test` (runs `turbo run test`)
- **API tests only**: `npm test --workspace=meal-diary-api` (vitest; unit tests mock DB — no Postgres required, but `DEV_DB_*` env vars must be set at import time)
- **Frontend e2e**: `npm run test:e2e` (Cypress; requires API + frontend running)
- **CI**: GitHub Actions runs `turbo run build` on push/PR via `.github/workflows/ci.yml` using `scripts/ci-install.sh` for Linux native deps
- **CodeQL**: Security analysis for JavaScript/TypeScript via `.github/workflows/codeql.yml` (also runs weekly on Mondays). Uses advanced setup with `scripts/ci-install.sh` — disable GitHub's CodeQL **default setup** under **Settings → Code security → Code scanning → CodeQL analysis → Disable CodeQL**, or SARIF uploads will fail.
- **No ESLint** configured in either package
- **TypeScript check (API)**: `npm run build --workspace=meal-diary-api`
- **Frontend build**: `npm run build --workspace=nuxt-app`
- **Marketing build**: `npm run build --workspace=meal-diary-marketing`
- **Mobile typecheck**: `npm run build --workspace=meal-diary-mobile`

### Gotchas

- The API uses `tsx` for TypeScript execution in dev/start scripts.
- Google OAuth is optional; the app functions without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
- PostHog analytics is optional; warnings about missing `POSTHOG_KEY` are harmless. Feature flag keys live in `packages/shared` (`FEATURE_FLAGS`); create matching flags in the PostHog UI. Nuxt loads PostHog for flags even without analytics consent / on localhost (capture stays opted out). Mobile: set `EXPO_PUBLIC_POSTHOG_KEY` in `apps/mobile/.env.development` and `.env.production`; capture stays off until the person allows analytics, and stays off in `__DEV__` even after that. Flags still evaluate.
- After login, new users are redirected to `/registration/step-2` to create or join a family group before accessing the diary.
- Some API tests have pre-existing failures related to `FamilyGroup.random_identifier` validation and `RefreshToken` unique constraint; these are not environment issues.
- New deployable services should be added under `apps/` and will be picked up automatically by npm workspaces and Turborepo.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
