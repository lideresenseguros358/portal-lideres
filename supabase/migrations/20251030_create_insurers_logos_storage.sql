-- Create storage bucket for insurer logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurer-logos', 
  'insurer-logos', 
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- Note: Storage policies must be created from Supabase Dashboard > Storage > insurer-logos > Policies
-- Or use Supabase CLI with proper service role permissions
-- 
-- Policies needed:
-- 1. SELECT: public can view (bucket_id = 'insurer-logos')
-- 2. INSERT: authenticated can upload (bucket_id = 'insurer-logos')
-- 3. UPDATE: authenticated can update (bucket_id = 'insurer-logos')
-- 4. DELETE: authenticated can delete (bucket_id = 'insurer-logos')
