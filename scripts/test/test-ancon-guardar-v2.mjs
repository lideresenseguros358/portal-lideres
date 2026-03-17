/**
 * GuardarCliente v2 — figura='1' worked but needs correct cod_producto
 * Doc says cod_producto: 41, not 07159. Let's fetch Listaproductos to find mapping.
 * Also test different cod_producto values with figura='1'.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function buildEnvelope(method, params) {
  const xml = Object.entries(params).filter(([,v]) => v != null).map(([k,v]) => `<${k}>${esc(String(v))}</${k}>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&ntilde;/g,'ñ').replace(/&oacute;/g,'ó'); }

async function soap(label, method, params) {
  const body = buildEnvelope(method, params);
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`  [${label}] → ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

async function main() {
  console.log('═══ GUARDAR CLIENTE — FIX FIGURA + COD_PRODUCTO ═══\n');

  const loginRes = await soap('LOGIN', 'GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = loginRes?.Login?.[0]?.Token;
  if (!token) { console.error('Login failed'); return; }

  // Fetch Listaproductos to understand cod_producto mapping
  console.log('\n── Listaproductos ──');
  const prods = await soap('PRODS', 'Listaproductos', { token });
  // Show all products to find the internal ID
  if (Array.isArray(prods)) {
    console.log(`  Total products: ${prods.length}`);
    // Find 07159 product
    const dt = prods.find(p => p.codigo_producto === '07159');
    console.log(`  DT product (07159):`, JSON.stringify(dt));
    // Find any product with codigo 41
    const p41 = prods.find(p => p.codigo_producto === '41' || p.codigo_producto === '041');
    console.log(`  Product 41:`, JSON.stringify(p41));
    // Show first 10 products
    console.log('  First 10 products:');
    for (const p of prods.slice(0, 10)) {
      console.log(`    ${p.codigo_producto} | ${p.codigo_ramo}/${p.codigo_subramo} | ${p.nombre_producto}`);
    }
  }

  // Get cotización
  const cotRes = await soap('COT', 'Estandar', {
    token, cod_marca: '00122', cod_modelo: '10393', ano: '2025',
    suma_asegurada: '0', cod_producto: '07159',
    cedula: '8-888-9999', nombre: 'JUAN', apellido: 'PEREZ',
    vigencia: 'A', email: 'test@test.com', tipo_persona: 'N',
    fecha_nac: '16/06/1994', nuevo: '0', responsable: 'CORREDOR',
  });
  let noCot = null;
  if (cotRes?.cotizacion) {
    for (const items of Object.values(cotRes.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCot = it.Descripcion1; break; } }
      }
      if (noCot) break;
    }
  }
  console.log(`\n  NoCot: ${noCot}`);
  if (!noCot) return;

  const gcBase = {
    tipo_persona: 'N', pasaporte: '',
    primer_nombre: 'JUAN', segundo_nombre: '', primer_apellido: 'PEREZ',
    segundo_apellido: '', casada: '', fecha_nac: '16/06/1994', sexo: 'M',
    presidencia: 'PANAMÁ', nacionalidad: 'PANAMÁ', direccion_laboral: 'TEST',
    calle: 'CALLE 50', casa: '1', barriada: 'EL CANGREJO', corregimiento: 'BELLA VISTA',
    direccion_cobros: 'PANAMA', telefono1: '2221133', telefono2: '', celular: '60000001',
    celular2: '', email: 'test@test.com', apartado: '', ced_prov: '8', ced_inicial: '888',
    tomo: '9999', folio: '', asiento: '', ocupacion: '001', pais_nacimiento: 'PANAMÁ',
    ofondo: '001', monto_ingreso: '001', prov_residencia: '008', cli_forpago: '002',
    cli_frepago: '002', cli_lista: '002', cli_fundacion: '002', cli_pep1: '002',
    asegurado_igual: '001', asegurado_benef: '004', asegurado_tercero: '006',
    cli_coa: '0', dv: '', rlegal: '', ncomercial: '', aoperacion: '',
    cod_actividad: '001', cod_clianiocon: '', razon_social: '', token, no_cotizacion: noCot,
    figura: '1',
  };

  // Try different cod_producto values
  const codProds = ['07159', '41', '002', '1', '2'];
  for (const cp of codProds) {
    console.log(`\n── GuardarCliente figura=1, cod_producto="${cp}" ──`);
    await soap(`GC-${cp}`, 'GuardarCliente', { ...gcBase, cod_producto: cp });
  }

  // Also try: maybe the NoCotizacion entry has deducible_a (ramo code) and TarifaPrima_a (subramo) info
  // From the cotización, NoCotizacion has: Deducible_a=002, TarifaPrima_a=001
  // These are cod_ramo and cod_subramo! So cod_producto in GuardarCliente is different from Estandar's
  // The doc says "cod_producto: 41" — this might be a TipoCliente-related code

  // Try with NoCotizacion info
  console.log('\n── GuardarCliente figura=1, cod_producto="" (empty) ──');
  await soap('GC-empty', 'GuardarCliente', { ...gcBase, cod_producto: '' });
}

main().catch(e => console.error('Fatal:', e));
