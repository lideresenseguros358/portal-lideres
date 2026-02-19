/**
 * Expediente Storage Utilities
 * Manages client and policy documents (cedula, licencia, registro vehicular)
 */

import { supabaseClient } from '@/lib/supabase/client';

export type DocumentType = 'cedula' | 'licencia' | 'registro_vehicular' | 'otros';

export interface ExpedienteDocument {
  id: string;
  client_id: string;
  policy_id: string | null;
  document_type: DocumentType;
  document_name: string | null; // Nombre personalizado para tipo "otros"
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const BUCKET_NAME = 'expediente';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const DOCUMENTS_PER_POLICY = 5; // Documentos permitidos por cada póliza del cliente
/** @deprecated Use DOCUMENTS_PER_POLICY */
const MAX_DOCUMENTS_PER_POLICY = DOCUMENTS_PER_POLICY; // Alias para compatibilidad
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

/**
 * Generate file path for storage
 */
function generateFilePath(
  clientId: string,
  policyId: string | null,
  documentType: DocumentType,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  if (documentType === 'registro_vehicular' && policyId) {
    return `clients/${clientId}/policies/${policyId}/${documentType}/${timestamp}_${sanitizedFileName}`;
  } else {
    return `clients/${clientId}/${documentType}/${timestamp}_${sanitizedFileName}`;
  }
}

/**
 * Validate file before upload
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido. Solo se aceptan: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `El archivo es demasiado grande. Tamaño máximo: ${MAX_FILE_SIZE / 1024 / 1024} MB`,
    };
  }

  return { valid: true };
}

/**
 * Upload a document to expediente storage
 */
export async function uploadExpedienteDocument(
  clientId: string,
  policyId: string | null,
  documentType: DocumentType,
  file: File,
  options?: {
    notes?: string;
    documentName?: string; // Nombre personalizado para tipo "otros"
  }
): Promise<{ ok: boolean; data?: ExpedienteDocument; error?: string }> {
  try {
    const supabase = supabaseClient();

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    // Validate document name for "otros" type
    if (documentType === 'otros' && !options?.documentName?.trim()) {
      return {
        ok: false,
        error: 'Debe proporcionar un nombre personalizado para documentos tipo "otros"',
      };
    }

    // Validate document type and policy relationship
    if (documentType === 'registro_vehicular' && !policyId) {
      return {
        ok: false,
        error: 'El registro vehicular debe estar asociado a una póliza',
      };
    }

    if ((documentType === 'cedula' || documentType === 'licencia') && policyId) {
      return {
        ok: false,
        error: 'Cédula y licencia son documentos del cliente, no de la póliza',
      };
    }
    
    // "otros" can be for client or policy, no validation needed

    // Check document limit: total docs for client vs (5 × number of policies)
    {
      // Count total docs already uploaded for this client
      const { data: existingDocs, error: countError } = await supabase
        .from('expediente_documents')
        .select('id')
        .eq('client_id', clientId);

      if (countError) {
        console.error('Error checking document count:', countError);
        return { ok: false, error: 'Error al verificar cantidad de documentos' };
      }

      // Count number of policies the client has
      const { data: policies, error: policiesError } = await supabase
        .from('policies')
        .select('id')
        .eq('client_id', clientId);

      if (policiesError) {
        console.error('Error counting client policies:', policiesError);
        return { ok: false, error: 'Error al verificar pólizas del cliente' };
      }

      const policyCount = policies?.length || 1;
      const maxAllowed = policyCount * DOCUMENTS_PER_POLICY;
      const currentCount = existingDocs?.length || 0;

      if (currentCount >= maxAllowed) {
        return {
          ok: false,
          error: `Este cliente ya tiene el máximo de ${maxAllowed} documento(s) permitidos (${DOCUMENTS_PER_POLICY} por cada una de sus ${policyCount} póliza(s)). Elimina algún documento existente para subir uno nuevo.`,
        };
      }
    }

    // Generate file path
    const filePath = generateFilePath(clientId, policyId, documentType, file.name);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return { ok: false, error: `Error al subir archivo: ${uploadError.message}` };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Create database record
    const { data: docData, error: dbError } = await supabase
      .from('expediente_documents')
      .insert({
        client_id: clientId,
        policy_id: policyId,
        document_type: documentType,
        document_name: documentType === 'otros' ? options?.documentName || null : null,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
        notes: options?.notes || null,
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: delete uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      console.error('Error creating database record:', dbError);
      return { ok: false, error: `Error al registrar documento: ${dbError.message}` };
    }

    return { ok: true, data: docData as unknown as ExpedienteDocument };
  } catch (error: any) {
    console.error('Unexpected error uploading document:', error);
    return { ok: false, error: error.message || 'Error inesperado al subir documento' };
  }
}

/**
 * Get all documents for a client
 */
export async function getClientDocuments(
  clientId: string
): Promise<{ ok: boolean; data?: ExpedienteDocument[]; error?: string }> {
  try {
    const supabase = supabaseClient();

    const { data, error } = await supabase
      .from('expediente_documents')
      .select('*')
      .eq('client_id', clientId)
      .is('policy_id', null)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching client documents:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, data: data as unknown as ExpedienteDocument[] };
  } catch (error: any) {
    console.error('Unexpected error fetching client documents:', error);
    return { ok: false, error: error.message || 'Error inesperado' };
  }
}

/**
 * Get all documents for a policy
 */
export async function getPolicyDocuments(
  policyId: string
): Promise<{ ok: boolean; data?: ExpedienteDocument[]; error?: string }> {
  try {
    const supabase = supabaseClient();

    const { data, error } = await supabase
      .from('expediente_documents')
      .select('*')
      .eq('policy_id', policyId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching policy documents:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, data: data as unknown as ExpedienteDocument[] };
  } catch (error: any) {
    console.error('Unexpected error fetching policy documents:', error);
    return { ok: false, error: error.message || 'Error inesperado' };
  }
}

/**
 * Get a signed URL for viewing/downloading a document
 */
export async function getExpedienteDocumentUrl(
  filePath: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const supabase = supabaseClient();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, url: data.signedUrl };
  } catch (error: any) {
    console.error('Unexpected error creating signed URL:', error);
    return { ok: false, error: error.message || 'Error inesperado' };
  }
}

