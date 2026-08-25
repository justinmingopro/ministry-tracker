-- Bear Notes - Supabase Schema
-- Run this in your Supabase SQL Editor (after supabase-schema-study.sql)

-- Notes imported from Bear (convention/assembly/talk notes), read-only mirror.
-- Populated by an iOS Shortcut hitting /api/bear-import, not by JW Library.
CREATE TABLE bear_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bear_note_id TEXT UNIQUE NOT NULL,   -- Bear's own note identifier, so re-imports upsert
  title TEXT,
  content TEXT NOT NULL,
  scripture_refs JSONB DEFAULT '[]'::jsonb,  -- [{ref, book, chapter, verse_start, verse_end}, ...] parsed from ==highlights==
  tags TEXT[],
  note_created_at TIMESTAMPTZ,
  note_modified_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX bear_notes_scripture_refs_idx ON bear_notes USING GIN(scripture_refs);
CREATE INDEX bear_notes_tags_idx ON bear_notes USING GIN(tags);
CREATE INDEX bear_notes_content_idx ON bear_notes USING GIN(to_tsvector('english', content));

CREATE TRIGGER update_bear_notes_updated_at
  BEFORE UPDATE ON bear_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
