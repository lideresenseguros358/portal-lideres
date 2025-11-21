import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { TablesInsert } from '@/lib/database.types';

interface CSVRow {
  policy_number: string;
  client_name: string;
  insurer_name: string;
  broker_email: string;
  policy_type: string;
  commission_amount: string;
  start_date: string;
  renewal_date: string;
}

interface ProcessedRow {
  row_number: number;
  policy_number: string;
  client_name: string;
  insurer_name: string;
  broker_email: string | null;
  broker_name: string | null;
  gross_amount: number;
  net_amount: number;
  percentage_applied: number;
  is_vida_assa: boolean;
  status: 'success' | 'error' | 'unidentified';
  error_message?: string;
  client_id?: string;
  policy_id?: string;
  broker_id?: string | null;
  insurer_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Leer archivo CSV
    const text = await file.text();
    const rows = parseCSV(text);

    console.log(`📊 Processing ${rows.length} rows from CSV`);

    // Obtener datos necesarios de BD
    const { data: insurers } = await supabase.from('insurers').select('id, name');
    const { data: brokers } = await supabase.from('brokers').select('id, email, name, percent_default');

    if (!insurers || !brokers) {
      return NextResponse.json({ error: 'Failed to load reference data' }, { status: 500 });
    }

    // Mapas para búsqueda rápida
    const insurerMap = new Map<string, any>(insurers.map((i: any) => [i.name.toUpperCase(), i]));
    const brokerMap = new Map<string, any>(brokers.map((b: any) => [b.email?.toLowerCase() || '', b]));

    // Procesar filas
    const processed: ProcessedRow[] = [];
    let successCount = 0;
    let errorCount = 0;
    let unidentifiedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const rowNum = i + 2; // +2 porque línea 1 es header

      try {
        const result = await processRow(
          row,
          rowNum,
          supabase,
          insurerMap,
          brokerMap,
          brokers
        );

        processed.push(result);

        if (result.status === 'success') successCount++;
        else if (result.status === 'error') errorCount++;
        else if (result.status === 'unidentified') unidentifiedCount++;

      } catch (error) {
        console.error(`Error processing row ${rowNum}:`, error);
        processed.push({
          row_number: rowNum,
          policy_number: row?.policy_number || '',
          client_name: row?.client_name || '',
          insurer_name: row?.insurer_name || '',
          broker_email: row?.broker_email || null,
          broker_name: null,
          gross_amount: parseFloat(row?.commission_amount || '0') || 0,
          net_amount: 0,
          percentage_applied: 0,
          is_vida_assa: false,
          status: 'error',
          error_message: String(error),
        });
        errorCount++;
      }
    }

    // Crear quincena CLOSED
    const fortnightId = await createFortnight(supabase);

    // Crear comm_import
    const importId = await createCommissionImport(supabase, fortnightId, processed);

    // Crear comm_items
    await createCommissionItems(supabase, importId, processed);

    // Actualizar fortnight_broker_totals
    await updateBrokerTotals(supabase, fortnightId, processed);

    return NextResponse.json({
      success: true,
      fortnight_id: fortnightId,
      import_id: importId,
      summary: {
        total: rows.length,
        success: successCount,
        errors: errorCount,
        unidentified: unidentifiedCount,
      },
      processed,
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row: any = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });
    return row as CSVRow;
  });
}

