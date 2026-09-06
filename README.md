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

## Importing from Trello (one-time migration)

`scripts/import_trello.py` is a one-time migration for people moving off two Trello
boards used before this app existed:

- A **return visits** board where each list is one contact and each card in it is a
  visit (or an "Address"/"Phone" metadata card) — imported into `contacts` + `visits`.
- A **personal study** board where each list is a month and each card is one day's
  study entry (e.g. `"12: Isa 24:1,2"` or `"8: Meeting prep"`) — imported into
  `study_log`. Bare chapter:verse entries with no book name are assumed to continue
  whichever book was most recently named, since that's how a running Bible-reading
  log is normally kept.

Unlike the JW Library/Bear imports, this isn't an ongoing sync — run it once per
board. First run `supabase-schema-trello.sql` in the Supabase SQL editor (adds a
`trello_list_id`/`trello_card_id` column to `contacts`/`visits`/`study_log` so a
re-run upserts instead of duplicating, same pattern as the other import tables).

Getting the export: open the board → menu (`...`) → **Print, export, and share** →
**Export as JSON**. If that opens a blank/blocked tab, visit the board's URL with
`.json` appended instead (e.g. `https://trello.com/b/AbCd1234/board-name.json`) —
either way, save the resulting raw JSON text as a `.json` file.

```
python scripts/import_trello.py return-visits.json personal-study.json          # dry run — prints a preview, writes nothing
python scripts/import_trello.py return-visits.json personal-study.json --commit # actually imports
```

Always review the dry-run preview first. In particular: archived (closed) Trello
lists are imported as contacts with status `moved`, since Trello doesn't record why
a list was archived — correct these individually in the Contacts tab afterward if
some were actually "not interested" or "do not call" instead. Historical study log
entries are **not** pushed to your iCloud calendar (unlike new entries logged
through the app), to avoid retroactively flooding it with hundreds of events.

## Importing Bear notes

Bear's notes database only lives on-device — there's no API and nothing this app can
poll from a server. Two ways to get a note in, both landing in the same `bear_notes`
table and both read-only (nothing is ever written back to Bear):

### Paste it in (recommended for occasional notes)

The **Search** tab has an **Add Note** button. Open your note in Bear, select all
the text and copy it (Bear's editor is plain text with Markdown formatting, so a
plain copy already includes the raw `==highlight==` markup around anything you
highlighted), paste it into the box, and save. The title defaults to the note's
first line if left blank, and tags default to any `#hashtags` found in the text.
Scripture references wrapped in `==...==` (i.e. anything you highlighted in Bear)
are auto-detected and linked. Good for the "a few notes every few months" case —
no setup required.

### iOS Shortcut (for frequent notes)

If you add Bear notes often enough that pasting each one in gets tedious, a
Shortcut can automate it: search Bear notes by tag, pull their title/content/tags/
dates, and POST them as a batch to `/api/bear-import`:
```json
{ "notes": [ { "id": "...", "title": "...", "content": "...", "tags": [...], "created": "...", "modified": "..." } ] }
```
`content` needs to be the plain Markdown text (not HTML) for `==highlight==`
scripture detection to work, and `id` should be something stable (Bear's own note
identifier) so re-running the Shortcut upserts instead of duplicating. Bear's exact
action names vary by version (look for something like "Search Notes" and "Get
Contents of Bear Notes") — ask Claude to help you build this against your specific
version if you want to set it up.

## Calendar sync

Study Log entries are pushed to an iCloud calendar via CalDAV (`/api/calendar-push`),
since Apple's calendars don't have a REST API the way Google's does. Create/rename a
calendar named `JW/Ministry` in the Calendar app (or set
`ICLOUD_STUDY_CALENDAR_NAME` to whatever you name it) before logging your first
study entry, or the push will fail with a "calendar not found" error listing the
calendars it *did* find on your account.
