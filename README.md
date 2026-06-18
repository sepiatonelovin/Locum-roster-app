# Locum Roster Portal

A small roster tool for a polyclinic: an admin opens AM/PM/whole-day slots on a calendar, locums log in with a code and request slots, and the admin approves or rejects requests. Built with React + Vite, Tailwind, and Supabase as the backend (with realtime sync across everyone using it).

I can't create your Supabase project, push to your GitHub, or deploy to Netlify for you — those steps need your own accounts/credentials. Everything below is what's left to do, in order.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a free project, and wait for it to finish provisioning.
2. Open **SQL Editor** → **New query**, paste in the contents of `supabase/schema.sql` from this project, and run it. This creates the three tables (`locums`, `roster_slots`, `app_state`), turns on realtime for them, and seeds two demo locums (Dr Tan / code `1234`, Dr Lim / code `5678`) so you have something to log in with immediately.
3. Go to **Settings → API**. You'll need the **Project URL** and the **anon public** key in the next step.

## 2. Run it locally first

1. Unzip this project and open a terminal in its folder.
2. Copy `.env.example` to `.env` and fill in the two values from Supabase:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
3. Install and run:
   ```
   npm install
   npm run dev
   ```
4. Open the local URL it prints. Log in with `admin2026` (the admin code) or `1234` / `5678` (the seeded demo locums) and try the full flow: open some slots, log out, log in as a locum and request one, log out, log back in as admin and approve it.

## 3. Push to GitHub

```
git init
git add .
git commit -m "Locum roster portal"
```
Create a new empty repository on GitHub, then follow the push instructions GitHub gives you (`git remote add origin ...`, `git push -u origin main`).

## 4. Deploy on Netlify

1. In Netlify: **Add new site → Import an existing project**, and connect the GitHub repo you just pushed.
2. Netlify should auto-detect the build command (`npm run build`) and publish directory (`dist`) from `netlify.toml`. If it doesn't, set them manually.
3. Before the first deploy (or after, then redeploy), go to **Site configuration → Environment variables** and add the same two variables from your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Once it's live, repeat the same login test from step 2 on the real URL.

## What to know before relying on this day to day

- **The admin code and locum codes are not real authentication.** They're compared in the browser, not verified server-side, and the codes themselves are stored as plain text. This is fine for an internal pilot with people you trust, but not for anything sensitive.
- **Row Level Security is switched off** on all three tables (see the comment in `schema.sql`), so anyone with your Supabase URL and anon key — both visible in your deployed site's source — could read or write roster data directly, bypassing the app entirely. The proper fix is Supabase Auth with real RLS policies; that's a separate piece of work from what's here, and I'm happy to help with it when you're ready.
- **Personal data**: the `locums` table stores names and email addresses. Worth a quick check with your polyclinic's IT/data governance process before this becomes the system of record, given PDPA — I'm not a lawyer, just flagging it.
- The old "reset this month's test data" button has been removed now that this writes to a real database — there's no undo button for deleting a real month's roster.

## Project structure

```
src/App.jsx            – the whole app (UI + Supabase calls)
src/supabaseClient.js  – Supabase client setup (reads from .env)
supabase/schema.sql    – run this once in Supabase's SQL editor
netlify.toml           – Netlify build settings
.env.example           – copy to .env and fill in your Supabase values
```
