-- Crear tabla para carpetas de VIDA ASSA
CREATE TABLE IF NOT EXISTS vida_assa_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear tabla para archivos de VIDA ASSA
CREATE TABLE IF NOT EXISTS vida_assa_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES vida_assa_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  is_new BOOLEAN DEFAULT false,
  marked_new_until TIMESTAMPTZ,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_vida_assa_folders_order ON vida_assa_folders(display_order);
CREATE INDEX IF NOT EXISTS idx_vida_assa_files_folder ON vida_assa_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_vida_assa_files_new ON vida_assa_files(is_new, marked_new_until);

-- Insertar 4 carpetas iniciales
INSERT INTO vida_assa_folders (name, display_order) VALUES
  ('TRAMITE REGULAR', 1),
  ('EMISION WEB', 2),
  ('FORMULARIOS', 3),
  ('FORMA DE PAGO', 4)
ON CONFLICT DO NOTHING;

-- Habilitar RLS
ALTER TABLE vida_assa_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vida_assa_files ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer
CREATE POLICY "Anyone can read vida_assa_folders"
  ON vida_assa_folders FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read vida_assa_files"
  ON vida_assa_files FOR SELECT
  USING (true);

-- Política: Solo master puede modificar carpetas
CREATE POLICY "Only master can manage vida_assa_folders"
  ON vida_assa_folders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Only master can manage vida_assa_files"
  ON vida_assa_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Comentarios
COMMENT ON TABLE vida_assa_folders IS 'Carpetas para organizar documentos de VIDA ASSA';
COMMENT ON TABLE vida_assa_files IS 'Archivos dentro de carpetas VIDA ASSA';
