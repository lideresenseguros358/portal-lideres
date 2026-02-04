'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer } from '@/lib/supabase/server';
import {
  toUpperNoAccents,
  formatAccountForACH,
  normalizeRoute,
  truncate,
  getAccountTypeCode,
  formatACHAmount,
  generateACHReference,
  cleanBeneficiaryId
} from '@/lib/commissions/ach-normalization';

/**
 * Obtener contexto de autenticación
 */
async function getAuthContext() {
  const supabase = await getSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('No autenticado');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return {
    userId: user.id,
    role: profile?.role || 'broker',
  };
}

/**
 * Generar archivo TXT para Banco General con ajustes aprobados
 * FORMATO ACH OFICIAL BANCO GENERAL (8 campos separados por ;):
 * 1. ID Beneficiario (1-15 alfanum.)
 * 2. Nombre Beneficiario (1-22 alfanum., normalizado ACH)
 * 3. Ruta Destino (1-9 num., código banco)
 * 4. Cuenta Destino (1-17 alfanum.)
 * 5. Producto Destino (03=Corriente, 04=Ahorro)
 * 6. Monto (###0.00)
 * 7. Tipo Pago (C=Crédito, D=Débito)
 * 8. Referencia Texto (1-80, inicia REF*TXT**, termina \)
 */
export async function actionGenerateBankTXT(reportIds: string[]) {
  try {
    console.log('[actionGenerateBankTXT] Generando TXT para reportes:', reportIds);
    const { role } = await getAuthContext();
    
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = getSupabaseAdmin();

    // Obtener reportes aprobados (para descarga antes de procesar)
    const { data: reports, error: reportsError } = await supabase
      .from('adjustment_reports')
      .select(`
        id,
        total_amount,
        paid_date,
        created_at,
        brokers!inner(
          name,
          nombre_completo,
          beneficiary_name,
          tipo_cuenta,
          bank_account_no,
          bank_route
        )
      `)
      .in('id', reportIds)
      .eq('status', 'approved');

    if (reportsError || !reports || reports.length === 0) {
      return { ok: false, error: 'No se encontraron reportes aprobados para generar TXT' };
    }

    // Generar contenido TXT según formato ACH oficial
    const fecha = new Date().toLocaleDateString('es-PA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }); // DD/MM/AAAA formato Panamá
    
    const lines: string[] = [];
    let sequenceId = 1;

    reports.forEach((report: any) => {
      const broker = report.brokers;
      
      // Validar que el broker tenga datos bancarios completos
      if (!broker.bank_account_no) {
        console.warn(`[ACH AJUSTES] Broker ${broker.name} - Falta cuenta bancaria`);
        return;
      }
      if (!broker.bank_route) {
        console.warn(`[ACH AJUSTES] Broker ${broker.name} - Falta ruta bancaria`);
        return;
      }

      // Campo 1: ID Beneficiario (secuencial con 0 padding)
      const idBeneficiario = cleanBeneficiaryId(String(sequenceId).padStart(3, '0'));
      
      // Campo 2: Nombre Beneficiario (normalizado ACH, max 22 chars)
      const nombreBeneficiario = truncate(
        toUpperNoAccents(broker.beneficiary_name || broker.nombre_completo || broker.name),
        22
      );
      
      // Campo 3: Ruta Destino (código banco, sin ceros iniciales)
      const rutaDestino = normalizeRoute(broker.bank_route);
      
      // Campo 4: Cuenta Destino (con 0 inicial si empieza con 3/4)
      const cuentaDestino = truncate(formatAccountForACH(broker.bank_account_no), 17);
      
      // Campo 5: Producto Destino (03=Corriente, 04=Ahorro)
      const productoDestino = getAccountTypeCode(broker.tipo_cuenta);
      
      // Campo 6: Monto (###0.00 format)
      const monto = formatACHAmount(Math.abs(Number(report.total_amount)));
      
      // Campo 7: Tipo Pago (C=Crédito)
      const tipoPago = 'C';
      
      // Campo 8: Referencia Texto (REF*TXT**...\)
      const referencia = generateACHReference(`AJUSTES / ${fecha}`);

      // Generar línea ACH con formato oficial (separador ;)
      const line = [
        idBeneficiario,
        nombreBeneficiario,
        rutaDestino,
        cuentaDestino,
        productoDestino,
        monto,
        tipoPago,
        referencia
      ].join(';');
      
      lines.push(line);
      sequenceId++;
    });
    
    const txtContent = lines.join('\n');

    if (!txtContent) {
      return { ok: false, error: 'No hay datos bancarios válidos para generar TXT' };
    }

    console.log(`[actionGenerateBankTXT] TXT generado con ${reports.length} línea(s)`);

    return {
      ok: true,
      data: {
        content: txtContent,
        filename: `AJUSTES_BG_${Date.now()}.txt`,
        count: reports.length
      }
    };
  } catch (error) {
    console.error('[actionGenerateBankTXT] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
