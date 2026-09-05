# Ministry Tracker

A personal app for tracking return visits/Bible studies, a daily study log synced to
an iCloud calendar, and a searchable archive of notes pulled in from both **JW Library**
and **Bear**.

React + [Supabase](https://supabase.com) (Postgres) for data, deployed as a set of
Vercel serverless functions (`/api/*`) alongside the static frontend.

## Features

- **Contacts** — return visit / Bible study contacts with status, territory, and a
  full visit history per person.
- **Study Log** — a daily log of personal/family study, each entry pushed to an
  iCloud calendar (via CalDAV) so it shows up alongside everything else on your phone.
- **Study Notes** — a read-only archive of notes exported from JW Library, imported
  from a `.jwlibrary` backup file. Scripture references are hyperlinked to
  [wol.jw.org](https://wol.jw.org).
- **Bear notes** — a read-only mirror of notes from the [Bear](https://bear.app) app
  (e.g. convention/assembly talk notes), pushed in from an iOS Shortcut. Scripture
  references inside `==highlighted==` text are parsed out automatically.
- **Search** — one search box across both JW Library notes and Bear notes.

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then run these SQL files
in the Supabase SQL Editor, **in order**, from the project root:

1. `supabase-schema.sql` — contacts + visits
2. `supabase-schema-study.sql` — study log + JW Library study notes
3. `supabase-schema-bear.sql` — Bear notes

### 2. Environment variables

Copy `.env.example` to `.env.local` for local development:

```
REACT_APP_SUPABASE_URL=...
REACT_APP_SUPABASE_ANON_KEY=...
```

Both values are under **Project Settings → API** in Supabase.

For deployment (Vercel project env vars — not committed anywhere), also set:

| Variable | Used by | Notes |
|---|---|---|
| `REACT_APP_SUPABASE_URL` / `REACT_APP_SUPABASE_ANON_KEY` | frontend + both API routes | same values as above |
| `ICLOUD_APPLE_ID` | `/api/calendar-push` | your Apple ID email |
| `ICLOUD_APP_SPECIFIC_PASSWORD` | `/api/calendar-push` | an **app-specific** password from [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords. Not your real Apple ID password, revocable anytime. |
| `ICLOUD_STUDY_CALENDAR_NAME` | `/api/calendar-push` | must exactly match the calendar's display name in the Calendar app/iCloud. Defaults to `JW/Ministry`. |
| `BEAR_IMPORT_TOKEN` | `/api/bear-import` | optional but recommended — a random string. If set, the Bear import endpoint requires `Authorization: Bearer <token>`; if unset, the endpoint accepts unauthenticated requests from anyone who finds the URL. |

### 3. Install and run

```
npm install
npm start        # local dev server
npm run build    # production build
```

## Importing JW Library notes

`scripts/import_jwlibrary.py` reads a `.jwlibrary` backup file and upserts its notes
into the `study_notes` table. No third-party dependencies (stdlib only), so it can
run from a scheduled task without a `pip install` step.

```
python scripts/import_jwlibrary.py [path-to-backup.jwlibrary]
```

- If no path is given, it uses the most recently modified `*.jwlibrary` file in
  `JWLIBRARY_BACKUP_DIR` (defaults to `~/iCloudDrive`) — convenient if JW Library is
  set to back up there automatically.
- Needs `SUPABASE_URL`/`SUPABASE_ANON_KEY` (or the `REACT_APP_`-prefixed names),
  either as environment variables or in a `.env.local`/`.env` file in the repo root.
- Safe to re-run: notes are upserted on their JW Library GUID, so re-imports update
  existing rows instead of duplicating them. Notes deleted in JW Library are **not**
  deleted here — this is a one-way archive, not a live mirror.

## Importing Bear notes

Bear's notes database only lives on-device — there's no API and nothing this app can
poll from a server. Instead, an **iOS Shortcut** run on your phone/iPad reads your
Bear notes and POSTs them to `/api/bear-import`, which upserts them into `bear_notes`
and parses out any scripture references it finds inside `==highlighted==` text.

### Setting up the Shortcut

1. Open the **Shortcuts** app → **+** to create a new shortcut.
2. Add the **Find Notes** action (from the Bear app's Shortcuts actions) to get the
   notes you want to import — e.g. filtered by a tag like `#talk` or `#convention`.
   (If you don't tag talk notes yet, tag the ones you want archived here — the
   Shortcut only needs to import what you point it at, not your whole Bear database.)
3. Add a **Repeat with Each** action over those notes, and inside it build a
   dictionary per note with:
   - `id` — the note's unique identifier (use **Get Details of Notes** → *Unique
     Identifier*)
   - `title` — the note's title
   - `content` — the note's text (plain text, not HTML — Bear's `==highlight==`
     markdown syntax needs to survive for scripture parsing to work)
   - `tags` — the note's tags, as a list
   - `created` / `modified` — the note's creation/modification dates, as ISO 8601
     strings (**Format Date** action, using the *ISO 8601* format)
4. Add each dictionary to a list (**Add to Variable**), outside the Repeat loop.
5. After the loop, use **Get Contents of URL**:
   - URL: `https://<your-deployed-app>/api/bear-import`
   - Method: `POST`
   - Headers: `Content-Type: application/json`, and if you set `BEAR_IMPORT_TOKEN`,
     `Authorization: Bearer <your-token>`
   - Request Body: JSON, with a single key `notes` set to the list built above —
     i.e. `{ "notes": [ {...}, {...} ] }`
6. Run the Shortcut. On success it returns `{ "imported": <count>,
   "scriptureRefsFound": <count> }`.

Re-running the Shortcut is safe — notes are upserted on Bear's own note `id`, so
re-imports update existing rows instead of duplicating them. This is read-only:
nothing is ever written back to Bear.

**Tip:** add the Shortcut to an Automation (e.g. "when Bear is closed" or a daily
time-of-day trigger) so your talk notes stay in sync without having to remember to
run it manually.

## Calendar sync

Study Log entries are pushed to an iCloud calendar via CalDAV (`/api/calendar-push`),
since Apple's calendars don't have a REST API the way Google's does. Create/rename a
calendar named `JW/Ministry` in the Calendar app (or set
`ICLOUD_STUDY_CALENDAR_NAME` to whatever you name it) before logging your first
study entry, or the push will fail with a "calendar not found" error listing the
calendars it *did* find on your account.
