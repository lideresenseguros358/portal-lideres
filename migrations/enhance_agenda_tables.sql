-- Enhance events table with missing fields
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS modality TEXT CHECK (modality IN ('virtual', 'presencial', 'hibrida')),
  ADD COLUMN IF NOT EXISTS zoom_url TEXT,
  ADD COLUMN IF NOT EXISTS zoom_code TEXT,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS allow_rsvp BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE;

-- Update existing location data to location_name if needed
UPDATE public.events SET location_name = location WHERE location IS NOT NULL AND location_name IS NULL;

-- Enhance event_attendees table
ALTER TABLE public.event_attendees
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('going', 'declined')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;

-- Update existing rsvp to status if needed
UPDATE public.event_attendees SET status = 'going' WHERE rsvp = 'yes' AND status IS NULL;
UPDATE public.event_attendees SET status = 'declined' WHERE rsvp = 'no' AND status IS NULL;

-- Create event_audience table if not exists (for SELECTED audience)
-- First drop orphaned type if it exists
DROP TYPE IF EXISTS public.event_audience CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'event_audience'
  ) THEN
    CREATE TABLE public.event_audience (
      event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
      broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, broker_id)
    );
  END IF;
END $$;

-- Create additional indexes
CREATE INDEX IF NOT EXISTS idx_events_modality ON public.events(modality);
CREATE INDEX IF NOT EXISTS idx_events_allow_rsvp ON public.events(allow_rsvp);

-- Create index for event_audience only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_audience') THEN
    CREATE INDEX IF NOT EXISTS idx_event_audience_broker_id ON public.event_audience(broker_id);
  END IF;
END $$;

-- Enable RLS for event_audience
DO $$
BEGIN
  ALTER TABLE public.event_audience ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- Table doesn't exist yet, will be handled by previous block
END $$;

-- RLS Policy for event_audience
DROP POLICY IF EXISTS "Allow authenticated users to view event audience" ON public.event_audience;
DROP POLICY IF EXISTS "Allow event creators to manage audience" ON public.event_audience;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_audience') THEN
    CREATE POLICY "Allow authenticated users to view event audience"
      ON public.event_audience
      FOR SELECT
      TO authenticated
      USING (true);

    CREATE POLICY "Allow event creators to manage audience"
      ON public.event_audience
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.events
          WHERE events.id = event_audience.event_id
          AND events.created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- Update RLS for event_attendees
DROP POLICY IF EXISTS "Allow authenticated users to view attendees" ON public.event_attendees;
DROP POLICY IF EXISTS "Allow brokers to manage their attendance" ON public.event_attendees;

CREATE POLICY "Allow authenticated users to view attendees"
  ON public.event_attendees
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow brokers to manage their attendance"
  ON public.event_attendees
  FOR ALL
  TO authenticated
  USING (
    broker_id IN (
      SELECT broker_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Add comments
COMMENT ON COLUMN public.events.modality IS 'Event modality: virtual, presencial, or hibrida';
COMMENT ON COLUMN public.events.allow_rsvp IS 'Whether attendees can RSVP to this event';
COMMENT ON TABLE public.event_audience IS 'Specific brokers who can see a SELECTED audience event';
