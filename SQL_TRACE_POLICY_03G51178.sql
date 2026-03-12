-- ============================================================
-- RASTREO COMPLETO DE PÓLIZA 03G51178
-- Ejecutar en Supabase SQL Editor
-- Tablas verificadas contra database.types.ts
-- ============================================================

-- 1. policies (pólizas formales en base de datos)
SELECT 'POLICIES' as source, p.id, p.policy_number, p.status,
       c.name as client_name, c.national_id, c.active as client_active,
       b.name as broker_name, i.name as insurer_name,
       p.created_at
FROM policies p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN brokers b ON c.broker_id = b.id
LEFT JOIN insurers i ON p.insurer_id = i.id
WHERE UPPER(p.policy_number) = '03G51178';

-- 2. comm_items (items de comisión importados en quincenas)
SELECT 'COMM_ITEMS' as source, ci.id, ci.policy_number, ci.insured_name,
       ci.gross_amount, ci.import_id,
       ci.broker_id, b.name as broker_name,
       ci.insurer_id, ins.name as insurer_name,
       ci.created_at
FROM comm_items ci
LEFT JOIN brokers b ON ci.broker_id = b.id
LEFT JOIN insurers ins ON ci.insurer_id = ins.id
WHERE UPPER(ci.policy_number) = '03G51178';

-- 3. temp_client_import (preliminares / pendientes de migrar)
SELECT 'TEMP_CLIENT_IMPORT' as source, tci.id, tci.policy_number,
       tci.client_name, tci.national_id, tci.email, tci.phone,
       tci.ramo, tci.status, tci.source, tci.migrated,
       tci.broker_id, b.name as broker_name,
       tci.insurer_id, ins.name as insurer_name,
       tci.client_id, tci.policy_id,
       tci.created_at
FROM temp_client_import tci
LEFT JOIN brokers b ON tci.broker_id = b.id
LEFT JOIN insurers ins ON tci.insurer_id = ins.id
WHERE UPPER(tci.policy_number) = '03G51178';

-- 4. clients (buscar por nombre del asegurado)
SELECT 'CLIENTS' as source, c.id, c.name, c.national_id, c.email,
       c.active, c.broker_id, b.name as broker_name, c.created_at
FROM clients c
LEFT JOIN brokers b ON c.broker_id = b.id
WHERE UPPER(c.name) ILIKE '%QUIJANO%';

-- 5. Lo que el wizard ve exactamente (RPCs)
SELECT 'RPC_POLICIES' as source, * FROM rpc_validate_policy_number('03G51178');
SELECT 'RPC_COMM_ITEMS' as source, * FROM rpc_validate_policy_in_comm_items('03G51178');
