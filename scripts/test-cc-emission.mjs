/**
 * Test script for Emisor Externo CC emission
 * Isolates the crear_poliza_auto_cc_externos payload issues
 */

const API = 'https://wscanales.segfedpa.com/EmisorFedpa.Api/api';
const U = 'SLIDERES';
const C = 'lider836';

function pad(n) { return String(n).padStart(2, '0'); }

function fechaDD_MM_YY() {
  const now = new Date();
  return pad(now.getDate()) + '/' + pad(now.getMonth() + 1) + '/' + String(now.getFullYear()).slice(-2);
}

function fechaFinDD_MM_YY() {
  const now = new Date();
  const h = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  return pad(h.getDate()) + '/' + pad(h.getMonth() + 1) + '/' + String(h.getFullYear()).slice(-2);
}

async function getCotizacion() {
  const r = await fetch(API + '/Polizas/get_cotizacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Ano: 2024, Uso: '10', CantidadPasajeros: 5, SumaAsegurada: '15000',
      CodLimiteLesiones: '5', CodLimitePropiedad: '5', CodLimiteGastosMedico: '1',
      EndosoIncluido: 'S', CodPlan: '461', CodMarca: 'TOY', CodModelo: 'COROLLA',
      Nombre: 'TEST', Apellido: 'CC', Cedula: '8-999-9999',
      Telefono: '60001234', Email: 'test@test.com', Usuario: U, Clave: C,
    }),
  });
  const d = await r.json();
  const c0 = d[0];
  return { cotizacion: c0.COTIZACION, ramo: c0.RAMO, subramo: c0.SUBRAMO, prima: c0.TOTAL_PRIMA_IMPUESTO };
}

async function getNroPoliza() {
  const r = await fetch(API + '/Polizas/get_nropoliza', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Ano: 2024, Uso: '10', CantidadPasajeros: 5, SumaAsegurada: '15000',
      CodPlan: '461', CodMarca: 'TOY', CodModelo: 'COROLLA',
      Nombre: 'T', Apellido: 'C', Cedula: '8-999-9999',
      Telefono: '6', Email: 't@t.com', Usuario: U, Clave: C,
    }),
  });
  const d = await r.json();
  return d[0].NUMPOL;
}

