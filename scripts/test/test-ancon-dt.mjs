/**
 * Quick test: ANCON DT product discovery + DT-only pricing
 */
const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';

function envXml(m, p) {
  const px = Object.entries(p).map(([k,v]) => `<${k}>${v}</${k}>`).join('');
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${m}>${px}</tns:${m}></soap:Body></soap:Envelope>`;
}

async function soap(m, p) {
  const r = await fetch(SOAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml;charset=utf-8', SOAPAction: `urn:server_otros#${m}` },
    body: envXml(m, p),
  });
  const t = await r.text();
  let match = t.match(/<return[^>]*>([\s\S]*?)<\/return>/) || t.match(/<data[^>]*>([\s\S]*?)<\/data>/);
  if (!match) return t;
  let d = match[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"');
  const jm = d.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jm) try { return JSON.parse(jm[1]); } catch {}
  return d;
}

(async () => {
  // Login
  const login = await soap('GenerarToken', { par_usuario: '01009', par_password: '750840840940840' });
  const token = login?.Login?.[0]?.Token;
  console.log('Token:', token ? 'OK' : 'FAIL');

  // Products
  const prods = await soap('Listaproductos', { token });
  console.log('\nProducts:', JSON.stringify(prods).substring(0, 1000));

  // Cotización with suma_asegurada=0 (DT only — no comprehensive value)
  console.log('\n--- Estandar with suma_asegurada=0 ---');
  const cot0 = await soap('Estandar', {
    token, cod_marca: '00122', cod_modelo: '10393', ano: '2024',
    suma_asegurada: '0', cod_producto: '00312',
    cedula: '8-888-9999', nombre: 'TEST', apellido: 'DT',
    vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
    fecha_nac: '16/06/1994', nuevo: '0',
  });

  if (cot0?.cotizacion?.opcion1) {
    cot0.cotizacion.opcion1.forEach(c =>
      console.log(`  ${c.Cobertura} | L1:${c.Limite1} | a:${c.TarifaPrima_a} b:${c.TarifaPrima_b} c:${c.TarifaPrima_c}`)
    );
  } else {
    console.log('Response:', JSON.stringify(cot0).substring(0, 500));
  }

  // Cotización with normal suma for CC
  console.log('\n--- Estandar with suma_asegurada=18000 (CC) ---');
  const cotCC = await soap('Estandar', {
    token, cod_marca: '00122', cod_modelo: '10393', ano: '2024',
    suma_asegurada: '18000', cod_producto: '00312',
    cedula: '8-888-9999', nombre: 'TEST', apellido: 'CC',
    vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
    fecha_nac: '16/06/1994', nuevo: '0',
  });

  if (cotCC?.cotizacion) {
    for (const [key, covs] of Object.entries(cotCC.cotizacion)) {
      const totals = covs.find(c => c.Cobertura === 'Totales');
      const noCot = covs.find(c => c.Cobertura === 'NoCotizacion');
      if (totals) console.log(`  ${key}: total_a=$${totals.TarifaPrima_a} total_b=$${totals.TarifaPrima_b} total_c=$${totals.TarifaPrima_c}`);
      if (noCot) console.log(`    NoCot: ${noCot.Descripcion1}`);
      // Show all coverages
      covs.filter(c => !['Totales','Totales_N','Totales_I','NoCotizacion'].includes(c.Cobertura))
        .forEach(c => console.log(`    ${c.Cobertura}: L1=${c.Limite1} prima_a=${c.TarifaPrima_a}`));
    }
  }

  console.log('\n✅ Done');
})().catch(e => console.error('FATAL:', e.message));
