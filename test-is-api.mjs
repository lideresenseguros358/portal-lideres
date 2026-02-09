// IS API test v5 — based on ACTUAL Swagger spec (swagger.json)
// KEY FINDINGS from Swagger:
//   POST /api/tokens                              → generate daily token
//   GET  /api/tokens/diario                       → retrieve daily token
//   GET  /api/tokens/auto                         → auto-specific token?
//   POST /api/cotizaemisorauto/generarcotizacion  → JSON body (CotizadorRequest)
//   POST /api/cotizaemisorauto/getemision         → JSON body (EmisorRequest)
//   GET  /api/cotizaemisorauto/getlistacoberturas/{idpv}
//   GET  /api/cotizaemisorauto/getpreciosplanesterceros/{vCodPlan}

const PRIMARY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiTFNFR1dTIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiMzIiLCJpc3MiOiJodHRwczovL3d3dy5pc2VndXJvcy5jb20iLCJhdWQiOiJhcGlWaWRhU2FsdXNDb3JlU0lTRSJ9.HomXGjaD5od8Ob34IUqdjGhy6GpR9iEO9AmUcFPI1PI';
const BASE = 'https://www.iseguros.com/APIRestIsTester/api';

async function api(label, path, token, method = 'GET', jsonBody = null) {
  const url = `${BASE}${path}`;
  try {
    const opts = { method, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } };
    if (jsonBody) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(jsonBody);
    }
    const r = await fetch(url, opts);
    const body = await r.text();
    let data;
    try { data = JSON.parse(body); } catch { data = body; }
    console.log(`[${label}] ${method} ${r.status}`);
    return { status: r.status, data, raw: body };
  } catch(e) {
    console.log(`[${label}] ERROR: ${e.message}`);
    return { status: 0, data: null, raw: '' };
  }
}

function parse(res) {
  if (typeof res.data === 'string') { try { return JSON.parse(res.data); } catch { return res.data; } }
  return res.data;
}

