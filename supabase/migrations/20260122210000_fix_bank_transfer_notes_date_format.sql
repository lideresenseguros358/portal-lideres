-- ============================================================================
-- MIGRACIÓN: Normalizar formato de fechas en notas de transferencias incluidas
-- ============================================================================
-- Problema: Las notas tienen formato MM/DD/YYYY pero el sistema espera DD/MM/YYYY
-- Solución: Convertir TODAS las fechas en notes_internal a formato DD/MM/YYYY
-- ============================================================================

-- Función para convertir una nota con fechas MM/DD/YYYY a DD/MM/YYYY
CREATE OR REPLACE FUNCTION normalize_transfer_note_dates()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  transfer_record RECORD;
  old_notes TEXT;
  new_notes TEXT;
  pattern TEXT;
  match TEXT[];
  converted_date TEXT;
  original_date TEXT;
BEGIN
  -- Iterar sobre todas las transferencias que tienen notas con "Incluida en corte:"
  FOR transfer_record IN 
    SELECT id, notes_internal
    FROM bank_transfers_comm
    WHERE notes_internal LIKE '%Incluida en corte:%'
  LOOP
    old_notes := transfer_record.notes_internal;
    new_notes := old_notes;
    
    -- Patrón regex para encontrar fechas MM/DD/YYYY
    -- Busca patrones como: 12/17/2025, 01/03/2025, etc.
    pattern := '(\d{1,2})/(\d{1,2})/(\d{4})';
    
    -- Reemplazar todas las ocurrencias de MM/DD/YYYY con DD/MM/YYYY
    -- Usar regexp_replace para convertir formato
    new_notes := regexp_replace(
      new_notes,
      pattern,
      '\2/\1/\3',
      'g'
    );
    
    -- Solo actualizar si hubo cambios
    IF new_notes != old_notes THEN
      UPDATE bank_transfers_comm
      SET notes_internal = new_notes,
          updated_at = NOW()
      WHERE id = transfer_record.id;
      
      RAISE NOTICE 'Transfer % updated: % -> %', 
        transfer_record.id, 
        old_notes, 
        new_notes;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Date format normalization complete!';
END;
$$;

-- Ejecutar la función de normalización
SELECT normalize_transfer_note_dates();

-- Limpiar la función temporal
DROP FUNCTION normalize_transfer_note_dates();

-- ============================================================================
-- VERIFICACIÓN: Mostrar algunas notas actualizadas para validar
-- ============================================================================
-- Descomentar para ver el resultado:
-- SELECT id, notes_internal 
-- FROM bank_transfers_comm 
-- WHERE notes_internal LIKE '%Incluida en corte:%' 
-- LIMIT 10;
