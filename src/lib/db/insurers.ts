import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer, type Tables, type TablesInsert, type TablesUpdate } from '@/lib/supabase/server';

type InsurerRow = Tables<'insurers'>;
type InsurerIns = TablesInsert<'insurers'>;
type InsurerUpd = TablesUpdate<'insurers'>;

type InsurerMappingRow = Tables<'insurer_mappings'>;
type InsurerMappingIns = TablesInsert<'insurer_mappings'>;
type InsurerMappingUpd = TablesUpdate<'insurer_mappings'>;

type MappingRuleRow = Tables<'insurer_mapping_rules'>;
type MappingRuleIns = TablesInsert<'insurer_mapping_rules'>;
type MappingRuleUpd = TablesUpdate<'insurer_mapping_rules'>;

type AssaCodeRow = Tables<'insurer_assa_codes'>;
type AssaCodeIns = TablesInsert<'insurer_assa_codes'>;
type AssaCodeUpd = TablesUpdate<'insurer_assa_codes'>;

// ===== Zod Schemas =====
export const InsurerInsertSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  active: z.boolean().default(true),
  logo_url: z.string().nullable().optional(),
});

export const InsurerUpdateSchema = InsurerInsertSchema.partial();

export const InsurerMappingInsertSchema = z.object({
  insurer_id: z.string().uuid(),
  policy_strategy: z.string().optional(),
  insured_strategy: z.string().optional(),
  commission_strategy: z.string().optional(),
  options: z.record(z.string(), z.any()).default({}),
  active: z.boolean().default(true),
});

export const InsurerMappingUpdateSchema = InsurerMappingInsertSchema.partial();

export const MappingRuleInsertSchema = z.object({
  insurer_id: z.string().uuid(),
  target_field: z.string().min(1),
  strategy: z.string().min(1),
  notes: z.string().optional(),
  aliases: z.array(z.string()).default([]),
});

export const MappingRuleUpdateSchema = MappingRuleInsertSchema.partial();

export const AssaCodeInsertSchema = z.object({
  insurer_id: z.string().uuid(),
  code: z.string().min(1),
  code_norm: z.string().optional(),
  broker_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
});

export const AssaCodeUpdateSchema = AssaCodeInsertSchema.partial();

// ===== CRUD Aseguradoras =====
export async function listInsurers(includeInactive = false) {
  const supabase = await getSupabaseServer();
  
  let query = supabase.from('insurers').select('*').order('name');
  
  if (!includeInactive) {
    query = query.eq('active', true);
  }
  
  const { data, error } = await query;
  if (error) throw new Error(`Error listando aseguradoras: ${error.message}`);
  
  return data ?? [];
}

export async function getInsurer(insurerId: string) {
  const supabase = await getSupabaseServer();
  
  const { data, error } = await supabase
    .from('insurers')
    .select('*')
    .eq('id', insurerId)
    .single();
    
  if (error) throw new Error(`Error obteniendo aseguradora: ${error.message}`);
  
  return data;
}

export async function createInsurer(data: z.infer<typeof InsurerInsertSchema>) {
  const supabase = getSupabaseAdmin();
  const parsed = InsurerInsertSchema.parse(data);
  
  const { data: insurer, error } = await supabase
    .from('insurers')
    .insert([{
      name: parsed.name,
      active: parsed.active,
    } satisfies InsurerIns])
    .select()
    .single();
    
  if (error) throw new Error(`Error creando aseguradora: ${error.message}`);
  
  return insurer;
}

export async function updateInsurer(insurerId: string, data: z.infer<typeof InsurerUpdateSchema>) {
  const supabase = getSupabaseAdmin();
  const parsed = InsurerUpdateSchema.parse(data);
  
  const update: InsurerUpd = {};
  if (parsed.name !== undefined) update.name = parsed.name;
  if (parsed.active !== undefined) update.active = parsed.active;
  if (parsed.logo_url !== undefined) update.logo_url = parsed.logo_url;
  
  const { data: insurer, error } = await supabase
    .from('insurers')
    .update(update)
    .eq('id', insurerId)
    .select()
    .single();
    
  if (error) throw new Error(`Error actualizando aseguradora: ${error.message}`);
  
  return insurer;
}

