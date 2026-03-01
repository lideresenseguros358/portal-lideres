/**
 * Helper to create a petition (ops_case) from a cotizador form submission.
 * Call this when a client submits a Vida, Incendio, or Hogar quote request
 * that includes client contact info.
 *
 * Fire-and-forget — never blocks the UI or throws to the user.
 */

interface PetitionFromQuoteParams {
  client_name: string;
  client_email?: string;
  client_phone?: string;
  cedula?: string;
  ramo: 'vida' | 'incendio' | 'hogar' | string;
  insurer_name?: string;
  details?: Record<string, any>;
  source?: string;
}

export async function createPetitionFromQuote(params: PetitionFromQuoteParams): Promise<{ success: boolean; ticket?: string }> {
  try {
    if (!params.client_name) {
      console.warn('[createPetitionFromQuote] Skipped — no client_name');
      return { success: false };
    }

    const res = await fetch('/api/operaciones/petitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_from_quote',
        client_name: params.client_name,
        client_email: params.client_email || null,
        client_phone: params.client_phone || null,
        cedula: params.cedula || null,
        ramo: params.ramo,
        insurer_name: params.insurer_name || null,
        details: params.details || {},
        source: params.source || 'COTIZADOR',
      }),
    });

    if (!res.ok) {
      console.error('[createPetitionFromQuote] API error:', res.status);
      return { success: false };
    }

    const json = await res.json();
    if (json.success) {
      console.log(`[createPetitionFromQuote] Created petition ${json.data?.ticket} for ${params.ramo}`);
      return { success: true, ticket: json.data?.ticket };
    }

    console.error('[createPetitionFromQuote] API returned error:', json.error);
    return { success: false };
  } catch (err) {
    console.error('[createPetitionFromQuote] Network error:', err);
    return { success: false };
  }
}
