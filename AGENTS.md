# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Meal Diary is a full-stack meal planning app with two services:
- **API** (`/workspace/api`): Express 5 + Sequelize + PostgreSQL on port 3001
- **Frontend** (`/workspace/frontend`): Nuxt 3 SSR app on port 3000

See `readme.md` for standard setup steps.

### Starting services

1. **PostgreSQL**: `sudo dockerd &>/tmp/dockerd.log &` then `sudo docker compose up -d postgres` from `/workspace`. Requires Docker + fuse-overlayfs + iptables-legacy (see below).
2. **API**: `cd /workspace/api && npm run dev` — runs on port 3001. Requires `.env` with `DEV_DB_*`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=development`.
3. **Frontend**: `cd /workspace/frontend && npm run dev` — runs on port 3000. Requires `.env` with `BASE_URL=http://localhost:3001`.

### Docker in Cloud VM

Docker requires these workarounds in the Cloud Agent environment:
- Storage driver must be `fuse-overlayfs` (configured via `/etc/docker/daemon.json`)
- iptables must use legacy mode: `sudo update-alternatives --set iptables /usr/sbin/iptables-legacy`
- Start dockerd manually: `sudo dockerd &>/tmp/dockerd.log &`
- Use `sudo docker compose` (not `docker compose`) since the user may not be in the docker group

### Environment files

- `api/.env` — copy from `api/.env.example`. Dev DB defaults: name=`meal-diary-dev`, user=`postgres`, password=`postgres`, host=`localhost`, port=`5432`. Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to any string. Set `NODE_ENV=development`.
- `frontend/.env` — copy from `frontend/.env.example`. Set `BASE_URL=http://localhost:3001`.

### Testing

- **API tests**: `cd /workspace/api && npm test` (vitest + supertest, requires running PostgreSQL)
- **No ESLint** configured in either package
- **TypeScript check (API)**: `cd /workspace/api && npx tsc --noEmit`
- **Frontend build**: `cd /workspace/frontend && npm run build`

### Gotchas

- The API uses `node --experimental-strip-types --experimental-transform-types` for native TypeScript execution; requires Node.js 22.7+.
- The API `package.json` lacks `"type": "module"` so Node emits a reparsing warning; this is harmless.
- Google OAuth is optional; the app functions without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.
- PostHog analytics is optional; warnings about missing `POSTHOG_KEY` are harmless.
- After login, new users are redirected to `/registration/step-2` to create or join a family group before accessing the diary.
- Some API tests have pre-existing failures related to `FamilyGroup.random_identifier` validation and `RefreshToken` unique constraint; these are not environment issues.
