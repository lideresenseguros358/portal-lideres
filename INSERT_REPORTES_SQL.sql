-- ============================================
-- SCRIPT SQL PARA INSERTAR REPORTES MANUALMENTE
-- ============================================
-- Si el script de Node.js no funciona, usa esto directamente en Supabase

-- PASO 1: Verificar si ya existen reportes
SELECT COUNT(*) as total_reportes FROM comm_imports;

-- PASO 2: Ver aseguradoras disponibles
SELECT id, name FROM insurers ORDER BY name;

-- PASO 3: Insertar reportes (AJUSTA LOS IDs según tu BD)
-- Primero, necesitas copiar los IDs de tus aseguradoras de la query anterior

-- EJEMPLO: Reemplaza 'UUID_DE_ASSA' con el ID real de cada aseguradora

-- DELETE FROM comm_imports; -- Descomentar si quieres limpiar primero

INSERT INTO comm_imports (insurer_id, period_label, total_amount) VALUES
  ((SELECT id FROM insurers WHERE name = 'ASSA' LIMIT 1), 'Q1 - Nov. 2025', 4108.37),
  ((SELECT id FROM insurers WHERE name = 'SURA' LIMIT 1), 'Q1 - Nov. 2025', 1244.54),
  ((SELECT id FROM insurers WHERE name ILIKE 'VIVIR' LIMIT 1), 'Q1 - Nov. 2025', 424.53),
  ((SELECT id FROM insurers WHERE name ILIKE 'INTERNACIONAL' LIMIT 1), 'Q1 - Nov. 2025', 1043.01),
  ((SELECT id FROM insurers WHERE name = 'FEDPA' LIMIT 1), 'Q1 - Nov. 2025', 1754.25),
  ((SELECT id FROM insurers WHERE name ILIKE 'ANCON' LIMIT 1), 'Q1 - Nov. 2025', 1295.97),
  ((SELECT id FROM insurers WHERE name = 'BANESCO' LIMIT 1), 'Q1 - Nov. 2025', 36.65),
  ((SELECT id FROM insurers WHERE name ILIKE 'REGIONAL' LIMIT 1), 'Q1 - Nov. 2025', 511.92),
  ((SELECT id FROM insurers WHERE name = 'OPTIMA' LIMIT 1), 'Q1 - Nov. 2025', 172.59),
  ((SELECT id FROM insurers WHERE name = 'ACERTA' LIMIT 1), 'Q1 - Nov. 2025', 89.39);

-- PASO 4: Verificar que se insertaron correctamente
SELECT 
  i.name as aseguradora,
  ci.total_amount as monto,
  ci.period_label,
  ci.created_at
FROM comm_imports ci
JOIN insurers i ON i.id = ci.insurer_id
ORDER BY ci.total_amount DESC;

-- PASO 5: Verificar el total
SELECT 
  COUNT(*) as total_registros,
  SUM(total_amount) as suma_total
FROM comm_imports;
-- Debe mostrar: total_registros = 10, suma_total = 10681.22

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- Si alguna aseguradora no existe, créala primero:
-- INSERT INTO insurers (name) VALUES ('NOMBRE_ASEGURADORA');

-- Ver todas las aseguradoras:
SELECT id, name FROM insurers ORDER BY name;

-- Limpiar todos los reportes (USA CON CUIDADO):
-- DELETE FROM comm_imports;

-- Ver broker LISSA:
SELECT id, name, email FROM brokers WHERE email = 'contacto@lideresenseguros.com';

-- Si LISSA no existe, créalo:
-- INSERT INTO brokers (name, email, percent_default) 
-- VALUES ('LISSA', 'contacto@lideresenseguros.com', 0);
