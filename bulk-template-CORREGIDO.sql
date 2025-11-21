-- =====================================================
-- TEMPLATE CORREGIDO PARA BULK IMPORT DE COMISIONES
-- Con lógica correcta de Códigos ASSA al 100%
-- =====================================================

DO $$
DECLARE
  v_fortnight_id UUID;
  v_import_id UUID;
  v_client_id UUID;
  v_policy_id UUID;
  v_broker_id UUID;
  v_insurer_id UUID;
  v_percentage NUMERIC;
  v_net_amount NUMERIC;
  v_broker_assa_code TEXT;
  v_is_assa_100 BOOLEAN;
BEGIN

  -- =====================================================
  -- 1. CREAR QUINCENA
  -- =====================================================
  INSERT INTO fortnights (period_start, period_end, status, notify_brokers, created_at)
  VALUES ('2025-11-01', '2025-11-15', 'PAID', false, NOW())
  RETURNING id INTO v_fortnight_id;

  RAISE NOTICE 'Quincena ID: %', v_fortnight_id;

  -- =====================================================
  -- 2. CREAR COMM_IMPORT
  -- =====================================================
  SELECT id INTO v_insurer_id FROM insurers WHERE UPPER(name) = 'ASSA' LIMIT 1;
  
  INSERT INTO comm_imports (period_label, insurer_id, total_amount, is_life_insurance, created_at)
  VALUES (v_fortnight_id, v_insurer_id, 7747.32, false, NOW())
  RETURNING id INTO v_import_id;

  RAISE NOTICE 'Import ID: %', v_import_id;

  -- =====================================================
  -- EJEMPLO DE FILA: PÓLIZA EN ASSA
  -- =====================================================
  
  -- Buscar aseguradora
  SELECT id INTO v_insurer_id FROM insurers WHERE UPPER(name) = 'ASSA' LIMIT 1;
  
  IF v_insurer_id IS NULL THEN
    RAISE WARNING 'Aseguradora no encontrada: ASSA';
  END IF;

  -- Buscar broker por email
  v_broker_id := NULL;
  SELECT id INTO v_broker_id FROM brokers WHERE LOWER(email) = 'amariar23@gmail.com' LIMIT 1;
  
  -- Obtener código ASSA del broker (si tiene)
  v_broker_assa_code := NULL;
  IF v_broker_id IS NOT NULL THEN
    SELECT assa_code INTO v_broker_assa_code FROM brokers WHERE id = v_broker_id;
  END IF;
  
  -- =====================================================
  -- LÓGICA CORRECTA DE PORCENTAJES
  -- =====================================================
  
  v_is_assa_100 := FALSE;
  
  -- Caso 1: VIDA en ASSA → 100%
  IF ('ASSA' = 'ASSA' AND 'VIDA' = 'VIDA') THEN
    v_percentage := 1.0;
    v_is_assa_100 := TRUE;
    RAISE NOTICE 'Aplicando 100%: VIDA en ASSA';
    
  -- Caso 2: Código ASSA del broker → 100%
  ELSIF ('ASSA' = 'ASSA' AND v_broker_assa_code IS NOT NULL AND '12B34565' = v_broker_assa_code) THEN
    v_percentage := 1.0;
    v_is_assa_100 := TRUE;
    RAISE NOTICE 'Aplicando 100%: Código ASSA del broker (%)' , v_broker_assa_code;
    
  -- Caso 3: Aplicar percent_default del broker
  ELSIF v_broker_id IS NOT NULL THEN
    SELECT percent_default INTO v_percentage FROM brokers WHERE id = v_broker_id;
    RAISE NOTICE 'Aplicando percent_default del broker: %', v_percentage;
    
  -- Caso 4: Sin broker
  ELSE
    v_percentage := 0;
    RAISE WARNING 'Broker no encontrado para email: amariar23@gmail.com';
  END IF;
  
  -- Calcular monto neto
  v_net_amount := 22.7 * v_percentage;

  -- =====================================================
  -- CREAR O ACTUALIZAR PÓLIZA
  -- =====================================================
  
  -- Buscar póliza existente
  SELECT id, client_id INTO v_policy_id, v_client_id 
  FROM policies 
  WHERE policy_number = '12B34565'
  LIMIT 1;

  IF v_policy_id IS NOT NULL THEN
    -- Póliza existe: actualizar
    UPDATE policies SET
      broker_id = COALESCE(v_broker_id, broker_id),
      insurer_id = COALESCE(v_insurer_id, insurer_id),
      start_date = COALESCE('2025-06-02', start_date),
      renewal_date = COALESCE('2026-06-02', renewal_date),
      -- Si es ASSA al 100%, setear percent_override = 1.0
      percent_override = CASE WHEN v_is_assa_100 THEN 1.0 ELSE percent_override END
    WHERE id = v_policy_id;
    
    RAISE NOTICE 'Póliza actualizada: 12B34565';
  ELSE
    -- Póliza NO existe: crear cliente y póliza
    
    -- Crear cliente (CON NORMALIZACIÓN)
    INSERT INTO clients (name, broker_id, active, created_at)
    VALUES (
      normalize_name('ALEXIS CONCEPCION ALVEO GONZALEZ'), 
      COALESCE(v_broker_id, (SELECT id FROM brokers LIMIT 1)), 
      true, 
      NOW()
    )
    RETURNING id INTO v_client_id;
    
    -- Crear póliza
    INSERT INTO policies (
      policy_number, client_id, broker_id, insurer_id, 
      start_date, renewal_date, percent_override, status, created_at
    )
    VALUES (
      '12B34565', 
      v_client_id, 
      COALESCE(v_broker_id, (SELECT id FROM brokers LIMIT 1)), 
      v_insurer_id,
      '2025-06-02', 
      '2026-06-02', 
      -- Si es ASSA al 100%, setear percent_override = 1.0
      CASE WHEN v_is_assa_100 THEN 1.0 ELSE NULL END, 
      'ACTIVA', 
      NOW()
    )
    RETURNING id INTO v_policy_id;
    
    RAISE NOTICE 'Cliente y póliza creados: 12B34565';
  END IF;

  -- =====================================================
  -- CREAR COMM_ITEM
  -- =====================================================
  
  INSERT INTO comm_items (
    import_id, policy_number, insured_name, insurer_id, broker_id, gross_amount, raw_row, created_at
  )
  VALUES (
    v_import_id, 
    '12B34565', 
    normalize_name('ALEXIS CONCEPCION ALVEO GONZALEZ'), 
    v_insurer_id, 
    v_broker_id,
    22.7,
    jsonb_build_object(
      'policy_type', 'VIDA',
      'percentage_applied', v_percentage,
      'net_amount', v_net_amount,
      'is_assa_100', v_is_assa_100,
      'broker_email', 'amariar23@gmail.com',
      'broker_assa_code', v_broker_assa_code
    ),
    NOW()
  );

  RAISE NOTICE 'Comm_item creado para póliza 12B34565';

