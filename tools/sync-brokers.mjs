// tools/sync-brokers.mjs
// Sincroniza tabla "brokers" -> Supabase Auth usando Admin API v2
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env / .env.local

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// ---------- Carga de .env ----------
const dotenvPathArg = process.argv.find(a => a.startsWith('dotenv_config_path='));
let loadedEnv = false;
try {
  const { config } = await import('dotenv');
  if (dotenvPathArg) {
    const p = dotenvPathArg.split('=')[1];
    if (p && fs.existsSync(p)) {
      config({ path: p });
      loadedEnv = true;
      console.log(`Usando variables de entorno desde: ${p}`);
    }
  }
  if (!loadedEnv) {
    const local = path.resolve('.env.local');
    if (fs.existsSync(local)) {
      config({ path: local });
      console.log('Usando variables de entorno desde: .env.local');
    } else {
      config();
      console.log('Usando variables de entorno desde: .env');
    }
  }
} catch { /* opcional */ }

// ---------- Validación de ENV ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  process.exit(1);
}

// ---------- Cliente Admin ----------
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ---------- Helpers ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getAllAuthUsersMap() {
  // Map<emailLower, user>
  const map = new Map();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users || []) {
      if (u.email) map.set(u.email.toLowerCase(), u);
    }
    if (!data.users || data.users.length < perPage) break;
    page += 1;
    await sleep(100);
  }
  return map;
}

async function upsertBrokerUser(broker, existingUser) {
  const email = (broker.email || '').trim();
  if (!email) return { status: 'omitido', reason: 'sin_email' };

  const user_metadata = {
    broker_id: broker.id ?? null,
    full_name: broker.name ?? null // usamos 'name' como nombre público
  };
  const app_metadata = { role: 'broker' };

  if (!existingUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata,
      app_metadata
    });
    if (error) return { status: 'fallido', error };
    return { status: 'creado', userId: data.user.id };
  }

  const mergedUserMeta = { ...(existingUser.user_metadata || {}), ...user_metadata };
  const mergedAppMeta  = { ...(existingUser.app_metadata  || {}), ...app_metadata  };

  const needsUpdate =
    JSON.stringify(existingUser.user_metadata || {}) !== JSON.stringify(mergedUserMeta) ||
    JSON.stringify(existingUser.app_metadata  || {}) !== JSON.stringify(mergedAppMeta);

  if (!needsUpdate) return { status: 'actualizado_sin_cambios' };

  const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
    user_metadata: mergedUserMeta,
    app_metadata: mergedAppMeta
  });
  if (error) return { status: 'fallido', error };
  return { status: 'actualizado' };
}

async function main() {
  console.time('sync');

  // Solo columnas existentes: id, email, name
  const { data: brokers, error: brokersError } = await admin
    .from('brokers')
    .select('id, email, name')
    .not('email', 'is', null);

  if (brokersError) {
    console.error('Error leyendo tabla "brokers":', brokersError);
    process.exit(1);
  }

  console.log(`Brokers a sincronizar: ${brokers.length}`);

  let usersByEmail;
  try {
    usersByEmail = await getAllAuthUsersMap();
  } catch (e) {
    console.error('No se pudo listar usuarios con listUsers():', e);
    process.exit(1);
  }

  let creados = 0, actualizados = 0, sinCambios = 0, omitidos = 0, fallidos = 0;

  for (const b of brokers) {
    const existing = usersByEmail.get((b.email || '').toLowerCase());
    try {
      const res = await upsertBrokerUser(b, existing);
      switch (res.status) {
        case 'creado': creados++; break;
        case 'actualizado': actualizados++; break;
        case 'actualizado_sin_cambios': sinCambios++; break;
        case 'omitido': omitidos++; break;
        case 'fallido': fallidos++; break;
      }
      const tag = res.status.padEnd(21, ' ');
      console.log(`Broker ${b.id ?? ''} (${b.email}) -> ${tag}${res.error ? res.error.message : ''}`);
    } catch (err) {
      fallidos++;
      console.log(`Broker ${b.id ?? ''} (${b.email}) -> fallido: ${err.message}`);
    }
    await sleep(30);
  }

  console.log(`\nResumen -> creados:${creados}, actualizados:${actualizados}, sin_cambios:${sinCambios}, omitidos:${omitidos}, fallidos:${fallidos}`);
  console.timeEnd('sync');
}

main().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
