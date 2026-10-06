# OuttaTime

Track time across projects, from any browser or device. Dark theme, Google sign-in, per-user data.

- **Project tiles** with Start/Stop. Several can run at once.
- **Master clock** showing the combined time of all projects in the current instance, plus this week's total.
- **Time entries** editor on each project, for fixing a forgotten stop or adding time by hand.
- **Reports** saved as frozen snapshots: this week and total summaries (time and %), a Monday–Sunday weekly breakdown, and a detailed start/stop log. Choose **Full** or **This week only**, and whether the total covers the **current instance** or **all time**. Export as **PDF, Excel, CSV**, or print.
- **New instance** resets every clock. It can save a final report first and keep your project tiles. Reports stay until you delete them.

Timers are stored as start/stop timestamps on the server, so a timer started on your phone keeps running on your laptop, and nothing is lost when a tab closes.

## Stack

Next.js 16 (App Router) · Auth.js v5 (Google) · Drizzle ORM · Postgres (Neon) · Tailwind CSS v4 · jsPDF / ExcelJS

## Run locally

```bash
npm install
cp .env.example .env.local   # then set AUTH_SECRET (npx auth secret)
npm run dev
```

With no `DATABASE_URL`, the app uses an embedded Postgres (PGlite) stored in `./.pglite`, so no database server is needed. With `DEV_LOGIN=true`, the sign-in page shows a **Dev login** button so you can try the app without Google. This button never appears in production builds.

## Deploy to Vercel

1. **Import the repo** at [vercel.com/new](https://vercel.com/new). The framework is detected automatically.
2. **Add a database:** in the project, go to *Storage → Create → Neon (Postgres)* and connect it. This sets `DATABASE_URL` for you. Migrations run automatically during each build.
3. **Create Google OAuth credentials** at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials):
   - *Create credentials → OAuth client ID → Web application*
   - Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`. For local Google testing, also add `http://localhost:3000/api/auth/callback/google`.
   - You may need to configure the OAuth consent screen first. Set it to *External* and add yourself as a test user, or publish it.
4. **Set environment variables** in *Settings → Environment Variables*:
   | Name | Value |
   |---|---|
   | `AUTH_SECRET` | output of `npx auth secret` |
   | `AUTH_GOOGLE_ID` | Google client ID |
   | `AUTH_GOOGLE_SECRET` | Google client secret |
5. **Redeploy.**

## Database changes

Edit `src/db/schema.ts`, then:

```bash
npm run db:generate   # writes a new SQL migration to ./drizzle
npm run db:migrate    # applies it (also runs automatically on dev/build)
```

## Project layout

```
src/
  app/
    actions.ts            server actions (every query is scoped to the signed-in user)
    page.tsx              sign-in
    onboarding/           timezone selection on first login
    (app)/dashboard/      timers + master clock
    (app)/reports/        reports list and report view
    (app)/settings/       timezone, sign out
  components/             client UI (tiles, dialogs, report view)
  db/                     Drizzle schema + connection (Neon or local PGlite)
  lib/
    report.ts             builds frozen report snapshots
    export.ts             PDF / Excel / CSV export
    time.ts               timezone + Monday–Sunday week math
```
