-- Create delinquency table for tracking debt by policy
CREATE TABLE IF NOT EXISTS public.delinquency (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_id UUID NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  policy_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE SET NULL,
  due_soon DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  current DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  bucket_1_30 DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  bucket_31_60 DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  bucket_61_90 DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  bucket_90_plus DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  total_debt DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  cutoff_date DATE NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_delinquency_insurer_id ON public.delinquency(insurer_id);
CREATE INDEX IF NOT EXISTS idx_delinquency_broker_id ON public.delinquency(broker_id);
CREATE INDEX IF NOT EXISTS idx_delinquency_policy_number ON public.delinquency(policy_number);
CREATE INDEX IF NOT EXISTS idx_delinquency_total_debt ON public.delinquency(total_debt);
CREATE INDEX IF NOT EXISTS idx_delinquency_cutoff_date ON public.delinquency(cutoff_date);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_delinquency_insurer_policy ON public.delinquency(insurer_id, policy_number);

-- Enable RLS
ALTER TABLE public.delinquency ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: authenticated users can view all records
CREATE POLICY "Allow authenticated users to view delinquency"
  ON public.delinquency
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for INSERT: only authenticated users can insert
CREATE POLICY "Allow authenticated users to insert delinquency"
  ON public.delinquency
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for UPDATE: only authenticated users can update
CREATE POLICY "Allow authenticated users to update delinquency"
  ON public.delinquency
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for DELETE: only authenticated users can delete
CREATE POLICY "Allow authenticated users to delete delinquency"
  ON public.delinquency
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comment to table
COMMENT ON TABLE public.delinquency IS 'Tracks delinquency (morosidad) amounts by policy and bucket aging';
