-- Agregar campo is_primary a insurer_contacts
-- Este campo marca un contacto como el contacto principal de la aseguradora
-- Solo puede haber un contacto principal por aseguradora

-- 1. Agregar la columna is_primary
ALTER TABLE public.insurer_contacts 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- 2. Crear índice para mejorar consultas de contactos principales
CREATE INDEX IF NOT EXISTS idx_insurer_contacts_primary 
ON public.insurer_contacts(insurer_id, is_primary) 
WHERE is_primary = true;

-- 3. Función para asegurar solo un contacto principal por aseguradora
CREATE OR REPLACE FUNCTION ensure_single_primary_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el nuevo/actualizado contacto se marca como principal
  IF NEW.is_primary = true THEN
    -- Desmarcar todos los demás contactos de esta aseguradora
    UPDATE public.insurer_contacts
    SET is_primary = false
    WHERE insurer_id = NEW.insurer_id
    AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear trigger para ejecutar la función
DROP TRIGGER IF EXISTS trigger_ensure_single_primary_contact ON public.insurer_contacts;

CREATE TRIGGER trigger_ensure_single_primary_contact
  BEFORE INSERT OR UPDATE OF is_primary
  ON public.insurer_contacts
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_contact();

-- 5. Comentario sobre el campo
COMMENT ON COLUMN public.insurer_contacts.is_primary IS 'Indica si este es el contacto principal de la aseguradora. Solo puede haber uno por aseguradora.';