async function emitir(cantidadPago) {
  const cot = await getCotizacion();
  const numpol = await getNroPoliza();
  const polFmt = cot.ramo + '-' + cot.subramo + '-' + numpol + '-0';
  const desde = fechaDD_MM_YY();
  const hasta = fechaFinDD_MM_YY();

  const data = {
    FechaHora: desde,
    Monto: String(cot.prima),
    Aprobada: 'S',
    NroTransaccion: 'SMOKE' + Date.now(),
    FechaAprobada: desde,
    Ramo: cot.ramo,
    SubRamo: cot.subramo,
    IdCotizacion: String(cot.cotizacion),
    NroPoliza: polFmt,
    Certificado: '0',
    FechaDesde: desde,
    FechaHasta: hasta,
    Opcion: 'B',
    CantidadPago: String(cantidadPago),
    Plan: '461',
    Usuario: U,
    Clave: C,
    Entidad: [{
      Juridico: 'N',
      NombreCompleto: 'TEST CC EMISOR',
      PrimerNombre: 'TEST',
      SegundoNombre: '',
      PrimerApellido: 'CC',
      SegundoApellido: 'EMISOR',
      DocumentoIdentificacion: 'C',
      Cedula: '8-999-9999',
      Ruc: '',
      CodPais: '507',
      CodProvincia: '8',
      CodCorregiemiento: '1',
      Email: 'test@test.com',
      TelefonoOficina: '60001234',
      Celular: '60001234',
      Direccion: 'PANAMA CITY TEST',
      IdVinculo: '1',
      FechaNacimiento: '15/06/90',
      Sexo: 'M',
      Ocupacion: '99',
    }],
    Auto: {
      CodMarca: 'TOY',
      CodModelo: 'COROLLA',
      Ano: '2024',
      Placa: 'TST999',
      Chasis: 'VIN123456789012345',
      Motor: 'MOT123456',
      Color: 'BLANCO',
      Uso: '10',
      SumaAsegurada: '15000',
      CantidadPasajeros: '5',
    },
  };

  console.log(`  NroPoliza: ${polFmt} | IdCot: ${cot.cotizacion} | Prima: $${cot.prima} | CantPago: ${cantidadPago}`);

  const fd = new FormData();
  fd.append('data', JSON.stringify(data));

  // Create minimal valid PDF
  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`;
  const pdfBlob = new Blob([Buffer.from(pdfContent)], { type: 'application/pdf' });
  fd.append('File1', pdfBlob, 'cedula.pdf');
  fd.append('File2', pdfBlob, 'licencia.pdf');
  fd.append('File3', pdfBlob, 'foto_vehiculo.pdf');

  const r = await fetch(API + '/Polizas/crear_poliza_auto_cc_externos', {
    method: 'POST',
    body: fd,
  });
  const txt = await r.text();
  return { status: r.status, response: txt };
}

async function main() {
  console.log('=== Test Emisor Externo CC Emission ===\n');

  // Test different FechaNacimiento formats
  const fechaTests = [
    '01/06/90',   // dd/mm/yy — June 1, 1990
    '06/01/90',   // mm/dd/yy — June 1, 1990
    '01-JUN-90',  // Oracle NLS
  ];

  for (const fn of fechaTests) {
    console.log(`Test: FechaNacimiento='${fn}'`);
    const r = await emitirWithFecha(fn);
    console.log(`  Status: ${r.status}`);
    console.log(`  Response: ${r.response.substring(0, 200)}\n`);
  }
}

async function emitirWithFecha(fechaNac) {
  const cot = await getCotizacion();
  const numpol = await getNroPoliza();
  const polFmt = cot.ramo + '-' + cot.subramo + '-' + numpol + '-0';
  const desde = fechaDD_MM_YY();
  const hasta = fechaFinDD_MM_YY();

  const data = {
    FechaHora: desde, Monto: String(cot.prima), Aprobada: 'S',
    NroTransaccion: 'SM' + Date.now(), FechaAprobada: desde,
    Ramo: cot.ramo, SubRamo: cot.subramo,
    IdCotizacion: String(cot.cotizacion), NroPoliza: polFmt,
    Certificado: '0', FechaDesde: desde, FechaHasta: hasta,
    Opcion: 'B', CantidadPago: '1', Plan: '461', Usuario: U, Clave: C,
    Entidad: [{
      Juridico: 'N', NombreCompleto: 'TEST CC',
      PrimerNombre: 'TEST', SegundoNombre: '',
      PrimerApellido: 'CC', SegundoApellido: 'EMISOR',
      DocumentoIdentificacion: 'C', Cedula: '8-999-9999', Ruc: '',
      CodPais: '507', CodProvincia: '8', CodCorregiemiento: '1',
      Email: 'test@test.com', TelefonoOficina: '60001234',
      Celular: '60001234', Direccion: 'PANAMA CITY',
      IdVinculo: '1', FechaNacimiento: fechaNac, Sexo: 'M', Ocupacion: '99',
    }],
    Auto: {
      CodMarca: 'TOY', CodModelo: 'COROLLA', Ano: '2024',
      Placa: 'TST999', Chasis: 'VIN12345678901', Motor: 'MOT12345',
      Color: 'BLANCO', Uso: '10', SumaAsegurada: '15000', CantidadPasajeros: '5',
    },
  };

  const fd = new FormData();
  fd.append('data', JSON.stringify(data));
  const pdfBlob = new Blob([Buffer.from('%PDF-1.4 test')], { type: 'application/pdf' });
  fd.append('File1', pdfBlob, 'cedula.pdf');
  fd.append('File2', pdfBlob, 'licencia.pdf');
  fd.append('File3', pdfBlob, 'foto.pdf');

  const r = await fetch(API + '/Polizas/crear_poliza_auto_cc_externos', { method: 'POST', body: fd });
  return { status: r.status, response: await r.text() };
}

main().catch(e => console.error('Fatal:', e.message));
