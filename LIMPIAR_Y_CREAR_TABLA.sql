-- PASO 1: Limpiar cualquier residuo (constraints huérfanos)
-- Ejecuta esto primero en Supabase SQL Editor

-- Eliminar constraint si existe (aunque la tabla no exista)
DO $$ 
BEGIN
    -- Intentar eliminar la tabla si existe (con CASCADE para limpiar todo)
    DROP TABLE IF EXISTS public.insurer_contacts CASCADE;
    
    RAISE NOTICE 'Limpieza completada';
END $$;

-- PASO 2: Crear la tabla limpia
CREATE TABLE public.insurer_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    insurer_id UUID NOT NULL,
    name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PASO 3: Agregar foreign key (ahora sí sin conflicto)
ALTER TABLE public.insurer_contacts
ADD CONSTRAINT insurer_contacts_insurer_id_fkey 
FOREIGN KEY (insurer_id) REFERENCES public.insurers(id) ON DELETE CASCADE;

-- PASO 4: Crear índice
CREATE INDEX idx_insurer_contacts_insurer_id 
ON public.insurer_contacts(insurer_id);

-- PASO 5: Habilitar RLS
ALTER TABLE public.insurer_contacts ENABLE ROW LEVEL SECURITY;

-- PASO 6: Políticas de seguridad
-- SELECT: Todos los usuarios autenticados pueden ver
CREATE POLICY "Users can view insurer contacts"
ON public.insurer_contacts
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Solo Master
CREATE POLICY "Master can insert insurer contacts"
ON public.insurer_contacts
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'master'
    )
);

-- UPDATE: Solo Master
CREATE POLICY "Master can update insurer contacts"
ON public.insurer_contacts
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'master'
    )
);

-- DELETE: Solo Master
CREATE POLICY "Master can delete insurer contacts"
ON public.insurer_contacts
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'master'
    )
);

-- PASO 7: Trigger para updated_at
CREATE OR REPLACE FUNCTION update_insurer_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_insurer_contacts_updated_at
BEFORE UPDATE ON public.insurer_contacts
FOR EACH ROW
EXECUTE FUNCTION update_insurer_contacts_updated_at();

-- PASO 8: Comentarios
COMMENT ON TABLE public.insurer_contacts IS 'Contactos de personas en las aseguradoras';
COMMENT ON COLUMN public.insurer_contacts.name IS 'Nombre completo del contacto';
COMMENT ON COLUMN public.insurer_contacts.position IS 'Cargo o posición en la aseguradora';
COMMENT ON COLUMN public.insurer_contacts.phone IS 'Teléfono de contacto';
COMMENT ON COLUMN public.insurer_contacts.email IS 'Correo electrónico';
COMMENT ON COLUMN public.insurer_contacts.notes IS 'Notas adicionales sobre el contacto';

-- Verificar que se creó correctamente
SELECT 
    'Tabla creada exitosamente' as mensaje,
    COUNT(*) as num_columnas
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'insurer_contacts';
