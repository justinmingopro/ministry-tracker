-- Study Log start/end time - Supabase Schema
-- Run this in your Supabase SQL Editor (after supabase-schema-study.sql)

-- Optional start/end time for a study_log entry. When both are set, the
-- pushed iCloud calendar event is a timed event instead of all-day — see
-- api/calendar-push.js.
ALTER TABLE study_log ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE study_log ADD COLUMN IF NOT EXISTS end_time TIME;
