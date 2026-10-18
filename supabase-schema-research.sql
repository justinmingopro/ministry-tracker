-- Research Assistant session history - Supabase Schema
-- Run this in your Supabase SQL Editor (after supabase-schema-rls.sql, since this
-- enables RLS immediately — there's no pre-existing anon-key traffic to this new
-- table to worry about breaking, unlike the original RLS rollout).

-- One row per research-assistant conversation. turns is the full back-and-forth,
-- oldest first: [{q, a, references: [{table, id, title}]}, ...]. Rewritten in full
-- on every turn (simplest correct approach at this scale) rather than appended to
-- piecemeal.
CREATE TABLE IF NOT EXISTS research_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_question TEXT NOT NULL,
  turns JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_sessions_updated_at_idx ON research_sessions(updated_at DESC);

ALTER TABLE research_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated access" ON research_sessions;
CREATE POLICY "authenticated access" ON research_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
