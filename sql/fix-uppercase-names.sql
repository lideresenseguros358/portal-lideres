-- ============================================
-- FIX: Normalizar nombres a MAYÚSCULAS en profiles, brokers y user_requests
-- Fecha: 2026-03-13
-- Problema: El wizard de nuevo usuario guardaba nombres en minúsculas
--           porque CSS text-transform:uppercase solo es visual,
--           no cambia el valor real del input.
-- ============================================

-- 1. PROFILES: Normalizar full_name a MAYÚSCULAS
UPDATE profiles
SET full_name = UPPER(full_name)
WHERE full_name IS NOT NULL
  AND full_name != UPPER(full_name);

-- 2. BROKERS: Normalizar name a MAYÚSCULAS
UPDATE brokers
SET name = UPPER(name)
WHERE name IS NOT NULL
  AND name != UPPER(name);

-- 3. BROKERS: Normalizar nombre_completo a MAYÚSCULAS
UPDATE brokers
SET nombre_completo = UPPER(nombre_completo)
WHERE nombre_completo IS NOT NULL
  AND nombre_completo != UPPER(nombre_completo);

-- 4. USER_REQUESTS: Normalizar nombre_completo a MAYÚSCULAS (pendientes y aprobadas)
UPDATE user_requests
SET nombre_completo = UPPER(nombre_completo)
WHERE nombre_completo IS NOT NULL
  AND nombre_completo != UPPER(nombre_completo);

-- NOTA: beneficiary_name y nombre_completo_titular NO se tocan porque
-- esos ya se normalizan con toUpperNoAccents() (sin acentos, formato ACH).
