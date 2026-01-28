import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener parámetros
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const brokerId = searchParams.get('broker');

    // Verificar rol
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, broker_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
    }

    // Construir query según rol
    let query = (supabase as any)
      .from('production')
      .select(`
        *,
        brokers!production_broker_id_fkey (
          id,
          name,
          assa_code,
          meta_personal,
          canceladas_ytd
        )
      `)
      .eq('year', year);

    // Si es broker, solo ver su propia producción
    if (profile.role === 'broker' && profile.broker_id) {
      query = query.eq('broker_id', profile.broker_id);
    }

    // Si se especifica un broker en particular
    if (brokerId) {
      query = query.eq('broker_id', brokerId);
    }

    const { data: productionData, error: prodError } = await query;

    if (prodError) {
      console.error('Error fetching production:', prodError);
      return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
    }

    // Obtener datos del año anterior para comparativos (incluir persistencia para carry-forward)
    const { data: previousYearData } = await (supabase as any)
      .from('production')
      .select('broker_id, bruto, canceladas, month, persistencia, num_polizas')
      .eq('year', year - 1);

    // Agrupar datos por broker
    const brokerMap = new Map();

    // Inicializar estructura para cada broker
    if (profile.role === 'master' && !brokerId) {
      console.log('👑 Master user - Fetching all brokers');
      const { data: allBrokers, error: brokersError } = await supabase
        .from('brokers')
        .select('id, name, assa_code, meta_personal, canceladas_ytd')
        .order('name');

      console.log('📋 All brokers fetched:', allBrokers?.length, 'brokers');
      console.log('📋 Brokers error:', brokersError);
      console.log('📋 First broker from DB:', allBrokers?.[0]);

      allBrokers?.forEach(broker => {
        brokerMap.set(broker.id, {
          broker_id: broker.id,
          broker_name: broker.name,
          assa_code: broker.assa_code || '',
          meta_personal: parseFloat(broker.meta_personal as any) || 0,
          months: {
            jan: { bruto: 0, num_polizas: 0, persistencia: null },
            feb: { bruto: 0, num_polizas: 0, persistencia: null },
            mar: { bruto: 0, num_polizas: 0, persistencia: null },
            apr: { bruto: 0, num_polizas: 0, persistencia: null },
            may: { bruto: 0, num_polizas: 0, persistencia: null },
            jun: { bruto: 0, num_polizas: 0, persistencia: null },
            jul: { bruto: 0, num_polizas: 0, persistencia: null },
            aug: { bruto: 0, num_polizas: 0, persistencia: null },
            sep: { bruto: 0, num_polizas: 0, persistencia: null },
            oct: { bruto: 0, num_polizas: 0, persistencia: null },
            nov: { bruto: 0, num_polizas: 0, persistencia: null },
            dec: { bruto: 0, num_polizas: 0, persistencia: null },
          },
          canceladas_ytd: broker.canceladas_ytd || 0,
          previous_year: { bruto_ytd: 0, neto_ytd: 0, num_polizas_ytd: 0 }
        });
      });
      console.log('✅ BrokerMap initialized with', brokerMap.size, 'brokers');
    } else {
      console.log('👤 Not Master or filtered by broker:', { role: profile.role, brokerId });
    }

    // Si no es master o se filtró por broker, obtener meta_personal del broker específico
    if ((profile.role !== 'master' || brokerId) && productionData && productionData.length > 0) {
      const brokerIds = [...new Set(productionData.map((r: any) => r.broker_id))].filter((id): id is string => typeof id === 'string');
      const { data: brokersWithMeta } = await supabase
        .from('brokers')
        .select('id, meta_personal, canceladas_ytd')
        .in('id', brokerIds);
      
      const metaMap = new Map(brokersWithMeta?.map(b => [b.id, parseFloat(b.meta_personal as any) || 0]) || []);
      const canceladasMap = new Map(brokersWithMeta?.map(b => [b.id, b.canceladas_ytd || 0]) || []);
      
      // Inicializar brokers con sus metas personales
      brokerIds.forEach(bId => {
        if (!brokerMap.has(bId)) {
          const record = productionData.find((r: any) => r.broker_id === bId);
          brokerMap.set(bId, {
            broker_id: bId,
            broker_name: record?.brokers?.name || 'Sin nombre',
            assa_code: record?.brokers?.assa_code || '',
            meta_personal: metaMap.get(bId as string) || 0,
            months: {
              jan: { bruto: 0, num_polizas: 0 },
              feb: { bruto: 0, num_polizas: 0 },
              mar: { bruto: 0, num_polizas: 0 },
              apr: { bruto: 0, num_polizas: 0 },
              may: { bruto: 0, num_polizas: 0 },
              jun: { bruto: 0, num_polizas: 0 },
              jul: { bruto: 0, num_polizas: 0 },
              aug: { bruto: 0, num_polizas: 0 },
              sep: { bruto: 0, num_polizas: 0 },
              oct: { bruto: 0, num_polizas: 0 },
              nov: { bruto: 0, num_polizas: 0 },
              dec: { bruto: 0, num_polizas: 0 },
            },
            canceladas_ytd: canceladasMap.get(bId as string) || 0,
            previous_year: { bruto_ytd: 0, neto_ytd: 0, num_polizas_ytd: 0 }
          });
        }
      });
    }

    // Poblar con datos reales del año actual
    productionData?.forEach((record: any) => {
      if (!brokerMap.has(record.broker_id)) {
        // Este caso no debería ocurrir ahora, pero lo dejamos por seguridad
        brokerMap.set(record.broker_id, {
          broker_id: record.broker_id,
          broker_name: record.brokers?.name || 'Sin nombre',
          assa_code: record.brokers?.assa_code || '',
          meta_personal: record.brokers?.meta_personal || 0,
          months: {
            jan: { bruto: 0, num_polizas: 0 },
            feb: { bruto: 0, num_polizas: 0 },
            mar: { bruto: 0, num_polizas: 0 },
            apr: { bruto: 0, num_polizas: 0 },
            may: { bruto: 0, num_polizas: 0 },
            jun: { bruto: 0, num_polizas: 0 },
            jul: { bruto: 0, num_polizas: 0 },
            aug: { bruto: 0, num_polizas: 0 },
            sep: { bruto: 0, num_polizas: 0 },
            oct: { bruto: 0, num_polizas: 0 },
            nov: { bruto: 0, num_polizas: 0 },
            dec: { bruto: 0, num_polizas: 0 },
          },
          canceladas_ytd: record.brokers?.canceladas_ytd || 0,
          previous_year: { bruto_ytd: 0, neto_ytd: 0, num_polizas_ytd: 0 }
        });
      }

      const broker = brokerMap.get(record.broker_id);
      // Convertir month number (1-12) a key ('jan', 'feb'...)
      const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthKey = monthKeys[record.month - 1] as keyof typeof broker.months;
      if (monthKey) {
        broker.months[monthKey] = {
          bruto: parseFloat(record.bruto) || 0,
          num_polizas: parseInt(record.num_polizas) || 0,
          persistencia: record.persistencia !== null && record.persistencia !== undefined ? parseFloat(record.persistencia) : null,
        };
        // canceladas_ytd ya viene de brokers, no se acumula
      }
    });

    // Calcular datos del año anterior
    previousYearData?.forEach((record: any) => {
      const broker = brokerMap.get(record.broker_id);
      if (broker) {
        broker.previous_year.bruto_ytd += parseFloat(record.bruto) || 0;
        broker.previous_year.neto_ytd += (parseFloat(record.bruto) || 0) - (parseFloat(record.canceladas) || 0);
        broker.previous_year.num_polizas_ytd += parseInt(record.num_polizas) || 0;
        
        // Guardar última persistencia del año anterior (mes más reciente con valor)
        const persistencia = record.persistencia !== null && record.persistencia !== undefined ? parseFloat(record.persistencia) : null;
        if (persistencia !== null) {
          // Solo actualizar si no existe o si este mes es más reciente
          if (!broker.previous_year.last_persistencia || record.month > broker.previous_year.last_persistencia.month) {
            broker.previous_year.last_persistencia = { value: persistencia, month: record.month };
          }
        }
      }
    });

    const brokersArray = Array.from(brokerMap.values());

    console.log('📊 API Production - Role:', profile.role);
    console.log('📊 API Production - Broker ID filter:', brokerId);
    console.log('📊 API Production - Total brokers in map:', brokerMap.size);
    console.log('📊 API Production - Brokers array length:', brokersArray.length);
    console.log('📊 API Production - First broker:', brokersArray[0]);

    return NextResponse.json({ 
      success: true, 
      data: {
        year,
        brokers: brokersArray
      }
    });
  } catch (error) {
    console.error('Error al obtener producción:', error);
    return NextResponse.json({ error: 'Error al obtener producción' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea Master
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Solo Master puede editar producción' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      broker_id, 
      year, 
      month: monthKey, 
      bruto,           // Cifra bruta del mes
      num_polizas,     // Número de pólizas vendidas
      canceladas,      // Canceladas del mes
      persistencia,    // Persistencia del mes (%)
      canceladas_ytd,  // Canceladas anuales (legacy)
      meta_personal    // Meta personal del broker
    } = body;

    // ===========================================================
    // CASO 1: Actualizar Meta Personal del Broker
    // ===========================================================
    if (meta_personal !== undefined) {
      if (!broker_id) {
        return NextResponse.json({ error: 'broker_id es requerido' }, { status: 400 });
      }

      const { error: metaError } = await supabase
        .from('brokers')
        .update({ meta_personal: parseFloat(meta_personal) })
        .eq('id', broker_id);

      if (metaError) {
        console.error('Error updating meta_personal:', metaError);
        return NextResponse.json({ error: 'Error al actualizar meta personal' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Meta personal actualizada exitosamente' 
      });
    }

    // ===========================================================
    // CASO 2: Actualizar Canceladas Anuales (YTD) usando field
    // ===========================================================
    const { field, value } = body;
    
    if (field === 'canceladas_ytd') {
      if (!broker_id) {
        return NextResponse.json({ error: 'broker_id es requerido' }, { status: 400 });
      }

      // Redondear a 2 decimales EXACTOS para evitar errores de punto flotante
      const exactValue = Math.round(value * 100) / 100;

      // Guardar DIRECTAMENTE en la tabla brokers (campo anual, NO mensual)
      const { error: updateError } = await supabase
        .from('brokers')
        .update({ canceladas_ytd: exactValue })
        .eq('id', broker_id);

      if (updateError) {
        console.error('Error updating canceladas_ytd:', updateError);
        return NextResponse.json({ error: 'Error al actualizar canceladas' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Canceladas anuales actualizadas' 
      });
    }

    // Legacy: mantener compatibilidad con canceladas_ytd directo
    if (canceladas_ytd !== undefined) {
      return NextResponse.json({ 
        success: true, 
        message: 'Canceladas anuales actualizadas' 
      });
    }

    // ===========================================================
    // CASO 3: Actualizar Cifras Mensuales (Bruto + Num Pólizas)
    // ===========================================================
    if (!broker_id || !year || !monthKey) {
      return NextResponse.json({ error: 'broker_id, year y month son requeridos' }, { status: 400 });
    }

    if (bruto === undefined || num_polizas === undefined) {
      return NextResponse.json({ error: 'bruto y num_polizas son requeridos' }, { status: 400 });
    }

    if (typeof bruto !== 'number' || bruto < 0) {
      return NextResponse.json({ error: 'Bruto debe ser un número positivo' }, { status: 400 });
    }

    if (typeof num_polizas !== 'number' || num_polizas < 0) {
      return NextResponse.json({ error: 'Número de pólizas debe ser un número positivo' }, { status: 400 });
    }

    // Validar canceladas si se proporciona
    const canceladasValue = canceladas !== undefined ? parseFloat(canceladas) : 0;
    if (canceladasValue < 0) {
      return NextResponse.json({ error: 'Canceladas debe ser un número positivo' }, { status: 400 });
    }
    
    if (canceladasValue > bruto) {
      return NextResponse.json({ error: 'Canceladas no puede ser mayor que bruto' }, { status: 400 });
    }

    // Validar persistencia si se proporciona
    const persistenciaValue = persistencia !== undefined && persistencia !== null ? parseFloat(persistencia) : null;
    if (persistenciaValue !== null && (persistenciaValue < 0 || persistenciaValue > 100)) {
      return NextResponse.json({ error: 'Persistencia debe estar entre 0 y 100' }, { status: 400 });
    }

    // Convertir month key ('jan', 'feb'...) a número (1-12)
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = monthKeys.indexOf(monthKey);
    if (monthIndex === -1) {
      return NextResponse.json({ error: 'Mes inválido' }, { status: 400 });
    }
    const month = monthIndex + 1; // 1-12

    // Upsert (insert or update) de la producción mensual
    const { error: upsertError } = await (supabase as any)
      .from('production')
      .upsert({
        broker_id,
        year,
        month,
        bruto,
        num_polizas,
        canceladas: canceladasValue,
        persistencia: persistenciaValue,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'broker_id,year,month',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('Error upsert production:', upsertError);
      return NextResponse.json({ error: 'Error al guardar en base de datos' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Producción actualizada exitosamente' 
    });
  } catch (error) {
    console.error('Error al actualizar producción:', error);
    return NextResponse.json({ error: 'Error al actualizar producción' }, { status: 500 });
  }
}
