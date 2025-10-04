-- =====================================================
-- MIGRATION: Guías y Descargas
-- Date: 2025-10-03
-- Description: Tablas para repositorios de documentos
-- =====================================================

-- =====================================================
-- 1. GUÍAS (Repositorio interno sin aseguradoras)
-- =====================================================

-- Tabla de secciones de guías
CREATE TABLE IF NOT EXISTS guide_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de archivos de guías
CREATE TABLE IF NOT EXISTS guide_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES guide_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_new BOOLEAN DEFAULT true, -- Badge "Nuevo" 24-48h
  marked_new_until TIMESTAMPTZ -- Hasta cuándo mostrar badge
);

-- Tabla para duplicados sincronizados de guías
CREATE TABLE IF NOT EXISTS guide_file_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_file_id UUID NOT NULL REFERENCES guide_files(id) ON DELETE CASCADE,
  linked_file_id UUID NOT NULL REFERENCES guide_files(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_file_id, linked_file_id)
);

-- Índices para guías
CREATE INDEX IF NOT EXISTS idx_guide_sections_order ON guide_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_guide_files_section ON guide_files(section_id);
CREATE INDEX IF NOT EXISTS idx_guide_files_order ON guide_files(display_order);
CREATE INDEX IF NOT EXISTS idx_guide_files_new ON guide_files(is_new, marked_new_until);

-- =====================================================
-- 2. DESCARGAS (Repositorio por Ramo/Tipo/Aseguradora)
-- =====================================================

-- Tabla de secciones de descargas
CREATE TABLE IF NOT EXISTS download_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope TEXT NOT NULL CHECK (scope IN ('generales', 'personas')), -- Ramo
  policy_type TEXT NOT NULL, -- Tipo de póliza (auto, vida, salud, etc)
  insurer_id UUID REFERENCES insurers(id) ON DELETE CASCADE, -- Aseguradora (NULL = requisitos generales)
  name TEXT NOT NULL, -- Nombre de sección (Requisitos, Formularios, etc)
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de archivos de descargas
CREATE TABLE IF NOT EXISTS download_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES download_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_new BOOLEAN DEFAULT true,
  marked_new_until TIMESTAMPTZ
);

-- Tabla para duplicados sincronizados de descargas
CREATE TABLE IF NOT EXISTS download_file_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_file_id UUID NOT NULL REFERENCES download_files(id) ON DELETE CASCADE,
  linked_file_id UUID NOT NULL REFERENCES download_files(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_file_id, linked_file_id)
);

-- Índices para descargas
CREATE INDEX IF NOT EXISTS idx_download_sections_scope ON download_sections(scope);
CREATE INDEX IF NOT EXISTS idx_download_sections_type ON download_sections(policy_type);
CREATE INDEX IF NOT EXISTS idx_download_sections_insurer ON download_sections(insurer_id);
CREATE INDEX IF NOT EXISTS idx_download_sections_order ON download_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_download_files_section ON download_files(section_id);
CREATE INDEX IF NOT EXISTS idx_download_files_order ON download_files(display_order);
CREATE INDEX IF NOT EXISTS idx_download_files_new ON download_files(is_new, marked_new_until);

-- =====================================================
-- 3. RLS POLICIES - GUÍAS
-- =====================================================

ALTER TABLE guide_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_file_links ENABLE ROW LEVEL SECURITY;

-- Eliminar policies existentes primero
DROP POLICY IF EXISTS "Everyone can view guide sections" ON guide_sections;
DROP POLICY IF EXISTS "Everyone can view guide files" ON guide_files;
DROP POLICY IF EXISTS "Masters can manage guide sections" ON guide_sections;
DROP POLICY IF EXISTS "Masters can manage guide files" ON guide_files;
DROP POLICY IF EXISTS "Masters can manage guide file links" ON guide_file_links;

