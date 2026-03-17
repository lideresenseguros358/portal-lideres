// Test GenerarNoDocumento directly against ANCON SOAP API
const url = 'https://app.asegurancon.com/ws_emisiones/server_otros.php';

async function test() {
  // 1. Get token
  const tokenEnv = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros">',
    '  <soap:Body>',
    '    <tns:GenerarToken><par_usuario>01009</par_usuario><par_password>750840840940840</par_password></tns:GenerarToken>',
    '  </soap:Body>',
    '</soap:Envelope>',
  ].join('\n');

  const tokenRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'urn:server_otros#GenerarToken' },
    body: tokenEnv,
  });
  const tokenXml = await tokenRes.text();
  // Extract JSON from <data> tag (HTML-encoded)
  const dataMatch = tokenXml.match(/<data[^>]*>([\s\S]*?)<\/data>/);
  let token = '';
  if (dataMatch) {
    const decoded = dataMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    console.log('Decoded data:', decoded.substring(0, 300));
    try {
      const json = JSON.parse(decoded);
      token = json.Login?.[0]?.Token || '';
    } catch { /* not JSON */ }
  }
  console.log('Token:', token ? token.substring(0, 30) + '...' : 'EMPTY');

  // 2. GenerarNodocumento
  const genEnv = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros">',
    '  <soap:Body>',
    '    <tns:GenerarNodocumento>',
    '      <cod_compania>001</cod_compania>',
    '      <cod_sucursal>009</cod_sucursal>',
    '      <ano>2025</ano>',
    '      <cod_ramo>002</cod_ramo>',
    '      <cod_subramo>001</cod_subramo>',
    `      <token>${token}</token>`,
    '    </tns:GenerarNodocumento>',
    '  </soap:Body>',
    '</soap:Envelope>',
  ].join('\n');

  const genRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'urn:server_otros#GenerarNodocumento' },
    body: genEnv,
  });
  const genXml = await genRes.text();
  console.log('\nGenerarNoDocumento response:');
  console.log(genXml.substring(0, 1200));
}

test().catch(e => console.error('Error:', e.message));
