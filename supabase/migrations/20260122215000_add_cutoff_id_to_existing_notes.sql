-- ============================================================================
-- MIGRACIÓN: Agregar [ID:cutoff_id] a notas existentes de transferencias incluidas
-- ============================================================================
-- Problema: Transferencias incluidas ANTES no tienen [ID:xxx] en las notas
-- Solución: Extraer fechas de las notas, buscar cutoff correspondiente, agregar [ID:xxx]
-- ============================================================================

DO $$
DECLARE
  transfer_record RECORD;
  note_line TEXT;
  note_lines TEXT[];
  date_pattern TEXT;
  start_date_str TEXT;
  end_date_str TEXT;
  matching_cutoff_id UUID;
  new_notes TEXT;
  line_index INT;
BEGIN
  RAISE NOTICE 'Iniciando actualización de notas con IDs de corte...';
  
  -- Iterar sobre todas las transferencias con "Incluida en corte:" en las notas
  FOR transfer_record IN 
    SELECT id, notes_internal
    FROM bank_transfers_comm
    WHERE notes_internal LIKE '%Incluida en corte:%'
      AND notes_internal NOT LIKE '%[ID:%'  -- Solo las que NO tienen ID aún
  LOOP
    RAISE NOTICE 'Procesando transfer %', transfer_record.id;
    
    -- Dividir notas en líneas
    note_lines := string_to_array(transfer_record.notes_internal, E'\n');
    new_notes := '';
    
    -- Procesar cada línea
    FOR line_index IN 1..array_length(note_lines, 1)
    LOOP
      note_line := note_lines[line_index];
      
      -- Si la línea contiene "Incluida en corte:" y NO tiene [ID:
      IF note_line LIKE '%Incluida en corte:%' AND note_line NOT LIKE '%[ID:%' THEN
        RAISE NOTICE '  Línea encontrada: %', note_line;
        
        -- Extraer fechas con regex (DD/MM/YYYY - DD/MM/YYYY)
        -- Patrón: "Incluida en corte: DD/MM/YYYY - DD/MM/YYYY"
        -- Extraer primera fecha (start_date)
        start_date_str := (regexp_matches(note_line, '(\d{1,2})/(\d{1,2})/(\d{4})'))[1] || '-' || 
                          (regexp_matches(note_line, '(\d{1,2})/(\d{1,2})/(\d{4})'))[2] || '-' ||
                          (regexp_matches(note_line, '(\d{1,2})/(\d{1,2})/(\d{4})'))[3];
        
        -- Buscar todas las fechas en la línea
        -- Segunda fecha vendría después del " - "
        -- Necesitamos encontrar el cutoff que coincida
        
        -- Estrategia más simple: buscar cutoff por las fechas formateadas
        -- Convertir "17/12/2025 - 03/01/2026" a buscar cutoffs
        -- Intentar buscar el cutoff que tenga esas fechas
        
        -- Extraer el fragmento con las fechas
        date_pattern := substring(note_line FROM 'Incluida en corte: ([0-9/]+ - [0-9/]+)');
        
        RAISE NOTICE '  Patrón de fecha extraído: %', date_pattern;
        
        -- Buscar cutoff que coincida con estas fechas
        -- Necesitamos convertir DD/MM/YYYY a YYYY-MM-DD para comparar
        SELECT id INTO matching_cutoff_id
        FROM bank_cutoffs
        WHERE 
          -- Formatear start_date y end_date del cutoff para comparar
          to_char(start_date::date, 'DD/MM/YYYY') || ' - ' || to_char(end_date::date, 'DD/MM/YYYY') = date_pattern
        LIMIT 1;
        
        IF matching_cutoff_id IS NOT NULL THEN
          RAISE NOTICE '  ✅ Cutoff encontrado: %', matching_cutoff_id;
          
          -- Insertar [ID:xxx] después de las fechas, antes del paréntesis de timestamp
          -- "📌 Incluida en corte: 17/12/2025 - 03/01/2026 (22/01/2026)"
          -- Convertir a:
          -- "📌 Incluida en corte: 17/12/2025 - 03/01/2026 [ID:xxx] (22/01/2026)"
          
          -- Si hay paréntesis (timestamp), insertar antes
          IF note_line LIKE '%(%)%' THEN
            note_line := regexp_replace(
              note_line,
              '(\d{1,2}/\d{1,2}/\d{4} - \d{1,2}/\d{1,2}/\d{4}) (\()',
              '\1 [ID:' || matching_cutoff_id || '] \2'
            );
          ELSE
            -- Si no hay timestamp, agregar al final
            note_line := regexp_replace(
              note_line,
              '(\d{1,2}/\d{1,2}/\d{4} - \d{1,2}/\d{1,2}/\d{4})',
              '\1 [ID:' || matching_cutoff_id || ']'
            );
          END IF;
          
          RAISE NOTICE '  Nueva línea: %', note_line;
        ELSE
          RAISE NOTICE '  ⚠️  No se encontró cutoff para: %', date_pattern;
        END IF;
      END IF;
      
      -- Agregar línea a new_notes
      IF new_notes = '' THEN
        new_notes := note_line;
      ELSE
        new_notes := new_notes || E'\n' || note_line;
      END IF;
    END LOOP;
    
    -- Actualizar la transferencia con las notas modificadas
    IF new_notes != transfer_record.notes_internal THEN
      UPDATE bank_transfers_comm
      SET notes_internal = new_notes,
          updated_at = NOW()
      WHERE id = transfer_record.id;
      
      RAISE NOTICE '✅ Transfer % actualizado', transfer_record.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE '🎉 Actualización completa!';
END;
$$;

-- ============================================================================
-- VERIFICACIÓN: Mostrar notas actualizadas
-- ============================================================================
-- Descomentar para ver el resultado:
-- SELECT id, reference_number, notes_internal 
-- FROM bank_transfers_comm 
-- WHERE notes_internal LIKE '%[ID:%' 
-- LIMIT 10;
