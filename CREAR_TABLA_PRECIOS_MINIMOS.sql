-- Tabla para almacenar precios mínimos de Daños a Terceros
-- Se actualiza automáticamente con cada cotización exitosa

CREATE TABLE IF NOT EXISTS third_party_min_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer_name TEXT NOT NULL UNIQUE, -- 'FEDPA', 'INTERNACIONAL', etc.
  min_price DECIMAL(10, 2) NOT NULL,
  policy_type TEXT DEFAULT 'DANOS_TERCEROS',
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas por aseguradora
CREATE INDEX IF NOT EXISTS idx_third_party_prices_insurer 
ON third_party_min_prices(insurer_name);

-- RLS: Todos pueden leer, solo el sistema puede escribir
ALTER TABLE third_party_min_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver precios mínimos"
ON third_party_min_prices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Solo sistema puede actualizar precios"
ON third_party_min_prices FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Insertar precios iniciales
INSERT INTO third_party_min_prices (insurer_name, min_price, policy_type)
VALUES 
  ('FEDPA', 130.00, 'DANOS_TERCEROS'),
  ('INTERNACIONAL', 150.00, 'DANOS_TERCEROS')
ON CONFLICT (insurer_name) 
DO UPDATE SET 
  min_price = EXCLUDED.min_price,
  last_updated_at = NOW();

-- Función para actualizar precio mínimo (bypasea RLS)
CREATE OR REPLACE FUNCTION update_third_party_min_price(
  p_insurer_name TEXT,
  p_new_price DECIMAL(10, 2),
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO third_party_min_prices (
    insurer_name,
    min_price,
    policy_type,
    updated_by,
    last_updated_at
  )
  VALUES (
    p_insurer_name,
    p_new_price,
    'DANOS_TERCEROS',
    p_user_id,
    NOW()
  )
  ON CONFLICT (insurer_name)
  DO UPDATE SET
    min_price = CASE 
      WHEN EXCLUDED.min_price < third_party_min_prices.min_price 
      THEN EXCLUDED.min_price
      ELSE third_party_min_prices.min_price
    END,
    updated_by = EXCLUDED.updated_by,
    last_updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION update_third_party_min_price IS 
'Actualiza el precio mínimo de Daños a Terceros. Solo guarda si el nuevo precio es menor al actual.';

COMMENT ON TABLE third_party_min_prices IS
'Almacena los precios mínimos de Daños a Terceros por aseguradora. 
Se actualiza automáticamente cuando usuarios realizan cotizaciones exitosas.';
