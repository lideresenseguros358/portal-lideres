import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';

interface CSVRow {
  client_name: string;
  national_id: string;
  email: string;
  phone: string;
  birth_date: string;
  policy_number: string;
  insurer_name: string;
  ramo: string;
  start_date: string;
  renewal_date: string;
  status: string;
  broker_email: string;
  notas?: string; // Único campo opcional
}

interface ImportError {
  row: number;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: 0,
        errors: [{ row: 0, message: 'No se proporcionó archivo' }],
      });
    }

    // Leer archivo CSV
    const text = await file.text();
    const parsed = await parseCSV(text);

    const errors: ImportError[] = [];
    let successCount = 0;

    // Agrupar filas por cliente (por cédula o nombre)
    const clientGroups = groupByClient(parsed);

    // Procesar cada grupo de cliente
    for (const [clientKey, rows] of Object.entries(clientGroups)) {
      try {
        const result = await processClientGroup(supabase, rows);
        if (result.success) {
          successCount += rows.length;
        } else {
          rows.forEach((row, idx) => {
            errors.push({
              row: row._rowNumber || idx + 2,
              message: result.error || 'Error desconocido',
            });
          });
        }
      } catch (error) {
        rows.forEach((row, idx) => {
          errors.push({
            row: row._rowNumber || idx + 2,
            message: error instanceof Error ? error.message : 'Error al procesar',
          });
        });
      }
    }

    return NextResponse.json({
      success: successCount,
      errors,
    });
  } catch (error) {
    console.error('Error en import:', error);
    return NextResponse.json(
      {
        success: 0,
        errors: [
          {
            row: 0,
            message: error instanceof Error ? error.message : 'Error interno del servidor',
          },
        ],
      },
      { status: 500 }
    );
  }
}

function parseCSV(text: string): Promise<(CSVRow & { _rowNumber?: number })[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results: Papa.ParseResult<CSVRow>) => {
        const rowsWithNumbers = results.data.map((row, idx) => ({
          ...row,
          _rowNumber: idx + 2, // +2 porque línea 1 es header
        }));
        resolve(rowsWithNumbers);
      },
      error: reject,
    });
  });
}

/**
 * Agrupa filas CSV por cliente usando cédula o nombre como clave
 */
function groupByClient(rows: (CSVRow & { _rowNumber?: number })[]): Record<string, (CSVRow & { _rowNumber?: number })[]> {
  const groups: Record<string, (CSVRow & { _rowNumber?: number })[]> = {};

  for (const row of rows) {
    // Normalizar cédula y nombre para comparación
    const normalizedId = row.national_id?.trim().toUpperCase() || '';
    const normalizedName = row.client_name?.trim().toUpperCase() || '';

    // Usar cédula como clave primaria, nombre como secundaria
    const key = normalizedId || normalizedName;

    if (!key) continue; // Saltar filas sin identificador

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  }

  return groups;
}

/**
 * Procesa un grupo de pólizas para un mismo cliente
 */
