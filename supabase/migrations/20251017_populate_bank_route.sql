-- Script para poblar bank_route en brokers existentes
-- Fecha: 2025-10-17
-- Objetivo: Configurar código de ruta bancaria por defecto

-- ====================================================================
-- OPCIÓN 1: CONFIGURAR BANCO GENERAL PARA TODOS
-- ====================================================================
-- Si todos los brokers usan Banco General (código 71):

UPDATE public.brokers 
SET bank_route = '71'
WHERE active = true 
  AND bank_account_no IS NOT NULL 
  AND bank_route IS NULL;

-- Verificar cuántos se actualizaron:
-- SELECT COUNT(*) FROM brokers WHERE bank_route = '71';

-- ====================================================================
-- OPCIÓN 2: ACTUALIZAR POR BROKER INDIVIDUAL
-- ====================================================================
-- Si cada broker usa un banco diferente:

-- Ejemplo: Juan Pérez - Banco General
-- UPDATE brokers SET bank_route = '71' WHERE id = 'uuid-del-broker';

-- Ejemplo: María López - Banco Nacional
-- UPDATE brokers SET bank_route = '1' WHERE id = 'uuid-del-broker';

-- Ejemplo: Pedro Gómez - Banistmo
-- UPDATE brokers SET bank_route = '22' WHERE id = 'uuid-del-broker';

-- ====================================================================
-- OPCIÓN 3: ACTUALIZAR SEGÚN NOMBRE DEL BANCO (si existe campo)
-- ====================================================================
-- Si existe un campo que indica el banco:

-- UPDATE brokers 
-- SET bank_route = CASE 
--   WHEN UPPER(bank_name) LIKE '%GENERAL%' THEN '71'
--   WHEN UPPER(bank_name) LIKE '%NACIONAL%' THEN '1'
--   WHEN UPPER(bank_name) LIKE '%BANISTMO%' THEN '22'
--   WHEN UPPER(bank_name) LIKE '%GLOBAL%' THEN '41'
--   WHEN UPPER(bank_name) LIKE '%BAC%' THEN '45'
--   WHEN UPPER(bank_name) LIKE '%BANESCO%' THEN '52'
--   ELSE NULL
-- END
-- WHERE active = true AND bank_route IS NULL;

-- ====================================================================
-- TABLA DE REFERENCIA: CÓDIGOS DE RUTA PANAMÁ
-- ====================================================================
-- Código | Banco
-- -------|----------------------------------
-- 71     | Banco General (ACH)
-- 1      | Banco Nacional de Panamá
-- 22     | Banistmo
-- 41     | Global Bank
-- 45     | BAC (Banco de América Central)
-- 52     | Banesco
-- 59     | Scotiabank
-- 64     | Citibank
-- 78     | Multibank
-- 
-- Nota: Verificar códigos actualizados con cada banco

-- ====================================================================
-- VERIFICACIÓN POST-ACTUALIZACIÓN
-- ====================================================================

-- Ver brokers con bank_route configurado
SELECT 
  id, 
  name, 
  bank_route, 
  bank_account_no, 
  tipo_cuenta,
  active
FROM brokers
WHERE bank_route IS NOT NULL
ORDER BY name;

-- Ver brokers SIN bank_route (necesitan atención)
SELECT 
  id, 
  name, 
  bank_account_no, 
  tipo_cuenta,
  active
FROM brokers
WHERE active = true 
  AND bank_route IS NULL
ORDER BY name;

-- Estadísticas generales
SELECT 
  bank_route,
  COUNT(*) as broker_count
FROM brokers
WHERE active = true
GROUP BY bank_route
ORDER BY broker_count DESC;

-- Ver estado de preparación para ACH
SELECT 
  CASE 
    WHEN is_ach_ready THEN 'Listo para ACH'
    ELSE 'Falta información'
  END AS status,
  COUNT(*) as count
FROM brokers_ach_validation
WHERE active = true
GROUP BY is_ach_ready;

-- ====================================================================
-- FIN DEL SCRIPT
-- ====================================================================

-- IMPORTANTE: 
-- 1. Ejecutar OPCIÓN 1 si todos usan Banco General
-- 2. O ejecutar OPCIÓN 2 para actualizar individualmente
-- 3. Verificar resultados con las queries de verificación
-- 4. Confirmar que brokers_ach_validation muestra "Listo para ACH"
