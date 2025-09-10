// /pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { SerializeOptions } from 'cookie';
import { serialize as cookieSerialize } from 'cookie';

type Role = 'master' | 'broker';

interface GSLoginResponse {
  ok: boolean;
  sessionId?: string;
  role?: Role;
  brokerEmail?: string;
  expiresAt?: string; // ISO
  error?: string;
}

function isRole(x: unknown): x is Role {
  return x === 'master' || x === 'broker';
}
function safeStr(x: unknown): string | undefined {
  return typeof x === 'string' ? x : undefined;
}
function isGSLogin(x: unknown): x is GSLoginResponse {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.ok !== 'boolean') return false;
  if (o.role !== undefined && !isRole(o.role)) return false;
  if (o.sessionId !== undefined && typeof o.sessionId !== 'string') return false;
  if (o.brokerEmail !== undefined && typeof o.brokerEmail !== 'string') return false;
  if (o.expiresAt !== undefined && typeof o.expiresAt !== 'string') return false;
  if (o.error !== undefined && typeof o.error !== 'string') return false;
  return true;
}

const GSHEET_API_URL = process.env.GSHEET_API_URL!;
const GSHEET_API_TOKEN = process.env.GSHEET_API_TOKEN!;
const DEFAULT_SESSION_HOURS = Number(process.env.SESSION_HOURS ?? '24'); // fallback

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' });
    return;
  }

  const email = safeStr(req.body?.email)?.trim();
  const password = safeStr(req.body?.password)?.trim();
  if (!email || !password) {
    res.status(400).json({ ok: false, error: 'Faltan credenciales' });
    return;
  }

  try {
    const url = `${GSHEET_API_URL}?action=login&table=brokers&token=${encodeURIComponent(
      GSHEET_API_TOKEN
    )}`;

    const gsRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const text = await gsRes.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      res.status(502).json({ ok: false, error: 'Respuesta no JSON desde GS API' });
      return;
    }

    if (!isGSLogin(data)) {
      res.status(502).json({ ok: false, error: 'Estructura inválida desde GS API' });
      return;
    }
    if (!data.ok) {
      res.status(401).json({ ok: false, error: data.error ?? 'Credenciales inválidas' });
      return;
    }

    // Fecha de expiración (del API o fallback local)
    const expIso = data.expiresAt
      ? new Date(data.expiresAt)
      : new Date(Date.now() + DEFAULT_SESSION_HOURS * 60 * 60 * 1000);

    const cookieOptions: SerializeOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: expIso,
    };

    // Guarda cookie con el sessionId
    const header = cookieSerialize('portal_session', data.sessionId ?? '', cookieOptions);
    res.setHeader('Set-Cookie', header);

    res.status(200).json({
      ok: true,
      sessionId: data.sessionId,
      role: data.role,
      brokerEmail: data.brokerEmail ?? email,
      expiresAt: expIso.toISOString(),
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Error de servidor',
    });
  }
}

