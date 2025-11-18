-- =====================================================
-- BULK IMPORT COMPLETO: MB SEGUROS
-- Paso 1: Actualizar función
-- Paso 2: Importar 14 registros de MB SEGUROS
-- =====================================================

-- =====================================================
-- PASO 1: ACTUALIZAR FUNCIÓN (BÚSQUEDA FLEXIBLE)
-- =====================================================

DROP FUNCTION IF EXISTS bulk_import_clients_policies(JSONB);

CREATE OR REPLACE FUNCTION bulk_import_clients_policies(
  import_data JSONB
)
RETURNS TABLE(
  success BOOLEAN,
  row_number INTEGER,
  client_name TEXT,
  policy_number TEXT,
  message TEXT,
  client_id UUID,
  policy_id UUID
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  row_data JSONB;
  row_idx INTEGER := 0;
  v_broker_id UUID;
  v_insurer_id UUID;
  v_client_id UUID;
  v_policy_id UUID;
  v_existing_client_id UUID;
  v_client_name TEXT;
  v_policy_number TEXT;
  v_broker_email TEXT;
  v_insurer_name TEXT;
  v_ramo TEXT;
  v_start_date DATE;
  v_renewal_date DATE;
  v_national_id TEXT;
  v_email TEXT;
  v_phone TEXT;
BEGIN
  FOR row_data IN SELECT * FROM jsonb_array_elements(import_data)
  LOOP
    row_idx := row_idx + 1;
    
    BEGIN
      v_client_name := UPPER(TRIM(row_data->>'client_name'));
      v_policy_number := UPPER(TRIM(row_data->>'policy_number'));
      v_broker_email := LOWER(TRIM(row_data->>'broker_email'));
      v_insurer_name := UPPER(TRIM(row_data->>'insurer_name'));
      v_ramo := UPPER(TRIM(row_data->>'ramo'));
      v_start_date := (row_data->>'start_date')::DATE;
      v_renewal_date := (row_data->>'renewal_date')::DATE;
      v_national_id := NULLIF(UPPER(TRIM(row_data->>'national_id')), '');
      v_email := NULLIF(LOWER(TRIM(row_data->>'email')), '');
      v_phone := NULLIF(TRIM(row_data->>'phone'), '');
      
      IF v_client_name IS NULL OR v_client_name = '' THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Nombre del cliente requerido', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_policy_number IS NULL OR v_policy_number = '' THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Número de póliza requerido', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_broker_email IS NULL OR v_broker_email = '' THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Email del broker requerido', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_insurer_name IS NULL OR v_insurer_name = '' THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Nombre de aseguradora requerido', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_start_date IS NULL THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Fecha de inicio requerida', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_renewal_date IS NULL THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Fecha de renovación requerida', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      SELECT b.id INTO v_broker_id
      FROM brokers b
      INNER JOIN profiles p ON b.p_id = p.id
      WHERE LOWER(p.email) = v_broker_email
      LIMIT 1;
      
      IF v_broker_id IS NULL THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 
          'ERROR: Broker no encontrado con email: ' || v_broker_email, NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      -- ✅ BÚSQUEDA FLEXIBLE DE ASEGURADORA
      SELECT id INTO v_insurer_id
      FROM insurers
      WHERE UPPER(name) = v_insurer_name
      LIMIT 1;
      
      IF v_insurer_id IS NULL THEN
        SELECT id INTO v_insurer_id
        FROM insurers
        WHERE UPPER(name) LIKE '%' || v_insurer_name || '%'
           OR v_insurer_name LIKE '%' || UPPER(name) || '%'
        LIMIT 1;
      END IF;
      
      IF v_insurer_id IS NULL THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 
          'ERROR: Aseguradora no encontrada: ' || v_insurer_name, NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF EXISTS (SELECT 1 FROM policies pol WHERE pol.policy_number = v_policy_number) THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 
          'ERROR: Póliza ya existe: ' || v_policy_number, NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      SELECT id INTO v_existing_client_id
      FROM clients
      WHERE (v_national_id IS NOT NULL AND national_id = v_national_id)
         OR (UPPER(name) = v_client_name)
      LIMIT 1;
      
      IF v_existing_client_id IS NOT NULL THEN
        v_client_id := v_existing_client_id;
        
        UPDATE clients
        SET 
          national_id = COALESCE(clients.national_id, v_national_id),
          email = COALESCE(clients.email, v_email),
          phone = COALESCE(clients.phone, v_phone),
          broker_id = COALESCE(clients.broker_id, v_broker_id)
        WHERE id = v_existing_client_id;
      ELSE
        INSERT INTO clients (
          name,
          national_id,
          email,
          phone,
          broker_id,
          active,
          created_at
        ) VALUES (
          v_client_name,
          v_national_id,
          v_email,
          v_phone,
          v_broker_id,
          true,
          now()
        )
        RETURNING id INTO v_client_id;
      END IF;
      
      INSERT INTO policies (
        client_id,
        broker_id,
        policy_number,
        insurer_id,
        ramo,
        start_date,
        renewal_date,
        status,
        created_at
      ) VALUES (
        v_client_id,
        v_broker_id,
        v_policy_number,
        v_insurer_id,
        v_ramo,
        v_start_date,
        v_renewal_date,
        'ACTIVA',
        now()
      )
      RETURNING id INTO v_policy_id;
      
      RETURN QUERY SELECT true, row_idx, v_client_name, v_policy_number, 
        'SUCCESS: Cliente y póliza creados', v_client_id, v_policy_id;
      
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 
        'ERROR: ' || SQLERRM, NULL::UUID, NULL::UUID;
    END;
  END LOOP;
END;
$$;

-- =====================================================
-- PASO 2: EJECUTAR BULK IMPORT DE 14 REGISTROS MB
-- =====================================================

SELECT * FROM bulk_import_clients_policies('[
  {
    "client_name": "ROSA ANGELA MARTINEZ KANTULE",
    "national_id": "10-6-1867",
    "policy_number": "2280",
    "broker_email": "samudiosegurospa@outlook.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "INCENDIO",
    "start_date": "2027-06-01",
    "renewal_date": "2028-06-01"
  },
  {
    "client_name": "UNI LEASING, INC.",
    "national_id": "2029392-1-744609 DV 7",
    "policy_number": "55683",
    "broker_email": "keniagonzalez@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "INCENDIO",
    "start_date": "2027-04-03",
    "renewal_date": "2028-04-03"
  },
  {
    "client_name": "MAXILIANO DAVID PEREZ ANDERSON",
    "national_id": "20756",
    "policy_number": "51026",
    "broker_email": "carlosfoot@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "AUTO",
    "start_date": "2026-09-01",
    "renewal_date": "2027-09-01"
  },
  {
    "client_name": "MIÑOSO ARIAS GONZALEZ",
    "national_id": "10-27-184",
    "policy_number": "58978",
    "broker_email": "carlosfoot@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "AUTO",
    "start_date": "2025-07-06",
    "renewal_date": "2026-07-06"
  },
  {
    "client_name": "NORBERTO INIQUIÑAPI VILLALAZ ARIAS",
    "national_id": "3-708-2124",
    "policy_number": "61287",
    "broker_email": "carlosfoot@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "AUTO",
    "start_date": "2025-06-08",
    "renewal_date": "2026-06-08"
  },
  {
    "client_name": "OSIRIS EVA ARCHIBOLD JONES",
    "national_id": "8-763-2035",
    "policy_number": "76668",
    "broker_email": "carlosfoot@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "AUTO",
    "start_date": "2025-10-03",
    "renewal_date": "2026-03-10"
  },
  {
    "client_name": "MELISSA SHECK ORTIZ",
    "national_id": "8-883-118",
    "policy_number": "79414",
    "broker_email": "carlosfoot@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "AUTO",
    "start_date": "2026-10-05",
    "renewal_date": "2027-10-05"
  },
  {
    "client_name": "ANA MARIA JONES MORALES",
    "national_id": "3-99-761",
    "policy_number": "81555",
    "broker_email": "carlosfoot@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "AUTO",
    "start_date": "2025-01-10",
    "renewal_date": "2026-10-08"
  },
  {
    "client_name": "ALFREDO PINZON CUBILLA",
    "national_id": "4-294-2353",
    "policy_number": "122188",
    "broker_email": "samudiosegurospa@outlook.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "AUTO",
    "start_date": "2027-03-08",
    "renewal_date": "2028-03-08"
  },
  {
    "client_name": "WAI CHAI CHUNG CASTILLO",
    "national_id": "8-1095-511",
    "policy_number": "97671",
    "broker_email": "samudiosegurospa@outlook.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "AUTO",
    "start_date": "2026-07-05",
    "renewal_date": "2027-07-05"
  },
  {
    "client_name": "CEDITER, S.A.",
    "national_id": "1969761-1-735140 DV 98",
    "policy_number": "38551",
    "broker_email": "itzycandanedo@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "HOGAR",
    "start_date": "2026-07-06",
    "renewal_date": "2027-07-06"
  },
  {
    "client_name": "CEDITER, S.A.",
    "national_id": "1969761-1-735140 DV 98",
    "policy_number": "33851",
    "broker_email": "itzycandanedo@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "RESPONSABILIDAD CIVIL",
    "start_date": "2026-07-10",
    "renewal_date": "2027-07-10"
  },
  {
    "client_name": "MIRNA ESTHER CORREOSO GARCIA",
    "national_id": "1-703-572",
    "policy_number": "46451",
    "broker_email": "didimosamudio@lideresenseguros.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "VIDA",
    "start_date": "2026-07-10",
    "renewal_date": "2050-07-10"
  },
  {
    "client_name": "ANGEL ALBERTO LOPEZ LOPEZ",
    "national_id": "E-8-145842",
    "policy_number": "60973",
    "broker_email": "samudiosegurospa@outlook.com",
    "insurer_name": "MB SEGUROS",
    "ramo": "VIDA",
    "start_date": "2027-05-07",
    "renewal_date": "2041-05-07"
  }
]'::jsonb);

-- =====================================================
-- PASO 3: VERIFICAR RESULTADOS
-- =====================================================

-- Ver resumen de importación
-- Si ves todas las filas con success=true, el import fue exitoso

-- Verificar pólizas MB creadas (ejecutar después del import)
/*
SELECT 
  p.policy_number,
  c.name as client,
  c.national_id,
  i.name as insurer,
  b.name as broker,
  p.ramo,
  p.start_date,
  p.renewal_date
FROM policies p
JOIN clients c ON p.client_id = c.id
JOIN insurers i ON p.insurer_id = i.id
JOIN brokers b ON p.broker_id = b.id
WHERE i.name = 'MB'
  AND p.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY p.created_at DESC;
*/

-- =====================================================
-- RESUMEN
-- =====================================================

/*
✅ FUNCIÓN ACTUALIZADA: Búsqueda flexible de aseguradoras
✅ 14 REGISTROS MB SEGUROS listos para importar

BROKERS INVOLUCRADOS:
- samudiosegurospa@outlook.com (4 pólizas)
- carlosfoot@lideresenseguros.com (6 pólizas)
- keniagonzalez@lideresenseguros.com (1 póliza)
- itzycandanedo@lideresenseguros.com (2 pólizas)
- didimosamudio@lideresenseguros.com (1 póliza)

TIPOS DE PÓLIZAS:
- AUTO: 8 pólizas
- INCENDIO: 2 pólizas
- VIDA: 2 pólizas
- HOGAR: 1 póliza
- RESPONSABILIDAD CIVIL: 1 póliza

CLIENTES ÚNICOS: 11 (3 clientes con 2+ pólizas)
*/
