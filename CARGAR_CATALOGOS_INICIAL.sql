-- ============================================
-- SCRIPT: Verificar y cargar catálogos IS locales
-- ============================================
-- Este script verifica si existen datos en is_catalogs
-- y muestra instrucciones para cargarlos si están vacíos

-- 1. Verificar datos existentes
SELECT 
  catalog_type,
  environment,
  jsonb_array_length(catalog_data::jsonb) as num_registros,
  updated_at
FROM is_catalogs
WHERE environment = 'development'
ORDER BY catalog_type;

-- Si NO hay datos (tabla vacía), necesitas:
-- OPCIÓN A: Copiar desde producción si existe
-- OPCIÓN B: Cargar manualmente datos de marcas/modelos comunes

-- ============================================
-- OPCIÓN A: Si tienes datos en producción
-- ============================================
/*
INSERT INTO is_catalogs (catalog_type, catalog_data, environment, updated_at)
SELECT catalog_type, catalog_data, 'development', NOW()
FROM is_catalogs
WHERE environment = 'PROD'
ON CONFLICT (catalog_type, environment) DO UPDATE
SET catalog_data = EXCLUDED.catalog_data,
    updated_at = NOW();
*/

-- ============================================
-- OPCIÓN B: Cargar datos mínimos de marcas comunes
-- ============================================
-- Esto carga las 20 marcas más comunes en Panamá
INSERT INTO is_catalogs (catalog_type, catalog_data, environment, updated_at)
VALUES (
  'marcas',
  '[
    {"vcodmarca":"156","vdescripcion":"TOYOTA"},
    {"vcodmarca":"74","vdescripcion":"HONDA"},
    {"vcodmarca":"99","vdescripcion":"NISSAN"},
    {"vcodmarca":"75","vdescripcion":"HYUNDAI"},
    {"vcodmarca":"53","vdescripcion":"FORD"},
    {"vcodmarca":"24","vdescripcion":"CHEVROLET"},
    {"vcodmarca":"98","vdescripcion":"MITSUBISHI"},
    {"vcodmarca":"92","vdescripcion":"MAZDA"},
    {"vcodmarca":"80","vdescripcion":"KIA"},
    {"vcodmarca":"154","vdescripcion":"SUZUKI"},
    {"vcodmarca":"42","vdescripcion":"DODGE"},
    {"vcodmarca":"79","vdescripcion":"JEEP"},
    {"vcodmarca":"97","vdescripcion":"MERCEDES-BENZ"},
    {"vcodmarca":"8","vdescripcion":"BMW"},
    {"vcodmarca":"5","vdescripcion":"AUDI"},
    {"vcodmarca":"159","vdescripcion":"VOLKSWAGEN"},
    {"vcodmarca":"129","vdescripcion":"SUBARU"},
    {"vcodmarca":"89","vdescripcion":"LEXUS"},
    {"vcodmarca":"52","vdescripcion":"FIAT"},
    {"vcodmarca":"115","vdescripcion":"RENAULT"}
  ]'::jsonb,
  'development',
  NOW()
)
ON CONFLICT (catalog_type, environment) DO UPDATE
SET catalog_data = EXCLUDED.catalog_data,
    updated_at = NOW();

-- Nota: Los modelos son demasiados para incluir aquí (12,000+)
-- Necesitas cargarlos desde un archivo JSON o desde la API una sola vez

SELECT 'Marcas cargadas correctamente' as status;
