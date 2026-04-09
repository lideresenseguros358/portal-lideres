/**
 * Server-side Expediente Storage
 * Saves documents to Supabase Storage + expediente_documents table
 * using the admin client (no auth required).
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';

const BUCKET_NAME = 'expediente';

interface SaveDocumentParams {
  clientId: string;
  policyId: string | null;
  documentType: 'cedula' | 'licencia' | 'registro_vehicular' | 'carta_autorizacion' | 'debida_diligencia' | 'otros';
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
  notes?: string;
  documentName?: string;
}

/**
 * Save a single document to Supabase Storage + expediente_documents table
 */
async function saveDocument(params: SaveDocumentParams): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const timestamp = Date.now();
  const sanitizedFileName = params.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

  console.log(`[Expediente Server] saveDocument: type=${params.documentType}, clientId=${params.clientId}, policyId=${params.policyId}, fileName=${params.fileName}, size=${params.fileBuffer.length}, mime=${params.mimeType}, documentName=${params.documentName || 'null'}`);

  // Build storage path
  let filePath: string;
  // Policy-level document types (stored under policy folder)
  const policyLevelTypes = ['registro_vehicular', 'carta_autorizacion', 'debida_diligencia', 'otros'];
  if (params.policyId && policyLevelTypes.includes(params.documentType)) {
    filePath = `clients/${params.clientId}/policies/${params.policyId}/${params.documentType}/${timestamp}_${sanitizedFileName}`;
  } else {
    filePath = `clients/${params.clientId}/${params.documentType}/${timestamp}_${sanitizedFileName}`;
  }

  console.log(`[Expediente Server] Uploading to: ${filePath}`);

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, params.fileBuffer, {
      contentType: params.mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error(`[Expediente Server] ❌ Storage upload FAILED for ${params.documentType}:`, uploadError.message, JSON.stringify(uploadError));
    return { ok: false, error: `Storage upload: ${uploadError.message}` };
  }

  console.log(`[Expediente Server] ✅ Storage upload OK for ${params.documentType}`);

  // Create database record
  const insertPayload = {
    client_id: params.clientId,
    policy_id: params.policyId,
    document_type: params.documentType,
    document_name: params.documentName || null,
    file_path: filePath,
    file_name: params.fileName,
    file_size: params.fileBuffer.length,
    mime_type: params.mimeType,
    uploaded_by: null, // Server-side upload, no user context
    notes: params.notes || null,
  };

  console.log(`[Expediente Server] Inserting DB record:`, JSON.stringify(insertPayload));

  const { error: dbError } = await supabase
    .from('expediente_documents')
    .insert(insertPayload);

  if (dbError) {
    // Rollback: delete uploaded file
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    console.error(`[Expediente Server] ❌ DB insert FAILED for ${params.documentType}:`, dbError.message, 'code:', dbError.code, 'details:', dbError.details, 'hint:', dbError.hint);
    return { ok: false, error: `DB insert: ${dbError.message}` };
  }

  console.log(`[Expediente Server] ✅ DB insert OK for ${params.documentType}`);
  return { ok: true };
}

/**
 * Save all emission documents to the client's expediente.
 * Called from send-expediente after successful emission.
 * 
 * Documents saved:
 * - Cédula (client-level)
 * - Licencia (client-level)
 * - Registro vehicular (policy-level)
 * - Carta de autorización (policy-level)
 * 
 * Inspection photos are NOT saved (those are for the insurer only).
 */
/**
 * Check if a client already has a specific document type uploaded.
 */
