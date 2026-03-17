/**
 * Query FEDPA EmisorPlan API to discover available DT plans
 * This calls the internal API routes which handle token auth
 */

const BASE = 'http://localhost:3000';

async function queryPlans() {
  console.log('═══ Querying FEDPA Plans via /api/fedpa/planes ═══\n');
  
  // Check if there's a direct planes endpoint
  try {
    const res = await fetch(`${BASE}/api/fedpa/planes?environment=DEV`);
    const data = await res.json();
    console.log(`Plans response (${res.status}):`, JSON.stringify(data, null, 2).substring(0, 2000));
  } catch (err) {
    console.log('No /api/fedpa/planes endpoint:', err.message);
  }

  // Try the third-party quote endpoint  
  console.log('\n═══ Querying via /api/is/auto/third-party ═══\n');
  try {
    const res = await fetch(`${BASE}/api/is/auto/third-party`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ano: '2022',
        uso: '10',
        cantidadPasajeros: '5',
        marca: 'TOY',
        modelo: 'COROLLA',
        nombre: 'Carlos',
        apellido: 'Martinez',
        cedula: '8-888-1001',
        telefono: '67001001',
        email: 'test@example.com',
      }),
    });
    const data = await res.json();
    console.log(`Third-party response (${res.status}):`, JSON.stringify(data, null, 2).substring(0, 2000));
  } catch (err) {
    console.log('Third-party error:', err.message);
  }
}

queryPlans().catch(console.error);
