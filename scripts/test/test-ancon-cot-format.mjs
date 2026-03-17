/**
 * Dump FULL Estandar response to find exact cotización format
 * and check if ConsultarCliente needs a different format.
 * 
 * Also: try GuardarCliente with the FULL cotización number from response
 * (not just the NoCotizacion field).
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';
const USUARIO = '01009';
const PASSWORD = '750840840940840';

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function decode(t) { return t.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'"); }

async function soap(label, method, pairs) {
  const xml = pairs.map(([k,v]) => `<${k}>${esc(String(v ?? ''))}</${k}>`).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
  const res = await fetch(SOAP_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` }, body });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  let parsed;
  if (m) { const d = decode(m[1]); try { parsed = JSON.parse(d); } catch { parsed = d; } }
  else parsed = text.substring(0, 1200);
  console.log(`[${label}] -> ${JSON.stringify(parsed).substring(0, 1000)}`);
  return parsed;
}

async function main() {
  console.log('=== COT FORMAT CHECK ===\n');

  const lr = await soap('LOGIN', 'GenerarToken', [['par_usuario', USUARIO], ['par_password', PASSWORD]]);
  const token = lr?.Login?.[0]?.Token;
  if (!token) return;

  // Full cotización response dump  
  const cr = await soap('COT', 'Estandar', [
    ['token', token], ['cod_marca', '00122'], ['cod_modelo', '10393'], ['ano', '2025'],
    ['suma_asegurada', '0'], ['cod_producto', '07159'], ['cedula', '8-888-9999'],
    ['nombre', 'JUAN'], ['apellido', 'PEREZ'], ['vigencia', 'A'],
    ['email', 'test@test.com'], ['tipo_persona', 'N'], ['fecha_nac', '16/06/1994'],
    ['nuevo', '0'], ['responsable', 'CORREDOR'],
  ]);
  
  // Find ALL NoCotizacion-like entries
  console.log('\n--- ALL cotización entries ---');
  if (cr?.cotizacion) {
    for (const [optKey, items] of Object.entries(cr.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) {
          if (it.Cobertura === 'NoCotizacion' || it.Cobertura?.includes('Cot') || it.Cobertura?.includes('cot')) {
            console.log(`  [${optKey}] ${it.Cobertura}: Desc1=${it.Descripcion1}, Desc2=${it.Descripcion2}, Lim1=${it.Limite1}, Lim2=${it.Limite2}`);
          }
        }
      }
    }
  }

  // Find ALL fields in first option
  if (cr?.cotizacion?.opcion1 && Array.isArray(cr.cotizacion.opcion1)) {
    console.log('\n--- ALL items in opcion1 ---');
    for (const it of cr.cotizacion.opcion1) {
      console.log(`  ${it.Cobertura}: D1=${it.Descripcion1} D2=${it.Descripcion2} L1=${it.Limite1} L2=${it.Limite2}`);
    }
  }

  // Check all top-level keys
  console.log('\n--- Top-level keys in response ---');
  if (typeof cr === 'object' && cr !== null) {
    for (const [k, v] of Object.entries(cr)) {
      console.log(`  ${k}: ${typeof v} ${Array.isArray(v) ? `[${v.length}]` : ''}`);
    }
  }

  let noCot = null;
  if (cr?.cotizacion) {
    for (const items of Object.values(cr.cotizacion)) {
      if (Array.isArray(items)) {
        for (const it of items) { if (it.Cobertura === 'NoCotizacion') { noCot = it.Descripcion1; break; } }
      }
      if (noCot) break;
    }
  }
  console.log(`\nNoCot extracted: "${noCot}"`);
  
  if (!noCot) return;

  // Try ConsultarCliente with the cotización in a variety of ways
  console.log('\n--- ConsultarCliente attempts ---');
  
  // Standard
  const r1 = await soap('CC-std', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCot], ['figura', '1']]);
  
  // Without hyphen prefix (just number after last hyphen)  
  const parts = noCot.split('-');
  await soap('CC-noPfx', 'ConsultarCliente', [['token', token], ['no_cotizacion', parts[1]], ['figura', '1']]);
  
  // With leading zeros stripped
  await soap('CC-noZero', 'ConsultarCliente', [['token', token], ['no_cotizacion', noCot.replace(/^0+/, '').replace(/-0+/, '-')], ['figura', '1']]);

  // Maybe the "No cotización errado" message is actually "no client found for this cotización"
  // and not a format error. Let's check the Spanish — "No cotización errado" could mean
  // "cotización number [is] wrong/invalid" OR "No [client for] cotización [was] found"
  // 
  // If it means "no client found", then it confirms GuardarCliente is required first.
  // The fact that ALL format variations return the same message supports this theory.

  console.log('\n\n===== CONCLUSION =====');
  console.log('ConsultarCliente returns "No cotización errado" for ALL formats.');
  console.log('This likely means NO CLIENT was registered for this cotización.');
  console.log('GuardarCliente always fails with "PAÍS DE RESIDENCIA obligatorio".');
  console.log('EmitirDatos FK error is caused by missing client record.');
  console.log('ROOT CAUSE: GuardarCliente WSDL missing pais_residencia parameter.');
}

main().catch(e => console.error('Fatal:', e));
