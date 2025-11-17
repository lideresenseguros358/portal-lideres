-- =====================================================
-- OBTENER TODOS LOS EMAILS REALES DE BROKERS ACTIVOS
-- =====================================================

SELECT 
  b.name as broker_name,
  p.email as email_real,
  b.id as broker_id,
  b.active
FROM brokers b
INNER JOIN profiles p ON b.p_id = p.id
WHERE b.active = true
ORDER BY b.name;

-- =====================================================
-- BUSCAR COINCIDENCIAS CON LOS EMAILS QUE TIENES
-- =====================================================

-- Esta query busca coincidencias parciales por nombre
-- para ayudarte a identificar el email correcto

WITH emails_en_tus_datos AS (
  SELECT unnest(ARRAY[
    'ediscastillo',
    'kathrinaguirre',
    'angelicaramos',
    'soniaarenas',
    'lissethvergara',
    'ruthmejia',
    'stheysivejarano',
    'josemanuel',
    'ivettemartinez',
    'itzycandanedo',
    'elizabetharce',
    'kattiaberguido',
    'veronicahenriquez',
    'leormanhudgson',
    'luzgonzalez',
    'keniagonzalez',
    'hericka',
    'sebastianachiari',
    'ricardojimenez',
    'jazmincamilo'
  ]) as prefijo
)
SELECT 
  etd.prefijo || '@lideresenseguros.com' as email_en_tus_datos,
  b.name as nombre_broker_real,
  p.email as email_real,
  '-- REEMPLAZAR: ' || etd.prefijo || '@lideresenseguros.com → ' || p.email as comando_find_replace
FROM emails_en_tus_datos etd
LEFT JOIN brokers b ON (
  LOWER(REPLACE(b.name, ' ', '')) LIKE '%' || etd.prefijo || '%'
  OR LOWER(b.name) LIKE '%' || SUBSTRING(etd.prefijo, 1, 5) || '%'
)
LEFT JOIN profiles p ON b.p_id = p.id
WHERE b.active = true
ORDER BY etd.prefijo;

-- =====================================================
-- MAPEO SUGERIDO BASADO EN NOMBRES
-- =====================================================

-- Edis Castillo
SELECT 'ediscastillo@lideresenseguros.com' as email_incorrecto, 
       b.name, p.email as email_correcto
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%edis%' OR LOWER(b.name) LIKE '%castillo%'

UNION ALL

-- Kathrin Aguirre
SELECT 'kathrinaguirre@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%kathrin%' OR LOWER(b.name) LIKE '%aguirre%'

UNION ALL

-- Angelica Ramos (probablemente Yira Ramos)
SELECT 'angelicaramos@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%ramos%' AND LOWER(p.email) LIKE '%ramos%'

UNION ALL

-- Sonia Arenas
SELECT 'soniaarenas@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%sonia%' OR LOWER(b.name) LIKE '%arenas%'

UNION ALL

-- Lisseth Vergara
SELECT 'lissethvergara@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%lisseth%' OR LOWER(b.name) LIKE '%vergara%'

UNION ALL

-- Ruth Mejia
SELECT 'ruthmejia@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%ruth%' OR LOWER(b.name) LIKE '%mejia%'

UNION ALL

-- Stheysi Vejarano
SELECT 'stheysivejarano@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%stheysi%' OR LOWER(b.name) LIKE '%vejarano%'

UNION ALL

-- Jose Manuel
SELECT 'josemanuel@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%jose%manuel%' OR (LOWER(b.name) LIKE '%jose%' AND LOWER(b.name) LIKE '%manuel%')

UNION ALL

-- Ivette Martinez
SELECT 'ivettemartinez@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%ivette%' OR LOWER(b.name) LIKE '%martinez%'

UNION ALL

-- Itzy Candanedo
SELECT 'itzycandanedo@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%itzy%' OR LOWER(b.name) LIKE '%candanedo%'

UNION ALL

-- Elizabeth Arce
SELECT 'elizabetharce@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%elizabeth%' AND LOWER(b.name) LIKE '%arce%'

UNION ALL

-- Kattia Berguido
SELECT 'kattiaberguido@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%kattia%' OR LOWER(b.name) LIKE '%berguido%'

UNION ALL

-- Veronica Henriquez
SELECT 'veronicahenriquez@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%veronica%' OR LOWER(b.name) LIKE '%henriquez%'

UNION ALL

-- Leorman Hudgson
SELECT 'leormanhudgson@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%leorman%' OR LOWER(b.name) LIKE '%hudgson%'

UNION ALL

-- Luz González
SELECT 'luzgonzalez@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%luz%' AND LOWER(b.name) LIKE '%gonzalez%'

UNION ALL

-- Kenia González
SELECT 'keniagonzalez@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%kenia%' OR LOWER(b.name) LIKE '%kennia%'

UNION ALL

-- Hericka
SELECT 'hericka@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%hericka%' OR LOWER(b.name) LIKE '%ericka%'

UNION ALL

-- Sebastian Achiari
SELECT 'sebastianachiari@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%sebastian%' OR LOWER(b.name) LIKE '%achiari%'

UNION ALL

-- Ricardo Jimenez
SELECT 'ricardojimenez@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%ricardo%' AND LOWER(b.name) LIKE '%jimenez%'

UNION ALL

-- Jazmin Camilo
SELECT 'jazmincamilo@lideresenseguros.com', b.name, p.email
FROM brokers b
JOIN profiles p ON b.p_id = p.id
WHERE LOWER(b.name) LIKE '%jazmin%' OR LOWER(b.name) LIKE '%camilo%';