async function processClientGroup(
  supabase: any,
  rows: (CSVRow & { _rowNumber?: number })[]
): Promise<{ success: boolean; error?: string }> {
  if (rows.length === 0) {
    return { success: false, error: 'Grupo vacío' };
  }

  const firstRow = rows[0];
  
  if (!firstRow) {
    return { success: false, error: 'Primera fila no encontrada' };
  }

  // Validaciones básicas
  if (!firstRow.client_name || !firstRow.broker_email) {
    return { success: false, error: 'client_name y broker_email son obligatorios' };
  }

  // 1. Buscar broker por email
  const { data: broker, error: brokerError } = await supabase
    .from('brokers')
    .select('id, p_id, profiles!inner(email)')
    .eq('profiles.email', firstRow.broker_email.trim().toLowerCase())
    .single();

  if (brokerError || !broker) {
    return { success: false, error: `Broker no encontrado: ${firstRow.broker_email}` };
  }

  const brokerId = broker.id;

  // 2. Buscar cliente existente por cédula o nombre
  let existingClient = null;
  const normalizedName = firstRow.client_name.trim().toUpperCase();
  const normalizedId = firstRow.national_id?.trim().toUpperCase();

  if (normalizedId) {
    // Buscar por cédula (prioritario)
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('national_id', normalizedId)
      .single();
    existingClient = data;
  }

  if (!existingClient && normalizedName) {
    // Buscar por nombre si no se encontró por cédula
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('name', normalizedName)
      .single();
    existingClient = data;
  }

  let clientId: string;

  // Determinar si el cliente debe ser PRELIMINAR
  // Falta alguno de estos datos obligatorios: national_id, email, phone, birth_date
  const isPreliminary = !normalizedId || !firstRow.email?.trim() || !firstRow.phone?.trim() || !firstRow.birth_date?.trim();

  if (existingClient) {
    // 3. Cliente existe: ACTUALIZAR datos faltantes
    const updateData: any = {};
    let needsUpdate = false;

    // Actualizar solo campos que estén vacíos en BD pero llenos en CSV
    if (!existingClient.national_id && normalizedId) {
      updateData.national_id = normalizedId;
      needsUpdate = true;
    }
    if (!existingClient.email && firstRow.email?.trim()) {
      updateData.email = firstRow.email.trim();
      needsUpdate = true;
    }
    if (!existingClient.phone && firstRow.phone?.trim()) {
      updateData.phone = firstRow.phone.trim();
      needsUpdate = true;
    }
    if (!existingClient.birth_date && firstRow.birth_date?.trim()) {
      updateData.birth_date = firstRow.birth_date.trim();
      needsUpdate = true;
    }

    // Actualizar estado active basado en datos completos
    const newActiveStatus = !isPreliminary;
    if (existingClient.active !== newActiveStatus) {
      updateData.active = newActiveStatus;
      needsUpdate = true;
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', existingClient.id);

      if (updateError) {
        return { success: false, error: `Error actualizando cliente: ${updateError.message}` };
      }
    }

    clientId = existingClient.id;
  } else {
    // 4. Cliente NO existe: CREAR nuevo
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: normalizedName,
        national_id: normalizedId || null,
        email: firstRow.email?.trim() || null,
        phone: firstRow.phone?.trim() || null,
        birth_date: firstRow.birth_date?.trim() || null,
        broker_id: brokerId,
        active: !isPreliminary, // false si falta algún dato, true si está completo
      })
      .select()
      .single();

    if (clientError || !newClient) {
      return { success: false, error: `Error creando cliente: ${clientError?.message}` };
    }

    clientId = newClient.id;
  }

  // 5. Crear pólizas (una por cada fila del grupo)
  for (const row of rows) {
    try {
      // Validar campos obligatorios de póliza
      if (!row.policy_number || !row.insurer_name) {
        return {
          success: false,
          error: `Fila ${row._rowNumber}: policy_number e insurer_name son obligatorios`,
        };
      }

      // Buscar aseguradora
      const { data: insurer, error: insurerError } = await supabase
        .from('insurers')
        .select('id')
        .eq('name', row.insurer_name.trim().toUpperCase())
        .single();

      if (insurerError || !insurer) {
        return {
          success: false,
          error: `Fila ${row._rowNumber}: Aseguradora no encontrada: ${row.insurer_name}`,
        };
      }

      // Verificar si la póliza ya existe
      const { data: existingPolicy } = await supabase
        .from('policies')
        .select('id')
        .eq('policy_number', row.policy_number.trim().toUpperCase())
        .single();

      if (existingPolicy) {
        return {
          success: false,
          error: `Fila ${row._rowNumber}: Póliza ${row.policy_number} ya existe`,
        };
      }

      // Crear póliza
      const policyData: any = {
        policy_number: row.policy_number.trim().toUpperCase(),
        client_id: clientId,
        broker_id: brokerId,
        insurer_id: insurer.id,
        ramo: row.ramo.trim().toUpperCase(),
        start_date: row.start_date.trim(),
        renewal_date: row.renewal_date.trim(),
        status: row.status.trim().toUpperCase() as any,
        notas: row.notas?.trim() || null,
      };

      const { error: policyError } = await supabase.from('policies').insert(policyData);

      if (policyError) {
        return {
          success: false,
          error: `Fila ${row._rowNumber}: Error creando póliza: ${policyError.message}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Fila ${row._rowNumber}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  }

  return { success: true };
}
