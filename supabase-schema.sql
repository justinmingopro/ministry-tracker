-- Ministry Visit Tracker - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Contacts table (people you've contacted)
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  territory TEXT,
  status TEXT DEFAULT 'interested' CHECK (status IN ('interested', 'not interested', 'studying', 'moved', 'do not call')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visits table (individual visits per contact)
CREATE TABLE visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scripture TEXT,
  topic TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX visits_contact_id_idx ON visits(contact_id);
CREATE INDEX contacts_status_idx ON contacts(status);
CREATE INDEX contacts_territory_idx ON contacts(territory);

-- Auto-update updated_at on contacts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
