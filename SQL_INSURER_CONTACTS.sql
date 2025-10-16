-- Tabla para almacenar contactos de aseguradoras
-- Ejecutar este SQL en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.insurer_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    insurer_id UUID NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT insurer_contacts_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES insurers(id) ON DELETE CASCADE
);

-- Índice para mejorar consultas por insurer_id
CREATE INDEX IF NOT EXISTS idx_insurer_contacts_insurer_id ON public.insurer_contacts(insurer_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.insurer_contacts ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios autenticados pueden ver todos los contactos
CREATE POLICY "Users can view insurer contacts"
    ON public.insurer_contacts
    FOR SELECT
    TO authenticated
    USING (true);

-- Política: Solo Master puede insertar contactos
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

-- Política: Solo Master puede actualizar contactos
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

-- Política: Solo Master puede eliminar contactos
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

-- Trigger para actualizar updated_at automáticamente
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

-- Comentarios
COMMENT ON TABLE public.insurer_contacts IS 'Contactos de personas en las aseguradoras';
COMMENT ON COLUMN public.insurer_contacts.name IS 'Nombre completo del contacto';
COMMENT ON COLUMN public.insurer_contacts.position IS 'Cargo o posición en la aseguradora';
COMMENT ON COLUMN public.insurer_contacts.phone IS 'Teléfono de contacto';
COMMENT ON COLUMN public.insurer_contacts.email IS 'Correo electrónico';
COMMENT ON COLUMN public.insurer_contacts.notes IS 'Notas adicionales sobre el contacto';
