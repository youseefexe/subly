-- Run this in your Supabase SQL editor to add the neighborhood column to listings

ALTER TABLE listings ADD COLUMN IF NOT EXISTS neighborhood text;