END $$;

-- =====================================================
-- NOTAS PARA EL GENERADOR TYPESCRIPT
-- =====================================================

/*

IMPORTANTE: Al generar el bulk SQL desde TypeScript:

1. NORMALIZACIÓN DE NOMBRES:
   - Usar función toUpperNoAccents() que convierte guiones en espacios
   - Envolver nombres de clientes con normalize_name()
   
2. CÓDIGOS ASSA AL 100%:
   - Para cada fila, verificar si:
     a) Es VIDA en ASSA → 100%
     b) El policy_number coincide con broker.assa_code Y es ASSA → 100%
   - Si ninguno aplica, usar percent_default del broker
   
3. ESTRUCTURA:
   - Obtener broker_assa_code al inicio de cada fila
   - Usar v_is_assa_100 para marcar casos especiales
   - Aplicar percent_override = 1.0 cuando corresponda
   
4. EJEMPLO DE CÓDIGO TYPESCRIPT:

function normalizeClientName(name: string): string {
  if (!name) return '';
  
  let normalized = name.trim().toUpperCase();
  
  // Reemplazar acentos y ñ
  const accents: Record<string, string> = {
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
    'Ä': 'A', 'Ë': 'E', 'Ï': 'I', 'Ö': 'O', 'Ü': 'U',
    'Â': 'A', 'Ê': 'E', 'Î': 'I', 'Ô': 'O', 'Û': 'U',
    'Ñ': 'N'
  };
  
  for (const [char, replacement] of Object.entries(accents)) {
    normalized = normalized.replace(new RegExp(char, 'g'), replacement);
  }
  
  // Convertir guiones en espacios (IMPORTANTE)
  normalized = normalized.replace(/-/g, ' ');
  
  // Eliminar caracteres especiales (excepto espacios, A-Z, 0-9)
  normalized = normalized.replace(/[^A-Z0-9 ]/g, '');
  
  // Comprimir espacios múltiples
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized.trim();
}

function shouldApply100Percent(
  insurerName: string, 
  policyType: string | null, 
  policyNumber: string,
  brokerAssaCode: string | null
): boolean {
  // Caso 1: VIDA en ASSA
  if (insurerName === 'ASSA' && policyType === 'VIDA') {
    return true;
  }
  
  // Caso 2: Código ASSA del broker
  if (insurerName === 'ASSA' && brokerAssaCode && policyNumber === brokerAssaCode) {
    return true;
  }
  
  return false;
}

*/
