-- Row Level Security - Supabase Schema
-- Run this LAST, only after:
--   1. The new app code (login screen + service-role API routes) is deployed
--      to Vercel, AND
--   2. You've confirmed you can actually log in and use the app.
-- Enabling RLS before that will lock the live app out of its own data —
-- see README's "Security: login + Row Level Security" section.

-- This is a single-user app with no per-row ownership concept (no user_id
-- columns), so every policy below is simply "must be logged in" — not
-- per-row filtering. That's what actually closes the hole: today the anon
-- key (which is always public — it ships in the deployed JS bundle by
-- design) has full read/write access with nothing checking who's asking.
-- After this, the anon key alone is useless without a real login.

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bear_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pub_talk_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated access" ON contacts;
CREATE POLICY "authenticated access" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated access" ON visits;
CREATE POLICY "authenticated access" ON visits FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated access" ON study_notes;
CREATE POLICY "authenticated access" ON study_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated access" ON study_log;
CREATE POLICY "authenticated access" ON study_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated access" ON bear_notes;
CREATE POLICY "authenticated access" ON bear_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated access" ON pub_talk_trades;
CREATE POLICY "authenticated access" ON pub_talk_trades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- bear_notes writes from api/bear-import.js and all writes from api/search.js's
-- notes lookup use the service-role key or a forwarded user session
-- respectively (see api/*.js) — both bypass or satisfy these policies
-- correctly, so no separate policy is needed for them.
