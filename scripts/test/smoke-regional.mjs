/**
 * Smoke Test: La Regional de Seguros — DT + CC Cotización → Emisión → Carátula
 * 
 * Usage:
 *   node scripts/test/smoke-regional.mjs          # Full test (DT + CC)
 *   node scripts/test/smoke-regional.mjs dt       # DT only
 *   node scripts/test/smoke-regional.mjs cc       # CC only
 *   node scripts/test/smoke-regional.mjs print 10-29-XXXXXXX  # Print only
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE = 'https://desa.laregionaldeseguros.com:10443/desaw';
const USERNAME = 'LIDERES_EN_SEGUROS_99';
const PASSWORD = 'F?V3pTl*_cPL';
const COD_INTER = '99';
const TOKEN = '6NWEDYFWVCQoaqzppdjswFKPAPGQQPBnxMBTzhzDGTFRG8R4THEDS--X+*ieO';
const basicAuth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${basicAuth}`,
  codInter: COD_INTER,
  token: TOKEN,
};

async function api(name, url, method, body) {
  console.log(`\n═══ ${name} ═══`);
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  console.log(`  Status: ${res.status} | CT: ${ct}`);
  console.log(`  Body: ${JSON.stringify(data).substring(0, 600)}`);
  return { status: res.status, data, text, ct };
}

// ═══════════════════════════════════════
// DT (RC) Flow
// ═══════════════════════════════════════
async function testDT() {
  console.log('\n\n╔══════════════════════════════════╗');
  console.log('║   REGIONAL DT (RC) SMOKE TEST   ║');
  console.log('╚══════════════════════════════════╝');

  // 1. Cotización
  const dtUrl = `${BASE}/regional/auto/cotizar/?cToken=${TOKEN}&cCodInter=${COD_INTER}&nEdad=35&cSexo=M&cEdocivil=S&cMarca=68&cModelo=780&nAnio=2024&nMontoVeh=15000&nLesiones=5000*10000&nDanios=5000&cEndoso=1&cTipocobert=RC`;
  const cot = await api('DT Cotización (GET)', dtUrl, 'GET');

  const item = cot.data?.items?.[0];
  if (!item?.numcot) {
    console.log('\n❌ DT cotización failed:', item?.opcion || 'empty items');
    return null;
  }
  console.log(`\n✅ DT numcot: ${item.numcot} | plan: ${item.plan} | prima: ${item.primatotal}`);

  // 2. Emisión
  const emit = await api('DT Emisión (POST)', `${BASE}/regional/auto/emitirPolizaRc`, 'POST', {
    codInter: COD_INTER,
    plan: String(item.plan || '100016'),
    cliente: {
      nomter: 'JUAN', apeter: 'SMOKE', fchnac: '1990-06-15', edad: 35, sexo: 'M', edocivil: 'S',
      t1numero: '2900000', t2numero: '62900000', email: 'smoke@lideresenseguros.com',
      direccion: { codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1, dirhab: 'Ciudad de Panama' },
      identificacion: { tppersona: 'N', tpodoc: 'C', prov: 8, letra: null, tomo: 888, asiento: 9999, dv: null, pasaporte: null },
    },
    datosveh: { codmarca: 68, codmodelo: 780, anio: 2024, numplaca: 'SMK1234', serialcarroceria: 'JTDBR32E160654321', serialmotor: 'SMK987654', color: 1 },
    condHab: { nomter: 'JUAN', apeter: 'SMOKE', sexo: 'M', edocivil: 'S' },
  });

  const poliza = emit.data?.poliza || emit.data?.numpoliza || emit.data?.items?.[0]?.poliza || emit.data?.items?.[0]?.numpoliza;
  if (!poliza) {
    console.log('\n❌ DT emisión failed — no poliza returned');
    return null;
  }
  console.log(`\n✅ DT POLIZA: ${poliza}`);

  // 3. Imprimir
  return await testPrint(poliza, 'dt');
}

// ═══════════════════════════════════════
// CC Flow
// ═══════════════════════════════════════
async function testCC() {
  console.log('\n\n╔══════════════════════════════════╗');
  console.log('║   REGIONAL CC SMOKE TEST        ║');
  console.log('╚══════════════════════════════════╝');

  // 1. Cotización
  const cot = await api('CC Cotización (POST)', `${BASE}/regional/auto/cotizacion`, 'POST', {
    cliente: {
      nomter: 'MARIA', apeter: 'SMOKE', edad: 30, sexo: 'F', edocivil: 'S',
      identificacion: { tppersona: 'N', tpodoc: 'C', prov: 8, letra: null, tomo: 777, asiento: 8888, dv: null, pasaporte: null },
      t1numero: '2900000', t2numero: '62900000', email: 'smoke@lideresenseguros.com',
    },
    datosveh: { vehnuevo: 'N', codmarca: 68, codmodelo: 780, anio: 2024, valorveh: 15000, numpuestos: 4 },
    tpcobert: '1', endoso: '1',
    limites: { lescor: '5000*10000', danpro: '5000', gasmed: '500*2500' },
  });

  const numcot = cot.data?.numcot;
  if (!numcot) {
    console.log('\n❌ CC cotización failed:', cot.data?.mensaje || 'no numcot');
    return null;
  }
  console.log(`\n✅ CC numcot: ${numcot}`);

  // 2. Emisión
  const emit = await api('CC Emisión (POST)', `${BASE}/regional/auto/emitirPoliza`, 'POST', {
    codInter: COD_INTER, numcot,
    cliente: {
      direccion: { codpais: 507, codestado: 8, codciudad: 1, codmunicipio: 1, codurb: 1, dirhab: 'Ciudad de Panama' },
      datosCumplimiento: { ocupacion: 1, ingresoAnual: 1, paisTributa: 507, pep: 'N' },
    },
    datosveh: { vehnuevo: 'N', numplaca: 'SMK5678', serialcarroceria: 'JTDBR32E160654322', serialmotor: 'SMK987655', color: 1, usoveh: 'P', peso: 'L' },
    acreedor: '81',
  });

  const poliza = emit.data?.poliza || emit.data?.numpoliza || emit.data?.items?.[0]?.poliza || emit.data?.items?.[0]?.numpoliza;
  if (!poliza) {
    console.log('\n❌ CC emisión failed — no poliza returned');
    return null;
  }
  console.log(`\n✅ CC POLIZA: ${poliza}`);

  // 3. Imprimir
  return await testPrint(poliza, 'cc');
}

// ═══════════════════════════════════════
// Imprimir (shared)
// ═══════════════════════════════════════
async function testPrint(poliza, suffix) {
  const { writeFileSync } = await import('fs');

  const print = await api(`Imprimir Póliza ${poliza}`, `${BASE}/regional/util/imprimirPoliza`, 'POST', { poliza: String(poliza) });

  // Check for JSON with base64 PDF
  if (typeof print.data === 'object' && print.data !== null) {
    const b64 = print.data.pdf || print.data.documento || print.data.base64;
    if (b64) {
      const filename = `caratula_regional_${suffix}_${poliza}.pdf`;
      writeFileSync(filename, Buffer.from(b64, 'base64'));
      console.log(`\n✅ PDF guardado: ${filename}`);
      return poliza;
    }
    // Check for error message
    if (print.data.mensaje) {
      console.log(`\n⚠️ imprimirPoliza mensaje: ${print.data.mensaje}`);
    }
  }

  // Check for raw PDF binary
  if (print.text?.startsWith('%PDF') || print.ct?.includes('pdf')) {
    const filename = `caratula_regional_${suffix}_${poliza}.pdf`;
    writeFileSync(filename, Buffer.from(print.text, 'binary'));
    console.log(`\n✅ PDF (binary) guardado: ${filename} (${print.text.length} bytes)`);
    return poliza;
  }

  console.log('\n⚠️ No PDF received from imprimirPoliza');
  return poliza;
}

// ═══════════════════════════════════════
// Main
// ═══════════════════════════════════════
const arg = process.argv[2] || 'all';

(async () => {
  if (arg === 'print' && process.argv[3]) {
    await testPrint(process.argv[3], 'manual');
  } else if (arg === 'dt') {
    await testDT();
  } else if (arg === 'cc') {
    await testCC();
  } else {
    await testDT();
    await testCC();
  }
  console.log('\n\n═══ SMOKE TEST COMPLETE ═══');
})().catch(e => console.error('\nFATAL:', e.message));
