/**
 * Debug script: Query EmisorPlan /api/planes to understand DT plan premiums
 * and compare with Emisor Externo plan 426 cotización
 */

const EMISOR_PLAN_BASE = 'https://wscanales.segfedpa.com/EmisorPlan';
const EMISOR_EXTERNO_BASE = 'https://wscanales.segfedpa.com/EmisorFedpa.Api/api';
const USUARIO = process.env.USUARIO_FEDPA || 'SLIDERES';
const CLAVE = process.env.CLAVE_FEDPA || 'lider836';

async function getToken(amb = 'DEV') {
  console.log(`\n=== Getting EmisorPlan token (${amb}) ===`);
  const res = await fetch(`${EMISOR_PLAN_BASE}/api/generartoken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: USUARIO, clave: CLAVE, Amb: amb }),
  });
  const data = await res.json();
  console.log('Token response:', JSON.stringify(data).substring(0, 200));
  if (data.token) return data.token;
  throw new Error(data.msg || 'No token received');
}

async function getPlanes(token) {
  console.log('\n=== Querying EmisorPlan /api/planes ===');
  const res = await fetch(`${EMISOR_PLAN_BASE}/api/planes`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  
  if (!Array.isArray(data)) {
    console.log('Planes response (not array):', JSON.stringify(data).substring(0, 500));
    return [];
  }
  
  console.log(`Found ${data.length} planes total`);
  
  // Show ALL plans with their details
  data.forEach(p => {
    const desc = p.descripcion || p.nombreplan || p.tipoplan || '';
    const tipo = p.tipoplan || '';
    console.log(`  Plan ${p.plan}: ${desc} | tipo=${tipo} | prima=${p.prima} | primaConImpuesto=${p.primaconimpuesto} | ramo=${p.ramo}/${p.subramo}`);
  });
  
  // Filter DT plans
  const dtPlans = data.filter(p => {
    const desc = (p.descripcion || p.nombreplan || p.tipoplan || '').toUpperCase();
    return desc.includes('TERCERO') || desc.includes('D.T') || desc.includes('DT') || 
           desc.includes('DAÑO') || desc.includes('DANO') ||
           p.plan === 426 || p.plan === 1000 || p.plan === 1002;
  });
  
  console.log(`\n=== DT Plans (${dtPlans.length}) ===`);
  dtPlans.forEach(p => {
    console.log(JSON.stringify(p, null, 2));
  });
  
  return data;
}

async function getCotizacionEmisorExterno() {
  console.log('\n=== Querying Emisor Externo get_cotizacion (plan 426) ===');
  
  // Option A (Basic): B=5,000, no medical, with endoso
  const basicParams = {
    Ano: new Date().getFullYear(),
    Uso: '10',
    CantidadPasajeros: 5,
    SumaAsegurada: '0',
    CodLimiteLesiones: '5',
    CodPlan: '426',
    CodMarca: '5',
    CodModelo: '10',
    Nombre: 'COTIZACION',
    Apellido: 'WEB',
    Cedula: '0-0-0',
    Telefono: '00000000',
    Email: 'cotizacion@web.com',
    Usuario: USUARIO,
    Clave: CLAVE,
    CodLimitePropiedad: '13',   // B = 5,000
    CodLimiteGastosMedico: '0', // Sin gastos médicos
    EndosoIncluido: 'S',
  };
  
  const basicRes = await fetch(`${EMISOR_EXTERNO_BASE}/Polizas/get_cotizacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(basicParams),
  });
  const basicData = await basicRes.json();
  
  if (!Array.isArray(basicData)) {
    console.log('Basic cotización error:', JSON.stringify(basicData).substring(0, 300));
    return;
  }
  
  // Option A coverages
  const basicAll = basicData.filter(c => c.OPCION === 'A');
  const OPCION_A_COVERAGES = ['A', 'B', 'FAB', 'H-1', 'K6'];
  const basicCoverages = basicAll.filter(c => OPCION_A_COVERAGES.includes(c.COBERTURA));
  
  const idCotBasic = basicAll[0]?.COTIZACION;
  const basicPrima = basicCoverages.reduce((s, c) => s + (c.PRIMA_IMPUESTO || 0), 0);
  const basicPrimaRounded = Math.round(basicPrima);
  
  console.log('\n--- Emisor Externo Plan 426 Option A (Basic) ---');
  console.log('idCotizacion:', idCotBasic);
  console.log('Coverages:');
  basicCoverages.forEach(c => {
    console.log(`  ${c.COBERTURA}: PRIMA=${c.PRIMA}, PRIMA_IMPUESTO=${c.PRIMA_IMPUESTO}, LIMITE=${c.LIMITE}`);
  });
  console.log('Total PRIMA_IMPUESTO (exact):', basicPrima);
  console.log('Total PRIMA_IMPUESTO (rounded):', basicPrimaRounded);
  
  // Premium option
  const premiumParams = {
    ...basicParams,
    CodLimitePropiedad: '8',    // B = 10,000
    CodLimiteGastosMedico: '23', // 500/2,500
    EndosoIncluido: 'S',
  };
  
  const premiumRes = await fetch(`${EMISOR_EXTERNO_BASE}/Polizas/get_cotizacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(premiumParams),
  });
  const premiumData = await premiumRes.json();
  
  if (!Array.isArray(premiumData)) {
    console.log('Premium cotización error:', JSON.stringify(premiumData).substring(0, 300));
    return;
  }
  
  const premiumAll = premiumData.filter(c => c.OPCION === 'A');
  const OPCION_C_COVERAGES = ['A', 'B', 'C', 'FAV', 'H-1', 'K6'];
  const premiumCoverages = premiumAll.filter(c => OPCION_C_COVERAGES.includes(c.COBERTURA));
  
  const idCotPremium = premiumAll[0]?.COTIZACION;
  const premiumPrima = premiumCoverages.reduce((s, c) => s + (c.PRIMA_IMPUESTO || 0), 0);
  const premiumPrimaRounded = Math.round(premiumPrima);
  
  console.log('\n--- Emisor Externo Plan 426 Option C (Premium) ---');
  console.log('idCotizacion:', idCotPremium);
  console.log('Coverages:');
  premiumCoverages.forEach(c => {
    console.log(`  ${c.COBERTURA}: PRIMA=${c.PRIMA}, PRIMA_IMPUESTO=${c.PRIMA_IMPUESTO}, LIMITE=${c.LIMITE}`);
  });
  console.log('Total PRIMA_IMPUESTO (exact):', premiumPrima);
  console.log('Total PRIMA_IMPUESTO (rounded):', premiumPrimaRounded);
  
  return { idCotBasic, basicPrima, basicPrimaRounded, idCotPremium, premiumPrima, premiumPrimaRounded };
}

async function main() {
  try {
    // 1. Get EmisorPlan token and query plans
    const token = await getToken('DEV');
    const allPlans = await getPlanes(token);
    
    // 2. Get Emisor Externo cotización for comparison
    const cotData = await getCotizacionEmisorExterno();
    
    // 3. Compare
    if (cotData && allPlans.length > 0) {
      console.log('\n\n========================================');
      console.log('COMPARISON: Emisor Externo vs EmisorPlan');
      console.log('========================================');
      
      const plan426 = allPlans.find(p => p.plan === 426);
      const plan1000 = allPlans.find(p => p.plan === 1000);
      const plan1002 = allPlans.find(p => p.plan === 1002);
      
      console.log('\nEmisor Externo Plan 426 Basic prima:', cotData.basicPrima, '(rounded:', cotData.basicPrimaRounded, ')');
      console.log('Emisor Externo Plan 426 Premium prima:', cotData.premiumPrima, '(rounded:', cotData.premiumPrimaRounded, ')');
      
      if (plan426) {
        console.log('\nEmisorPlan Plan 426:', JSON.stringify({ prima: plan426.prima, primaconimpuesto: plan426.primaconimpuesto }));
      } else {
        console.log('\nEmisorPlan Plan 426: NOT FOUND in EmisorPlan API');
      }
      if (plan1000) {
        console.log('EmisorPlan Plan 1000:', JSON.stringify({ prima: plan1000.prima, primaconimpuesto: plan1000.primaconimpuesto, descripcion: plan1000.descripcion }));
      }
      if (plan1002) {
        console.log('EmisorPlan Plan 1002:', JSON.stringify({ prima: plan1002.prima, primaconimpuesto: plan1002.primaconimpuesto, descripcion: plan1002.descripcion }));
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
