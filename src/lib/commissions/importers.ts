import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Tables, TablesInsert } from '@/lib/supabase/server';
import type { ParsedRow } from './schemas';
import * as XLSX from 'xlsx';
import { previewMapping } from '@/lib/db/insurers';
import { parseSuraExcel } from '@/lib/parsers/sura-parser';
import { getInsurerSlug } from '@/lib/utils/policy-number';

type CommImportRow = Tables<'comm_imports'>;
type CommItemRow = Tables<'comm_items'>;
type CommImportIns = TablesInsert<'comm_imports'>;
type CommItemIns = TablesInsert<'comm_items'>;

interface MappingRule {
  target_field: string;
  aliases: any;
  commission_column_2_aliases?: any;
  commission_column_3_aliases?: any;
}

/**
 * Parse XLSX file using previewMapping for consistent logic
 */
async function parseXlsxFile(file: File, mappingRules: MappingRule[] = [], invertNegatives: boolean = false, useMultiColumns: boolean = false, insurerId?: string): Promise<ParsedRow[]> {
  
  // PARSER ESPECIAL PARA SURA (formato multi-tabla complejo)
  if (insurerId) {
    const supabase = getSupabaseAdmin();
    const { data: insurer } = await supabase
      .from('insurers')
      .select('name')
      .eq('id', insurerId)
      .single();

    const insurerSlug = getInsurerSlug(String((insurer as any)?.name || ''));
    
    if (insurer?.name?.toUpperCase().includes('SURA')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const suraRows = parseSuraExcel(arrayBuffer);
        
        console.log('[SURA PARSER] Extraídas', suraRows.length, 'filas');
        
        return suraRows.map(row => ({
          policy_number: row.policy_number,
          client_name: row.client_name,
          commission_amount: row.gross_amount,
          raw_row: row
        }));
      } catch (error) {
        console.error('[SURA PARSER] Error:', error);
        throw new Error('Error al parsear archivo de SURA: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA WW MEDICAL
    if (insurerSlug === 'ww-medical') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[WW MEDICAL] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[WW MEDICAL] PDF detectado - Usando parser directo de PDF');
          const { parseWWMedicalPDF } = await import('@/lib/parsers/ww-medical-parser');
          const wwRows = await parseWWMedicalPDF(arrayBuffer);

          console.log('[WW MEDICAL PARSER] Extraídas', wwRows.length, 'filas');

          return wwRows.map(row => ({
            policy_number: row.policy_number,
            client_name: row.client_name,
            commission_amount: row.gross_amount,
            raw_row: row
          }));
        }
      } catch (error) {
        console.error('[WW MEDICAL PARSER] Error:', error);
        throw new Error('Error al parsear archivo de WW MEDICAL: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA UNIVIVIR
    if (insurer?.name?.toUpperCase().includes('UNIVIVIR')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[UNIVIVIR] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[UNIVIVIR] PDF detectado - Usando parser directo de PDF');
          const { parseUniVivirPDF } = await import('@/lib/parsers/univivir-parser');
          const univivirRows = await parseUniVivirPDF(arrayBuffer);

          console.log('[UNIVIVIR PARSER] Extraídas', univivirRows.length, 'filas');

          return univivirRows.map(row => {
            let amount = row.gross_amount;
            
            // Aplicar inversión de signos si está configurado
            if (invertNegatives) {
              console.log(`[UNIVIVIR] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
              amount = amount * -1;
            }
            
            return {
              policy_number: row.policy_number,
              client_name: row.client_name,
              commission_amount: amount,
              raw_row: row
            };
          });
        }
      } catch (error) {
        console.error('[UNIVIVIR PARSER] Error:', error);
        throw new Error('Error al parsear archivo de UNIVIVIR: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }
    
    // PARSER ESPECIAL PARA BANESCO (PDF o Excel con columnas mezcladas)
    if (insurer?.name?.toUpperCase().includes('BANESCO')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();
        let banescoRows: any[] = [];
        
        // Si es PDF, usar parser directo de PDF
        if (fileExtension === 'pdf') {
          console.log('[BANESCO] PDF detectado - Usando parser directo de PDF');
          const { parseBanescoPDF } = await import('@/lib/parsers/banesco-parser');
          banescoRows = await parseBanescoPDF(arrayBuffer);
        } else {
          // Si es XLSX, usar parser de Excel
          console.log('[BANESCO] XLSX detectado - Usando parser de Excel');
          const { parseBanescoExcel } = await import('@/lib/parsers/banesco-parser');
          banescoRows = parseBanescoExcel(arrayBuffer);
        }
        
        console.log('[BANESCO PARSER] Extraídas', banescoRows.length, 'filas');
        
        return banescoRows.map(row => {
          let amount = row.gross_amount;
          
          // Aplicar inversión de signos si está configurado
          if (invertNegatives) {
            console.log(`[BANESCO] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
            amount = amount * -1;
          }
          
          return {
            policy_number: row.policy_number,
            client_name: row.client_name,
            commission_amount: amount,
            raw_row: row
          };
        });
      } catch (error) {
        console.error('[BANESCO PARSER] Error:', error);
        throw new Error('Error al parsear archivo de BANESCO: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }
    
    // PARSER ESPECIAL PARA MERCANTIL (similar a BANESCO)
    if (insurer?.name?.toUpperCase().includes('MERCANTIL')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();
        let mercantilRows: any[] = [];
        
        // Si es PDF, usar parser directo de PDF
        if (fileExtension === 'pdf') {
          console.log('[MERCANTIL] PDF detectado - Usando parser directo de PDF');
          const { parseMercantilPDF } = await import('@/lib/parsers/mercantil-parser');
          mercantilRows = await parseMercantilPDF(arrayBuffer);
        } else {
          // Si es XLSX, usar parser de Excel
          console.log('[MERCANTIL] XLSX detectado - Usando parser de Excel');
          const { parseMercantilExcel } = await import('@/lib/parsers/mercantil-parser');
          mercantilRows = parseMercantilExcel(arrayBuffer);
        }
        
        console.log('[MERCANTIL PARSER] Extraídas', mercantilRows.length, 'filas');
        
        return mercantilRows.map(row => {
          let amount = row.gross_amount;
          
          // Aplicar inversión de signos si está configurado
          if (invertNegatives) {
            console.log(`[MERCANTIL] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
            amount = amount * -1;
          }
          
          return {
            policy_number: row.policy_number,
            client_name: row.client_name,
            commission_amount: amount,
            raw_row: row
          };
        });
      } catch (error) {
        console.error('[MERCANTIL PARSER] Error:', error);
        throw new Error('Error al parsear archivo de MERCANTIL: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA REGIONAL
    if (insurer?.name?.toUpperCase().includes('REGIONAL')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[REGIONAL] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[REGIONAL] PDF detectado - Usando parser directo de PDF');
          const { parseRegionalPDF } = await import('@/lib/parsers/regional-parser');
          const regionalRows = await parseRegionalPDF(arrayBuffer);

          console.log('[REGIONAL PARSER] Extraídas', regionalRows.length, 'filas');

          return regionalRows.map(row => {
            let amount = row.gross_amount;
            
            // Aplicar inversión de signos si está configurado
            if (invertNegatives) {
              console.log(`[REGIONAL] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
              amount = amount * -1;
            }
            
            return {
              policy_number: row.policy_number,
              client_name: row.client_name,
              commission_amount: amount,
              raw_row: row
            };
          });
        }
      } catch (error) {
        console.error('[REGIONAL PARSER] Error:', error);
        throw new Error('Error al parsear archivo de REGIONAL: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA ACERTA
    if (insurer?.name?.toUpperCase().includes('ACERTA')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[ACERTA] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[ACERTA] PDF detectado - Usando parser directo de PDF');
          const { parseAcertaPDF } = await import('@/lib/parsers/acerta-parser');
          const acertaRows = await parseAcertaPDF(arrayBuffer);

          console.log('[ACERTA PARSER] Extraídas', acertaRows.length, 'filas');

          return acertaRows.map(row => {
            let amount = row.gross_amount;
            
            // Aplicar inversión de signos si está configurado
            if (invertNegatives) {
              console.log(`[ACERTA] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
              amount = amount * -1;
            }
            
            return {
              policy_number: row.policy_number,
              client_name: row.client_name,
              commission_amount: amount,
              raw_row: row
            };
          });
        }
      } catch (error) {
        console.error('[ACERTA PARSER] Error:', error);
        throw new Error('Error al parsear archivo de ACERTA: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA GENERAL
    if (insurer?.name?.toUpperCase().includes('GENERAL')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[GENERAL] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[GENERAL] PDF detectado - Usando parser directo de PDF');
          const { parseGeneralPDF } = await import('@/lib/parsers/general-parser');
          const generalRows = await parseGeneralPDF(arrayBuffer);

          console.log('[GENERAL PARSER] Extraídas', generalRows.length, 'filas');

          return generalRows.map(row => {
            let amount = row.gross_amount;
            
            // Aplicar inversión de signos si está configurado
            if (invertNegatives) {
              console.log(`[GENERAL] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
              amount = amount * -1;
            }
            
            return {
              policy_number: row.policy_number,
              client_name: row.client_name,
              commission_amount: amount,
              raw_row: row
            };
          });
        }
      } catch (error) {
        console.error('[GENERAL PARSER] Error:', error);
        throw new Error('Error al parsear archivo de GENERAL: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA OPTIMA
    if (insurer?.name?.toUpperCase().includes('OPTIMA')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[OPTIMA] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[OPTIMA] PDF detectado - Usando parser directo de PDF');
          const { parseOptimaPDF } = await import('@/lib/parsers/optima-parser');
          const optimaRows = await parseOptimaPDF(arrayBuffer);

          console.log('[OPTIMA PARSER] Extraídas', optimaRows.length, 'filas');

          return optimaRows.map(row => {
            let amount = row.gross_amount;
            
            // Aplicar inversión de signos si está configurado
            if (invertNegatives) {
              console.log(`[OPTIMA] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
              amount = amount * -1;
            }
            
            return {
              policy_number: row.policy_number,
              client_name: row.client_name,
              commission_amount: amount,
              raw_row: row
            };
          });
        }
      } catch (error) {
        console.error('[OPTIMA PARSER] Error:', error);
        throw new Error('Error al parsear archivo de OPTIMA: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA MB (MAPFRE BANCO)
    if (insurer?.name?.toUpperCase() === 'MB' || insurer?.name?.toUpperCase().includes('MAPFRE BANCO')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[MB] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[MB] PDF detectado - Usando parser directo de PDF');
          const { parseMBPDF } = await import('@/lib/parsers/mb-parser');
          const mbRows = await parseMBPDF(arrayBuffer);

          console.log('[MB PARSER] Extraídas', mbRows.length, 'filas');

          return mbRows.map(row => {
            let amount = row.gross_amount;
            
            // Aplicar inversión de signos si está configurado
            if (invertNegatives) {
              console.log(`[MB] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
              amount = amount * -1;
            }
            
            return {
              policy_number: row.policy_number,
              client_name: row.client_name,
              commission_amount: amount,
              raw_row: row
            };
          });
        }
      } catch (error) {
        console.error('[MB PARSER] Error:', error);
        throw new Error('Error al parsear archivo de MB: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA ALIADO
    if (insurer?.name?.toUpperCase() === 'ALIADO' || insurer?.name?.toUpperCase().includes('ALIADO')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[ALIADO] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[ALIADO] PDF detectado - Usando parser directo de PDF');
          const { parseAliadoPDF } = await import('@/lib/parsers/aliado-parser');
          const aliadoRows = await parseAliadoPDF(arrayBuffer);

          console.log('[ALIADO PARSER] Extraídas', aliadoRows.length, 'filas');

          return aliadoRows.map(row => {
            let amount = row.gross_amount;
            
            // Aplicar inversión de signos si está configurado
            if (invertNegatives) {
              console.log(`[ALIADO] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
              amount = amount * -1;
            }
            
            return {
              policy_number: row.policy_number,
              client_name: row.client_name,
              commission_amount: amount,
              raw_row: row
            };
          });
        }
      } catch (error) {
        console.error('[ALIADO PARSER] Error:', error);
        throw new Error('Error al parsear archivo de ALIADO: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA PALIG (PAN AMERICAN LIFE)
    if (insurer?.name?.toUpperCase() === 'PALIG' || insurer?.name?.toUpperCase().includes('PAN AMERICAN')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[PALIG] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[PALIG] PDF detectado - Usando parser directo de PDF');
          const { parsePaligPDF } = await import('@/lib/parsers/palig-parser');
          const paligRows = await parsePaligPDF(arrayBuffer);

          console.log('[PALIG PARSER] Extraídas', paligRows.length, 'filas');

          return paligRows.map(row => {
            let amount = row.gross_amount;
            
            // Aplicar inversión de signos si está configurado
            if (invertNegatives) {
              console.log(`[PALIG] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
              amount = amount * -1;
            }
            
            return {
              policy_number: row.policy_number,
              client_name: row.client_name,
              commission_amount: amount,
              raw_row: row
            };
          });
        }
      } catch (error) {
        console.error('[PALIG PARSER] Error:', error);
        throw new Error('Error al parsear archivo de PALIG: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }

    // PARSER ESPECIAL PARA VUMI (LA REGIONAL)
    if (insurer?.name?.toUpperCase() === 'VUMI' || insurer?.name?.toUpperCase().includes('REGIONAL')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileExtension = file.name.toLowerCase().split('.').pop();

        if (fileExtension !== 'pdf') {
          console.log('[VUMI] Archivo no PDF - usando previewMapping/manual');
        } else {
          console.log('[VUMI] PDF detectado - Usando parser directo de PDF');
          const { parseVumiPDF } = await import('@/lib/parsers/vumi-parser');
          const vumiRows = await parseVumiPDF(arrayBuffer);

          console.log('[VUMI PARSER] Extraídas', vumiRows.length, 'filas');

          return vumiRows.map(row => {
            let amount = row.gross_amount;
            
            // Aplicar inversión de signos si está configurado
            if (invertNegatives) {
              console.log(`[VUMI] 🔄 INVIRTIENDO SIGNO: ${amount} → ${amount * -1}`);
              amount = amount * -1;
            }
            
            return {
              policy_number: row.policy_number,
              client_name: row.client_name,
              commission_amount: amount,
              raw_row: row
            };
          });
        }
      } catch (error) {
        console.error('[VUMI PARSER] Error:', error);
        throw new Error('Error al parsear archivo de VUMI: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    }
  }
  
  // Si tenemos insurerId (y NO es SURA), usar previewMapping para consistencia
  if (insurerId) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      const result = await previewMapping({
        targetField: 'COMMISSIONS',
        insurerId,
        fileBuffer: arrayBuffer,
        fileName: file.name
      });
      
      if (!result.success || !result.previewRows) {
        // Caer al método manual
      } else {
        
        // Convertir previewRows a ParsedRow[]
        const rows: ParsedRow[] = [];
        for (const row of result.previewRows) {
          const policyNum = row.policy_number?.toString().trim() || '';
          const clientName = row.client_name?.toString().trim() || '';
          
          // Validar que policy_number sea válido
          const isValidPolicy = policyNum && 
                               policyNum !== '--' && 
                               policyNum !== 'undefined' &&
                               !policyNum.includes('#') &&
                               policyNum.length > 0;
          
          // Validar que client_name no sea texto descriptivo
          const invalidTexts = ['AGO DE', 'MES DE', 'DETALLE', 'TOTAL', 'OP-', 'COMISION AL'];
          const isValidClient = clientName && 
                               !invalidTexts.some(text => clientName.toUpperCase().includes(text));
          
          if (isValidPolicy && isValidClient && row.gross_amount !== 0) {
            let finalAmount = row.gross_amount || 0;
            
            // Aplicar inversión si está configurado
            if (invertNegatives) {
              console.log(`🔄 INVIRTIENDO SIGNO: ${finalAmount} → ${finalAmount * -1}`);
              finalAmount = finalAmount * -1;
            } else {
              console.log(`❌ NO INVERTIR (invertNegatives=${invertNegatives}): ${finalAmount}`);
            }
            
            rows.push({
              policy_number: policyNum,
              client_name: clientName || null,
              commission_amount: finalAmount,
              raw_row: row,
            });
          }
        }
        
        return rows;
      }
    } catch (error) {
      // Fallback silencioso
    }
  }
  
  // Fallback: método manual (código original)
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (jsonData.length === 0) return [];
  
  // First row is headers
  const firstRow = jsonData[0];
  if (!firstRow) return [];
  
  const headers = firstRow.map((h: any) => String(h || '').trim());
  
  // Use mapping rules if available, otherwise use default detection
  let policyIndex = -1;
  let insuredIndex = -1;
  let amountIndex = -1;
  let amount2Index = -1; // ASSA: Vida 1er año
  let amount3Index = -1; // ASSA: Vida renovación
  
  if (mappingRules && mappingRules.length > 0) {
    // Use configured mapping
    for (const rule of mappingRules) {
      const aliases = Array.isArray(rule.aliases) ? rule.aliases : [];
      const aliases2 = Array.isArray(rule.commission_column_2_aliases) ? rule.commission_column_2_aliases : [];
      const aliases3 = Array.isArray(rule.commission_column_3_aliases) ? rule.commission_column_3_aliases : [];
      
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (!header) continue;
        
        // Primera columna de comisión
        if (aliases.some((alias: string) => header.toLowerCase().includes(alias.toLowerCase()))) {
          if (rule.target_field === 'policy') policyIndex = i;
          if (rule.target_field === 'insured') insuredIndex = i;
          if (rule.target_field === 'commission') amountIndex = i;
        }
        
        // Segunda columna (ASSA: Vida 1er año)
        if (useMultiColumns && aliases2.length > 0 && aliases2.some((alias: string) => header.toLowerCase().includes(alias.toLowerCase()))) {
          amount2Index = i;
        }
        
        // Tercera columna (ASSA: Vida renovación)
        if (useMultiColumns && aliases3.length > 0 && aliases3.some((alias: string) => header.toLowerCase().includes(alias.toLowerCase()))) {
          amount3Index = i;
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
  
  console.log('[PARSER] Column mapping:', { policyIndex, insuredIndex, amountIndex, amount2Index, amount3Index });
  console.log('[PARSER] Mapped columns:', {
    policy: policyIndex >= 0 ? headers[policyIndex] : 'NOT FOUND',
    insured: insuredIndex >= 0 ? headers[insuredIndex] : 'NOT FOUND',
    amount: amountIndex >= 0 ? headers[amountIndex] : 'NOT FOUND',
    amount2: amount2Index >= 0 ? headers[amount2Index] : 'NOT USED',
    amount3: amount3Index >= 0 ? headers[amount3Index] : 'NOT USED'
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
    
    // Parse amount - Sum multiple columns if ASSA (useMultiColumns = true)
    let grossAmount = 0;
    
    // Columna 1 (principal)
    if (amountIndex >= 0 && values[amountIndex]) {
      const amountValue = values[amountIndex];
      if (typeof amountValue === 'number') {
        grossAmount += amountValue;
      } else {
        const amountStr = String(amountValue).replace(/[$,]/g, '').trim();
        const parsed = parseFloat(amountStr);
        grossAmount += isNaN(parsed) ? 0 : parsed;
      }
    }
    
    // Columna 2 (ASSA: Vida 1er año)
    if (useMultiColumns && amount2Index >= 0 && values[amount2Index]) {
      const amountValue = values[amount2Index];
      if (typeof amountValue === 'number') {
        grossAmount += amountValue;
      } else {
        const amountStr = String(amountValue).replace(/[$,]/g, '').trim();
        const parsed = parseFloat(amountStr);
        grossAmount += isNaN(parsed) ? 0 : parsed;
      }
    }
    
    // Columna 3 (ASSA: Vida renovación)
    if (useMultiColumns && amount3Index >= 0 && values[amount3Index]) {
      const amountValue = values[amount3Index];
      if (typeof amountValue === 'number') {
        grossAmount += amountValue;
      } else {
        const amountStr = String(amountValue).replace(/[$,]/g, '').trim();
        const parsed = parseFloat(amountStr);
        grossAmount += isNaN(parsed) ? 0 : parsed;
      }
    }
    
    // Invert sign if configured
    if (invertNegatives) {
      console.log(`🔄 INVIRTIENDO SIGNO: ${grossAmount} → ${grossAmount * -1}`);
      grossAmount = grossAmount * -1;
    } else {
      console.log(`❌ NO INVERTIR (invertNegatives=${invertNegatives}): ${grossAmount}`);
    }
    
    // Excluir rows con 0.00 (excepto si viene de ASSA que puede tener códigos especiales)
    // Solo agregar si tiene policy_number Y amount diferente de 0
    if (policyNumber && grossAmount !== 0) {
      rows.push({
        policy_number: policyNumber,
        client_name: insuredName,
        commission_amount: grossAmount,
        raw_row: rawRow,
      });
    }
  }
  
  return rows;
}

/**
 * Parse CSV or XLSX file into rows
 */
export async function parseCsvXlsx(file: File, mappingRules: MappingRule[] = [], invertNegatives: boolean = false, useMultiColumns: boolean = false, insurerId?: string): Promise<ParsedRow[]> {
  console.log('[PARSER] Starting to parse file:', file.name);
  console.log('[PARSER] Use multi columns (ASSA):', useMultiColumns);
  console.log('[PARSER] Insurer ID:', insurerId);

  if (insurerId) {
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(fileExtension || '');
    const isPdf = fileExtension === 'pdf';

    const supabase = getSupabaseAdmin();
    const { data: insurer } = await supabase
      .from('insurers')
      .select('name')
      .eq('id', insurerId)
      .single();

    const insurerSlug = getInsurerSlug(String((insurer as any)?.name || ''));

    if (insurerSlug === 'assistcard' && isImage) {
      console.log('[PARSER] Detectado ASSISTCARD (imagen) - Usando parser especial');
      const arrayBuffer = await file.arrayBuffer();
      const { parseAssistcardImage } = await import('@/lib/parsers/assistcard-parser');
      const parsed = await parseAssistcardImage(arrayBuffer, file.name);

      return parsed.map(r => ({
        policy_number: r.policy_number,
        client_name: r.client_name,
        commission_amount: r.gross_amount,
        raw_row: r,
      }));
    }

    if (insurerSlug === 'ifs' && isPdf) {
      console.log('[PARSER] Detectado IFS (PDF) - Usando parser especial');
      const arrayBuffer = await file.arrayBuffer();
      const { parseIFSPDF } = await import('@/lib/parsers/ifs-parser');
      const parsed = await parseIFSPDF(arrayBuffer);

      const missingPolicies = Array.from(
        new Set(
          parsed
            .filter(r => !r.client_name)
            .map(r => r.policy_number)
            .filter(Boolean)
        )
      );

      const policyToClient = new Map<string, string>();
      if (missingPolicies.length > 0) {
        const { data: policyRows } = await supabase
          .from('policies')
          .select('policy_number, clients(name)')
          .in('policy_number', missingPolicies);

        (policyRows || []).forEach((p: any) => {
          const pn = String(p?.policy_number || '');
          const cn = String(p?.clients?.name || '');
          if (pn && cn) policyToClient.set(pn, cn);
        });
      }

      return parsed.map(r => ({
        policy_number: r.policy_number,
        client_name: r.client_name || policyToClient.get(r.policy_number) || null,
        commission_amount: r.gross_amount,
        raw_row: r,
      }));
    }
  }
  
  // Check if it's XLSX or PDF (PDF parsers are in parseXlsxFile)
  const fileExtension = file.name.toLowerCase().split('.').pop();
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || fileExtension === 'pdf') {
    console.log(`[PARSER] Detectado archivo ${fileExtension?.toUpperCase()} - Usando parseXlsxFile con parsers personalizados`);
    return parseXlsxFile(file, mappingRules, invertNegatives, useMultiColumns, insurerId);
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
export async function insertCommissionBatch(
  fortnightId: string,
  importData: CommImportRow,
  items: ParsedRow[],
  bankGroupIds: string[] = []
): Promise<{ importId: string; insertedCount: number }> {
  const supabase = getSupabaseAdmin();
  
  // Prepare items for insertion
  const commItems: CommItemIns[] = items.map(row => ({
    import_id: importData.id,
    policy_number: row.policy_number || 'UNKNOWN',
    insured_name: row.client_name || undefined,
    gross_amount: row.commission_amount,
    insurer_id: importData.insurer_id,
    broker_id: undefined,
    raw_row: row.raw_row,
  }));
  
  // Insert items
  const { data: itemsData, error: itemsError } = await supabase
    .from('comm_items')
    .insert(commItems);
  
  if (itemsError) {
    // Rollback import on error
    await supabase.from('comm_imports').delete().eq('id', importData.id);
    throw new Error(`Error creating items: ${itemsError.message}`);
  }
  
  // Link BANCO groups with comm_imports after successful import
  if (bankGroupIds.length > 0) {
    console.log(`[BANCO] Vinculando ${bankGroupIds.length} grupos bancarios con import ${importData.id}`);
    
    for (const groupId of bankGroupIds) {
      // Obtener total del grupo
      const { data: groupData } = await supabase
        .from('bank_groups')
        .select('total_amount')
        .eq('id', groupId)
        .single();

      if (groupData) {
        await supabase
          .from('bank_group_imports')
          .insert({
            group_id: groupId,
            import_id: importData.id,
            amount_assigned: groupData.total_amount || 0,
          });
        
        console.log(`[BANCO] Grupo ${groupId} vinculado con monto $${groupData.total_amount}`);
      }
    }
  }

  return {
    importId: importData.id,
    insertedCount: commItems.length,
  };
}
