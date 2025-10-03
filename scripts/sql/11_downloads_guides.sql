-- Step 11: downloads and guides taxonomy

CREATE TABLE IF NOT EXISTS public.download_docs (
  id bigserial PRIMARY KEY,
  insurer_id bigint REFERENCES public.insurers(id) ON DELETE SET NULL,
  ramo text,
  title text NOT NULL,
  storage_path text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.doc_tags (
  id bigserial PRIMARY KEY,
  name text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.download_doc_tags (
  doc_id bigint NOT NULL REFERENCES public.download_docs(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES public.doc_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (doc_id, tag_id)
);
