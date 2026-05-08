# Saheli Web Dashboard

Production-grade emergency response dashboard for the **Saheli** women safety platform. This is the **web** companion to the existing React Native Expo mobile app.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- Firebase Web SDK v11 (Auth + Firestore + Storage)
- TanStack Query, Zustand, Framer Motion, Leaflet, Recharts
- Cloudinary for media (existing project: `dbs5egjdh`)
- FastAPI backend (existing) for signed Cloudinary uploads

## Quick Start

```bash
cd web
cp .env.local.example .env.local      # values are pre-filled for the existing maitri-b92e0 project
npm install
npm run dev                            # http://localhost:3001
```

> Use `npm` or `yarn` — both work. `pnpm` is also fine.

## Available Pages (delivered in this drop)

| Route | Status | Description |
|---|---|---|
| `/login` | ✅ Page 1 — implemented | Firebase email/password, role-based redirect |
| `/super-admin` | scaffolded redirect-target | Comes in Phase 2 |
| `/station` | scaffolded redirect-target | Comes in Phase 2 |
| `/officer` | scaffolded redirect-target | Comes in Phase 2 |

## Test credentials

Create the super-admin in Firebase Auth (one-off seed):
- Email: `vikrantsinghan5@gmail.com`
- Password: `12345678`

Then create `users/{uid}` document:
```json
{ "role": "super_admin", "name": "Vikrant Singh", "email": "vikrantsinghan5@gmail.com" }
```

## Folder layout
See `PROMPT.md` (root of this folder) for the full architecture, Firestore schema, security rules and per-page specifications.

## Build / Deploy
```bash
npm run build       # next build
npm run start       # next start
# or push to Vercel — zero-config
```

## License
Proprietary — Saheli / Maitri 2025.
