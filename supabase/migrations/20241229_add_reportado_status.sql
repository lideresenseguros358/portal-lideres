-- ============================================
-- AGREGAR STATUS 'REPORTADO' A BANK_TRANSFERS_COMM
-- Portal Líderes - 29/12/2024
-- ============================================

-- Eliminar constraint existente
ALTER TABLE public.bank_transfers_comm 
DROP CONSTRAINT IF EXISTS bank_transfers_comm_status_check;

-- Agregar nuevo constraint con REPORTADO
ALTER TABLE public.bank_transfers_comm
ADD CONSTRAINT bank_transfers_comm_status_check 
CHECK (status IN ('SIN_CLASIFICAR', 'PENDIENTE', 'OK_CONCILIADO', 'REPORTADO', 'PAGADO'));

-- Comentario explicativo
COMMENT ON CONSTRAINT bank_transfers_comm_status_check ON public.bank_transfers_comm IS 
'Status válidos: SIN_CLASIFICAR (inicial), PENDIENTE (sin clasificar), OK_CONCILIADO (conciliado), REPORTADO (tipo reporte/bono), PAGADO (pagado en quincena)';
