import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Uso: node tools/set-temp-password.mjs contacto@lideresenseguros.com
// si no pasas email, lo hace para TODOS los usuarios Auth
const argEmail = (process.argv[2] || '').toLowerCase();
const NEW_PASS = 'Temporal123';

async function setForUser(user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: NEW_PASS });
  if (error) {
    console.log(`✗ ${user.email}: ${error.message}`);
  } else {
    console.log(`✓ ${user.email}: password temporal asignada`);
    // opcional: forzar cambio con email
    await admin.auth.admin.generateLink({ type: 'password_reset', email: user.email });
  }
}

async function main() {
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users || [];
    for (const u of users) {
      const email = (u.email || '').toLowerCase();
      if (!email) continue;
      if (!argEmail || email === argEmail) {
        await setForUser(u);
      }
    }
    if (users.length < perPage) break;
    page++;
  }
}
main().catch(e => { console.error(e); process.exit(1); });
