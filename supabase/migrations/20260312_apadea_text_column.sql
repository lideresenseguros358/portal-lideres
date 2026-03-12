-- Migration: Add apadea_text column for free-text APADEA dates
-- Keep apadea_date1/apadea_date2 intact to avoid breaking dependent views/policies
-- Copy any existing numeric values as seed text

ALTER TABLE important_dates
  ADD COLUMN IF NOT EXISTS apadea_text text;

-- Seed existing rows: convert old numeric day values to text
UPDATE important_dates
  SET apadea_text = CONCAT(
    COALESCE(apadea_date1::text, ''),
    CASE WHEN apadea_date2 IS NOT NULL THEN ' y ' || apadea_date2::text ELSE '' END
  )
  WHERE apadea_text IS NULL
    AND (apadea_date1 IS NOT NULL OR apadea_date2 IS NOT NULL);
