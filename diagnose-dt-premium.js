/**
 * Diagnostic script: Compare premiums between Emisor Externo (plan 426) 
 * and EmisorPlan (plans 1000/1002) to find the mismatch.
 */

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('=== FEDPA DT Premium Diagnostic ===\n');

  // Step 1: Get cotización from Emisor Externo (plan 426) via our API
  console.log('--- Step 1: Emisor Externo Cotización (plan 426) ---');
  try {
    const cotRes = await fetch(`${BASE_URL}/api/fedpa/third-party`);
    const cotData = await cotRes.json();
    
    if (cotData.success) {
      console.log('Plan code used for cotización:', cotData.planCode);
      console.log('Emission plan codes:', JSON.stringify(cotData.emissionPlanCodes));
      console.log('idCotizacionBasic:', cotData.idCotizacionBasic);
      console.log('idCotizacionPremium:', cotData.idCotizacionPremium);
      console.log('Ramo:', cotData.ramo, 'Subramo:', cotData.subramo);
      
      for (const plan of cotData.plans) {
        console.log(`\n  Plan: ${plan.name} (${plan.planType})`);
        console.log(`    emissionPlanCode: ${plan.emissionPlanCode}`);
        console.log(`    annualPremium (rounded): ${plan.annualPremium}`);
        console.log(`    annualPremiumExact: ${plan.annualPremiumExact}`);
        console.log(`    idCotizacion: ${plan.idCotizacion}`);
        console.log(`    Coverages:`);
        for (const cov of plan.coverageList) {
          console.log(`      ${cov.code} - ${cov.name}: prima=${cov.prima}, primaBase=${cov.primaBase}, limit=${cov.limit}`);
        }
      }
    } else {
      console.log('Cotización failed:', cotData.error);
    }
  } catch (e) {
    console.error('Error fetching cotización:', e.message);
  }

  // Step 2: Get plans from EmisorPlan API via our planes endpoint
  console.log('\n\n--- Step 2: EmisorPlan Plans (via /api/fedpa/planes) ---');
  try {
    const planesRes = await fetch(`${BASE_URL}/api/fedpa/planes?environment=DEV&tipo=DANOS A TERCEROS`);
    const planesData = await planesRes.json();
    
    if (planesData.success) {
      console.log('Total DT plans:', planesData.count);
      
      // Look specifically for plans 1000, 1001, 1002
      const targetPlans = [1000, 1001, 1002, 426];
      for (const plan of planesData.data) {
        if (targetPlans.includes(plan.plan) || plan.plan >= 1000) {
          console.log(`\n  Plan ${plan.plan}: ${plan.nombreplan || plan.descripcion}`);
          console.log(`    tipoplan: ${plan.tipoplan}`);
          console.log(`    prima: ${plan.prima}`);
          console.log(`    impuesto1: ${plan.impuesto1}`);
          console.log(`    impuesto2: ${plan.impuesto2}`);
          console.log(`    primaconimpuesto: ${plan.primaconimpuesto}`);
          if (plan.coberturas && plan.coberturas.length > 0) {
            console.log(`    Coberturas:`);
            for (const cob of plan.coberturas) {
              console.log(`      ${cob.cobertura}: ${cob.descripcion} - prima=${cob.prima}, limite=${cob.limite}`);
            }
          }
        }
      }
      
      // Also show plan 426 if present
      const plan426 = planesData.data.find(p => p.plan === 426);
      if (plan426) {
        console.log(`\n  Plan 426 (reference): ${plan426.nombreplan || plan426.descripcion}`);
        console.log(`    prima: ${plan426.prima}`);
        console.log(`    primaconimpuesto: ${plan426.primaconimpuesto}`);
      }
    } else {
      console.log('Planes failed:', planesData.error);
    }

    // Also get ALL plans to check if 1000/1002 exist
    console.log('\n\n--- Step 2b: Check if plans 1000/1001/1002 exist in ALL plans ---');
    const allPlanesRes = await fetch(`${BASE_URL}/api/fedpa/planes?environment=DEV`);
    const allPlanesData = await allPlanesRes.json();
    if (allPlanesData.success) {
      const found = allPlanesData.data.filter(p => [1000, 1001, 1002].includes(p.plan));
      if (found.length > 0) {
        for (const plan of found) {
          console.log(`  Found plan ${plan.plan}: ${plan.nombreplan || plan.descripcion}`);
          console.log(`    prima: ${plan.prima}, primaconimpuesto: ${plan.primaconimpuesto}`);
          if (plan.coberturas) {
            console.log(`    coberturas count: ${plan.coberturas.length}`);
            for (const cob of plan.coberturas) {
              console.log(`      ${cob.cobertura}: prima=${cob.prima}`);
            }
          }
        }
      } else {
        console.log('  Plans 1000/1001/1002 NOT found in EmisorPlan API response');
        console.log('  Available plan IDs:', allPlanesData.data.map(p => p.plan).join(', '));
      }
    }
  } catch (e) {
    console.error('Error fetching planes:', e.message);
  }

  // Step 3: Try a direct cotización via EmisorPlan (if such endpoint exists)
  console.log('\n\n--- Step 3: Attempt EmisorPlan cotización for plans 1000/1002 ---');
  console.log('(This would require a dedicated EmisorPlan cotización endpoint, checking...)');
  
  // Check the planes.service to see if it returns premiums for 1000/1002
  // The planes endpoint already should return this data if the plans exist
  
  console.log('\n=== Diagnostic Complete ===');
}

main().catch(console.error);
