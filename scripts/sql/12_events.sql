-- Step 12: events and attendees tables

CREATE TABLE IF NOT EXISTS public.events (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  details text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  location text,
  audience public.event_audience NOT NULL DEFAULT 'ALL',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_attendees (
  event_id bigint NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  rsvp text,
  PRIMARY KEY (event_id, broker_id)
);
