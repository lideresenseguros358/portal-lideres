-- Migration: Create config_agenda table for LINK LISSA Recurrente
-- Date: 2025-10-04
-- Description: Stores recurring LISSA link configuration per user

-- Create table
CREATE TABLE IF NOT EXISTS config_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lissa_recurring_link text,
  lissa_meeting_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_config_agenda_user_id 
ON config_agenda(user_id);

-- Enable RLS
ALTER TABLE config_agenda ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own agenda config"
ON config_agenda
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agenda config"
ON config_agenda
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agenda config"
ON config_agenda
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agenda config"
ON config_agenda
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_config_agenda_updated_at 
BEFORE UPDATE ON config_agenda
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Insert comment
COMMENT ON TABLE config_agenda IS 'Stores LINK LISSA recurring configuration for agenda module';
