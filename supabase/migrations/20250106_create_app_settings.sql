-- Crear tabla app_settings si no existe
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insertar configuraciones iniciales de concursos
INSERT INTO app_settings (key, value)
VALUES 
  (
    'production.contests.assa',
    jsonb_build_object(
      'start_month', 1,
      'end_month', 12,
      'goal', 250000,
      'goal_double', 400000,
      'enable_double_goal', false,
      'year', EXTRACT(YEAR FROM NOW())::INTEGER,
      'last_reset_date', NULL
    )
  ),
  (
    'production.contests.convivio',
    jsonb_build_object(
      'start_month', 1,
      'end_month', 12,
      'goal', 150000,
      'goal_double', 250000,
      'enable_double_goal', true,
      'year', EXTRACT(YEAR FROM NOW())::INTEGER,
      'last_reset_date', NULL
    )
  )
ON CONFLICT (key) DO NOTHING;

-- Habilitar RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Política: Masters pueden hacer todo
CREATE POLICY "Masters can do everything on app_settings"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Política: Todos pueden leer
CREATE POLICY "Everyone can read app_settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);
