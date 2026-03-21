import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * API para detectar brokers con deudas activas
 * 
 * Query params:
 * - fortnight_start: fecha inicio de quincena (YYYY-MM-DD)
 * - fortnight_end: fecha fin de quincena (YYYY-MM-DD)
 * 
 * Retorna: { broker_id: string, has_debts: boolean, debt_count: number }[]
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fortnightStart = searchParams.get('fortnight_start');
    const fortnightEnd = searchParams.get('fortnight_end');

    if (!fortnightStart || !fortnightEnd) {
      return NextResponse.json(
        { ok: false, error: 'Faltan parámetros: fortnight_start y fortnight_end' },
        { status: 400 }
      );
    }

    // Determinar si es Q1 o Q2 basado en el día de inicio
    const startDay = parseInt(fortnightStart.split('-')[2] || '1');
    const fortnightType = startDay <= 15 ? 'Q1' : 'Q2';

    console.log('[broker-debts] Fortnight:', fortnightStart, 'to', fortnightEnd);
    console.log('[broker-debts] Fortnight type:', fortnightType);

    const supabase = getSupabaseAdmin();

    // 1. Obtener todos los adelantos activos (pending y partial con saldo > 0)
    const { data: advances, error: advancesError } = await supabase
      .from('advances')
      .select('id, broker_id, amount, status, is_recurring, recurrence_id')
      .in('status', ['pending', 'partial', 'PENDING', 'PARTIAL'])
      .gt('amount', 0);

    if (advancesError) {
      console.error('[broker-debts] Error loading advances:', advancesError);
      return NextResponse.json(
        { ok: false, error: 'Error al cargar adelantos' },
        { status: 500 }
      );
    }

    console.log('[broker-debts] Total active advances:', advances?.length || 0);

    // 2. Obtener recurrencias activas
    const { data: recurrences, error: recurrencesError } = await supabase
      .from('advance_recurrences')
      .select('id, broker_id, fortnight_type, is_active, end_date')
      .eq('is_active', true);

    if (recurrencesError) {
      console.error('[broker-debts] Error loading recurrences:', recurrencesError);
      return NextResponse.json(
        { ok: false, error: 'Error al cargar recurrencias' },
        { status: 500 }
      );
    }

    console.log('[broker-debts] Total active recurrences:', recurrences?.length || 0);

    // 3. Filtrar recurrencias que aplican en esta quincena
    const today = new Date().toISOString().split('T')[0] || '';
    const applicableRecurrences = (recurrences || []).filter(rec => {
      // Verificar que no haya vencido
      if (rec.end_date && today && rec.end_date < today) {
        return false;
      }

      // Verificar que aplique a esta quincena
      if (rec.fortnight_type === 'BOTH') {
        return true; // Aplica a Q1 y Q2
      }

      return rec.fortnight_type === fortnightType;
    });

    console.log('[broker-debts] Applicable recurrences for', fortnightType, ':', applicableRecurrences.length);

    // 4. Construir set de recurrence_ids que aplican en esta quincena
    const applicableRecurrenceIds = new Set(applicableRecurrences.map(r => r.id));

    // 5. Agrupar por broker_id
    const brokerDebtsMap = new Map<string, {
      has_regular_debts: boolean;
      regular_debt_count: number;
      has_recurring: boolean;
      recurrence_count: number;
    }>();

    // Contar adelantos activos por broker — separar regulares de recurrentes
    (advances || []).forEach(adv => {
      if (!brokerDebtsMap.has(adv.broker_id)) {
        brokerDebtsMap.set(adv.broker_id, { has_regular_debts: false, regular_debt_count: 0, has_recurring: false, recurrence_count: 0 });
      }
      const brokerData = brokerDebtsMap.get(adv.broker_id)!;

      if (adv.is_recurring && adv.recurrence_id) {
        // Solo contar si la recurrencia aplica en esta quincena (Q1/Q2/BOTH)
        if (applicableRecurrenceIds.has(adv.recurrence_id)) {
          brokerData.has_recurring = true;
          // No incrementar recurrence_count aquí — se hace abajo desde applicableRecurrences
        }
        // No contar como deuda regular
      } else {
        // Deuda regular (no recurrente)
        brokerData.has_regular_debts = true;
        brokerData.regular_debt_count += 1;
      }
    });

    // Agregar recurrencias aplicables (ya filtradas por Q1/Q2/BOTH)
    applicableRecurrences.forEach(rec => {
      if (!brokerDebtsMap.has(rec.broker_id)) {
        brokerDebtsMap.set(rec.broker_id, { has_regular_debts: false, regular_debt_count: 0, has_recurring: true, recurrence_count: 1 });
      } else {
        const brokerData = brokerDebtsMap.get(rec.broker_id)!;
        brokerData.has_recurring = true;
        brokerData.recurrence_count += 1;
      }
    });

    // 6. Convertir a array — mantener compatibilidad con campos existentes
    const result = Array.from(brokerDebtsMap.entries())
      .filter(([_, data]) => data.has_regular_debts || data.has_recurring)
      .map(([broker_id, data]) => ({
        broker_id,
        has_debts: data.has_regular_debts || data.has_recurring,
        debt_count: data.regular_debt_count, // Solo deudas regulares
        has_recurring: data.has_recurring,
        recurrence_count: data.recurrence_count,
      }));

    console.log('[broker-debts] Brokers with debts:', result.length);
    console.log('[broker-debts] Sample:', result.slice(0, 3));

    return NextResponse.json({
      ok: true,
      data: result,
      fortnight_type: fortnightType,
    });
  } catch (error: any) {
    console.error('[broker-debts] Unexpected error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Error inesperado' },
      { status: 500 }
    );
  }
}
