# AI Envisioning Workshop Management

Dell + Microsoft co-branded workshop management platform.

## Prerequisites

- Node.js 22 LTS or newer
- npm 10 or newer

## Project Layout

This repository contains two independent npm projects:

- `backend/`
- `frontend/`

Each project owns its package file, config files, environment example, dependencies, and scripts.

## Backend

NestJS/TypeScript API and backend worker.

```bash
cd backend
npm install
npm run dev
npm run build
npm run test
npm run lint
npm run typecheck
```

The backend exposes `GET /api/health` at `http://localhost:4000/api/health`.

## Frontend

React/Vite/TypeScript client.

```bash
cd frontend
npm install
npm run dev
npm run build
npm run test
npm run lint
npm run typecheck
```

The frontend runs at `http://localhost:5173`.

## Local Services

Phase 1 adds the local Docker stack:

```bash
docker compose up --build
```

Development endpoints:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:4000/api/health`
- Mailpit UI: `http://localhost:8025`
- PostgreSQL: `localhost:5432`

The backend initializes a TypeORM PostgreSQL connection on startup. Uploaded files are stored under `backend/uploads/` in the local Docker stack.

## Database

Run migrations and development seed from the backend project:

```bash
cd backend
npm run migration:run
npm run seed:dev
```

Rollback the latest migration:

```bash
cd backend
npm run migration:revert
```

For a local rebuild, reset the Docker database volume and re-run migrations and seed:

```bash
docker compose down -v
docker compose up -d postgres mailpit
cd backend
npm run migration:run
npm run seed:dev
```

The development seed is disabled when `NODE_ENV=production`.

Country options are stored in the `countries` table and are intentionally not seeded. Add active ISO 3166-1 alpha-2 rows (`code`, `name`, `active`) before submitting workshop requests. The requester form loads active countries and the configured programme currency from `GET /api/public/workshop-options`.

Workshop tracking links require a one-time code sent to the workshop creator's exact email domain. Tracking sessions are workshop-scoped, stored as token hashes, and expire after eight hours by default. Run `npm run migration:run` after pulling database changes.

For production, set `APP_BASE_URL` to the public frontend origin and `VITE_API_BASE_URL` to the public HTTPS API origin. Credentialed API requests require the frontend origin to match the API CORS allowlist; production session cookies use `SameSite=None; Secure` for cross-site deployments.

Admin access is available at `/admin/login`. Locally, run `npm run seed:dev` from `backend/`; the seeded email and password come from `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`. Admin sessions have a 30-minute idle timeout and a 12-hour absolute timeout by default. Login throttling is stored in PostgreSQL so it is shared across API instances.
