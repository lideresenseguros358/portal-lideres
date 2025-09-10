// lib/gsheets.ts
const API = process.env.GSHEET_API_URL!;
const TOKEN = process.env.GSHEET_API_TOKEN!;

/**
 * Llama al Apps Script vía nuestro proxy interno /api/gs
 * (Así evitamos CORS y mantenemos el token en el servidor)
 */
export async function gsList(table: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/gs?action=list&table=${encodeURIComponent(table)}`, {
    method: 'GET',
    // No mandamos token aquí; el proxy /api/gs lo agrega desde server-side
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GS API list error (status ${res.status}): ${txt}`);
  }
  return res.json();
}

export async function gsLogin(email: string, password: string) {
  const res = await fetch(`/api/login`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const { error } = await res.json().catch(()=>({error:'Error desconocido'}));
    throw new Error(error || 'Login falló');
  }
  return res.json(); // { role: 'master'|'broker' }
}
