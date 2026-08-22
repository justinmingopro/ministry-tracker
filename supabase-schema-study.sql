-- Study Notes + Daily Study Log - Supabase Schema
-- Run this in your Supabase SQL Editor (after supabase-schema.sql)

-- Notes imported from JW Library (.jwlibrary backup via convert_to_obsidian.py)
CREATE TABLE study_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jwlibrary_note_id TEXT UNIQUE,   -- original note GUID, so re-imports upsert instead of duplicating
  title TEXT,
  content TEXT NOT NULL,
  scripture_ref TEXT,              -- display string, e.g. "Acts 17:26, 27"
  scripture_book TEXT,             -- normalized, nullable — enables cross-referencing with visits later
  scripture_chapter INT,
  scripture_verse_start INT,
  scripture_verse_end INT,
  publication_ref TEXT,            -- e.g. "w20 January pp. 8-9"
  tags TEXT[],
  note_created_at TIMESTAMPTZ,     -- original timestamp from JW Library
  note_modified_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily study log (replaces Trello + manual calendar entry)
CREATE TABLE study_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scripture_ref TEXT,
  scripture_book TEXT,
  scripture_chapter INT,
  topic TEXT,
  notes TEXT,
  study_note_id UUID REFERENCES study_notes(id) ON DELETE SET NULL,
  calendar_event_id TEXT,          -- Google Calendar event id, for update/delete sync
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX study_notes_scripture_book_idx ON study_notes(scripture_book);
CREATE INDEX study_notes_tags_idx ON study_notes USING GIN(tags);
CREATE INDEX study_log_log_date_idx ON study_log(log_date);
CREATE INDEX study_log_scripture_book_idx ON study_log(scripture_book);

-- Auto-update updated_at (reuses the function created by supabase-schema.sql)
CREATE TRIGGER update_study_notes_updated_at
  BEFORE UPDATE ON study_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_log_updated_at
  BEFORE UPDATE ON study_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
