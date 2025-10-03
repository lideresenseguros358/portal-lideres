import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Tables, TablesInsert } from '@/lib/supabase/server';
import type { ParsedRow } from './schemas';
import * as XLSX from 'xlsx';

type CommImportRow = Tables<'comm_imports'>;
type CommItemRow = Tables<'comm_items'>;
type CommImportIns = TablesInsert<'comm_imports'>;
type CommItemIns = TablesInsert<'comm_items'>;

interface MappingRule {
  target_field: string;
  aliases: any;
}

/**
 * Parse XLSX file using xlsx library
 */
async function parseXlsxFile(file: File, mappingRules: MappingRule[] = [], invertNegatives: boolean = false): Promise<ParsedRow[]> {
  console.log('[PARSER] Parsing XLSX file:', file.name);
  console.log('[PARSER] Using mapping rules:', mappingRules);
  
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.log('[PARSER] No sheets found');
    return [];
  }
  
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    console.log('[PARSER] Sheet not found');
    return [];
  }
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  console.log('[PARSER] Total rows:', jsonData.length);
  
  if (jsonData.length === 0) {
    console.log('[PARSER] No data found');
    return [];
  }
  
  // First row is headers
  const firstRow = jsonData[0];
  if (!firstRow) {
    console.log('[PARSER] No header row');
    return [];
  }
  
  const headers = firstRow.map((h: any) => String(h || '').trim());
  console.log('[PARSER] Headers:', headers);
  
  // Use mapping rules if available, otherwise use default detection
  let policyIndex = -1;
  let insuredIndex = -1;
  let amountIndex = -1;
  
  if (mappingRules && mappingRules.length > 0) {
    // Use configured mapping
    for (const rule of mappingRules) {
      const aliases = Array.isArray(rule.aliases) ? rule.aliases : [];
      
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (!header) continue;
        if (aliases.some((alias: string) => header.toLowerCase().includes(alias.toLowerCase()))) {
          // Map target_field to column indices
          if (rule.target_field === 'policy') policyIndex = i;
          if (rule.target_field === 'insured') insuredIndex = i;
          if (rule.target_field === 'commission') amountIndex = i;
        }
      }
    }
  } else {
    // Fallback to default detection
    const headersLower = headers.map(h => h.toLowerCase());
    policyIndex = headersLower.findIndex(h => 
      h.includes('polic') || h.includes('poliz') || h.includes('numero') || h.includes('no.')
    );
    insuredIndex = headersLower.findIndex(h => 
      h.includes('insured') || h.includes('asegurado') || h.includes('nombre') || h.includes('client')
    );
    amountIndex = headersLower.findIndex(h => 
      h.includes('honorario') || h.includes('amount') || h.includes('gross') || h.includes('bruto') || (h.includes('monto') && !h.includes('gasto'))
    );
  }
  
  console.log('[PARSER] Column mapping:', { policyIndex, insuredIndex, amountIndex });
  console.log('[PARSER] Mapped columns:', {
    policy: policyIndex >= 0 ? headers[policyIndex] : 'NOT FOUND',
    insured: insuredIndex >= 0 ? headers[insuredIndex] : 'NOT FOUND',
    amount: amountIndex >= 0 ? headers[amountIndex] : 'NOT FOUND'
  });
  
  // Parse data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const values = jsonData[i];
    if (!values || values.length === 0) continue;
    
    // Skip if all values are empty
    if (values.every(v => !v)) continue;
    
    // Store raw row
    const rawRow: Record<string, any> = {};
    headers.forEach((header, idx) => {
      rawRow[header] = values[idx] || null;
    });
    
    // Extract standard fields
    const policyNumber = policyIndex >= 0 && values[policyIndex] ? String(values[policyIndex]).trim() : null;
    const insuredName = insuredIndex >= 0 && values[insuredIndex] ? String(values[insuredIndex]).trim() : null;
    
    // Parse amount
    let grossAmount = 0;
    if (amountIndex >= 0 && values[amountIndex]) {
      const amountValue = values[amountIndex];
      if (typeof amountValue === 'number') {
        grossAmount = amountValue;
      } else {
        const amountStr = String(amountValue).replace(/[$,]/g, '').trim();
        const parsed = parseFloat(amountStr);
        grossAmount = isNaN(parsed) ? 0 : parsed;
      }
      
      // Invert sign if configured
      if (invertNegatives) {
        grossAmount = grossAmount * -1;
      }
    }
    
    // Only add rows with at least policy number or amount (include negatives)
    if (policyNumber || grossAmount !== 0) {
      rows.push({
        policy_number: policyNumber,
        client_name: insuredName,
        commission_amount: grossAmount,
        raw_row: rawRow,
      });
    }
  }
  
  console.log('[PARSER] Parsed rows:', rows.length);
  console.log('[PARSER] Sample row:', rows[0]);
  console.log('[PARSER] Sample row 2:', rows[1]);
  
  return rows;
}

/**
 * Parse CSV or XLSX file into rows
 */
