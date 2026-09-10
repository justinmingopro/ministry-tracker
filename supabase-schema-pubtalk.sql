-- Public Talk Trades - Supabase Schema
-- Run this in your Supabase SQL Editor (after supabase-schema.sql)

-- Tracks which congregation has confirmed a bilateral public talk trade for a
-- given month (replaces the "Pub Talk Trades" Google Doc). NW Scheduler
-- handles the actual movement of individual speakers — this table only
-- tracks the month-level trade agreement: who, and when it was confirmed.
CREATE TABLE IF NOT EXISTS pub_talk_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_month DATE NOT NULL UNIQUE,  -- normalized to the 1st of the month, e.g. 2026-02-01
  congregation TEXT,
  coordinator_name TEXT,
  coordinator_phone TEXT,
  coordinator_email TEXT,
  confirmed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pub_talk_trades_trade_month_idx ON pub_talk_trades(trade_month);

-- Reuses the update_updated_at_column() trigger function created by supabase-schema.sql
DROP TRIGGER IF EXISTS update_pub_talk_trades_updated_at ON pub_talk_trades;
CREATE TRIGGER update_pub_talk_trades_updated_at
  BEFORE UPDATE ON pub_talk_trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
