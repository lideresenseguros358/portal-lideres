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
  documentType: 'cedula' | 'licencia' | 'registro_vehicular' | 'carta_autorizacion' | 'otros';
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

  // Build storage path
  let filePath: string;
  if (params.documentType === 'registro_vehicular' && params.policyId) {
    filePath = `clients/${params.clientId}/policies/${params.policyId}/${params.documentType}/${timestamp}_${sanitizedFileName}`;
  } else if (params.policyId && (params.documentType === 'carta_autorizacion' || params.documentType === 'otros')) {
    filePath = `clients/${params.clientId}/policies/${params.policyId}/${params.documentType}/${timestamp}_${sanitizedFileName}`;
  } else {
    filePath = `clients/${params.clientId}/${params.documentType}/${timestamp}_${sanitizedFileName}`;
  }

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, params.fileBuffer, {
      contentType: params.mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error(`[Expediente Server] Error uploading ${params.documentType}:`, uploadError.message);
    return { ok: false, error: uploadError.message };
  }

  // Create database record
  const { error: dbError } = await supabase
    .from('expediente_documents')
    .insert({
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
    });

  if (dbError) {
    // Rollback: delete uploaded file
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    console.error(`[Expediente Server] Error inserting ${params.documentType} record:`, dbError.message);
    return { ok: false, error: dbError.message };
  }

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
export async function guardarDocumentosExpediente(params: {
  clientId: string;
  policyId: string;
  cedula?: { buffer: Buffer; fileName: string; mimeType: string };
  licencia?: { buffer: Buffer; fileName: string; mimeType: string };
  registroVehicular?: { buffer: Buffer; fileName: string; mimeType: string };
  cartaAutorizacion?: { buffer: Buffer; fileName: string; mimeType: string };
  nroPoliza?: string;
}): Promise<{ ok: boolean; saved: string[]; errors: string[] }> {
  const saved: string[] = [];
  const errors: string[] = [];

  console.log('[Expediente Server] Guardando documentos para clientId:', params.clientId, 'policyId:', params.policyId);

  // Save cédula (client-level, no policyId)
  if (params.cedula) {
    const result = await saveDocument({
      clientId: params.clientId,
      policyId: null, // Client-level document
      documentType: 'cedula',
      fileName: params.cedula.fileName,
      fileBuffer: params.cedula.buffer,
      mimeType: params.cedula.mimeType,
    });
    if (result.ok) {
      saved.push('cedula');
    } else {
      errors.push(`cedula: ${result.error}`);
    }
  }

  // Save licencia (client-level, no policyId)
  if (params.licencia) {
    const result = await saveDocument({
      clientId: params.clientId,
      policyId: null, // Client-level document
      documentType: 'licencia',
      fileName: params.licencia.fileName,
      fileBuffer: params.licencia.buffer,
      mimeType: params.licencia.mimeType,
    });
    if (result.ok) {
      saved.push('licencia');
    } else {
      errors.push(`licencia: ${result.error}`);
    }
  }

  // Save registro vehicular (policy-level)
  if (params.registroVehicular) {
    const result = await saveDocument({
      clientId: params.clientId,
      policyId: params.policyId,
      documentType: 'registro_vehicular',
      fileName: params.registroVehicular.fileName,
      fileBuffer: params.registroVehicular.buffer,
      mimeType: params.registroVehicular.mimeType,
    });
    if (result.ok) {
      saved.push('registro_vehicular');
    } else {
      errors.push(`registro_vehicular: ${result.error}`);
    }
  }

  // Save carta de autorización (policy-level)
  if (params.cartaAutorizacion) {
    const result = await saveDocument({
      clientId: params.clientId,
      policyId: params.policyId,
      documentType: 'otros',
      documentName: `Carta de Autorización${params.nroPoliza ? ` - Póliza ${params.nroPoliza}` : ''}`,
      fileName: params.cartaAutorizacion.fileName,
      fileBuffer: params.cartaAutorizacion.buffer,
      mimeType: params.cartaAutorizacion.mimeType,
      notes: 'Autorización, Declaración de Veracidad y Términos y Condiciones firmados digitalmente durante la emisión.',
    });
    if (result.ok) {
      saved.push('carta_autorizacion');
    } else {
      errors.push(`carta_autorizacion: ${result.error}`);
    }
  }

  console.log(`[Expediente Server] Resultado: ${saved.length} guardados, ${errors.length} errores`, { saved, errors });
  return { ok: errors.length === 0, saved, errors };
}
