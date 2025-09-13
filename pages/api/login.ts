// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize as cookieSerialize, SerializeOptions } from 'cookie';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../lib/supabase'; // tu helper de server (service role)

type Role = 'master' | 'broker';

interface ApiLoginOk {
  ok: true;
  sessionId: string;
  role: Role;
  brokerEmail: string;
  expiresAt: string; // ISO
}

interface ApiLoginErr {
  ok: false;
  error: string;
}

type ApiLoginRes = ApiLoginOk | ApiLoginErr;

const SESSION_HOURS = Number(process.env.SESSION_HOURS || '24');

const cookieOpts: SerializeOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_HOURS * 3600,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiLoginRes>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Faltan credenciales' });
  }

  // 1) Buscar primero en profiles (email exacto)
  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role, broker_id, full_name, email')
    .eq('email', email)
    .maybeSingle();

  if (pErr) {
    return res.status(500).json({ ok: false, error: 'Error consultando perfiles' });
  }

  // Fallback: si no hubiera profile todavía, intenta en brokers por correo
  let brokerRow:
    | {
        id: string;
        role: Role;
        active: boolean;
        passwordHash: string | null;
        brokerEmail: string;
      }
    | null = null;

  if (profile?.broker_id) {
    const { data: b, error: bErr } = await supabaseAdmin
      .from('brokers')
      .select('id, role, active, "passwordHash", "brokerEmail"')
      .eq('id', profile.broker_id)
      .maybeSingle();

    if (bErr) {
      return res.status(500).json({ ok: false, error: 'Error consultando brokers' });
    }
    brokerRow = b as any;
  } else {
    // (case-insensitive)
    const { data: b, error: bErr } = await supabaseAdmin
      .from('brokers')
      .select('id, role, active, "passwordHash", "brokerEmail"')
      .ilike('brokerEmail', email)
      .maybeSingle();

    if (bErr) {
      return res.status(500).json({ ok: false, error: 'Error consultando brokers' });
    }
    brokerRow = b as any;
  }

  if (!brokerRow) {
    return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  }
  if (!brokerRow.active) {
    return res.status(403).json({ ok: false, error: 'Usuario inactivo' });
  }

  // 2) Validar contraseña (usando hash guardado en brokers.passwordHash)
  const hash = brokerRow.passwordHash ?? '';
  const okPass = await bcrypt.compare(password, hash);
  if (!okPass) {
    return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
  }

  // 3) Responder y setear cookie de sesión httpOnly
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();

  res.setHeader('Set-Cookie', cookieSerialize('portal_session', sessionId, cookieOpts));

  return res.status(200).json({
    ok: true,
    sessionId,
    role: (profile?.role ?? brokerRow.role) as Role,
    brokerEmail: brokerRow.brokerEmail,
    expiresAt,
  });
}
