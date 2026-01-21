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
  isDuplicate?: boolean; // Para identificar pólizas duplicadas vs errores reales
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
    const excluded: ImportError[] = []; // Broker no encontrado
    const csvDuplicates: ImportError[] = []; // Duplicados dentro del CSV
    let successCount = 0;
    let clientsCreated = 0; // Clientes nuevos creados
    let clientsUpdated = 0; // Clientes actualizados

    // Eliminar duplicados de números de póliza dentro del CSV
    const deduplicatedRows = deduplicatePolicies(parsed, csvDuplicates);

    // Agrupar filas por cliente (por cédula o nombre)
    const clientGroups = groupByClient(deduplicatedRows);
    const totalGroups = Object.keys(clientGroups).length;
    let processedGroups = 0;

    console.log(`[IMPORT API] Total grupos a procesar: ${totalGroups}`);

    // Procesar cada grupo de cliente - VALIDACIÓN NO ESTRICTA
    for (const [clientKey, rows] of Object.entries(clientGroups)) {
      processedGroups++;
      const progressPercent = Math.round((processedGroups / totalGroups) * 100);
      console.log(`[IMPORT API] Progreso: ${processedGroups}/${totalGroups} (${progressPercent}%)`);
      try {
        const result = await processClientGroup(supabase, rows, userRole, userBrokerId);
        
        if (result.success) {
          successCount += result.policiesCreated || rows.length;
          if (result.clientCreated) clientsCreated++;
          if (result.clientUpdated) clientsUpdated++;
        } else if (result.partialSuccess) {
          // Algunas pólizas se crearon, otras no
          successCount += result.policiesCreated || 0;
          if (result.clientCreated) clientsCreated++;
          if (result.clientUpdated) clientsUpdated++;
          if (result.errors) {
            errors.push(...result.errors);
          }
        } else if (result.skipGroup) {
          // Broker no encontrado - excluir este grupo sin contar como error
          const brokerEmail = rows[0]?.broker_email || 'desconocido';
          rows.forEach((row) => {
            excluded.push({
              row: row._rowNumber || 0,
              message: `Broker no encontrado: ${brokerEmail}`,
            });
          });
        } else {
          // Falló todo el grupo
          if (result.errors && result.errors.length > 0) {
            // Si hay errores detallados, usarlos (mantienen isDuplicate y otros flags)
            errors.push(...result.errors);
          } else {
            // Si no hay errores detallados, crear genéricos
            rows.forEach((row) => {
              errors.push({
                row: row._rowNumber || 0,
                message: result.error || 'Error desconocido',
              });
            });
          }
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

    console.log(`[IMPORT API] Importación completada:`);
    console.log(`  - Pólizas creadas: ${successCount}`);
    console.log(`  - Clientes nuevos: ${clientsCreated}`);
    console.log(`  - Clientes actualizados: ${clientsUpdated}`);
    console.log(`  - Errores: ${errors.length}`);
    console.log(`  - Broker no encontrado: ${excluded.length}`);
    console.log(`  - Duplicados en CSV: ${csvDuplicates.length}`);
    
    return NextResponse.json({
      success: successCount,
      errors,
      excluded, // Broker no encontrado
      csvDuplicates, // Duplicados dentro del CSV
      clientsCreated, // Clientes nuevos
      clientsUpdated, // Clientes actualizados
      totalGroups,
      processed: processedGroups,
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
 * Detecta si un documento es RUC (empresa)
 */
function isRUC(nationalId: string): boolean {
  if (!nationalId || !nationalId.includes('-')) return false;
  // RUC tiene guiones pero NO empieza con prefijos de cédula
  return !nationalId.match(/^(PE|E|N|PN|PI|[1-9]|1[0-2])-/);
}

/**
 * Verifica si una fila tiene información completa
 */
function isRowComplete(row: CSVRow & { _rowNumber?: number }): boolean {
  // Si es RUC, la fecha de nacimiento es opcional
  const isCompany = isRUC(row.national_id?.trim() || '');
  
  return !!(
    row.client_name?.trim() &&
    row.national_id?.trim() &&
    row.email?.trim() &&
    row.phone?.trim() &&
    (isCompany || row.birth_date?.trim()) && // Opcional si es RUC
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
  clientCreated?: boolean; // Si se creó un cliente nuevo
  clientUpdated?: boolean; // Si se actualizó un cliente existente
  error?: string;
  errors?: ImportError[];
  skipGroup?: boolean; // Para skipear grupos con broker no encontrado
}> {
  console.log('[IMPORT API] ========== PROCESANDO GRUPO ==========');
  console.log('[IMPORT API] Filas en grupo:', rows.length);
  
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
  console.log('[IMPORT API] userRole:', userRole);
  console.log('[IMPORT API] broker_email del CSV:', firstRow.broker_email);
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
    brokerEmail = firstRow.broker_email.toString().trim().toLowerCase();
  }

  // 2. Buscar broker por email (en dos pasos para mayor confiabilidad)
  console.log('[IMPORT API] Buscando profile con email:', brokerEmail);
  console.log('[IMPORT API] Email length:', brokerEmail.length, 'chars:', JSON.stringify(brokerEmail));
  
  // Paso 1: Buscar profile por email (case-insensitive)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', brokerEmail)
    .single();

  if (profileError || !profile) {
    console.log('[IMPORT API] Profile no encontrado:', profileError);
    return { success: false, error: `Broker no encontrado (profile): ${brokerEmail}` };
  }

  console.log('[IMPORT API] Profile encontrado:', profile.id);

  // Paso 2: Buscar broker por user_id (p_id)
  const { data: broker, error: brokerError } = await supabase
    .from('brokers')
    .select('id, p_id')
    .eq('p_id', profile.id)
    .single();

  if (brokerError || !broker) {
    console.log('[IMPORT API] Broker no encontrado para profile:', brokerError);
    // Retornar null para skipear este grupo (broker no encontrado)
    return { success: false, error: `Broker no encontrado: ${brokerEmail}`, skipGroup: true };
  }

  console.log('[IMPORT API] Broker encontrado:', broker.id);
  const brokerId = broker.id;

  // 3. Buscar cliente existente por cédula o nombre
  let existingClient = null;
  // Normalizar nombre: eliminar acentos, ñ→n, puntuación, y MAYÚSCULAS
  const normalizedName = firstRow.client_name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ñ/g, 'n').replace(/Ñ/g, 'N').replace(/[^\w\s\-]/g, '').toUpperCase();
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

  // ==============================================================
  // PRIMERO: VALIDAR TODAS LAS PÓLIZAS ANTES DE CREAR/ACTUALIZAR CLIENTE
  // Esto evita crear clientes sin pólizas
  // ==============================================================
  
  const policyErrors: ImportError[] = [];
  const validPolicies: typeof rows = [];

  for (const row of rows) {
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

    // Verificar si la póliza ya existe en BD
    const { data: existingPolicy } = await supabase
      .from('policies')
      .select('id')
      .eq('policy_number', row.policy_number.trim().toUpperCase())
      .single();

    if (existingPolicy) {
      policyErrors.push({
        row: row._rowNumber || 0,
        message: `Póliza ${row.policy_number} ya existe en la base de datos`,
        isDuplicate: true, // IMPORTANTE: Flag para separar duplicados de errores
      });
      continue;
    }

    // Póliza válida - guardar para crear después
    validPolicies.push(row);
  }

  // Si NO hay pólizas válidas para crear, NO crear el cliente
  if (validPolicies.length === 0) {
    console.log('[IMPORT API] No hay pólizas válidas - no se creará el cliente');
    
    // Verificar si todos son duplicados
    const allDuplicates = policyErrors.every(e => e.isDuplicate);
    
    if (allDuplicates && policyErrors.length > 0) {
      return {
        success: false,
        error: `Todas las pólizas de este cliente ya existen en la base de datos`,
        errors: policyErrors,
      };
    }
    
    return { 
      success: false, 
      error: 'No se pudo validar ninguna póliza para este cliente',
      errors: policyErrors,
    };
  }

  // ==============================================================
  // AHORA SÍ: CREAR O ACTUALIZAR CLIENTE
  // Solo si hay al menos una póliza válida para crear
  // ==============================================================
  
  let clientId: string;
  let clientCreated = false;
  let clientUpdated = false;
  
  // Si es RUC (empresa), la fecha de nacimiento es opcional
  const isCompany = isRUC(normalizedId);
  const isPreliminary = !normalizedId || !firstRow.email?.trim() || !firstRow.phone?.trim() || (!isCompany && !firstRow.birth_date?.trim());

  if (existingClient) {
    // Cliente existe: ACTUALIZAR datos faltantes
    const updateData: any = {};
    let needsUpdate = false;

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
      clientUpdated = true;
    }

    clientId = existingClient.id;
  } else {
    // Cliente NO existe: CREAR nuevo
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: normalizedName,
        national_id: normalizedId || null,
        email: firstRow.email?.trim() || null,
        phone: firstRow.phone?.trim() || null,
        birth_date: firstRow.birth_date?.trim() || null,
        broker_id: brokerId,
        active: !isPreliminary,
      })
      .select()
      .single();

    if (clientError || !newClient) {
      return { success: false, error: `Error creando cliente: ${clientError?.message}` };
    }

    clientId = newClient.id;
    clientCreated = true;
  }

  // ==============================================================
  // FINALMENTE: CREAR LAS PÓLIZAS VÁLIDAS
  // ==============================================================
  
  let policiesCreated = 0;

  for (const row of validPolicies) {
    try {
      // Buscar aseguradora (ya validada antes, pero necesitamos el objeto)
      const { data: insurer } = await supabase
        .from('insurers')
        .select('id, name')
        .eq('name', row.insurer_name.trim().toUpperCase())
        .single();

      if (!insurer) {
        // No debería pasar porque ya validamos antes
        policyErrors.push({
          row: row._rowNumber || 0,
          message: `Error inesperado: aseguradora no encontrada`,
        });
        continue;
      }

      // Determinar commission_override
      // REGLA ESPECIAL: Vida ASSA = 100% override
      // Para todos los demás: null (usa default del broker)
      const ramoNormalized = row.ramo.trim().toUpperCase();
      const insurerNormalized = insurer.name.trim().toUpperCase();
      const isVidaASSA = ramoNormalized === 'VIDA' && insurerNormalized === 'ASSA';
      
      const commissionOverride = isVidaASSA ? 100 : null;

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
        percent_override: commissionOverride, // CORRECCIÓN: columna real es percent_override
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
      console.error('[IMPORT API] Error en póliza fila', row._rowNumber, ':', error);
      policyErrors.push({
        row: row._rowNumber || 0,
        message: error instanceof Error ? `Error creando póliza: ${error.message}` : `Error desconocido al crear póliza`,
      });
    }
  }

  // Retornar resultado según cuántas pólizas se crearon
  const totalAttempted = validPolicies.length;
  
  if (policiesCreated === totalAttempted && policyErrors.length === 0) {
    // Todas las pólizas válidas se crearon exitosamente
    return { 
      success: true, 
      policiesCreated,
      clientCreated,
      clientUpdated,
    };
  } else if (policiesCreated > 0) {
    // Algunas pólizas se crearon, otras fallaron o eran duplicadas
    return { 
      success: false,
      partialSuccess: true, 
      policiesCreated,
      clientCreated,
      clientUpdated,
      errors: policyErrors,
    };
  } else if (policyErrors.every(e => e.isDuplicate)) {
    // Todas eran duplicadas - cliente ya existe con estas pólizas
    return { 
      success: false, 
      error: 'Todas las pólizas de este cliente ya existen en la base de datos',
      errors: policyErrors,
    };
  } else {
    // Errores reales al crear pólizas
    return { 
      success: false, 
      error: 'No se pudo crear ninguna póliza válida para este cliente',
      errors: policyErrors,
    };
  }
}