export async function cloneInsurer(insurerId: string) {
  const supabase = getSupabaseAdmin();
  
  // Obtener aseguradora original
  const { data: original, error: getError } = await supabase
    .from('insurers')
    .select('*')
    .eq('id', insurerId)
    .single<InsurerRow>();
    
  if (getError || !original) throw new Error(`Error obteniendo aseguradora: ${getError?.message || 'No encontrada'}`);
  
  // Crear copia con nombre modificado
  const { data: newInsurer, error: createError } = await supabase
    .from('insurers')
    .insert([{
      name: `${original.name} (copia)`,
      active: original.active,
    } satisfies InsurerIns])
    .select()
    .single<InsurerRow>();
    
  if (createError) throw new Error(`Error clonando aseguradora: ${createError.message}`);
  
  // Copiar mapeos
  const { data: mappings, error: mappingsError } = await supabase
    .from('insurer_mappings')
    .select('*')
    .eq('insurer_id', insurerId)
    .returns<InsurerMappingRow[]>();
    
  if (mappingsError) throw new Error(`Error obteniendo mapeos: ${mappingsError.message}`);
  
  if (mappings && mappings.length > 0) {
    const newMappings = mappings.map((m) => ({
      insurer_id: newInsurer.id,
      policy_strategy: m.policy_strategy,
      insured_strategy: m.insured_strategy,
      commission_strategy: m.commission_strategy,
      options: m.options,
      active: m.active,
    } satisfies InsurerMappingIns));
    
    const { error: insertMappingsError } = await supabase
      .from('insurer_mappings')
      .insert(newMappings);
      
    if (insertMappingsError) throw new Error(`Error copiando mapeos: ${insertMappingsError.message}`);
  }
  
  return newInsurer;
}

export async function toggleInsurerActive(insurerId: string) {
  const supabase = getSupabaseAdmin();
  
  const { data: current, error: getError } = await supabase
    .from('insurers')
    .select('active')
    .eq('id', insurerId)
    .single();
    
  if (getError) throw new Error(`Error obteniendo aseguradora: ${getError.message}`);
  
  const { data: updated, error: updateError } = await supabase
    .from('insurers')
    .update({ active: !current.active })
    .eq('id', insurerId)
    .select()
    .single();
    
  if (updateError) throw new Error(`Error actualizando aseguradora: ${updateError.message}`);
  
  return updated;
}

export const getInsurerById = getInsurer;

// ===== Mappings =====
export async function getInsurerMapping(insurerId: string) {
  const supabase = await getSupabaseServer();
  
  const { data, error } = await supabase
    .from('insurer_mappings')
    .select('*')
    .eq('insurer_id', insurerId)
    .single();
    
  if (error && error.code !== 'PGRST116') throw new Error(`Error obteniendo mapeo: ${error.message}`);
  
  return data;
}

export const getInsurerMappingRules = listMappingRules;

export async function listMappingRules(insurerId: string, targetField?: string) {
  const supabase = await getSupabaseServer();
  
  let query = supabase
    .from('insurer_mapping_rules')
    .select('*')
    .eq('insurer_id', insurerId)
    .order('target_field');
  
  if (targetField) {
    query = query.eq('target_field', targetField);
  }
  
  const { data, error } = await query.returns<MappingRuleRow[]>();
  if (error) throw new Error(`Error listando reglas: ${error.message}`);
  
  return data ?? [];
}

export async function upsertInsurerMapping(data: z.infer<typeof InsurerMappingInsertSchema>) {
  const supabase = getSupabaseAdmin();
  const parsed = InsurerMappingInsertSchema.parse(data);
  
  const { data: upserted, error } = await supabase
    .from('insurer_mappings')
    .upsert([
      {
        insurer_id: parsed.insurer_id,
        policy_strategy: parsed.policy_strategy ?? undefined,
        insured_strategy: parsed.insured_strategy ?? undefined,
        commission_strategy: parsed.commission_strategy ?? undefined,
        options: parsed.options ?? {},
        active: parsed.active,
      } satisfies InsurerMappingIns
    ])
    .select()
    .single();
    
  if (error) throw new Error(`Error actualizando mapeo: ${error.message}`);
  return upserted;
}

