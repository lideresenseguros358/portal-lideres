import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fortnightId = searchParams.get('fortnight_id');

    if (!fortnightId) {
      return NextResponse.json({ ok: false, error: 'fortnight_id requerido' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    
    // Obtener LISSA broker ID para filtrar
    const { data: lissaBroker } = await supabase
      .from('brokers')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();

    const lissaBrokerId = lissaBroker?.id || null;
    console.log('[fortnight-details] LISSA broker ID:', lissaBrokerId);

    // 1. Obtener info de la quincena
    const { data: fortnight } = await supabase
      .from('fortnights')
      .select('period_start, period_end, status')
      .eq('id', fortnightId)
      .single();

    // 2. Obtener totales generales
    const { data: imports } = await supabase
      .from('comm_imports')
      .select('total_amount')
      .eq('period_label', fortnightId);

    const totalReportes = (imports || []).reduce((sum, imp) => sum + (imp.total_amount || 0), 0);

    // 2. Obtener detalles agrupados
    // NOTA: fortnight_details se agregará a types al ejecutar EJECUTAR_AHORA.bat
    const { data: details, error: detailsError } = await (supabase as any)
      .from('fortnight_details')
      .select(`
        *,
        brokers (id, name, email, percent_default),
        insurers (id, name)
      `)
      .eq('fortnight_id', fortnightId);

    if (detailsError) {
      console.error('[fortnight-details] Error:', detailsError);
      return NextResponse.json({ ok: false, error: detailsError.message }, { status: 500 });
    }

    // 3. Obtener totales por broker con descuentos
    const { data: brokerTotals } = await supabase
      .from('fortnight_broker_totals')
      .select('broker_id, gross_amount, net_amount, discounts_json, is_retained')
      .eq('fortnight_id', fortnightId);

    const totalsMap = new Map();
    (brokerTotals || []).forEach((bt: any) => {
      totalsMap.set(bt.broker_id, {
        gross: bt.gross_amount,
        net: bt.net_amount,
        discount: bt.gross_amount - bt.net_amount,
        discounts_json: bt.discounts_json || {},
        is_retained: bt.is_retained || false
      });
    });

    // 4. Agrupar por broker → aseguradora
    const brokerMap = new Map();

    (details || []).forEach((detail: any) => {
      const brokerId = detail.broker_id;
      const brokerName = detail.brokers?.name || 'Sin nombre';
      const brokerEmail = detail.brokers?.email || '';
      const percentDefault = detail.brokers?.percent_default || 0;
      const insurerId = detail.insurer_id;
      const insurerName = detail.insurers?.name || 'Sin nombre';

      if (!brokerMap.has(brokerId)) {
        brokerMap.set(brokerId, {
          broker_id: brokerId,
          broker_name: brokerName,
          broker_email: brokerEmail,
          percent_default: percentDefault,
          insurers: new Map(),
          assa_codes: [],
          gross_amount: 0,
          net_amount: 0,
          discount_amount: 0
        });
      }

      const broker = brokerMap.get(brokerId);

      if (detail.is_assa_code) {
        // Códigos ASSA separados
        broker.assa_codes.push({
          id: detail.id,
          policy_number: detail.policy_number,
          client_name: detail.client_name,
          ramo: detail.ramo,
          commission_raw: detail.commission_raw,
          percent_applied: detail.percent_applied,
          commission_calculated: detail.commission_calculated,
          is_assa_code: detail.is_assa_code,
          assa_code: detail.assa_code
        });
      } else {
        // Pólizas regulares agrupadas por aseguradora
        if (!broker.insurers.has(insurerId)) {
          broker.insurers.set(insurerId, {
            insurer_id: insurerId,
            insurer_name: insurerName,
            items: [],
            total: 0
          });
        }

        const insurer = broker.insurers.get(insurerId);
        insurer.items.push({
          id: detail.id,
          policy_number: detail.policy_number,
          client_name: detail.client_name,
          ramo: detail.ramo,
          commission_raw: detail.commission_raw,
          percent_applied: detail.percent_applied,
          commission_calculated: detail.commission_calculated,
          is_assa_code: detail.is_assa_code,
          assa_code: detail.assa_code
        });
        // Total aseguradora = suma de comisiones calculadas
        insurer.total += detail.commission_calculated;
      }
    });

    // Obtener lista de brokers activos
    const { data: activeBrokersData } = await supabase
      .from('brokers')
      .select('id, active')
      .eq('active', true);
    
    const activeBrokerIds = new Set((activeBrokersData || []).map(b => b.id));
    console.log('[fortnight-details] Cantidad de brokers activos:', activeBrokerIds.size);

    // 5. Convertir Map a Array y agregar totales
    const brokers = Array.from(brokerMap.values()).map(broker => {
      const totals = totalsMap.get(broker.broker_id) || { 
        gross: 0, 
        net: 0, 
        discount: 0,
        discounts_json: {},
        is_retained: false
      };
      return {
        ...broker,
        insurers: Array.from(broker.insurers.values()),
        gross_amount: totals.gross,
        net_amount: totals.net,
        discount_amount: totals.discount,
        discounts_json: totals.discounts_json,
        is_retained: totals.is_retained
      };
    }).sort((a, b) => a.broker_name.localeCompare(b.broker_name)); // Orden alfabético

    // 6. Calcular totales EXCLUYENDO LISSA y brokers inactivos (igual que cards superiores)
    // CRÍTICO: Debe coincidir con total_paid_net del historial que excluye LISSA
    const totalCorredores = brokers
      .filter(b => {
        const isLissa = b.broker_id === lissaBrokerId;
        const isActive = activeBrokerIds.has(b.broker_id);
        
        if (isLissa) {
          console.log('[fortnight-details] LISSA excluido del total:', b.broker_name, b.net_amount);
          return false;
        }
        
        if (!isActive) {
          console.log('[fortnight-details] Broker inactivo excluido del total:', b.broker_name, b.net_amount);
          return false;
        }
        
        return true;
      })
      .reduce((sum, b) => sum + b.net_amount, 0);
    
    console.log('[fortnight-details] Total Corredores (sin LISSA ni inactivos):', totalCorredores);
      
    const gananciaOficina = totalReportes - totalCorredores;

    return NextResponse.json({
      ok: true,
      brokers,
      totals: {
        total_reportes: totalReportes,
        total_corredores: totalCorredores,
        ganancia_oficina: gananciaOficina
      },
      fortnight: fortnight || { period_start: '', period_end: '', status: 'PAID' }
    });

  } catch (error) {
    console.error('[fortnight-details] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
