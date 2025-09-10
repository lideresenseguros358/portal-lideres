// /lib/gsheets.ts
// Helper para hablar con tu Apps Script de Google Sheets

export type Role = 'master' | 'broker';

export interface GSLoginOk {
  ok: true;
  status: number;
  sessionId: string;
  role: Role;
  brokerEmail: string;
  error?: undefined;
  raw?: unknown;
}

export interface GSLoginFail {
  ok: false;
  status: number;
  error: string;
  raw?: unknown;
}

export type GSLoginResult = GSLoginOk | GSLoginFail;

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function gsLogin(email: string, password: string): Promise<GSLoginResult> {
  const url = reqEnv('GSHEET_API_URL');   // ej: https://script.google.com/macros/s/XXXX/exec
  const token = reqEnv('GSHEET_API_TOKEN'); // ej: LISSA806

  try {
    const res = await fetch(`${url}?action=login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': token,
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    const status = res.status;
    const text = await res.text();

    // Apps Script a veces devuelve HTML de Drive en errores → detectarlo
    if (text.startsWith('<!DOCTYPE html') || text.includes('<html')) {
      return { ok: false, status, error: 'GS API devolvió HTML (revisa URL /exec y permisos)', raw: text };
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, status, error: 'Respuesta no-JSON desde GS API', raw: text };
    }

    // Esperamos { ok:boolean, status:number, data?:..., error?:... }
    const obj = json as { ok: boolean; status: number; data?: unknown; error?: string };

    if (!obj.ok || !obj.data) {
      return { ok: false, status: obj.status ?? status, error: obj.error ?? 'Login rechazado', raw: obj };
    }

    // data con los campos esperados
    const d = obj.data as {
      sessionId: string;
      role: Role;
      brokerEmail: string;
    };

    return {
      ok: true,
      status: obj.status ?? status,
      sessionId: d.sessionId,
      role: d.role,
      brokerEmail: d.brokerEmail,
      raw: obj,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, status: 500, error: msg };
  }
}

// Ejemplo de listado genérico (por si lo usas luego)
export interface GSListResponse<T> {
  ok: boolean;
  status: number;
  data?: T[];
  error?: string;
  raw?: unknown;
}

export async function gsList<T>(table: string): Promise<GSListResponse<T>> {
  const url = reqEnv('GSHEET_API_URL');
  const token = reqEnv('GSHEET_API_TOKEN');

  try {
    const res = await fetch(`${url}?action=list&table=${encodeURIComponent(table)}`, {
      method: 'GET',
      headers: { 'x-portal-token': token },
      cache: 'no-store',
    });
    const status = res.status;
    const text = await res.text();

    if (text.startsWith('<!DOCTYPE html') || text.includes('<html')) {
      return { ok: false, status, error: 'GS API devolvió HTML (revisa URL /exec y permisos)', raw: text };
    }

    const json = JSON.parse(text) as { ok: boolean; status: number; data?: T[]; error?: string };
    if (!json.ok || !json.data) {
      return { ok: false, status: json.status ?? status, error: json.error ?? 'Error de listado', raw: json };
    }
    return { ok: true, status: json.status ?? status, data: json.data, raw: json };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, status: 500, error: msg };
  }
}

