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
    const userRole = formData.get('userRole') as string;
    const userBrokerId = formData.get('userBrokerId') as string | null;

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
    const excluded: ImportError[] = [];
    let successCount = 0;

    // Eliminar duplicados de números de póliza
    const deduplicatedRows = deduplicatePolicies(parsed, excluded);

    // Agrupar filas por cliente (por cédula o nombre)
    const clientGroups = groupByClient(deduplicatedRows);

    // Procesar cada grupo de cliente - VALIDACIÓN NO ESTRICTA
    for (const [clientKey, rows] of Object.entries(clientGroups)) {
      try {
        const result = await processClientGroup(supabase, rows, userRole, userBrokerId);
        
        if (result.success) {
          successCount += result.policiesCreated || rows.length;
        } else if (result.partialSuccess) {
          // Algunas pólizas se crearon, otras no
          successCount += result.policiesCreated || 0;
          if (result.errors) {
            errors.push(...result.errors);
          }
        } else {
          // Falló todo el grupo
          rows.forEach((row) => {
            errors.push({
              row: row._rowNumber || 0,
              message: result.error || 'Error desconocido',
            });
          });
        }
      } catch (error) {
        rows.forEach((row) => {
          errors.push({
            row: row._rowNumber || 0,
            message: error instanceof Error ? error.message : 'Error al procesar',
          });
        });
      }
    }

    return NextResponse.json({
      success: successCount,
      errors,
      excluded,
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
        excluded: [],
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
 * Elimina duplicados de números de póliza
 * Si ambas filas tienen info completa, mantiene solo la primera
 * Si una tiene info completa y otra no, mantiene la completa
 */
function deduplicatePolicies(
  rows: (CSVRow & { _rowNumber?: number })[],
  excluded: ImportError[]
): (CSVRow & { _rowNumber?: number })[] {
  const policyMap = new Map<string, (CSVRow & { _rowNumber?: number })>();

  for (const row of rows) {
    const policyNumber = row.policy_number?.trim().toUpperCase();
    if (!policyNumber) continue;

    const existing = policyMap.get(policyNumber);
    if (!existing) {
      policyMap.set(policyNumber, row);
      continue;
    }

    // Determinar qué fila tiene más información completa
    const rowComplete = isRowComplete(row);
    const existingComplete = isRowComplete(existing);

    if (rowComplete && !existingComplete) {
      // Nueva fila es más completa, reemplazar
      policyMap.set(policyNumber, row);
      excluded.push({
        row: existing._rowNumber || 0,
        message: `Póliza ${policyNumber} duplicada - reemplazada por fila ${row._rowNumber} con información más completa`,
      });
    } else {
      // Mantener existente, excluir nueva
      excluded.push({
        row: row._rowNumber || 0,
        message: `Póliza ${policyNumber} duplicada - ya existe en fila ${existing._rowNumber}`,
      });
    }
  }

  return Array.from(policyMap.values());
}

/**
 * Verifica si una fila tiene información completa
 */
function isRowComplete(row: CSVRow & { _rowNumber?: number }): boolean {
  return !!(
    row.client_name?.trim() &&
    row.national_id?.trim() &&
    row.email?.trim() &&
    row.phone?.trim() &&
    row.birth_date?.trim() &&
    row.policy_number?.trim() &&
    row.insurer_name?.trim() &&
    row.ramo?.trim() &&
    row.start_date?.trim() &&
    row.renewal_date?.trim() &&
    row.status?.trim() &&
    row.broker_email?.trim()
  );
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
  rows: (CSVRow & { _rowNumber?: number })[],
  userRole?: string,
  userBrokerId?: string | null
): Promise<{ 
  success: boolean; 
  partialSuccess?: boolean;
  policiesCreated?: number;
  error?: string;
  errors?: ImportError[];
}> {
  if (rows.length === 0) {
    return { success: false, error: 'Grupo vacío' };
  }

  const firstRow = rows[0];
  
  if (!firstRow) {
    return { success: false, error: 'Primera fila no encontrada' };
  }

  // Validaciones básicas
  if (!firstRow.client_name) {
    return { success: false, error: 'client_name es obligatorio' };
  }

  // 1. Determinar broker_email según rol
  let brokerEmail: string;
  if (userRole === 'broker' && userBrokerId) {
    // Si es broker, usar su propio ID sin importar lo que venga en CSV
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('id, profiles!inner(email)')
      .eq('id', userBrokerId)
      .single();
    
    if (!brokerData) {
      return { success: false, error: 'Broker del usuario no encontrado' };
    }
    brokerEmail = brokerData.profiles.email;
  } else {
    // Si es master, usar broker_email del CSV
    if (!firstRow.broker_email) {
      return { success: false, error: 'broker_email es obligatorio para usuarios master' };
    }
    brokerEmail = firstRow.broker_email.trim().toLowerCase();
  }

  // 2. Buscar broker por email
  const { data: broker, error: brokerError } = await supabase
    .from('brokers')
    .select('id, p_id, commission_override, profiles!inner(email)')
    .eq('profiles.email', brokerEmail)
    .single();

  if (brokerError || !broker) {
    return { success: false, error: `Broker no encontrado: ${brokerEmail}` };
  }

  const brokerId = broker.id;

  // 3. Buscar cliente existente por cédula o nombre
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
    // 4. Cliente existe: ACTUALIZAR datos faltantes
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
    // 5. Cliente NO existe: CREAR nuevo
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

  // 6. Crear pólizas (una por cada fila del grupo) - VALIDACIÓN NO ESTRICTA
  let policiesCreated = 0;
  const policyErrors: ImportError[] = [];

  for (const row of rows) {
    try {
      // Validar campos obligatorios de póliza
      if (!row.policy_number?.trim()) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: 'policy_number está vacío - campo obligatorio',
        });
        continue;
      }

      if (!row.insurer_name?.trim()) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: 'insurer_name está vacío - campo obligatorio',
        });
        continue;
      }

      if (!row.ramo?.trim()) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: 'ramo está vacío - campo obligatorio',
        });
        continue;
      }

      if (!row.start_date?.trim() || !row.renewal_date?.trim()) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: 'start_date y renewal_date son obligatorios',
        });
        continue;
      }

      if (!row.status?.trim()) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: 'status está vacío - campo obligatorio',
        });
        continue;
      }

      // Buscar aseguradora
      const { data: insurer, error: insurerError } = await supabase
        .from('insurers')
        .select('id, name')
        .eq('name', row.insurer_name.trim().toUpperCase())
        .single();

      if (insurerError || !insurer) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: `Aseguradora no encontrada: ${row.insurer_name}`,
        });
        continue;
      }

      // Verificar si la póliza ya existe
      const { data: existingPolicy } = await supabase
        .from('policies')
        .select('id')
        .eq('policy_number', row.policy_number.trim().toUpperCase())
        .single();

      if (existingPolicy) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: `Póliza ${row.policy_number} ya existe en la base de datos`,
        });
        continue;
      }

      // Determinar commission_override
      // REGLA ESPECIAL: Vida ASSA = 100% override sin importar default del broker
      const ramoNormalized = row.ramo.trim().toUpperCase();
      const insurerNormalized = insurer.name.trim().toUpperCase();
      const isVidaASSA = ramoNormalized === 'VIDA' && insurerNormalized === 'ASSA';
      
      const commissionOverride = isVidaASSA ? 100 : (broker.commission_override || null);

      // Crear póliza
      const policyData: any = {
        policy_number: row.policy_number.trim().toUpperCase(),
        client_id: clientId,
        broker_id: brokerId,
        insurer_id: insurer.id,
        ramo: ramoNormalized,
        start_date: row.start_date.trim(),
        renewal_date: row.renewal_date.trim(),
        status: row.status.trim().toUpperCase() as any,
        notas: row.notas?.trim() || null,
        commission_override: commissionOverride,
      };

      const { error: policyError } = await supabase.from('policies').insert(policyData);

      if (policyError) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: `Error creando póliza: ${policyError.message}`,
        });
        continue;
      }

      policiesCreated++;
    } catch (error) {
      policyErrors.push({
        row: row._rowNumber || 0,
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  // Retornar resultado según cuántas pólizas se crearon
  if (policiesCreated === rows.length) {
    return { success: true, policiesCreated };
  } else if (policiesCreated > 0) {
    return { 
      success: false,
      partialSuccess: true, 
      policiesCreated,
      errors: policyErrors,
    };
  } else {
    return { 
      success: false, 
      error: 'No se pudo crear ninguna póliza para este cliente',
      errors: policyErrors,
    };
  }
}