async function test() {
  // ===== STEP 1: Get daily token =====
  console.log('=== STEP 1: Get daily token ===');
  let dailyToken = null;

  // 1a: POST /tokens (generate)
  const genRes = await api('POST /tokens', '/tokens', PRIMARY, 'POST');
  if (genRes.status === 200) {
    dailyToken = genRes.data?.token || genRes.raw.replace(/^"|"$/g, '');
    if (!dailyToken?.startsWith('eyJ')) dailyToken = null;
  }
  console.log('  POST /tokens:', genRes.status, '|', genRes.raw?.substring(0, 120));

  // 1b: GET /tokens/diario (retrieve)
  if (!dailyToken) {
    const retRes = await api('GET /tokens/diario', '/tokens/diario', PRIMARY);
    if (retRes.status === 200) {
      let t = retRes.raw.replace(/^"|"$/g, '');
      if (t.startsWith('eyJ')) {
        const payload = JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString());
        const exp = payload.exp ? new Date(payload.exp * 1000) : null;
        const expired = exp && exp < new Date();
        console.log('  /tokens/diario exp:', exp?.toISOString(), 'expired:', expired);
        if (!expired) dailyToken = t;
      }
    }
  }

  // 1c: GET /tokens/auto (auto-specific?)
  console.log('  --- Testing /tokens/auto ---');
  const autoTokenRes = await api('GET /tokens/auto', '/tokens/auto', PRIMARY);
  console.log('  /tokens/auto:', autoTokenRes.status, '|', autoTokenRes.raw?.substring(0, 120));
  let autoToken = null;
  if (autoTokenRes.status === 200) {
    let t = autoTokenRes.raw.replace(/^"|"$/g, '');
    if (typeof autoTokenRes.data === 'object' && autoTokenRes.data?.token) t = autoTokenRes.data.token;
    if (t?.startsWith('eyJ')) {
      autoToken = t;
      console.log('  ✅ Got auto-specific token!');
    }
  }

  const token = dailyToken || autoToken;
  if (!token) { console.error('❌ No valid token obtained. Aborting.'); return; }
  console.log('  Using token (50):', token.substring(0, 50) + '...\n');

  // ===== STEP 2: Catalogs =====
  console.log('=== STEP 2: Marcas ===');
  const marcas = parse(await api('getmarcas', '/cotizaemisorauto/getmarcas', token));
  const toyota = marcas?.Table?.find(m => m.TXT_DESC === 'TOYOTA');
  const codMarca = toyota ? Math.floor(toyota.COD_MARCA) : 2;
  console.log('  Total:', marcas?.Table?.length, '| Toyota COD_MARCA:', codMarca);

  console.log('\n=== STEP 3: Modelos ===');
  const modelos = parse(await api('getmodelos', '/cotizaemisorauto/getmodelos/1/100', token));
  const toyotaModel = modelos?.Table?.find(m => Math.floor(m.COD_MARCA) === codMarca);
  const codModelo = toyotaModel ? Math.floor(toyotaModel.COD_MODELO) : 3;
  console.log('  Total:', modelos?.Table?.length, '| Toyota model:', toyotaModel?.TXT_DESC, 'COD_MODELO:', codModelo);

  console.log('\n=== STEP 4: Tipo Planes ===');
  const tipoPlanes = parse(await api('gettipoplanes', '/cotizaemisorauto/gettipoplanes', token));
  console.log('  Planes:', JSON.stringify(tipoPlanes?.Table?.map(p => `${p.DATO}:${p.TEXTO}`) || []));

  console.log('\n=== STEP 5: Grupo Tarifa (tipo=3 DAT) ===');
  const grupo = parse(await api('getgrupotarifa', '/cotizaemisorauto/getgrupotarifa/3', token));
  const codGrupo = grupo?.Table?.[0]?.DATO ? Math.floor(grupo.Table[0].DATO) : 20;
  console.log('  Grupos:', JSON.stringify(grupo?.Table || []), '| Using:', codGrupo);

  console.log('\n=== STEP 6: Planes (tipo=3 DAT) ===');
  const planes = parse(await api('getplanes', '/cotizaemisorauto/getplanes/3', token));
  console.log('  Planes:', JSON.stringify(planes?.Table?.map(p => `${Math.floor(p.DATO)}:${p.TEXTO}`) || []));
  const codPlan = planes?.Table?.[0]?.DATO ? Math.floor(planes.Table[0].DATO) : 306;

  console.log('\n=== STEP 6.5: Precios planes terceros ===');
  const precios = await api('getpreciosplanesterceros', `/cotizaemisorauto/getpreciosplanesterceros/${codPlan}`, token);
  console.log('  Precios:', precios.raw?.substring(0, 300));

  // ===== STEP 7: GENERATE QUOTE — POST with JSON body =====
  console.log('\n=== STEP 7: POST /generarcotizacion (JSON body) ===');
  const cotizadorRequest = {
    codTipoDoc: 1,
    nroDoc: "8-000-000",
    nroNit: "8-000-000",
    nombre: "PRUEBA",
    apellido: "PRUEBA",
    telefono: "60606060",
    correo: "prueba@prueba.com",
    codMarca: codMarca,
    codModelo: codModelo,
    sumaAseg: "0",
    anioAuto: "2023",
    codPlanCobertura: codPlan,
    codPlanCoberturaAdic: 0,
    codGrupoTarifa: codGrupo,
    cantOcupantes: "0",
    codPlanCobAsiento: "0"
  };
  console.log('  Request:', JSON.stringify(cotizadorRequest));
  
  const quoteRes = await api('generarcotizacion', '/cotizaemisorauto/generarcotizacion', token, 'POST', cotizadorRequest);
  const quoteData = parse(quoteRes);
  console.log('  Status:', quoteRes.status);
  console.log('  Response:', JSON.stringify(quoteData?.Table?.[0] || quoteData).substring(0, 500));

  // Also try with autoToken if different
  if (autoToken && autoToken !== token) {
    console.log('\n  --- Retry with autoToken ---');
    const q2 = await api('generarcotizacion-auto', '/cotizaemisorauto/generarcotizacion', autoToken, 'POST', cotizadorRequest);
    console.log('  Status:', q2.status, '| Body:', q2.raw?.substring(0, 300));
  }

  const tableRow = quoteData?.Table?.[0];
  if (tableRow?.RESOP === 1 && tableRow?.IDCOT) {
    console.log('\n  ✅ QUOTE SUCCESS! IDCOT:', tableRow.IDCOT, 'PTOTAL:', tableRow.PTOTAL);

    // ===== STEP 8: Get coberturas =====
    console.log('\n=== STEP 8: GET /getlistacoberturas/{idpv} ===');
    const cobRes = await api('getlistacoberturas', `/cotizaemisorauto/getlistacoberturas/${tableRow.IDCOT}`, token);
    const cobData = parse(cobRes);
    console.log('  Status:', cobRes.status);
    console.log('  Coberturas:', JSON.stringify(cobData?.Table?.slice(0, 3) || cobData).substring(0, 500));
  } else {
    console.log('\n  ❌ Quote failed:', tableRow?.MSG || quoteData);
  }

  console.log('\n=== DONE ===');
}

test().catch(e => console.error('Fatal:', e));
