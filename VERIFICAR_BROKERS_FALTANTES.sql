-- =====================================================
-- VERIFICAR BROKERS FALTANTES EN LA BASE DE DATOS
-- =====================================================
-- 
-- Este SQL verifica cuáles de los emails de brokers
-- del CSV NO existen en la tabla brokers
--
-- INSTRUCCIONES:
-- 1. Ejecuta este SQL en Supabase
-- 2. Si aparecen brokers faltantes, créalos primero
-- 3. Luego ejecuta el bulk import
--
-- =====================================================

-- Lista de emails de brokers del CSV
WITH csv_brokers AS (
  SELECT DISTINCT email FROM (VALUES
    ('ediscastillo@lideresenseguros.com'),
    ('kathrinaguirre@lideresenseguros.com'),
    ('angelicaramos@lideresenseguros.com'),
    ('luzgonzalez@lideresenseguros.com'),
    ('ruthmejia@lideresenseguros.com'),
    ('stheysivejarano@lideresenseguros.com'),
    ('soniaarenas@lideresenseguros.com'),
    ('lissethvergara@lideresenseguros.com'),
    ('veronicahenriquez@lideresenseguros.com'),
    ('leormanhudgson@lideresenseguros.com'),
    ('keniagonzalez@lideresenseguros.com'),
    ('jazmincamilo@lideresenseguros.com'),
    ('hericka@lideresenseguros.com'),
    ('sebastianachiari@lideresenseguros.com'),
    ('ricardojimenez@lideresenseguros.com'),
    ('josemanuel@lideresenseguros.com'),
    ('itzycandanedo@lideresenseguros.com'),
    ('elizabetharce@lideresenseguros.com'),
    ('kattiaberguido@lideresenseguros.com'),
    ('ivettemartinez@lideresenseguros.com'),
    ('yiraramos@lideresenseguros.com'),
    ('samudiosegurospa@outlook.com'),
    ('yanitzajustiniani@lideresenseguros.com'),
    ('luisquiros@lideresenseguros.com'),
    ('didimosamudio@lideresenseguros.com'),
    ('kvseguros13@gmail.com'),
    ('minismei@hotmail.com')
  ) AS t(email)
)
-- Mostrar brokers que NO existen en la tabla brokers
SELECT 
  csv.email AS "Email Faltante",
  'CREATE BROKER NEEDED' AS "Estado"
FROM csv_brokers csv
LEFT JOIN brokers b ON LOWER(TRIM(b.email)) = LOWER(TRIM(csv.email))
WHERE b.id IS NULL
ORDER BY csv.email;

-- =====================================================
-- Si aparecen resultados, significa que esos brokers
-- NO existen en la base de datos y debes crearlos primero
-- =====================================================
