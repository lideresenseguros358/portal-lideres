// Step 1: Call get_cotizacion directly to see what SUBRAMO is returned
const cotBody = {
  Ano: 2021, Uso: '10', CantidadPasajeros: 5, SumaAsegurada: '15000',
  CodLimiteLesiones: '1', CodLimitePropiedad: '7', CodLimiteGastosMedico: '16',
  EndosoIncluido: 'S', CodPlan: '461',
  CodMarca: 'TOY', CodModelo: 'COROLLA',
  Nombre: 'PRUEBA', Apellido: 'TEST', Cedula: '8-999-2222',
  Telefono: '60002222', Email: 'test@lideresenseguros.com',
  Usuario: 'SLIDERES', Clave: 'lider836',
};

console.log('=== STEP 1: get_cotizacion — check SUBRAMO field ===');
const cotRes = await fetch('https://wscanales.segfedpa.com/EmisorFedpa.Api/api/Polizas/get_cotizacion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cotBody),
});
const cotData = await cotRes.json();
const first = Array.isArray(cotData) ? cotData[0] : cotData;
console.log('Keys in first cobertura:', Object.keys(first));
console.log('SUBRAMO:', first.SUBRAMO, '| SubRamo:', first.SubRamo);
console.log('RAMO:', first.RAMO, '| Ramo:', first.Ramo);
console.log('COTIZACION:', first.COTIZACION);
console.log('Full first cobertura:', JSON.stringify(first, null, 2));