async function processRow(
  row: CSVRow,
  rowNum: number,
  supabase: any,
  insurerMap: Map<string, any>,
  brokerMap: Map<string, any>,
  allBrokers: any[]
): Promise<ProcessedRow> {
  
  const grossAmount = parseFloat(row.commission_amount) || 0;
  
  // 1. Buscar insurer
  const insurer = insurerMap.get(row.insurer_name.toUpperCase());
  if (!insurer) {
    return {
      row_number: rowNum,
      policy_number: row.policy_number,
      client_name: row.client_name,
      insurer_name: row.insurer_name,
      broker_email: row.broker_email || null,
      broker_name: null,
      gross_amount: grossAmount,
      net_amount: 0,
      percentage_applied: 0,
      is_vida_assa: false,
      status: 'error',
      error_message: `Insurer not found: ${row.insurer_name}`,
    };
  }

  // 2. Buscar broker por email (si existe)
  let broker = null;
  let brokerId: string | null = null;
  
  if (row.broker_email && row.broker_email.trim() !== '') {
    broker = brokerMap.get(row.broker_email.toLowerCase());
    if (broker) {
      brokerId = broker.id;
    }
  }

  // 3. Determinar porcentaje
  const isVidaAssa = row.insurer_name.toUpperCase() === 'ASSA' && 
                     row.policy_type.toUpperCase() === 'VIDA';
  
  let percentageApplied = 0;
  if (isVidaAssa) {
    percentageApplied = 1.0; // 100% para vida ASSA
  } else if (broker) {
    percentageApplied = broker.percent_default || 0;
  }

  const netAmount = grossAmount * percentageApplied;

  // 4. Buscar o crear póliza y cliente
  let policyId: string | undefined;
  let clientId: string | undefined;

  // Buscar póliza existente por policy_number
  const { data: existingPolicy } = await supabase
    .from('policies')
    .select('id, client_id, broker_id')
    .eq('policy_number', row.policy_number)
    .single();

  if (existingPolicy) {
    // Póliza existe
    policyId = existingPolicy.id;
    clientId = existingPolicy.client_id;
    
    // Si no teníamos broker pero la póliza sí, usarlo
    if (!brokerId && existingPolicy.broker_id) {
      brokerId = existingPolicy.broker_id;
      const foundBroker = allBrokers.find((b: any) => b.id === brokerId);
      if (foundBroker) {
        broker = foundBroker;
        percentageApplied = isVidaAssa ? 1.0 : (broker.percent_default || 0);
      }
    }

    // Actualizar póliza con nuevos datos si es necesario
    const updates: any = {};
    if (brokerId) updates.broker_id = brokerId;
    if (row.start_date) updates.start_date = parseDate(row.start_date);
    if (row.renewal_date) updates.renewal_date = parseDate(row.renewal_date);
    if (isVidaAssa) updates.percent_override = 1.0;

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('policies')
        .update(updates)
        .eq('id', policyId);
    }

  } else {
    // Crear nuevo cliente
    const clientInsert: TablesInsert<'clients'> = {
      name: row.client_name,
      broker_id: brokerId || allBrokers[0]?.id || '', // Temporal, necesario para FK
      active: true,
    };

    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert([clientInsert])
      .select()
      .single();

    if (clientError || !newClient) {
      throw new Error(`Failed to create client: ${clientError?.message}`);
    }

    clientId = newClient.id;

    // Crear nueva póliza
    const policyInsert: TablesInsert<'policies'> = {
      policy_number: row.policy_number,
      client_id: clientId,
      broker_id: brokerId || allBrokers[0]?.id || '',
      insurer_id: insurer.id,
      start_date: parseDate(row.start_date) || null,
      renewal_date: parseDate(row.renewal_date) || null,
      percent_override: isVidaAssa ? 1.0 : null,
      status: 'ACTIVA',
    };

    const { data: newPolicy, error: policyError } = await supabase
      .from('policies')
      .insert([policyInsert])
      .select()
      .single();

    if (policyError || !newPolicy) {
      throw new Error(`Failed to create policy: ${policyError?.message}`);
    }

    policyId = newPolicy.id;
  }

  return {
    row_number: rowNum,
    policy_number: row.policy_number,
    client_name: row.client_name,
    insurer_name: row.insurer_name,
    broker_email: row.broker_email || null,
    broker_name: broker?.name || null,
    gross_amount: grossAmount,
    net_amount: netAmount,
    percentage_applied: percentageApplied,
    is_vida_assa: isVidaAssa,
    status: brokerId ? 'success' : 'unidentified',
    client_id: clientId,
    policy_id: policyId,
    broker_id: brokerId,
    insurer_id: insurer.id,
  };
}

async function createFortnight(supabase: any): Promise<string> {
  const insert: TablesInsert<'fortnights'> = {
    period_start: '2025-11-01',
    period_end: '2025-11-15',
    status: 'PAID', // CLOSED se maneja como PAID en el sistema
    notify_brokers: false,
  };

  const { data, error } = await supabase
    .from('fortnights')
    .insert([insert])
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create fortnight: ${error?.message}`);
  }

  return data.id;
}

async function createCommissionImport(
  supabase: any,
  fortnightId: string,
  processed: ProcessedRow[]
): Promise<string> {
  
  // Usar primera aseguradora encontrada (o podrías agrupar por aseguradora)
  const firstInsurer = processed.find(p => p.insurer_id)?.insurer_id || '';
  
  if (!firstInsurer) {
    throw new Error('No valid insurer found in processed rows');
  }

  const totalAmount = processed.reduce((sum, p) => sum + p.gross_amount, 0);

  const insert: TablesInsert<'comm_imports'> = {
    period_label: fortnightId,
    insurer_id: firstInsurer,
    total_amount: totalAmount,
    is_life_insurance: false,
  };

  const { data, error } = await supabase
    .from('comm_imports')
    .insert([insert])
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create import: ${error?.message}`);
  }

  return data.id;
}

async function createCommissionItems(
  supabase: any,
  importId: string,
  processed: ProcessedRow[]
) {
  const items: TablesInsert<'comm_items'>[] = processed
    .filter(p => p.status !== 'error')
    .map(p => ({
      import_id: importId,
      policy_number: p.policy_number,
      insured_name: p.client_name,
      insurer_id: p.insurer_id || '',
      broker_id: p.broker_id || null,
      gross_amount: p.gross_amount,
      raw_row: {
        ...p,
        percentage_applied: p.percentage_applied,
        net_amount: p.net_amount,
      },
    }));

  if (items.length === 0) {
    console.log('No items to insert');
    return;
  }

  const { error } = await supabase
    .from('comm_items')
    .insert(items);

  if (error) {
    throw new Error(`Failed to create commission items: ${error.message}`);
  }
}

async function updateBrokerTotals(
  supabase: any,
  fortnightId: string,
  processed: ProcessedRow[]
) {
  // Agrupar por broker
  const byBroker = new Map<string, number>();

  processed
    .filter(p => p.status === 'success' && p.broker_id)
    .forEach(p => {
      const current = byBroker.get(p.broker_id!) || 0;
      byBroker.set(p.broker_id!, current + p.net_amount);
    });

  // Crear/actualizar totales
  for (const [brokerId, grossAmount] of byBroker.entries()) {
    const insert: TablesInsert<'fortnight_broker_totals'> = {
      fortnight_id: fortnightId,
      broker_id: brokerId,
      gross_amount: grossAmount,
      net_amount: grossAmount, // Sin descuentos por ahora
      discounts_json: {},
    };

    await supabase
      .from('fortnight_broker_totals')
      .insert([insert]);
  }
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const parts = dateStr.split(/[-\/]/);
  if (parts.length !== 3) return null;

  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
