'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer } from '@/lib/supabase/server';

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
 * Generar archivo TXT para Banco General con ajustes pagados
 * Formato: TIPO_CUENTA|CUENTA|MONTO|NOMBRE|DESCRIPCION|FECHA
 * Referencia: "AJUSTES / DD/MM/AAAA"
 */
export async function actionGenerateBankTXT(reportIds: string[]) {
  try {
    console.log('[actionGenerateBankTXT] Generando TXT para reportes:', reportIds);
    const { role } = await getAuthContext();
    
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = getSupabaseAdmin();

    // Obtener reportes pagados
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
          tipo_cuenta,
          bank_account_no
        )
      `)
      .in('id', reportIds)
      .eq('payment_mode', 'immediate')
      .eq('status', 'paid');

    if (reportsError || !reports || reports.length === 0) {
      return { ok: false, error: 'No se encontraron reportes pagados para generar TXT' };
    }

    // Generar contenido TXT
    const fecha = new Date().toLocaleDateString('es-PA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }); // DD/MM/AAAA formato Panamá
    
    let txtContent = '';

    reports.forEach((report: any) => {
      const broker = report.brokers;
      
      // Validar que el broker tenga datos bancarios
      if (!broker.bank_account_no) {
        console.warn(`Broker ${broker.name} no tiene cuenta bancaria registrada`);
        return;
      }

      const tipoCuenta = broker.tipo_cuenta || 'AHORROS';
      const cuenta = broker.bank_account_no;
      const monto = Math.abs(Number(report.total_amount)).toFixed(2);
      const nombre = (broker.nombre_completo || broker.name).toUpperCase();
      const descripcion = `AJUSTES / ${fecha}`;

      // Formato: TIPO_CUENTA|CUENTA|MONTO|NOMBRE|DESCRIPCION|FECHA
      txtContent += `${tipoCuenta}|${cuenta}|${monto}|${nombre}|${descripcion}|${fecha}\n`;
    });

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
