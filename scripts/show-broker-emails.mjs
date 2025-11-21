import fs from 'fs';
import Papa from 'papaparse';

const csv = fs.readFileSync('public/plantilla_comisiones_quincena.csv', 'utf-8');
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

const emails = {};
const amounts = {};

parsed.data.forEach(row => {
  const email = row.broker_email?.trim();
  const amount = parseFloat(row.commission_amount) || 0;
  
  if (email) {
    emails[email] = (emails[email] || 0) + 1;
    amounts[email] = (amounts[email] || 0) + amount;
  }
});

console.log('\n📧 BROKERS POR EMAIL (SOLO del CSV):\n');
console.log('═══════════════════════════════════════════════════════\n');

Object.entries(emails)
  .sort((a, b) => b[1] - a[1])
  .forEach(([email, count], idx) => {
    const total = amounts[email];
    console.log(`${idx + 1}. ${email}`);
    console.log(`   Pólizas: ${count} | Total bruto: $${total.toFixed(2)}\n`);
  });

console.log('═══════════════════════════════════════════════════════');
console.log(`✅ Total brokers únicos: ${Object.keys(emails).length}`);
console.log(`⚠️  Sin broker: ${parsed.data.filter(r => !r.broker_email?.trim()).length} pólizas`);
console.log('═══════════════════════════════════════════════════════\n');
