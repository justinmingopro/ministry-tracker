-- Study Notes: server-side search support at scale - Supabase Schema
-- Run this in your Supabase SQL Editor (after supabase-schema-study.sql)
--
-- study_notes has grown past 13,000 rows. The Study Notes tab used to load
-- the whole table client-side with no .limit() and search/filter in the
-- browser — but Supabase/PostgREST silently caps an unlimited request at
-- the project's Max Rows setting (1000 by default), so anything past the
-- newest page was invisible to search entirely. The app now queries the
-- database directly for both search and the tag list.

-- Distinct tags across the WHOLE table (not just whatever page happens to be
-- loaded) for the tag filter dropdown.
CREATE OR REPLACE FUNCTION study_notes_distinct_tags()
RETURNS TABLE(tag TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT DISTINCT unnest(tags) AS tag
  FROM study_notes
  WHERE tags IS NOT NULL
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION study_notes_distinct_tags() TO authenticated;

-- Trigram indexes so ILIKE '%term%' search stays fast as the table keeps growing.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS study_notes_content_trgm_idx ON study_notes USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS study_notes_title_trgm_idx ON study_notes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS study_notes_scripture_ref_trgm_idx ON study_notes USING gin (scripture_ref gin_trgm_ops);
