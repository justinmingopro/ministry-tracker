-- Letters (elder correspondence/instructions from jw.org hub) - Supabase Schema
-- Run this in your Supabase SQL Editor (after supabase-schema-rls.sql)

-- One row per uploaded PDF. `content` holds the extracted text of the PDF
-- (filled in by /api/letters-extract-text right after upload) so letters can
-- be found by what they actually say, not just a manually-typed title.
CREATE TABLE IF NOT EXISTS letters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  tags TEXT[],
  letter_date DATE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS letters_created_at_idx ON letters(created_at DESC);

ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated access" ON letters;
CREATE POLICY "authenticated access" ON letters FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigram indexes so ILIKE search across title/description/content stays fast
-- as the collection grows (same approach as study_notes's search support).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS letters_title_trgm_idx ON letters USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS letters_content_trgm_idx ON letters USING gin (content gin_trgm_ops);

-- Storage bucket holding the actual PDF files. Private (not `public`), since
-- access is gated the same way as everything else in this app: a valid
-- "authenticated" Supabase session, via the policy below rather than a
-- world-readable bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('letters', 'letters', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "authenticated letters storage access" ON storage.objects;
CREATE POLICY "authenticated letters storage access" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'letters')
  WITH CHECK (bucket_id = 'letters');
