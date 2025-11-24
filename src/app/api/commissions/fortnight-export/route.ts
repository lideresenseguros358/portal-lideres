import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * API para obtener datos de una quincena en formato listo para exportar
 * Usa fortnight_details en lugar de comm_items
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fortnightId = searchParams.get('fortnight_id');

    if (!fortnightId) {
      return NextResponse.json({ ok: false, error: 'fortnight_id requerido' }, { status: 400 });
    }

    console.log('[Fortnight Export API] Obteniendo datos para:', fortnightId);

    const supabase = getSupabaseAdmin();

    // 1. Obtener totales de brokers con descuentos y retenciones
    const { data: brokerTotals } = await supabase
      .from('fortnight_broker_totals')
      .select('broker_id, gross_amount, net_amount, discounts_json, is_retained')
      .eq('fortnight_id', fortnightId);

    const totalsMap = new Map();
    (brokerTotals || []).forEach((bt: any) => {
      totalsMap.set(bt.broker_id, {
        gross: bt.gross_amount,
        net: bt.net_amount,
        discounts: bt.discounts_json,
        is_retained: bt.is_retained || false
      });
    });

    // 2. Obtener detalles de la quincena desde fortnight_details
    const { data: details, error: detailsError } = await (supabase as any)
      .from('fortnight_details')
      .select(`
        *,
        brokers (id, name, email, percent_default),
        insurers (id, name)
      `)
      .eq('fortnight_id', fortnightId);

    // 2.5 Obtener ajustes aprobados para esta quincena
    const { data: adjustmentReports } = await supabase
      .from('adjustment_reports')
      .select(`
        id,
        broker_id,
        total_amount,
        status,
        payment_mode,
        brokers!inner(id, name, email, percent_default),
        adjustment_report_items!inner(
          id,
          commission_raw,
          broker_commission,
          pending_items!inner(
            policy_number,
            insured_name,
            insurer_id,
            insurers!inner(id, name)
          )
        )
      `)
      .eq('fortnight_id', fortnightId)
      .eq('status', 'approved')
      .eq('payment_mode', 'next_fortnight');

    if (detailsError) {
      console.error('[Fortnight Export API] Error:', detailsError);
      return NextResponse.json({ ok: false, error: detailsError.message }, { status: 500 });
    }

    if (!details || details.length === 0) {
      console.log('[Fortnight Export API] No hay datos para esta quincena');
      return NextResponse.json({ ok: true, data: [] });
    }

    console.log('[Fortnight Export API] Encontrados', details.length, 'registros');
    console.log('[Fortnight Export API] Encontrados', (adjustmentReports || []).length, 'reportes de ajustes');

    // 3. Agrupar por broker → aseguradora
    const brokerMap = new Map();
    const adjustmentsMap = new Map(); // Para almacenar ajustes separados

    details.forEach((detail: any) => {
      const brokerId = detail.broker_id;
      const brokerName = detail.brokers?.name || 'Sin nombre';
      const brokerEmail = detail.brokers?.email || '';
      const percentDefault = detail.brokers?.percent_default || 0;
      const insurerId = detail.insurer_id;
      const insurerName = detail.insurers?.name || 'Sin nombre';

      // Inicializar broker si no existe
      if (!brokerMap.has(brokerId)) {
        brokerMap.set(brokerId, {
          broker_id: brokerId,
          broker_name: brokerName,
          broker_email: brokerEmail,
          percent_default: percentDefault,
          insurers: new Map(),
          total_gross: 0,
          total_net: 0,
        });
      }

      const broker = brokerMap.get(brokerId);

      // Inicializar aseguradora si no existe
      if (!broker.insurers.has(insurerId)) {
        broker.insurers.set(insurerId, {
          insurer_id: insurerId,
          insurer_name: insurerName,
          policies: [],
          total_gross: 0,
        });
      }

      const insurer = broker.insurers.get(insurerId);

      // Agregar póliza
      const policy = {
        policy_number: detail.policy_number,
        insured_name: detail.client_name,
        gross_amount: detail.commission_raw,
        percentage: detail.percent_applied,
        net_amount: detail.commission_calculated,
      };

      insurer.policies.push(policy);
      // Total aseguradora = suma de comisiones calculadas (con % aplicado)
      insurer.total_gross += detail.commission_calculated;
      broker.total_gross += detail.commission_calculated;
      broker.total_net += detail.commission_calculated;
    });

    // 3.5 Procesar ajustes y agregarlos al total bruto
    (adjustmentReports || []).forEach((report: any) => {
      const brokerId = report.broker_id;
      const brokerName = report.brokers?.name || 'Sin nombre';
      const brokerEmail = report.brokers?.email || '';
      const percentDefault = report.brokers?.percent_default || 0;

      // Inicializar broker si no existe
      if (!brokerMap.has(brokerId)) {
        brokerMap.set(brokerId, {
          broker_id: brokerId,
          broker_name: brokerName,
          broker_email: brokerEmail,
          percent_default: percentDefault,
          insurers: new Map(),
          total_gross: 0,
          total_net: 0,
        });
      }

      // Inicializar ajustes para este broker si no existe
      if (!adjustmentsMap.has(brokerId)) {
        adjustmentsMap.set(brokerId, {
          total_adjustments: 0,
          insurers: new Map()
        });
      }

      const broker = brokerMap.get(brokerId);
      const adjustments = adjustmentsMap.get(brokerId);

      // Procesar items del reporte de ajustes
      (report.adjustment_report_items || []).forEach((item: any) => {
        const insurerId = item.pending_items?.insurer_id;
        const insurerName = item.pending_items?.insurers?.name || 'Sin aseguradora';
        const brokerCommission = Number(item.broker_commission) || 0;

        // Agregar al total de ajustes
        adjustments.total_adjustments += brokerCommission;
        broker.total_gross += brokerCommission; // Sumar al total bruto del broker
        broker.total_net += brokerCommission;   // Sumar al total neto (antes de descuentos)

        // Agrupar por aseguradora en ajustes
        if (!adjustments.insurers.has(insurerId)) {
          adjustments.insurers.set(insurerId, {
            insurer_id: insurerId,
            insurer_name: insurerName,
            items: [],
            total: 0
          });
        }

        const adjInsurer = adjustments.insurers.get(insurerId);
        adjInsurer.items.push({
          policy_number: item.pending_items?.policy_number || 'N/A',
          insured_name: item.pending_items?.insured_name || 'N/A',
          commission_raw: Number(item.commission_raw) || 0,
          broker_commission: brokerCommission,
          percentage: percentDefault
        });
        adjInsurer.total += brokerCommission;
      });
    });

    // 4. Convertir Map a Array, agregar descuentos/retenciones y ordenar
    const result = Array.from(brokerMap.values()).map(broker => {
      // Usar totales de fortnight_broker_totals si existen, sino calcular
      const totalsFromDB = totalsMap.get(broker.broker_id);
      
      // Calcular totales desde las pólizas
      let calculatedGross = 0;
      let calculatedNet = 0;
      broker.insurers.forEach((ins: any) => {
        ins.policies.forEach((pol: any) => {
          calculatedGross += pol.gross_amount;
          calculatedNet += pol.net_amount;
        });
      });
      
      return {
        broker_id: broker.broker_id,
        broker_name: broker.broker_name,
        broker_email: broker.broker_email,
        percent_default: broker.percent_default,
        total_gross: totalsFromDB?.gross || calculatedGross,
        total_net: totalsFromDB?.net || calculatedNet,
        discounts_json: totalsFromDB?.discounts || {},
        is_retained: totalsFromDB?.is_retained || false,
        adjustments: adjustmentsMap.has(broker.broker_id) ? {
          total: adjustmentsMap.get(broker.broker_id).total_adjustments,
          insurers: Array.from(adjustmentsMap.get(broker.broker_id).insurers.values())
            .map((ins: any) => ({
              insurer_id: ins.insurer_id,
              insurer_name: ins.insurer_name,
              total: ins.total,
              items: ins.items.sort((a: any, b: any) => b.broker_commission - a.broker_commission)
            }))
            .sort((a: any, b: any) => b.total - a.total)
        } : null,
        insurers: Array.from(broker.insurers.values())
          .map((ins: any) => ({
            insurer_id: ins.insurer_id,
            insurer_name: ins.insurer_name,
            total_gross: ins.total_gross,
            policies: ins.policies.sort((a: any, b: any) => b.gross_amount - a.gross_amount),
          }))
          .sort((a: any, b: any) => b.total_gross - a.total_gross),
      };
    }).sort((a, b) => b.total_net - a.total_net);

    console.log('[Fortnight Export API] Procesados', result.length, 'brokers');
    
    // Debug: mostrar primeros brokers
    if (result.length > 0 && result[0]) {
      const firstBroker = result[0];
      console.log('[Fortnight Export API] Ejemplo broker:', {
        name: firstBroker.broker_name,
        total_gross: firstBroker.total_gross,
        total_net: firstBroker.total_net,
        discounts: firstBroker.discounts_json,
        percent: firstBroker.percent_default
      });
    }

    return NextResponse.json({ ok: true, data: result });

  } catch (error) {
    console.error('[Fortnight Export API] Error crítico:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
