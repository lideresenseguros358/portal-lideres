-- ============================================================================
-- MIGRACIÓN: Agregar [ID:xxx] correcto a las 3 transferencias incluidas
-- ============================================================================
-- Problema: Las transferencias tienen "17/12/2025 - 03/01/2026" pero ese corte
--           no existe o cambió de fechas
-- Solución: Buscar el corte correcto por fechas similares y agregar [ID:xxx]
-- ============================================================================

DO $$
DECLARE
  target_cutoff_id UUID;
  cutoff_start_date DATE;
  cutoff_end_date DATE;
  cutoff_label TEXT;
  transfer_count INT := 0;
BEGIN
  RAISE NOTICE '🔍 Buscando corte bancario cercano a 17/12/2025 - 03/01/2026...';
  
  -- Buscar corte con fechas cercanas (entre 16-18 de diciembre)
  SELECT id, start_date, end_date
  INTO target_cutoff_id, cutoff_start_date, cutoff_end_date
  FROM bank_cutoffs
  WHERE start_date >= '2025-12-16' 
    AND start_date <= '2025-12-18'
    AND end_date >= '2026-01-02'
    AND end_date <= '2026-01-04'
  ORDER BY start_date DESC
  LIMIT 1;
  
  IF target_cutoff_id IS NULL THEN
    RAISE NOTICE '❌ No se encontró corte cercano a esas fechas';
    RAISE NOTICE '📋 Cortes disponibles en diciembre 2025:';
    
    -- Mostrar todos los cortes de diciembre 2025
    FOR cutoff_start_date, cutoff_end_date IN 
      SELECT start_date, end_date 
      FROM bank_cutoffs 
      WHERE start_date >= '2025-12-01' AND start_date < '2026-01-31'
      ORDER BY start_date
    LOOP
      RAISE NOTICE '   - % - %', 
        to_char(cutoff_start_date, 'DD/MM/YYYY'),
        to_char(cutoff_end_date, 'DD/MM/YYYY');
    END LOOP;
    
    RETURN;
  END IF;
  
  -- Formatear label del corte
  cutoff_label := to_char(cutoff_start_date, 'DD/MM/YYYY') || ' - ' || to_char(cutoff_end_date, 'DD/MM/YYYY');
  
  RAISE NOTICE '✅ Corte encontrado: % [ID: %]', cutoff_label, target_cutoff_id;
  RAISE NOTICE '📝 Actualizando transferencias...';
  
  -- Actualizar las 3 transferencias que tienen "17/12/2025 - 03/01/2026" en las notas
  UPDATE bank_transfers_comm
  SET notes_internal = regexp_replace(
    notes_internal,
    '(Incluida en corte: 17/12/2025 - 03/01/2026)',
    '\1 [ID:' || target_cutoff_id || ']',
    'g'
  ),
  updated_at = NOW()
  WHERE notes_internal LIKE '%Incluida en corte: 17/12/2025 - 03/01/2026%'
    AND notes_internal NOT LIKE '%[ID:%';
  
  GET DIAGNOSTICS transfer_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Actualizadas % transferencias', transfer_count;
  RAISE NOTICE '🎉 Migración completada!';
  
  -- Verificar resultado
  RAISE NOTICE '';
  RAISE NOTICE '📋 Transferencias actualizadas:';
  FOR cutoff_label IN 
    SELECT reference_number || ': ' || substring(notes_internal, 1, 100)
    FROM bank_transfers_comm
    WHERE notes_internal LIKE '%[ID:' || target_cutoff_id || ']%'
    LIMIT 5
  LOOP
    RAISE NOTICE '   %', cutoff_label;
  END LOOP;
  
END;
$$;
