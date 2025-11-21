import fs from 'fs';
import Papa from 'papaparse';

const csv = fs.readFileSync('public/plantilla_comisiones_quincena.csv', 'utf-8');
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

let withEmail = 0;
let withoutEmail = 0;

parsed.data.forEach((row, idx) => {
  const email = row.broker_email?.trim();
  
  if (email && email !== '') {
    withEmail++;
  } else {
    withoutEmail++;
    if (withoutEmail <= 10) {
      console.log(`${idx + 2}. ${row.policy_number} | ${row.client_name} | email="${row.broker_email}"`);
    }
  }
});

console.log(`\n📊 RESUMEN:`);
console.log(`   Con email: ${withEmail}`);
console.log(`   Sin email: ${withoutEmail}`);
console.log(`   Total: ${parsed.data.length}`);
