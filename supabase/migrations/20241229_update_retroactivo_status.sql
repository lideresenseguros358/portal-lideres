-- ============================================
-- ACTUALIZACIÓN RETROACTIVA: Status según Tipo
-- Portal Líderes - 29/12/2024
-- ============================================
-- Este script actualiza el status de todas las transferencias
-- existentes según su tipo actual para mantener consistencia

-- 1. REPORTE o BONO → REPORTADO
UPDATE public.bank_transfers_comm
SET status = 'REPORTADO'
WHERE transfer_type IN ('REPORTE', 'BONO')
  AND status != 'PAGADO'; -- No tocar las que ya están pagadas

-- 2. PENDIENTE en tipo → PENDIENTE en status
UPDATE public.bank_transfers_comm
SET status = 'PENDIENTE'
WHERE transfer_type = 'PENDIENTE'
  AND status NOT IN ('PAGADO', 'REPORTADO');

-- 3. Eliminar SIN_CLASIFICAR: cambiar a PENDIENTE
UPDATE public.bank_transfers_comm
SET status = 'PENDIENTE'
WHERE status = 'SIN_CLASIFICAR';

-- 4. OTRO sin status claro → PENDIENTE (para que tengan un estado válido)
UPDATE public.bank_transfers_comm
SET status = 'PENDIENTE'
WHERE transfer_type = 'OTRO'
  AND status NOT IN ('PAGADO', 'REPORTADO', 'OK_CONCILIADO', 'PENDIENTE');

-- Resumen de cambios
SELECT 
  'Resumen de actualización retroactiva' as info,
  COUNT(*) FILTER (WHERE status = 'REPORTADO') as reportados,
  COUNT(*) FILTER (WHERE status = 'PENDIENTE') as pendientes,
  COUNT(*) FILTER (WHERE status = 'OK_CONCILIADO') as conciliados,
  COUNT(*) FILTER (WHERE status = 'PAGADO') as pagados,
  COUNT(*) FILTER (WHERE status = 'SIN_CLASIFICAR') as sin_clasificar_restantes
FROM public.bank_transfers_comm;
