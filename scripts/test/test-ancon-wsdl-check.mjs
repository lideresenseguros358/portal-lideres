/**
 * Check WSDL definition for ListadoInspeccion, SubirDocumentos, ListadoExpedientes
 * to understand why they return "Token Inactivo" immediately.
 */

const SOAP_URL = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';

async function main() {
  console.log('=== WSDL CHECK ===\n');

  // Fetch WSDL
  const res = await fetch(SOAP_URL + '?wsdl');
  const wsdl = await res.text();

  // Find ListadoInspeccion definition
  const methods = ['ListadoInspeccion', 'EnlazarInspeccion', 'SubirDocumentos', 'ListadoExpedientes', 'GuardarCliente', 'EmitirDatos'];
  
  for (const method of methods) {
    console.log(`\n--- ${method} ---`);
    
    // Find message definition (input params)
    const msgMatch = wsdl.match(new RegExp(`<message name="${method}Request">[\\s\\S]*?</message>`));
    if (msgMatch) {
      console.log('Input params:');
      const parts = msgMatch[0].matchAll(/<part name="(\w+)" type="(\w+:?\w+)"/g);
      for (const p of parts) {
        console.log(`  - ${p[1]}: ${p[2]}`);
      }
    } else {
      console.log('  NOT FOUND in WSDL');
    }
  }

  // Also check if there's a different namespace or port for some methods
  console.log('\n\n--- Port/Binding info ---');
  const portMatch = wsdl.match(/<port[^>]*>[\s\S]*?<\/port>/g);
  if (portMatch) {
    for (const p of portMatch) {
      console.log(p.substring(0, 200));
    }
  }
  
  // Check for operation definitions
  console.log('\n--- Operations for ListadoInspeccion ---');
  const opMatch = wsdl.match(/<operation name="ListadoInspeccion"[\s\S]*?<\/operation>/g);
  if (opMatch) {
    for (const o of opMatch) {
      console.log(o.substring(0, 300));
    }
  }
}

main().catch(e => console.error('Fatal:', e));
