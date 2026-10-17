# Meal diary

An application to plan the weeks meals!

A food diary and shopping list that are shareable amongst your household with family groups.

<div>
  <img src="./screenshots/diary.png" alt="Screenshot of the meal diary page" height="400" />
  <img src="./screenshots/shoppinglist.png" alt="Screenshot of the meal diary page" height="400" />
</div>

## How to install (DEV)

This repo is an npm workspaces monorepo. Install once from the root:

```bash
npm install
```

### Environment

- **API** — copy `api/.env.example` to `api/.env`. DB can be the local Postgres from `docker-compose.yml`. Set `WEBHOOK_BASE_URL` to the Nuxt server address with path `/api/webhook`.
- **Frontend** — copy `frontend/.env.example` to `frontend/.env`. Set `BASE_URL` to the API URL (e.g. `http://localhost:3001`).
- **Mobile** — copy `apps/mobile/.env.example` to `apps/mobile/.env`. Set `EXPO_PUBLIC_API_URL` to the API URL (`http://10.0.2.2:3001` for Android emulator).
- **Marketing** (optional) — copy `apps/marketing/.env.example` to `apps/marketing/.env`. Public site for `mealdiary.co.uk` (separate from the logged-in app at `app.mealdiary.co.uk`). Uses the same Silktide Consent Manager pattern as product web; Essential is site-only; Analytics consent gates GA4 + PostHog (no analytics SDKs until accept).

### Run locally (host)

```bash
# API (port 3001)
npm run dev --workspace=meal-diary-api

# Frontend (port 3000)
npm run dev --workspace=nuxt-app

# Marketing site (port 3010) — SEO landing at mealdiary.co.uk
npm run dev:marketing

# Mobile (Expo)
npm run dev:mobile

# Or API + frontend via Turborepo
npm run dev
```

### Run with Docker Compose

Starts Postgres, API, and frontend with a single root install:

```bash
docker compose up
```

Optional marketing service (profile `marketing`, port 3010):

```bash
docker compose --profile marketing up marketing
```

### Tests

```bash
# Unit tests (API vitest, etc.)
npm test

# Frontend Cypress e2e (requires API + frontend running)
npm run test:e2e
```

## Monorepo layout

```
meal-diary/
  api/                  # Express API
  frontend/             # Nuxt product app (app.mealdiary.co.uk)
  apps/marketing/       # Nuxt marketing site (mealdiary.co.uk)
  apps/mobile/          # Expo React Native app (iOS + Android)
  packages/shared/      # Shared types and constants
```

## Deployment currently

### DB
The postgres database is currently deployed on Railway.

### API & Frontend
Deployed on Railway

### Marketing
Deploy `apps/marketing` (Dockerfile) to Railway (or similar) and point `mealdiary.co.uk` at that service. Keep `app.mealdiary.co.uk` on the product Nuxt app.
