-- ========================================
-- FIX: TRIGGER PARA ELIMINAR REGISTROS PROCESADOS
-- ========================================
-- Este trigger complementa el proceso_temp_client_import
-- y ELIMINA el registro después de procesarlo exitosamente
-- ========================================

-- Primero, modificamos la función original para que solo marque como procesado
-- Ya no necesitamos cambiar la función, solo agregar un AFTER trigger

CREATE OR REPLACE FUNCTION public.delete_processed_temp_import()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo eliminar si fue procesado exitosamente
  IF NEW.import_status = 'processed' THEN
    -- Usar DELETE para remover el registro
    DELETE FROM public.temp_client_imports
    WHERE id = NEW.id;
    
    -- Retornar NULL porque el registro ya fue eliminado
    RETURN NULL;
  END IF;
  
  -- Si hay error, mantener el registro para revisión
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger AFTER que se ejecuta después del BEFORE trigger
DROP TRIGGER IF EXISTS trigger_delete_processed_temp_import ON public.temp_client_imports;
CREATE TRIGGER trigger_delete_processed_temp_import
  AFTER INSERT OR UPDATE ON public.temp_client_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_processed_temp_import();

-- Comentario
COMMENT ON FUNCTION public.delete_processed_temp_import() IS 
'Trigger AFTER: Elimina registros de temp_client_imports después de procesarlos exitosamente. Los errores se mantienen para revisión.';

-- ========================================
-- ORDEN DE EJECUCIÓN:
-- ========================================
-- 1. BEFORE trigger: process_temp_client_import()
--    - Valida datos
--    - Crea/actualiza cliente en clients
--    - Crea póliza en policies
--    - Marca como 'processed' o 'error'
--
-- 2. AFTER trigger: delete_processed_temp_import()
--    - Si status = 'processed' → ELIMINA el registro
--    - Si status = 'error' → MANTIENE para revisión
-- ========================================
