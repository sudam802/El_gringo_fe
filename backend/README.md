# Backend (local)

This Next.js frontend expects a backend at `NEXT_PUBLIC_BACKEND_URL` (default: `http://localhost:5000`).

## Run

```bash
cd backend
npm install
npm run dev
```

## Environment

- `PORT` (default `5000`)
- `FRONTEND_ORIGIN` (default `http://localhost:3000`) for CORS
- `JWT_SECRET` (required) used to sign the session cookie
- `COOKIE_SECURE` (`true|false`, default `false`) set `true` in production (HTTPS)

## Data storage

Local JSON file database at `backend/data/db.json` (created automatically).

