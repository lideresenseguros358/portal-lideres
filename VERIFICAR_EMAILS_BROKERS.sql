-- =====================================================
-- VERIFICAR EMAILS DE BROKERS
-- =====================================================

-- Ver TODOS los brokers activos con sus emails
SELECT 
  b.name as broker_name,
  p.email as broker_email,
  b.active,
  b.id as broker_id
FROM brokers b
INNER JOIN profiles p ON b.p_id = p.id
WHERE b.active = true
ORDER BY b.name;

-- =====================================================
-- BUSCAR EMAILS ESPECÍFICOS QUE FALLAN EN EL IMPORT
-- =====================================================

-- Lista de emails que no se encuentran según el error
WITH emails_buscados AS (
  SELECT unnest(ARRAY[
    'ediscastillo@lideresenseguros.com',
    'kathrinaguirre@lideresenseguros.com',
    'angelicaramos@lideresenseguros.com',
    'soniaarenas@lideresenseguros.com',
    'lissethvergara@lideresenseguros.com',
    'ruthmejia@lideresenseguros.com',
    'stheysivejarano@lideresenseguros.com',
    'josemanuel@lideresenseguros.com',
    'ivettemartinez@lideresenseguros.com',
    'itzycandanedo@lideresenseguros.com',
    'elizabetharce@lideresenseguros.com',
    'kattiaberguido@lideresenseguros.com',
    'veronicahenriquez@lideresenseguros.com',
    'leormanhudgson@lideresenseguros.com',
    'luzgonzalez@lideresenseguros.com',
    'keniagonzalez@lideresenseguros.com',
    'hericka@lideresenseguros.com',
    'sebastianachiari@lideresenseguros.com',
    'ricardojimenez@lideresenseguros.com',
    'jazmincamilo@lideresenseguros.com'
  ]) as email_buscado
)
SELECT 
  eb.email_buscado,
  CASE 
    WHEN p.email IS NOT NULL THEN '✅ ENCONTRADO'
    ELSE '❌ NO EXISTE'
  END as estado,
  b.name as nombre_broker,
  p.email as email_real
FROM emails_buscados eb
LEFT JOIN profiles p ON LOWER(p.email) = LOWER(eb.email_buscado)
LEFT JOIN brokers b ON b.p_id = p.id
ORDER BY estado DESC, eb.email_buscado;

-- =====================================================
-- BUSCAR EMAILS SIMILARES (para correcciones)
-- =====================================================

-- Buscar emails que empiecen con los nombres de los emails que faltan
SELECT 
  'ediscastillo' as prefijo_buscado,
  b.name as broker_name,
  p.email as email_encontrado
FROM brokers b
INNER JOIN profiles p ON b.p_id = p.id
WHERE LOWER(p.email) LIKE '%ediscastillo%'
  OR LOWER(p.email) LIKE '%edis%castillo%'
  OR LOWER(b.name) LIKE '%EDIS%CASTILLO%'

UNION ALL

SELECT 
  'kathrinaguirre' as prefijo_buscado,
  b.name as broker_name,
  p.email as email_encontrado
FROM brokers b
INNER JOIN profiles p ON b.p_id = p.id
WHERE LOWER(p.email) LIKE '%kathrina%'
  OR LOWER(p.email) LIKE '%aguirre%'
  OR LOWER(b.name) LIKE '%KATHRINA%'
  OR LOWER(b.name) LIKE '%AGUIRRE%'

UNION ALL

SELECT 
  'angelicaramos' as prefijo_buscado,
  b.name as broker_name,
  p.email as email_encontrado
FROM brokers b
INNER JOIN profiles p ON b.p_id = p.id
WHERE LOWER(p.email) LIKE '%angelica%'
  OR LOWER(p.email) LIKE '%ramos%'
  OR LOWER(b.name) LIKE '%ANGELICA%RAMOS%'

UNION ALL

SELECT 
  'soniaarenas' as prefijo_buscado,
  b.name as broker_name,
  p.email as email_encontrado
FROM brokers b
INNER JOIN profiles p ON b.p_id = p.id
WHERE LOWER(p.email) LIKE '%sonia%'
  OR LOWER(p.email) LIKE '%arenas%'
  OR LOWER(b.name) LIKE '%SONIA%ARENAS%'

ORDER BY prefijo_buscado, email_encontrado;
