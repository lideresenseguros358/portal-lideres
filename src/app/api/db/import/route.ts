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
  duplicateReason?: 'same_broker' | 'other_broker'; // Motivo de duplicado
  clientName?: string; // Para mostrar en UI
  policyNumber?: string; // Número de póliza
  brokerName?: string; // Nombre del broker actual (para duplicados de otro broker)
  errorType?: 'validation' | 'insurer_not_found' | 'broker_not_found' | 'duplicate_other_broker' | 'db_error' | 'unknown'; // Tipo de error para categorización en UI
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
    const clientDuplicates: ImportError[] = []; // Clientes/pólizas de otro broker en BD
    let successCount = 0;
    let policiesUpdated = 0; // Pólizas actualizadas (ya existían, se actualizaron datos)
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
        const result = await processClientGroup(supabase, rows, userRole, userBrokerId, clientDuplicates);
        
        if (result.success) {
          successCount += result.policiesCreated || 0;
          policiesUpdated += result.policiesUpdated || 0;
          if (result.clientCreated) clientsCreated++;
          if (result.clientUpdated) clientsUpdated++;
        } else if (result.partialSuccess) {
          // Algunas pólizas se crearon/actualizaron, otras no
          successCount += result.policiesCreated || 0;
          policiesUpdated += result.policiesUpdated || 0;
          if (result.clientCreated) clientsCreated++;
          if (result.clientUpdated) clientsUpdated++;
          if (result.errors) {
            errors.push(...result.errors);
          }
        } else if (result.skipGroup) {
          // Broker no encontrado - excluir este grupo
          const brokerEmail = rows[0]?.broker_email || 'desconocido';
          rows.forEach((row) => {
            excluded.push({
              row: row._rowNumber || 0,
              message: `Broker no encontrado: ${brokerEmail}`,
              errorType: 'broker_not_found',
            });
          });
        } else {
          // Falló todo el grupo
          if (result.errors && result.errors.length > 0) {
            errors.push(...result.errors);
          } else {
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
    console.log(`  - Pólizas actualizadas: ${policiesUpdated}`);
    console.log(`  - Clientes nuevos: ${clientsCreated}`);
    console.log(`  - Clientes actualizados: ${clientsUpdated}`);
    console.log(`  - Errores: ${errors.length}`);
    console.log(`  - Broker no encontrado: ${excluded.length}`);
    console.log(`  - Duplicados en CSV: ${csvDuplicates.length}`);
    console.log(`  - Duplicados otro broker: ${clientDuplicates.length}`);
    
    return NextResponse.json({
      success: successCount,
      policiesUpdated, // Pólizas actualizadas
      errors,
      excluded, // Broker no encontrado
      csvDuplicates, // Duplicados dentro del CSV
      clientDuplicates, // Clientes/pólizas de otro broker en BD
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
 * broker_email es opcional (se maneja según rol en processClientGroup)
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
    row.status?.trim()
    // broker_email NO se valida aquí - es opcional para brokers
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
 * Helper: obtener nombre del broker por broker_id
 */
async function getBrokerNameById(supabase: any, brokerId: string): Promise<string> {
  try {
    const { data: broker } = await supabase
      .from('brokers')
      .select('p_id')
      .eq('id', brokerId)
      .single();
    if (!broker) return 'Desconocido';
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', broker.p_id)
      .single();
    
    return profile?.full_name || profile?.email || 'Desconocido';
  } catch {
    return 'Desconocido';
  }
}

/**
 * Procesa un grupo de pólizas para un mismo cliente
 * - Clientes existentes del mismo broker: ACTUALIZA datos del cliente
 * - Pólizas existentes del mismo broker: ACTUALIZA datos de la póliza
 * - Clientes/pólizas de otro broker: reporta con nombre del broker
 */
async function processClientGroup(
  supabase: any,
  rows: (CSVRow & { _rowNumber?: number })[],
  userRole?: string,
  userBrokerId?: string | null,
  clientDuplicates?: ImportError[]
): Promise<{ 
  success: boolean; 
  partialSuccess?: boolean;
  policiesCreated?: number;
  policiesUpdated?: number;
  clientCreated?: boolean;
  clientUpdated?: boolean;
  error?: string;
  errors?: ImportError[];
  skipGroup?: boolean;
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

  // 1. Determinar broker_id y brokerEmail según rol
  console.log('[IMPORT API] userRole:', userRole);
  console.log('[IMPORT API] broker_email del CSV:', firstRow.broker_email);
  console.log('[IMPORT API] userBrokerId:', userBrokerId);
  
  let brokerId: string;
  let brokerEmail: string;
  
  if (userRole === 'broker' && userBrokerId) {
    brokerId = userBrokerId;
    
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('p_id')
      .eq('id', userBrokerId)
      .single();
    
    if (!brokerData) {
      console.error('[IMPORT API] Broker no encontrado con id:', userBrokerId);
      return { success: false, error: 'Broker del usuario no encontrado' };
    }
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', brokerData.p_id)
      .single();
    
    if (!profileData) {
      console.error('[IMPORT API] Profile no encontrado para broker p_id:', brokerData.p_id);
      return { success: false, error: 'Profile del broker no encontrado' };
    }
    
    brokerEmail = profileData.email;
    console.log('[IMPORT API] Broker encontrado (usuario):', brokerId, 'email:', brokerEmail);
  } else {
    if (!firstRow.broker_email) {
      return { success: false, error: 'broker_email es obligatorio para usuarios master' };
    }
    brokerEmail = firstRow.broker_email.toString().trim().toLowerCase();

    console.log('[IMPORT API] Buscando profile con email:', brokerEmail);
    
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

    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('id, p_id')
      .eq('p_id', profile.id)
      .single();

    if (brokerError || !broker) {
      console.log('[IMPORT API] Broker no encontrado para profile:', brokerError);
      return { success: false, error: `Broker no encontrado: ${brokerEmail}`, skipGroup: true };
    }

    console.log('[IMPORT API] Broker encontrado (master):', broker.id);
    brokerId = broker.id;
  }

  // 3. Buscar cliente existente por cédula o nombre
  let existingClient: any = null;
  const normalizedName = firstRow.client_name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ñ/g, 'n').replace(/Ñ/g, 'N').replace(/[^\w\s\-]/g, '').toUpperCase();
  const normalizedId = firstRow.national_id?.trim().toUpperCase();

  if (normalizedId) {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('national_id', normalizedId)
      .single();
    existingClient = data;
  }

  if (!existingClient && normalizedName) {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('name', normalizedName)
      .single();
    existingClient = data;
  }

  // VERIFICAR SI EL CLIENTE YA EXISTE CON OTRO BROKER
  if (existingClient && clientDuplicates) {
    const existingBrokerId = existingClient.broker_id;
    const isDifferentBroker = existingBrokerId && existingBrokerId !== brokerId;
    
    if (isDifferentBroker) {
      // Cliente de OTRO broker - obtener nombre del broker para el reporte
      const otherBrokerName = await getBrokerNameById(supabase, existingBrokerId);
      
      clientDuplicates.push({
        row: firstRow._rowNumber || 0,
        message: `Cliente "${firstRow.client_name}" ya existe registrado con el corredor: ${otherBrokerName}`,
        isDuplicate: true,
        duplicateReason: 'other_broker',
        clientName: firstRow.client_name,
        brokerName: otherBrokerName,
        errorType: 'duplicate_other_broker',
      });
      return {
        success: false,
        error: `Cliente duplicado (registrado con corredor: ${otherBrokerName})`,
      };
    }
    // Si es el MISMO broker, continuar para actualizar cliente y pólizas
  }

  // ==============================================================
  // VALIDAR TODAS LAS PÓLIZAS Y SEPARAR: nuevas, actualizables, errores
  // ==============================================================
  
  const policyErrors: ImportError[] = [];
  const newPolicies: (CSVRow & { _rowNumber?: number })[] = [];
  const updatePolicies: { row: CSVRow & { _rowNumber?: number }; existingId: string }[] = [];

  for (const row of rows) {
    // Validar campos obligatorios de póliza
    if (!row.policy_number?.trim()) {
      policyErrors.push({
        row: row._rowNumber || 0,
        message: 'Número de póliza vacío - campo obligatorio',
        errorType: 'validation',
        policyNumber: '',
      });
      continue;
    }

    if (!row.insurer_name?.trim()) {
      policyErrors.push({
        row: row._rowNumber || 0,
        message: 'Nombre de aseguradora vacío - campo obligatorio',
        errorType: 'validation',
        policyNumber: row.policy_number?.trim(),
      });
      continue;
    }

    if (!row.ramo?.trim()) {
      policyErrors.push({
        row: row._rowNumber || 0,
        message: 'Ramo vacío - campo obligatorio',
        errorType: 'validation',
        policyNumber: row.policy_number?.trim(),
      });
      continue;
    }

    if (!row.start_date?.trim() || !row.renewal_date?.trim()) {
      policyErrors.push({
        row: row._rowNumber || 0,
        message: 'Fecha de inicio y fecha de renovación son obligatorias',
        errorType: 'validation',
        policyNumber: row.policy_number?.trim(),
      });
      continue;
    }

    if (!row.status?.trim()) {
      policyErrors.push({
        row: row._rowNumber || 0,
        message: 'Estado de póliza vacío - campo obligatorio',
        errorType: 'validation',
        policyNumber: row.policy_number?.trim(),
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
        message: `Aseguradora no encontrada: "${row.insurer_name}". Verifica que el nombre coincida exactamente con las aseguradoras registradas.`,
        errorType: 'insurer_not_found',
        policyNumber: row.policy_number?.trim(),
      });
      continue;
    }

    // Verificar si la póliza ya existe en BD
    const { data: existingPolicy } = await supabase
      .from('policies')
      .select('id, broker_id')
      .eq('policy_number', row.policy_number.trim().toUpperCase())
      .single();

    if (existingPolicy) {
      // Póliza existe - verificar si es del mismo broker o de otro
      if (existingPolicy.broker_id !== brokerId) {
        // Póliza de OTRO broker
        const otherBrokerName = await getBrokerNameById(supabase, existingPolicy.broker_id);
        clientDuplicates?.push({
          row: row._rowNumber || 0,
          message: `Póliza "${row.policy_number}" ya existe registrada con el corredor: ${otherBrokerName}`,
          isDuplicate: true,
          duplicateReason: 'other_broker',
          clientName: firstRow.client_name,
          policyNumber: row.policy_number?.trim(),
          brokerName: otherBrokerName,
          errorType: 'duplicate_other_broker',
        });
      } else {
        // Póliza del MISMO broker → marcar para ACTUALIZAR
        updatePolicies.push({ row, existingId: existingPolicy.id });
      }
      continue;
    }

    // Póliza nueva válida
    newPolicies.push(row);
  }

  // Si NO hay pólizas nuevas NI actualizables, verificar si hay algo que hacer
  if (newPolicies.length === 0 && updatePolicies.length === 0) {
    console.log('[IMPORT API] No hay pólizas para crear ni actualizar');
    
    if (policyErrors.length === 0) {
      // Todo fueron duplicados de otro broker (ya reportados en clientDuplicates)
      return { success: false, error: 'Todas las pólizas pertenecen a otro corredor' };
    }
    
    return { 
      success: false, 
      error: 'No se pudo validar ninguna póliza para este cliente',
      errors: policyErrors,
    };
  }

  // ==============================================================
  // CREAR O ACTUALIZAR CLIENTE
  // ==============================================================
  
  let clientId: string;
  let clientCreated = false;
  let clientUpdated = false;
  
  const isCompany = isRUC(normalizedId);
  const isPreliminary = !normalizedId || !firstRow.email?.trim() || !firstRow.phone?.trim() || (!isCompany && !firstRow.birth_date?.trim());

  if (existingClient) {
    // Cliente existe con MISMO broker: ACTUALIZAR datos (sobreescribir con CSV si hay datos)
    const updateData: any = {};
    let needsUpdate = false;

    // Actualizar nombre si cambió
    if (normalizedName && existingClient.name !== normalizedName) {
      updateData.name = normalizedName;
      needsUpdate = true;
    }
    // Actualizar cédula si el CSV trae y es diferente
    if (normalizedId && existingClient.national_id !== normalizedId) {
      updateData.national_id = normalizedId;
      needsUpdate = true;
    }
    // Actualizar email si el CSV trae
    if (firstRow.email?.trim() && existingClient.email !== firstRow.email.trim()) {
      updateData.email = firstRow.email.trim();
      needsUpdate = true;
    }
    // Actualizar teléfono si el CSV trae
    if (firstRow.phone?.trim() && existingClient.phone !== firstRow.phone.trim()) {
      updateData.phone = firstRow.phone.trim();
      needsUpdate = true;
    }
    // Actualizar fecha de nacimiento si el CSV trae
    if (firstRow.birth_date?.trim() && existingClient.birth_date !== firstRow.birth_date.trim()) {
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
      console.log('[IMPORT API] Cliente actualizado:', existingClient.id, 'campos:', Object.keys(updateData));
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
  // CREAR PÓLIZAS NUEVAS
  // ==============================================================
  
  let policiesCreated = 0;

  for (const row of newPolicies) {
    try {
      const { data: insurer } = await supabase
        .from('insurers')
        .select('id, name')
        .eq('name', row.insurer_name.trim().toUpperCase())
        .single();

      if (!insurer) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: `Error inesperado: aseguradora no encontrada`,
          errorType: 'db_error',
        });
        continue;
      }

      const ramoNormalized = row.ramo.trim().toUpperCase();
      const insurerNormalized = insurer.name.trim().toUpperCase();
      const isVidaASSA = ramoNormalized === 'VIDA' && insurerNormalized === 'ASSA';
      const commissionOverride = isVidaASSA ? 100 : null;

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
        percent_override: commissionOverride,
      };

      const { error: policyError } = await supabase.from('policies').insert(policyData);

      if (policyError) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: `Error creando póliza: ${policyError.message}`,
          errorType: 'db_error',
          policyNumber: row.policy_number?.trim(),
        });
        continue;
      }

      policiesCreated++;
    } catch (error) {
      console.error('[IMPORT API] Error en póliza fila', row._rowNumber, ':', error);
      policyErrors.push({
        row: row._rowNumber || 0,
        message: error instanceof Error ? `Error creando póliza: ${error.message}` : `Error desconocido al crear póliza`,
        errorType: 'db_error',
      });
    }
  }

  // ==============================================================
  // ACTUALIZAR PÓLIZAS EXISTENTES (mismo broker)
  // ==============================================================
  
  let policiesUpdatedCount = 0;

  for (const { row, existingId } of updatePolicies) {
    try {
      const { data: insurer } = await supabase
        .from('insurers')
        .select('id, name')
        .eq('name', row.insurer_name.trim().toUpperCase())
        .single();

      if (!insurer) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: `Error inesperado: aseguradora no encontrada al actualizar`,
          errorType: 'db_error',
        });
        continue;
      }

      const ramoNormalized = row.ramo.trim().toUpperCase();
      const insurerNormalized = insurer.name.trim().toUpperCase();
      const isVidaASSA = ramoNormalized === 'VIDA' && insurerNormalized === 'ASSA';
      const commissionOverride = isVidaASSA ? 100 : null;

      const updateData: any = {
        client_id: clientId,
        insurer_id: insurer.id,
        ramo: ramoNormalized,
        start_date: row.start_date.trim(),
        renewal_date: row.renewal_date.trim(),
        status: row.status.trim().toUpperCase(),
        percent_override: commissionOverride,
      };
      
      if (row.notas?.trim()) {
        updateData.notas = row.notas.trim();
      }

      const { error: updateError } = await supabase
        .from('policies')
        .update(updateData)
        .eq('id', existingId);

      if (updateError) {
        policyErrors.push({
          row: row._rowNumber || 0,
          message: `Error actualizando póliza ${row.policy_number}: ${updateError.message}`,
          errorType: 'db_error',
          policyNumber: row.policy_number?.trim(),
        });
        continue;
      }

      policiesUpdatedCount++;
      console.log('[IMPORT API] Póliza actualizada:', row.policy_number);
    } catch (error) {
      console.error('[IMPORT API] Error actualizando póliza fila', row._rowNumber, ':', error);
      policyErrors.push({
        row: row._rowNumber || 0,
        message: error instanceof Error ? `Error actualizando póliza: ${error.message}` : `Error desconocido al actualizar póliza`,
        errorType: 'db_error',
      });
    }
  }

  // Retornar resultado
  const totalProcessed = policiesCreated + policiesUpdatedCount;
  
  if (totalProcessed > 0 && policyErrors.length === 0) {
    return { 
      success: true, 
      policiesCreated,
      policiesUpdated: policiesUpdatedCount,
      clientCreated,
      clientUpdated,
    };
  } else if (totalProcessed > 0) {
    return { 
      success: false,
      partialSuccess: true, 
      policiesCreated,
      policiesUpdated: policiesUpdatedCount,
      clientCreated,
      clientUpdated,
      errors: policyErrors,
    };
  } else {
    return { 
      success: false, 
      error: 'No se pudo crear ni actualizar ninguna póliza para este cliente',
      errors: policyErrors,
    };
  }
}