-- Todos pueden ver guías
CREATE POLICY "Everyone can view guide sections"
  ON guide_sections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Everyone can view guide files"
  ON guide_files FOR SELECT
  TO authenticated
  USING (true);

-- Solo Master puede modificar guías
CREATE POLICY "Masters can manage guide sections"
  ON guide_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can manage guide files"
  ON guide_files FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can manage guide file links"
  ON guide_file_links FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- =====================================================
-- 4. RLS POLICIES - DESCARGAS
-- =====================================================

ALTER TABLE download_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_file_links ENABLE ROW LEVEL SECURITY;

-- Eliminar policies existentes primero
DROP POLICY IF EXISTS "Everyone can view download sections" ON download_sections;
DROP POLICY IF EXISTS "Everyone can view download files" ON download_files;
DROP POLICY IF EXISTS "Masters can manage download sections" ON download_sections;
DROP POLICY IF EXISTS "Masters can manage download files" ON download_files;
DROP POLICY IF EXISTS "Masters can manage download file links" ON download_file_links;

-- Todos pueden ver descargas
CREATE POLICY "Everyone can view download sections"
  ON download_sections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Everyone can view download files"
  ON download_files FOR SELECT
  TO authenticated
  USING (true);

-- Solo Master puede modificar descargas
CREATE POLICY "Masters can manage download sections"
  ON download_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can manage download files"
  ON download_files FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can manage download file links"
  ON download_file_links FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- =====================================================
-- 5. TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Guías
DROP TRIGGER IF EXISTS guide_sections_updated_at ON guide_sections;
CREATE TRIGGER guide_sections_updated_at
  BEFORE UPDATE ON guide_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS guide_files_updated_at ON guide_files;
CREATE TRIGGER guide_files_updated_at
  BEFORE UPDATE ON guide_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Descargas
DROP TRIGGER IF EXISTS download_sections_updated_at ON download_sections;
CREATE TRIGGER download_sections_updated_at
  BEFORE UPDATE ON download_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS download_files_updated_at ON download_files;
CREATE TRIGGER download_files_updated_at
  BEFORE UPDATE ON download_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. DATOS INICIALES - GUÍAS
-- =====================================================

INSERT INTO guide_sections (name, display_order) VALUES
  ('Charlas', 1),
  ('Socios y Persona Clave', 2),
  ('Encuestas', 3),
  ('Ventas', 4),
  ('Hipotecas', 5),
  ('Trámites', 6),
  ('Cursos', 7)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. COMENTARIOS
-- =====================================================

COMMENT ON TABLE guide_sections IS 'Secciones del repositorio de guías internas';
COMMENT ON TABLE guide_files IS 'Archivos PDF en guías internas';
COMMENT ON TABLE guide_file_links IS 'Enlaces de duplicados sincronizados en guías';
COMMENT ON COLUMN guide_files.is_new IS 'Badge Nuevo visible 24-48h';
COMMENT ON COLUMN guide_files.marked_new_until IS 'Fecha límite para mostrar badge Nuevo';

COMMENT ON TABLE download_sections IS 'Secciones del repositorio de descargas por Ramo/Tipo/Aseguradora';
COMMENT ON TABLE download_files IS 'Archivos PDF en descargas';
COMMENT ON TABLE download_file_links IS 'Enlaces de duplicados sincronizados en descargas';
COMMENT ON COLUMN download_sections.scope IS 'Ramo: generales o personas';
COMMENT ON COLUMN download_sections.policy_type IS 'Tipo de póliza: auto, vida, salud, etc';
COMMENT ON COLUMN download_files.is_new IS 'Badge Nuevo visible 24-48h';
COMMENT ON COLUMN download_files.marked_new_until IS 'Fecha límite para mostrar badge Nuevo';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('guide_sections', 'guide_files', 'guide_file_links', 
                     'download_sections', 'download_files', 'download_file_links');

-- Verificar secciones iniciales de guías
SELECT id, name, display_order FROM guide_sections ORDER BY display_order;