export async function parseCsvXlsx(file: File, mappingRules: MappingRule[] = [], invertNegatives: boolean = false): Promise<ParsedRow[]> {
  console.log('[PARSER] Starting to parse file:', file.name);
  
  // Check if it's XLSX
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    return parseXlsxFile(file, mappingRules, invertNegatives);
  }
  
  // Otherwise parse as CSV
  let text = await file.text();
  
  // Sanitize text: remove null bytes and other problematic characters
  text = text
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control characters except \n, \r, \t
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n');
  
  const lines = text.split('\n').filter(line => line.trim());
  console.log('[PARSER] Total lines:', lines.length);
  
  if (lines.length === 0) {
    console.log('[PARSER] No lines found');
    return [];
  }
  
  // Auto-detect delimiter
  const firstLine = lines[0];
  if (!firstLine) {
    console.log('[PARSER] No first line');
    return [];
  }
  
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  console.log('[PARSER] Delimiter:', delimiter === '\t' ? 'TAB' : 'COMMA');
  
  // Parse headers
  const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
  console.log('[PARSER] Headers:', headers);
  
  // Map known headers to standard fields - más flexible
  const policyIndex = headers.findIndex(h => 
    h.includes('polic') || h.includes('poliz') || h.includes('numero') || h.includes('no.')
  );
  const insuredIndex = headers.findIndex(h => 
    h.includes('insured') || h.includes('asegurado') || h.includes('nombre') || h.includes('client')
  );
  const amountIndex = headers.findIndex(h => 
    h.includes('amount') || h.includes('gross') || h.includes('bruto') || h.includes('monto') || h.includes('comis')
  );
  
  console.log('[PARSER] Column mapping:', { policyIndex, insuredIndex, amountIndex });
  
  // Parse data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    
    const values = line.split(delimiter).map(v => v.trim());
    
    // Skip if all values are empty
    if (values.every(v => !v)) continue;
    
    // Store raw row
    const rawRow: Record<string, any> = {};
    headers.forEach((header, idx) => {
      rawRow[header] = values[idx] || null;
    });
    
    // Extract standard fields
    const policyNumber = policyIndex >= 0 && values[policyIndex] ? values[policyIndex] : null;
    const insuredName = insuredIndex >= 0 && values[insuredIndex] ? values[insuredIndex] : null;
    
    // Parse amount
    let grossAmount = 0;
    if (amountIndex >= 0 && values[amountIndex]) {
      const amountStr = values[amountIndex]
        .replace(/[$,]/g, '')
        .trim();
      const parsed = parseFloat(amountStr);
      grossAmount = isNaN(parsed) ? 0 : parsed;
    }
    
    // Only add rows with at least policy number or amount
    if (policyNumber || grossAmount > 0) {
      rows.push({
        policy_number: policyNumber,
        client_name: insuredName,
        commission_amount: grossAmount,
        raw_row: rawRow,
      });
    }
  }
  
  console.log('[PARSER] Parsed rows:', rows.length);
  console.log('[PARSER] Sample row:', rows[0]);
  
  return rows;
}

/**
 * Extract data from PDF using OCR (stub for now)
 * TODO: Integrate with actual Vision API
 */
export async function extractPdfWithVision(file: File): Promise<ParsedRow[]> {
  // Stub implementation - simulates OCR extraction
  console.log('TODO: Integrate Vision API for PDF extraction');
  
  // For now, return sample data to allow flow testing
  return [
    {
      policy_number: 'PDF-001',
      client_name: 'PDF Test Client', // Corrected property
      commission_amount: 1000, // Corrected property
      raw_row: {
        source: 'pdf',
        filename: file.name,
        note: 'Extracted via OCR (stub)',
      },
    },
  ];
}

/**
 * Insert import and items into database
 */
export async function upsertImport(
  insurerId: string,
  periodLabel: string,
  rows: ParsedRow[],
  userId: string
): Promise<{ importId: string; insertedCount: number }> {
  const supabase = getSupabaseAdmin();
  
  // Create import record
  const { data: importData, error: importError } = await supabase
    .from('comm_imports')
    .insert([{
      insurer_id: insurerId,
      period_label: periodLabel,
      uploaded_by: userId,
    } satisfies CommImportIns])
    .select()
    .single<CommImportRow>();
  
  if (importError || !importData) {
    throw new Error(`Error creating import: ${importError?.message || 'Unknown error'}`);
  }
  
  // Prepare items for insertion
  const items: CommItemIns[] = rows.map(row => ({
    import_id: importData.id,
    policy_number: row.policy_number || 'UNKNOWN',
    insured_name: row.client_name || undefined, // Corrected property
    gross_amount: row.commission_amount, // Corrected property
    insurer_id: insurerId,
    broker_id: undefined, // Initially unassigned
    raw_row: row.raw_row,
  }));
  
  // Insert items
  const { data: itemsData, error: itemsError } = await supabase
    .from('comm_items')
    .insert(items);
  
  if (itemsError) {
    // Rollback import on error
    await supabase.from('comm_imports').delete().eq('id', importData.id);
    throw new Error(`Error creating items: ${itemsError.message}`);
  }
  
  return {
    importId: importData.id,
    insertedCount: items.length,
  };
}
