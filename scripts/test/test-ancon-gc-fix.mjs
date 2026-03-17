/**
 * Fix GuardarCliente — minimal test, single token, minimal calls
 * Issues found:
 * - figura='1' works
 * - cod_producto='2' or '41' — both get past product check
 * - prov_residencia needs correct format (not '008')
 * 
 * Test: Token → Estandar → GuardarCliente with fixed prov_residencia
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
  const t0 = Date.now();
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const elapsed = Date.now() - t0;
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 800);
  console.log(`[${label}] (${elapsed}ms) → ${JSON.stringify(parsed).substring(0, 400)}`);
  return parsed;
}

async function main() {
  console.log('═══ FIX GUARDAR CLIENTE ═══\n');

  // 1. Token
  const loginRes = await soap('LOGIN', 'GenerarToken', { par_usuario: USUARIO, par_password: PASSWORD });
  const token = loginRes?.Login?.[0]?.Token;
  if (!token) { console.error('Login failed'); return; }

  // 2. Cotización — minimal
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
  console.log(`NoCot: ${noCot}\n`);
  if (!noCot) return;

  // 3. GuardarCliente with prov_residencia as text 'PANAMÁ' instead of code '008'
  // Doc says: prov_residencia: Método ListaProvincia — catalog returns {cod_provres: '008', nombre: 'PANAMÁ'}
  // But the field might need the NAME not the CODE
  const gc = await soap('GC', 'GuardarCliente', {
    tipo_persona: 'N',
    cod_producto: '41',
    pasaporte: '',
    primer_nombre: 'JUAN',
    segundo_nombre: '',
    primer_apellido: 'PEREZ',
    segundo_apellido: '',
    casada: '',
    fecha_nac: '16/06/1994',
    sexo: 'M',
    presidencia: 'PANAMÁ',
    nacionalidad: 'PANAMÁ',
    direccion_laboral: 'TEST',
    calle: 'CALLE 50',
    casa: '1',
    barriada: 'EL CANGREJO',
    corregimiento: 'BELLA VISTA',
    direccion_cobros: 'PANAMA',
    telefono1: '2221133',
    telefono2: '',
    celular: '60000001',
    celular2: '',
    email: 'test@test.com',
    apartado: '',
    ced_prov: '8',
    ced_inicial: '888',
    tomo: '9999',
    folio: '',
    asiento: '',
    ocupacion: '001',
    pais_nacimiento: 'PANAMÁ',
    ofondo: '001',
    monto_ingreso: '001',
    prov_residencia: 'PANAMÁ',
    cli_forpago: '002',
    cli_frepago: '002',
    cli_lista: '002',
    cli_fundacion: '002',
    cli_pep1: '002',
    asegurado_igual: '001',
    asegurado_benef: '004',
    asegurado_tercero: '006',
    cli_coa: '0',
    dv: '',
    rlegal: '',
    ncomercial: '',
    aoperacion: '',
    cod_actividad: '',
    cod_clianiocon: '',
    razon_social: '',
    token,
    no_cotizacion: noCot,
    figura: '1',
  });

  console.log('\nGuardarCliente result:', JSON.stringify(gc));
}

main().catch(e => console.error('Fatal:', e));
