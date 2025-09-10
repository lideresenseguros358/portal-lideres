// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const API = process.env.GSHEET_API_URL!;
const TOKEN = process.env.GSHEET_API_TOKEN!;
const MASTER_EMAIL = process.env.MASTER_EMAIL!;
const JWT_SECRET = process.env.JWT_SECRET!;

// Leer brokers de Sheets
async function fetchBrokers() {
  const url = `${API}?action=list&table=brokers`;
  const r = await fetch(url, { headers: {'x-portal-token': TOKEN }});
  if(!r.ok) throw new Error(`GS API list error (status ${r.status})`);
  const json = await r.json();
  return json?.items || json; // depende de cómo devuelva tu Apps Script
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try{
    if(req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
    const { email, password } = req.body || {};
    if(!email || !password) return res.status(400).json({ error:'Faltan credenciales' });

    const brokers = await fetchBrokers();
    const user = brokers.find((b: any) => String(b.brokerEmail||'').toLowerCase() === String(email).toLowerCase());

    if(!user) return res.status(401).json({ error:'Usuario no encontrado' });

    // MVP: si no tiene hash, contraseña por defecto "lissa806".
    const defaultPass = 'lissa806';
    const passOk = (user.passwordHash ? password === user.passwordHash /* placeholder temporal */ : password === defaultPass);

    if(!passOk) return res.status(401).json({ error:'Contraseña incorrecta' });

    // Rol:
    let role = user.role || 'broker';
    if(String(email).toLowerCase() === String(MASTER_EMAIL).toLowerCase()) {
      role = 'master';
    }

    // Crea JWT y setea cookie httpOnly
    const token = jwt.sign({ email, role }, JWT_SECRET, { expiresIn:'12h' });

    // Set-Cookie: portal_token
    res.setHeader('Set-Cookie', [
      `portal_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60*60*12}`,
    ]);
    return res.status(200).json({ role });
  }catch(e:any){
    return res.status(500).json({ error: e.message || 'Login error' });
  }
}
