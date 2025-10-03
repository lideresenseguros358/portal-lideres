-- 08_insurers_and_mappings.sql
-- Aseguradoras y sistema de mapeos

-- 1. Tabla de aseguradoras (ya debe existir)
CREATE TABLE IF NOT EXISTS public.insurers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de mapeos de aseguradoras
CREATE TABLE IF NOT EXISTS public.insurer_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insurer_id UUID NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
    map_kind TEXT NOT NULL CHECK (map_kind IN ('COMMISSIONS', 'DELINQUENCY')),
    standard_key TEXT NOT NULL,
    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    options JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de códigos ASSA
CREATE TABLE IF NOT EXISTS public.insurer_assa_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insurer_id UUID NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    code_norm TEXT NOT NULL,
    broker_id UUID NULL REFERENCES public.brokers(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_insurer_mappings_insurer_id ON public.insurer_mappings(insurer_id);
CREATE INDEX IF NOT EXISTS idx_insurer_mappings_map_kind ON public.insurer_mappings(map_kind);
CREATE INDEX IF NOT EXISTS idx_insurer_assa_codes_insurer_id ON public.insurer_assa_codes(insurer_id);
CREATE INDEX IF NOT EXISTS idx_insurer_assa_codes_code_norm ON public.insurer_assa_codes(code_norm);

-- Función para normalizar códigos ASSA
CREATE OR REPLACE FUNCTION normalize_assa_code(raw_code TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Formato esperado: PJ750-xxx (sin ceros de relleno)
    -- Ejemplo: PJ750-001 -> PJ750-1
    IF raw_code LIKE 'PJ750-%' THEN
        RETURN 'PJ750-' || LTRIM(SUBSTRING(raw_code FROM 7), '0');
    END IF;
    RETURN raw_code;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para normalizar code_norm automáticamente
CREATE OR REPLACE FUNCTION normalize_assa_code_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.code_norm := normalize_assa_code(NEW.code);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normalize_assa_code
    BEFORE INSERT OR UPDATE ON public.insurer_assa_codes
    FOR EACH ROW
    EXECUTE FUNCTION normalize_assa_code_trigger();

-- RLS Policies

-- Aseguradoras
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MASTER can do everything with insurers"
    ON public.insurers
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'MASTER'
        )
    );

CREATE POLICY "BROKER can read active insurers"
    ON public.insurers
    FOR SELECT
    TO authenticated
    USING (
        active = true
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'BROKER'
        )
    );

-- Mapeos
ALTER TABLE public.insurer_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MASTER can do everything with mappings"
    ON public.insurer_mappings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'MASTER'
        )
    );

CREATE POLICY "BROKER can read active mappings"
    ON public.insurer_mappings
    FOR SELECT
    TO authenticated
    USING (
        active = true
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'BROKER'
        )
    );

-- Códigos ASSA
ALTER TABLE public.insurer_assa_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MASTER can do everything with ASSA codes"
    ON public.insurer_assa_codes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'MASTER'
        )
    );

CREATE POLICY "BROKER can read ASSA codes"
    ON public.insurer_assa_codes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'BROKER'
        )
    );