/**
 * Delete a document from expediente
 */
export async function deleteExpedienteDocument(
  documentId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = supabaseClient();

    // First, get the document to know the file path
    const { data: doc, error: fetchError } = await supabase
      .from('expediente_documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      return { ok: false, error: 'Documento no encontrado' };
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([doc.file_path]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      // Continue anyway to delete from database
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('expediente_documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      console.error('Error deleting document record:', dbError);
      return { ok: false, error: dbError.message };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('Unexpected error deleting document:', error);
    return { ok: false, error: error.message || 'Error inesperado al eliminar documento' };
  }
}

/**
 * Check if client has a specific document type
 */
export async function hasDocument(
  clientId: string,
  documentType: DocumentType,
  policyId?: string | null
): Promise<{ ok: boolean; exists?: boolean; document?: ExpedienteDocument; error?: string }> {
  try {
    const supabase = supabaseClient();

    let query = supabase
      .from('expediente_documents')
      .select('*')
      .eq('client_id', clientId)
      .eq('document_type', documentType)
      .order('uploaded_at', { ascending: false })
      .limit(1);

    if (policyId) {
      query = query.eq('policy_id', policyId);
    } else {
      query = query.is('policy_id', null);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned"
      console.error('Error checking document:', error);
      return { ok: false, error: error.message };
    }

    return {
      ok: true,
      exists: !!data,
      document: data as unknown as ExpedienteDocument | undefined,
    };
  } catch (error: any) {
    console.error('Unexpected error checking document:', error);
    return { ok: false, error: error.message || 'Error inesperado' };
  }
}

/**
 * Update document notes
 */
export async function updateDocumentNotes(
  documentId: string,
  notes: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = supabaseClient();

    const { error } = await supabase
      .from('expediente_documents')
      .update({ notes })
      .eq('id', documentId);

    if (error) {
      console.error('Error updating document notes:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('Unexpected error updating notes:', error);
    return { ok: false, error: error.message || 'Error inesperado' };
  }
}

/**
 * Get document count for a client (total across all policies)
 * Limit = DOCUMENTS_PER_POLICY × number of policies the client has
 */
export async function getClientDocumentLimit(
  clientId: string
): Promise<{ ok: boolean; count?: number; maxAllowed?: number; remaining?: number; policyCount?: number; error?: string }> {
  try {
    const supabase = supabaseClient();

    // Count total docs for this client
    const { data: docs, error: docsError } = await supabase
      .from('expediente_documents')
      .select('id')
      .eq('client_id', clientId);

    if (docsError) {
      console.error('Error counting client documents:', docsError);
      return { ok: false, error: docsError.message };
    }

    // Count policies
    const { data: policies, error: policiesError } = await supabase
      .from('policies')
      .select('id')
      .eq('client_id', clientId);

    if (policiesError) {
      console.error('Error counting client policies:', policiesError);
      return { ok: false, error: policiesError.message };
    }

    const policyCount = policies?.length || 1;
    const maxAllowed = policyCount * DOCUMENTS_PER_POLICY;
    const count = docs?.length || 0;
    const remaining = Math.max(0, maxAllowed - count);

    return { ok: true, count, maxAllowed, remaining, policyCount };
  } catch (error: any) {
    console.error('Unexpected error counting documents:', error);
    return { ok: false, error: error.message || 'Error inesperado' };
  }
}

/**
 * @deprecated Use getClientDocumentLimit instead
 */
export async function getPolicyDocumentCount(
  policyId: string
): Promise<{ ok: boolean; count?: number; remaining?: number; error?: string }> {
  // Legacy: kept for compatibility, returns dummy values
  return { ok: true, count: 0, remaining: 999 };
}

/**
 * Export constants for UI usage
 */
export { MAX_DOCUMENTS_PER_POLICY, DOCUMENTS_PER_POLICY, MAX_FILE_SIZE, ALLOWED_MIME_TYPES };