export async function upsertMappingRule(data: z.infer<typeof MappingRuleInsertSchema>) {
  const supabase = getSupabaseAdmin();
  const parsed = MappingRuleInsertSchema.parse(data);
  
  // Buscar si ya existe
  const { data: existing } = await supabase
    .from('insurer_mapping_rules')
    .select('id')
    .eq('insurer_id', parsed.insurer_id)
    .eq('target_field', parsed.target_field)
    .single();
  
  if (existing) {
    // Actualizar
    const { data: updated, error } = await supabase
      .from('insurer_mapping_rules')
      .update({
        strategy: parsed.strategy,
        notes: parsed.notes || undefined,
        aliases: parsed.aliases ?? [],
      } satisfies MappingRuleUpd)
      .eq('id', existing.id)
      .select()
      .single();
      
    if (error) throw new Error(`Error actualizando regla: ${error.message}`);
    return updated;
  } else {
    // Insertar
    const { data: created, error } = await supabase
      .from('insurer_mapping_rules')
      .insert([{
        insurer_id: parsed.insurer_id,
        target_field: parsed.target_field,
        strategy: parsed.strategy,
        notes: parsed.notes || undefined,
        aliases: parsed.aliases ?? [],
      } satisfies MappingRuleIns])
      .select()
      .single();
      
    if (error) throw new Error(`Error creando regla: ${error.message}`);
    return created;
  }
}

export async function deleteMappingRule(ruleId: string) {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('insurer_mapping_rules')
    .delete()
    .eq('id', ruleId);
    
  if (error) throw new Error(`Error eliminando regla: ${error.message}`);
  
  return true;
}

// ===== Contacts, Downloads, ASSA Codes =====

export async function getInsurerContacts(insurerId: string) {
  // This is a placeholder. Implement according to your schema.
  return []; 
}

export async function getInsurerDownloads(insurerId: string) {
  // This is a placeholder. Implement according to your schema.
  return [];
}

export async function getInsurerAssaCodes(insurerId: string) {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('insurer_assa_codes')
    .select('*')
    .eq('insurer_id', insurerId)
    .order('code');

  if (error) throw new Error(`Error fetching ASSA codes: ${error.message}`);
  return data ?? [];
}

function normalizeAssaCode(code: string): string {
  // PJ750-001 -> PJ750-1
  if (code.startsWith('PJ750-')) {
    const suffix = code.substring(6);
    const numericPart = parseInt(suffix, 10);
    if (!isNaN(numericPart)) {
      return `PJ750-${numericPart}`;
    }
  }
  return code;
}

export async function importAssaCodes(insurerId: string, csvContent: string) {
  const supabase = getSupabaseAdmin();
  
  // Parsear CSV (asumiendo formato: code,broker_id)
  const lines = csvContent.split('\n').filter(line => line.trim());
  const hasHeader = lines[0]?.includes('code') || lines[0]?.includes('CODE');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  
  const codes: AssaCodeIns[] = [];
  const errors: string[] = [];
  
  for (const [index, line] of dataLines.entries()) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 1) continue;
    
    const code = parts[0];
    const brokerId = parts[1] || null;
    
    if (!code) {
      errors.push(`Línea ${index + 1}: código vacío`);
      continue;
    }
    
    codes.push({
      insurer_id: insurerId,
      code: code,
      code_norm: normalizeAssaCode(code), // Normalizamos en la aplicación
      broker_id: brokerId && brokerId !== 'office' ? brokerId : undefined,
      active: true,
    } satisfies AssaCodeIns);
  }
  
  // Insertar códigos válidos
  if (codes.length > 0) {
    const { error: insertError } = await supabase
      .from('insurer_assa_codes')
      .insert(codes);
      
    if (insertError) {
      throw new Error(`Error importando códigos: ${insertError.message}`);
    }
  }
  
  return {
    imported: codes.length,
    errors: errors.length,
    errorMessages: errors,
  };
}

// ===== Preview de Mapeo =====
export interface PreviewMappingOptions {
  targetField: string; // 'COMMISSIONS' o 'DELINQUENCY' o cualquier otro campo
  insurerId: string;
  fileBuffer: ArrayBuffer;
  fileName: string;
}