async function clientHasDocument(clientId: string, documentType: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('expediente_documents')
    .select('id')
    .eq('client_id', clientId)
    .eq('document_type', documentType)
    .is('policy_id', null)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function guardarDocumentosExpediente(params: {
  clientId: string;
  policyId: string;
  cedula?: { buffer: Buffer; fileName: string; mimeType: string };
  licencia?: { buffer: Buffer; fileName: string; mimeType: string };
  registroVehicular?: { buffer: Buffer; fileName: string; mimeType: string };
  cartaAutorizacion?: { buffer: Buffer; fileName: string; mimeType: string };
  polizaPdf?: { buffer: Buffer; fileName: string; mimeType: string };
  nroPoliza?: string;
}): Promise<{ ok: boolean; saved: string[]; errors: string[]; skipped: string[] }> {
  const saved: string[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];

  console.log('[Expediente Server] Guardando documentos para clientId:', params.clientId, 'policyId:', params.policyId);
  console.log('[Expediente Server] Docs recibidos:', {
    cedula: params.cedula ? `${params.cedula.fileName} (${params.cedula.buffer.length}b)` : 'NO',
    licencia: params.licencia ? `${params.licencia.fileName} (${params.licencia.buffer.length}b)` : 'NO',
    registroVehicular: params.registroVehicular ? `${params.registroVehicular.fileName} (${params.registroVehicular.buffer.length}b)` : 'NO',
    cartaAutorizacion: params.cartaAutorizacion ? `${params.cartaAutorizacion.fileName} (${params.cartaAutorizacion.buffer.length}b)` : 'NO',
    polizaPdf: params.polizaPdf ? `${params.polizaPdf.fileName} (${params.polizaPdf.buffer.length}b)` : 'NO',
  });

  // ── Cédula (client-level): skip if client already has one ──
  if (params.cedula) {
    const alreadyExists = await clientHasDocument(params.clientId, 'cedula');
    if (alreadyExists) {
      console.log('[Expediente Server] Cliente ya tiene cédula, omitiendo');
      skipped.push('cedula');
    } else {
      const result = await saveDocument({
        clientId: params.clientId,
        policyId: null,
        documentType: 'cedula',
        fileName: params.cedula.fileName,
        fileBuffer: params.cedula.buffer,
        mimeType: params.cedula.mimeType,
      });
      if (result.ok) saved.push('cedula');
      else errors.push(`cedula: ${result.error}`);
    }
  }

  // ── Licencia (client-level): skip if client already has one ──
  if (params.licencia) {
    const alreadyExists = await clientHasDocument(params.clientId, 'licencia');
    if (alreadyExists) {
      console.log('[Expediente Server] Cliente ya tiene licencia, omitiendo');
      skipped.push('licencia');
    } else {
      const result = await saveDocument({
        clientId: params.clientId,
        policyId: null,
        documentType: 'licencia',
        fileName: params.licencia.fileName,
        fileBuffer: params.licencia.buffer,
        mimeType: params.licencia.mimeType,
      });
      if (result.ok) saved.push('licencia');
      else errors.push(`licencia: ${result.error}`);
    }
  }

  // ── Registro vehicular (policy-level): always save — each policy has its own ──
  if (params.registroVehicular) {
    const result = await saveDocument({
      clientId: params.clientId,
      policyId: params.policyId,
      documentType: 'registro_vehicular',
      fileName: params.registroVehicular.fileName,
      fileBuffer: params.registroVehicular.buffer,
      mimeType: params.registroVehicular.mimeType,
    });
    if (result.ok) saved.push('registro_vehicular');
    else errors.push(`registro_vehicular: ${result.error}`);
  }

  // ── Debida diligencia / carta de autorización (policy-level): always save ──
  if (params.cartaAutorizacion) {
    const result = await saveDocument({
      clientId: params.clientId,
      policyId: params.policyId,
      documentType: 'debida_diligencia',
      documentName: `Debida Diligencia${params.nroPoliza ? ` - Póliza ${params.nroPoliza}` : ''}`,
      fileName: params.cartaAutorizacion.fileName,
      fileBuffer: params.cartaAutorizacion.buffer,
      mimeType: params.cartaAutorizacion.mimeType,
      notes: 'Autorización, Declaración de Veracidad y Términos y Condiciones firmados digitalmente durante la emisión.',
    });
    if (result.ok) saved.push('debida_diligencia');
    else errors.push(`debida_diligencia: ${result.error}`);
  }

  // ── Carátula de póliza (policy-level): always save ──
  if (params.polizaPdf) {
    const result = await saveDocument({
      clientId: params.clientId,
      policyId: params.policyId,
      documentType: 'otros',
      documentName: `Carátula de Póliza${params.nroPoliza ? ` - ${params.nroPoliza}` : ''}`,
      fileName: params.polizaPdf.fileName,
      fileBuffer: params.polizaPdf.buffer,
      mimeType: params.polizaPdf.mimeType,
      notes: 'Documento oficial de póliza emitido por la aseguradora.',
    });
    if (result.ok) saved.push('poliza_pdf');
    else errors.push(`poliza_pdf: ${result.error}`);
  }

  console.log(`[Expediente Server] Resultado: ${saved.length} guardados, ${skipped.length} omitidos (ya existen), ${errors.length} errores`, { saved, skipped, errors });
  return { ok: errors.length === 0, saved, errors, skipped };
}

// ─────────────────────────────────────────────────────────────
// ANCON Carátula helpers
// The expediente bucket only accepts PDF/image MIME types, so HTML
// is stored in the ancon_caratulas DB table instead of Storage.
// ─────────────────────────────────────────────────────────────

/**
 * Return cached raw HTML for an ANCON policy carátula, or null on miss.
 * Reads from the ancon_caratulas DB table (not Supabase Storage).
 */
export async function findAnconCaratula(polizaNumber: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('ancon_caratulas')
    .select('html_content')
    .eq('poliza_number', polizaNumber)
    .limit(1)
    .maybeSingle();
  return data?.html_content ?? null;
}

/**
 * Upsert raw HTML for an ANCON carátula into the ancon_caratulas DB table.
 * Also creates an expediente_documents record (type=otros) so the carátula
 * appears in the expediente viewer linked to the correct policy.
 */
export async function saveAnconCaratula(
  polizaNumber: string,
  rawHtml: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  // Resolve policy + client
  const { data: policy } = await supabase
    .from('policies')
    .select('id, client_id')
    .eq('policy_number', polizaNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!policy) {
    return { ok: false, error: `Policy not found for poliza: ${polizaNumber}` };
  }

  // Upsert HTML into ancon_caratulas
  const { error: upsertErr } = await supabase
    .from('ancon_caratulas')
    .upsert(
      { poliza_number: polizaNumber, policy_id: policy.id, html_content: rawHtml },
      { onConflict: 'poliza_number' }
    );

  if (upsertErr) {
    return { ok: false, error: `DB upsert: ${upsertErr.message}` };
  }

  console.log(`[Expediente ANCON] ✅ Carátula HTML guardada en ancon_caratulas para póliza ${polizaNumber}`);

  // Create expediente_documents record so carátula appears in the expediente viewer
  const { data: existing } = await supabase
    .from('expediente_documents')
    .select('id')
    .eq('policy_id', policy.id)
    .eq('document_type', 'otros')
    .ilike('document_name', 'Carátula de Póliza%')
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const sanitizedPoliza = polizaNumber.replace(/[^a-zA-Z0-9.-]/g, '_');
    // file_path uses a sentinel prefix — not a real Storage path.
    // The carátula route serves the content directly from ancon_caratulas.
    await supabase.from('expediente_documents').insert({
      client_id: policy.client_id,
      policy_id: policy.id,
      document_type: 'otros',
      document_name: `Carátula de Póliza - ${polizaNumber}`,
      file_path: `ancon-caratula-db:${sanitizedPoliza}`,
      file_name: `caratula_ancon_${sanitizedPoliza}.html`,
      file_size: rawHtml.length,
      mime_type: 'text/html',
      notes: 'Carátula HTML de póliza ANCON. Ver en /api/ancon/caratula?poliza=...',
      uploaded_by: null,
    });
  }

  return { ok: true };
}
