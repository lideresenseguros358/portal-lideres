-- Table: ancon_caratulas
-- Stores raw HTML content for ANCON policy carátulas.
-- The expediente storage bucket only accepts PDF/image MIME types, so HTML
-- is stored here in the database instead.
--
-- file_path reference: once the expediente bucket is updated to allow
-- application/octet-stream this table can be replaced by expediente_documents.

CREATE TABLE IF NOT EXISTS ancon_caratulas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id      UUID        REFERENCES policies(id) ON DELETE CASCADE,
  poliza_number  TEXT        NOT NULL,
  html_content   TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ancon_caratulas_poliza_number_idx
  ON ancon_caratulas (poliza_number);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION update_ancon_caratulas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ancon_caratulas_updated_at ON ancon_caratulas;
CREATE TRIGGER trg_ancon_caratulas_updated_at
  BEFORE UPDATE ON ancon_caratulas
  FOR EACH ROW EXECUTE PROCEDURE update_ancon_caratulas_updated_at();

-- RLS: service_role (admin client) can do everything; authenticated users can read their own
ALTER TABLE ancon_caratulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access"
  ON ancon_caratulas FOR ALL
  TO service_role USING (true) WITH CHECK (true);
