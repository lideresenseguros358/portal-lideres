-- ============================================
-- RPC FUNCTIONS PARA VALIDACIONES SIN RLS
-- ============================================
-- Estas funciones permiten validar clientes y pólizas
-- sin restricciones RLS, necesario para advertencias
-- ============================================

-- 1. Buscar cliente por cédula (ignora RLS)
CREATE OR REPLACE FUNCTION public.rpc_search_client_by_national_id(p_national_id TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  national_id TEXT,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  broker_id UUID,
  broker_name TEXT,
  broker_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.national_id,
    c.email,
    c.phone,
    c.birth_date,
    c.broker_id,
    b.name AS broker_name,
    p.email AS broker_email
  FROM clients c
  LEFT JOIN brokers b ON c.broker_id = b.id
  LEFT JOIN profiles p ON b.p_id = p.id
  WHERE c.national_id = UPPER(p_national_id)
  LIMIT 1;
END;
$$;

-- 2. Validar número de póliza en policies (ignora RLS)
CREATE OR REPLACE FUNCTION public.rpc_validate_policy_number(p_policy_number TEXT)
RETURNS TABLE (
  id UUID,
  policy_number TEXT,
  broker_id UUID,
  client_id UUID,
  client_name TEXT,
  client_active BOOLEAN,
  broker_name TEXT,
  broker_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pol.id,
    pol.policy_number,
    pol.broker_id,
    pol.client_id,
    c.name AS client_name,
    c.active AS client_active,
    b.name AS broker_name,
    p.email AS broker_email
  FROM policies pol
  LEFT JOIN clients c ON pol.client_id = c.id
  LEFT JOIN brokers b ON pol.broker_id = b.id
  LEFT JOIN profiles p ON b.p_id = p.id
  WHERE pol.policy_number = UPPER(p_policy_number)
  LIMIT 1;
END;
$$;

-- 3. Validar número de póliza en comm_items (ignora RLS)
CREATE OR REPLACE FUNCTION public.rpc_validate_policy_in_comm_items(p_policy_number TEXT)
RETURNS TABLE (
  id UUID,
  policy_number TEXT,
  insured_name TEXT,
  broker_id UUID,
  broker_name TEXT,
  broker_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.policy_number,
    ci.insured_name,
    ci.broker_id,
    b.name AS broker_name,
    p.email AS broker_email
  FROM comm_items ci
  LEFT JOIN brokers b ON ci.broker_id = b.id
  LEFT JOIN profiles p ON b.p_id = p.id
  WHERE ci.policy_number = UPPER(p_policy_number)
  LIMIT 1;
END;
$$;

-- Comentarios
COMMENT ON FUNCTION public.rpc_search_client_by_national_id IS 'Busca cliente por cédula sin restricciones RLS - usado para validaciones';
COMMENT ON FUNCTION public.rpc_validate_policy_number IS 'Valida si póliza existe en policies sin restricciones RLS';
COMMENT ON FUNCTION public.rpc_validate_policy_in_comm_items IS 'Valida si póliza existe en comm_items sin restricciones RLS';
