-- Trello import support - Supabase Schema
-- Run this in your Supabase SQL Editor (after supabase-schema.sql and
-- supabase-schema-study.sql), before running scripts/import_trello.py --commit

-- Lets a re-run of scripts/import_trello.py upsert instead of duplicating,
-- same pattern as bear_note_id / jwlibrary_note_id on the other import tables.
ALTER TABLE contacts ADD COLUMN trello_list_id TEXT UNIQUE;
ALTER TABLE visits ADD COLUMN trello_card_id TEXT UNIQUE;
ALTER TABLE study_log ADD COLUMN trello_card_id TEXT UNIQUE;
