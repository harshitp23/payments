# Payments

Student money planner: semester fixed costs (college + stay), subscriptions, trips and other
estimates, and expected job income — with "left over" for the semester.

Vite + React + TypeScript, Supabase (Postgres + RLS + magic-link auth).

## Setup

1. In the Supabase SQL editor, run in order:
   - `supabase/001_payments_schema.sql`
   - `supabase/002_semesters_trips_income.sql`
2. Supabase dashboard → Authentication → URL Configuration: set **Site URL** to
   `http://localhost:5173` (add your deployed URL to **Redirect URLs** later).
3. `cp .env.example .env.local` and fill in the project URL and anon key
   (Project Settings → API). Optionally set `VITE_CURRENCY` (default `USD`).
4. `npm install`, then `npm run dev`.

## Scripts

- `npm run dev` — local dev server
- `npm test` — unit tests for scheduling / money logic
- `npm run build` — type-check and production build
