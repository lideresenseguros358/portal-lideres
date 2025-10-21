-- ====================================================================
-- TABLA MAESTRA: ach_banks
-- Fecha: 2025-10-21
-- Objetivo: Catálogo único de bancos de Panamá con códigos de ruta ACH
-- Fuente: Listado ACH oficial - Instituciones Participantes
-- ====================================================================

-- Crear tabla
CREATE TABLE IF NOT EXISTS public.ach_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name VARCHAR(100) NOT NULL UNIQUE,
  route_code_raw VARCHAR(15) NOT NULL,
  route_code VARCHAR(9) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source VARCHAR(100) DEFAULT 'Listado ACH 2025-10-17 PDF',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ach_banks_status ON public.ach_banks(status);
CREATE INDEX IF NOT EXISTS idx_ach_banks_route_code ON public.ach_banks(route_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ach_banks_bank_name_lower ON public.ach_banks(LOWER(bank_name));

-- Comentarios
COMMENT ON TABLE public.ach_banks IS 'Catálogo maestro de bancos de Panamá con códigos de ruta ACH oficial';
COMMENT ON COLUMN public.ach_banks.bank_name IS 'Nombre oficial del banco (único)';
COMMENT ON COLUMN public.ach_banks.route_code_raw IS 'Código de ruta original con ceros (ej: 000000071)';
COMMENT ON COLUMN public.ach_banks.route_code IS 'Código de ruta normalizado sin ceros iniciales (ej: 71)';
COMMENT ON COLUMN public.ach_banks.status IS 'Estado del banco: ACTIVE o INACTIVE';
COMMENT ON COLUMN public.ach_banks.last_verified_at IS 'Última vez que se verificó la información';
COMMENT ON COLUMN public.ach_banks.source IS 'Fuente de la información (PDF, sitio web, etc)';

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_ach_banks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ach_banks_updated_at
BEFORE UPDATE ON public.ach_banks
FOR EACH ROW
EXECUTE FUNCTION public.update_ach_banks_updated_at();

-- ====================================================================
-- INSERTAR DATOS INICIALES - BANCOS DE PANAMÁ
-- ====================================================================

INSERT INTO public.ach_banks (bank_name, route_code_raw, route_code, status) VALUES
  ('BANCO NACIONAL DE PANAMÁ', '000000013', '13', 'ACTIVE'),
  ('BANISTMO', '000000026', '26', 'ACTIVE'),
  ('CITIBANK', '000000039', '39', 'ACTIVE'),
  ('BANCO GENERAL', '000000071', '71', 'ACTIVE'),
  ('MULTIBANK', '000000372', '372', 'ACTIVE'),
  ('TOWER BANK INTERNATIONAL INC.', '000000408', '408', 'ACTIVE'),
  ('CAJA DE AHORROS', '000000770', '770', 'ACTIVE'),
  ('CREDICORP BANK', '000001106', '1106', 'ACTIVE'),
  ('GLOBAL BANK', '000001151', '1151', 'ACTIVE'),
  ('BAC INTERNACIONAL (BAC CREDOMATIC)', '000001384', '1384', 'ACTIVE'),
  ('BANCO ALIADO', '000001083', '1083', 'ACTIVE'),
  ('BANCO AZTECA', '000001504', '1504', 'ACTIVE'),
  ('MMG BANK', '000001478', '1478', 'ACTIVE'),
  ('BICSA (BANCO INTER. DE COSTA RICA)', '000000518', '518', 'ACTIVE'),
  ('COOPEDUC', '000002503', '2503', 'ACTIVE'),
  ('COOESAN', '000002516', '2516', 'ACTIVE'),
  ('COOPEVE', '000002545', '2545', 'ACTIVE'),
  ('CACECHI', '000002529', '2529', 'ACTIVE'),
  ('COEDUCO', '000002532', '2532', 'ACTIVE'),
  ('BANESCO', '000001588', '1588', 'ACTIVE'),
  ('METROBANK', '000001067', '1067', 'ACTIVE'),
  ('ST GEORGES BANK', '000001494', '1494', 'ACTIVE'),
  ('BANCO DELTA', '000001562', '1562', 'ACTIVE'),
  ('BCT BANK', '000001397', '1397', 'ACTIVE'),
  ('SCOTIA BANK', '000000424', '424', 'ACTIVE'),
  ('BANCO LAFISE', '000001575', '1575', 'ACTIVE'),
  ('PRIVAL BANK', '000001672', '1672', 'ACTIVE'),
  ('BANCO DAVIVIENDA (PANAMÁ)', '000000181', '181', 'ACTIVE'),
  ('UNIBANK', '000001708', '1708', 'ACTIVE'),
  ('BANCO PICHINCHA PANAMÁ', '000001517', '1517', 'ACTIVE'),
  ('COOP. PROFESIONALES', '000000712', '712', 'ACTIVE'),
  ('MERCANTIL BANCO', '000001630', '1630', 'ACTIVE'),
  ('BANISI, S.A.', '000001614', '1614', 'ACTIVE'),
  ('BANCOLOMBIA', '000001753', '1753', 'ACTIVE'),
  ('BANCO FICOHSA PANAMA', '000001724', '1724', 'ACTIVE'),
  ('CANAL BANK', '000001258', '1258', 'ACTIVE'),
  ('COOPERATIVA CRISTOBAL', '000005005', '5005', 'ACTIVE'),
  ('BI BANK', '000001782', '1782', 'ACTIVE'),
  ('BBP BANK, S.A.', '000001656', '1656', 'ACTIVE'),
  ('EDIOACC, R.L.', '000005018', '5018', 'ACTIVE'),
  ('PACIFIC BANK', '000000916', '916', 'ACTIVE'),
  ('ECASESO', '000005021', '5021', 'ACTIVE'),
  ('COOPRAC', '000005034', '5034', 'ACTIVE'),
  ('BANK OF CHINA', '000001164', '1164', 'ACTIVE'),
  ('BANCO LA HIPOTECARIA', '000001698', '1698', 'ACTIVE'),
  ('CACSA', '000005047', '5047', 'ACTIVE')
ON CONFLICT (bank_name) DO UPDATE
SET 
  route_code_raw = EXCLUDED.route_code_raw,
  route_code = EXCLUDED.route_code,
  status = EXCLUDED.status,
  last_verified_at = NOW();

-- ====================================================================
-- POLÍTICAS RLS (Row Level Security)
-- ====================================================================

ALTER TABLE public.ach_banks ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer bancos activos
CREATE POLICY "Bancos activos son públicos para lectura"
ON public.ach_banks FOR SELECT
TO authenticated
USING (status = 'ACTIVE');

-- Política: Solo admins pueden modificar
CREATE POLICY "Solo admins pueden modificar bancos"
ON public.ach_banks FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('master', 'admin')
  )
);

-- ====================================================================
-- VISTA AUXILIAR: Bancos activos ordenados
-- ====================================================================

CREATE OR REPLACE VIEW public.ach_banks_active AS
SELECT 
  id,
  bank_name,
  route_code,
  route_code_raw
FROM public.ach_banks
WHERE status = 'ACTIVE'
ORDER BY bank_name ASC;

COMMENT ON VIEW public.ach_banks_active IS 'Vista de bancos activos ordenados alfabéticamente para dropdowns';

-- ====================================================================
-- FIN DE MIGRACIÓN
-- ====================================================================

-- Para verificar:
-- SELECT * FROM ach_banks ORDER BY bank_name;
-- SELECT COUNT(*) FROM ach_banks WHERE status = 'ACTIVE';
