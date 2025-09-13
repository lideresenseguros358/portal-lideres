// scripts/export-banco-general.ts
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ENV requeridos
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, service, { auth: { persistSession: false } });

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

type Row = {
  cuenta: string;
  identificacion: string;
  nombre: string;
  moneda: string;
  monto: number;
  detalle: string;
  email: string;
};

async function main() {
  const FORTNIGHT_ID = process.argv[2];
  if (!FORTNIGHT_ID) {
    console.error('Uso: npx ts-node scripts/export-banco-general.ts <FORTNIGHT_ID>');
    process.exit(1);
  }

  // Tomamos total_amount_net (si existe), si no total_amount
  const { data, error } = await supabase
    .from('commissions')
    .select(`
      total_amount, total_amount_net, currency,
      brokers:broker_id(
        brokerEmail, fullName,
        bank_account_no, bank_id,
        beneficiary_name, beneficiary_id
      )
    `)
    .eq('fortnight_id', FORTNIGHT_ID);

  if (error) throw error;

  const rows: Row[] = (data ?? []).map((rec: any) => ({
    cuenta: String(rec?.brokers?.bank_account_no ?? ''),
    identificacion: String(rec?.brokers?.beneficiary_id ?? ''),
    nombre: String(rec?.brokers?.beneficiary_name ?? rec?.brokers?.fullName ?? ''),
    moneda: String(rec?.currency ?? 'PAB'),
    monto: Number(rec?.total_amount_net ?? rec?.total_amount ?? 0),
    detalle: `Comisión quincena ${FORTNIGHT_ID}`,
    email: String(rec?.brokers?.brokerEmail ?? ''),
  }));

  // encabezados según Banco General (ajústalos si tu plantilla exige otro orden)
  const headers: (keyof Row)[] = [
    'cuenta', 'identificacion', 'nombre', 'moneda', 'monto', 'detalle', 'email',
  ];

  const lines: string[] = [];
  lines.push(headers.map((h) => csvEscape(h)).join(','));
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape((r as any)[h])).join(','));
  }

  const outDir = path.join(process.cwd(), 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `banco_general_${FORTNIGHT_ID}.csv`);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('CSV generado:', file);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