export async function previewMapping(options: PreviewMappingOptions) {
  const { targetField, insurerId, fileBuffer, fileName } = options;
  
  // Obtener reglas de mapeo para el campo objetivo
  const rules = await listMappingRules(insurerId, targetField);
  
  // Parsear el archivo según su tipo
  let headers: string[] = [];
  let dataRows: any[] = [];
  
  try {
    const fileExtension = fileName.toLowerCase().split('.').pop();
    
    if (fileExtension === 'csv') {
      // Parsear CSV
      const textDecoder = new TextDecoder('utf-8');
      const fileContent = textDecoder.decode(fileBuffer);
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return { success: false, error: 'Archivo CSV vacío' };
      }
      
      headers = lines[0]?.split(',').map(h => h.trim()) || [];
      
      // Parsear primeras 5 filas de datos
      for (let i = 1; i < Math.min(6, lines.length); i++) {
        const line = lines[i];
        if (!line) continue;
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        dataRows.push(row);
      }
      
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Parsear Excel usando xlsx
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      
      // Tomar la primera hoja
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return { success: false, error: 'El archivo Excel no tiene hojas' };
      }
      
      const worksheet = workbook.Sheets[firstSheetName];
      if (!worksheet) {
        return { success: false, error: 'No se pudo leer la hoja de Excel' };
      }
      
      // Convertir a JSON (array de objetos)
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        return { success: false, error: 'La hoja de Excel está vacía' };
      }
      
      // Primera fila son los headers
      headers = (jsonData[0] as any[]).map(h => String(h || '').trim());
      
      // Parsear primeras 5 filas de datos (saltando el header)
      for (let i = 1; i < Math.min(6, jsonData.length); i++) {
        const rowArray = jsonData[i] as any[];
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = rowArray[idx] !== undefined ? String(rowArray[idx]) : '';
        });
        dataRows.push(row);
      }
      
    } else {
      return { 
        success: false, 
        error: `Formato de archivo no soportado: ${fileExtension}. Use .csv, .xlsx o .xls` 
      };
    }
    
    if (headers.length === 0) {
      return { success: false, error: 'No se pudieron detectar columnas en el archivo' };
    }
    
  } catch (error) {
    console.error('Error parsing file:', error);
    return { 
      success: false, 
      error: `Error al parsear el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}` 
    };
  }
  
  // Función para normalizar strings (elimina acentos, espacios extra, lowercase)
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .trim()
      .replace(/\s+/g, ' '); // Normalizar espacios
  };
  
  console.log('[PREVIEW] Headers originales:', headers);
  console.log('[PREVIEW] Reglas de mapeo:', rules.map(r => ({
    target: r.target_field,
    aliases: r.aliases
  })));
  
  // Normalizar headers para comparación
  const headersNormalized = headers.map(h => normalizeString(h));
  
  // Crear mapa de aliases -> target_field
  const aliasMap = new Map<string, string>();
  for (const rule of rules) {
    // Agregar el target_field mismo como alias
    aliasMap.set(normalizeString(rule.target_field), rule.target_field);
    
    // Agregar todos los aliases
    const aliases = Array.isArray(rule.aliases) ? rule.aliases : [];
    for (const alias of aliases) {
      if (typeof alias === 'string' && alias.trim()) {
        aliasMap.set(normalizeString(alias), rule.target_field);
      }
    }
  }
  
  console.log('[PREVIEW] Alias map:', Array.from(aliasMap.entries()));
  
  // Mapear headers originales a campos objetivo
  const normalizedHeaders = headersNormalized.map((h, idx) => {
    const mapped = aliasMap.get(h);
    console.log(`[PREVIEW] Mapping "${headers[idx]}" (normalized: "${h}") -> ${mapped || 'NO MATCH'}`);
    return mapped || h;
  });
  
  // Crear filas normalizadas (usando headers normalizados como keys)
  const previewRows = dataRows.map(row => {
    const normalizedRow: any = {};
    headers.forEach((originalHeader, idx) => {
      const normalizedHeader = normalizedHeaders[idx];
      if (normalizedHeader) {
        normalizedRow[normalizedHeader] = row[originalHeader];
      }
    });
    return normalizedRow;
  });
  
  // Verificar campos requeridos según el tipo
  const requiredFields = targetField === 'COMMISSIONS' 
    ? ['policy_number', 'gross_amount'] 
    : targetField === 'DELINQUENCY'
    ? ['policy_number', 'amount']
    : [];
    
  const missingFields = requiredFields.filter(
    field => !normalizedHeaders.includes(field)
  );
  
  if (missingFields.length > 0) {
    console.log('[PREVIEW] Normalized headers:', normalizedHeaders);
    console.log('[PREVIEW] Required fields:', requiredFields);
    console.log('[PREVIEW] Missing fields:', missingFields);
    
    return {
      success: false,
      error: `Campos requeridos faltantes: ${missingFields.join(', ')}\nColumnas detectadas: ${headers.join(', ')}\nColumnas normalizadas: ${normalizedHeaders.join(', ')}`,
      originalHeaders: headers,
      normalizedHeaders,
      rules,
    };
  }
  
  return {
    success: true,
    originalHeaders: headers,
    normalizedHeaders,
    previewRows, // Filas con datos parseados
    rules,
  };
}
