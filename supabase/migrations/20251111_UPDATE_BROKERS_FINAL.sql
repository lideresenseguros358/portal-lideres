-- =====================================================
-- ACTUALIZACIÓN MASIVA DE BROKERS - PARTE 1: FUNCIONES
-- =====================================================

CREATE OR REPLACE FUNCTION clean_account(account TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN CASE WHEN account IS NULL OR TRIM(account) = '' THEN NULL
                ELSE REGEXP_REPLACE(account, '[^0-9]', '', 'g') END;
END; $$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_bank_code(bank TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        WHEN bank ILIKE '%GENERAL%' THEN '71'
        WHEN bank ILIKE '%BANISTMO%' THEN '22'
        WHEN bank ILIKE '%BAC%' THEN '45'
        WHEN bank ILIKE '%GLOBAL%' THEN '41'
        WHEN bank ILIKE '%SCOTI%' OR bank ILIKE '%NOVA%' THEN '50'
        WHEN bank ILIKE '%CAJA%' THEN '06'
        WHEN bank ILIKE '%CREDICORP%' THEN '47'
        ELSE NULL END;
END; $$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_tipo_code(tipo TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN CASE WHEN tipo ILIKE '%corriente%' THEN '03' ELSE '04' END;
END; $$ LANGUAGE plpgsql IMMUTABLE;
