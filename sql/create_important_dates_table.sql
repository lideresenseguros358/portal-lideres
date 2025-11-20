-- Tabla para almacenar las fechas importantes del mes
CREATE TABLE IF NOT EXISTS important_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2024),
  
  -- Fechas configurables
  vida_con_cancelacion_day INTEGER CHECK (vida_con_cancelacion_day >= 1 AND vida_con_cancelacion_day <= 31),
  via_regular_day INTEGER CHECK (via_regular_day >= 1 AND via_regular_day <= 31),
  apadea_date1 INTEGER CHECK (apadea_date1 >= 1 AND apadea_date1 <= 31),
  apadea_date2 INTEGER CHECK (apadea_date2 >= 1 AND apadea_date2 <= 31),
  cierre_mes_day INTEGER CHECK (cierre_mes_day >= 1 AND cierre_mes_day <= 31),
  
  -- Noticias / Anuncios
  news_text TEXT,
  news_active BOOLEAN DEFAULT true,
  
  -- Auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraint único por mes/año
  UNIQUE(month, year)
);

-- Índice para búsquedas rápidas por mes/año
CREATE INDEX IF NOT EXISTS idx_important_dates_month_year ON important_dates(year, month);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_important_dates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_important_dates_timestamp
  BEFORE UPDATE ON important_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_important_dates_updated_at();

-- Row Level Security (RLS)
ALTER TABLE important_dates ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer las fechas
CREATE POLICY "Anyone can read important dates"
  ON important_dates
  FOR SELECT
  USING (true);

-- Política: Solo Master puede insertar/actualizar/eliminar
CREATE POLICY "Only master can modify important dates"
  ON important_dates
  FOR ALL
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

-- Insertar datos por defecto para el mes actual
INSERT INTO important_dates (month, year, vida_con_cancelacion_day, via_regular_day, apadea_date1, apadea_date2, cierre_mes_day, news_text)
VALUES (
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  15, -- Último día vida con cancelación
  20, -- Último día vía regular
  10, -- Primera fecha APADEA
  25, -- Segunda fecha APADEA
  30, -- Día de cierre
  'Recuerda actualizar tus trámites pendientes antes del cierre.'
)
ON CONFLICT (month, year) DO NOTHING;

-- Comentarios en la tabla
COMMENT ON TABLE important_dates IS 'Almacena las fechas importantes configurables para cada mes';
COMMENT ON COLUMN important_dates.vida_con_cancelacion_day IS 'Día límite para trámites de vida con cancelación';
COMMENT ON COLUMN important_dates.via_regular_day IS 'Día límite para trámites vía regular';
COMMENT ON COLUMN important_dates.apadea_date1 IS 'Primera fecha importante de APADEA';
COMMENT ON COLUMN important_dates.apadea_date2 IS 'Segunda fecha importante de APADEA';
COMMENT ON COLUMN important_dates.cierre_mes_day IS 'Día de cierre del mes';
COMMENT ON COLUMN important_dates.news_text IS 'Texto libre para noticias o anuncios';
COMMENT ON COLUMN important_dates.news_active IS 'Indica si las noticias están activas para mostrar';
