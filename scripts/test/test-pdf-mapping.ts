/**
 * Unit tests for buildPdfDataFromPayload + generateAuthorizationPdf
 * Run: npx tsx -r tsconfig-paths/register scripts/test/test-pdf-mapping.ts
 */

import { buildPdfDataFromPayload, type ExpedientePayloadSources } from '@/lib/pdf/form-mapping';
import { generateAuthorizationPdf } from '@/lib/authorization-pdf';
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK PAYLOADS
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_DT_PAYLOAD: ExpedientePayloadSources = {
  clientData: {
    primerNombre: 'Juan',
    segundoNombre: 'Carlos',
    primerApellido: 'Pérez',
    segundoApellido: 'González',
    cedula: '8-123-4567',
    email: 'juan.perez@gmail.com',
    telefono: '6000-1234',
    celular: '6999-5678',
    direccion: 'Calle 50, Edificio Global Bank, Piso 3, Ciudad de Panamá',
    fechaNacimiento: '1985-03-15',
    sexo: 'M',
    estadoCivil: 'casado',
    esPEP: false,
    actividadEconomica: 'Ingeniero Civil',
    dondeTrabaja: 'Constructora ABC, S.A.',
    nivelIngresos: '30mil a 50mil',
  },
  vehicleData: {
    placa: 'AB1234',
    vinChasis: '1HGBH41JXMN109186',
    motor: 'L15B7',
    color: 'BLANCO',
    pasajeros: 5,
    puertas: 4,
  },
  quoteData: {
    marca: 'TOYOTA',
    modelo: 'COROLLA',
    anio: 2023,
    valorVehiculo: 0,
    cobertura: 'Daños a Terceros',
    primaTotal: 350,
  },
  tipoCobertura: 'DT',
  insurerName: 'Internacional de Seguros',
  nroPoliza: 'IS-AUTO-DT-2026-00123',
  pdfUrl: 'https://example.com/poliza.pdf',
  firmaDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};

const MOCK_CC_PAYLOAD: ExpedientePayloadSources = {
  clientData: {
    primerNombre: 'María',
    segundoNombre: '',
    primerApellido: 'Rodríguez',
    segundoApellido: 'Sánchez',
    cedula: 'E-8-12345',
    email: 'maria.rodriguez@outlook.com',
    telefono: '6100-9876',
    celular: '',
    direccion: 'Vía España, Torre Delta, Apto 12B',
    fechaNacimiento: '1990-11-28',
    sexo: 'F',
    estadoCivil: 'soltero',
    esPEP: true,
    actividadEconomica: 'Abogada',
    dondeTrabaja: 'Bufete Legal Rodríguez & Asociados',
    nivelIngresos: 'mas de 50mil',
  },
  vehicleData: {
    placa: 'CD5678',
    vinChasis: 'WVWZZZ3CZWE123456',
    motor: 'EA888',
    color: 'NEGRO',
    pasajeros: 5,
    puertas: 4,
  },
  quoteData: {
    marca: 'VOLKSWAGEN',
    modelo: 'TIGUAN',
    anio: 2024,
    valorVehiculo: 38500,
    cobertura: 'Cobertura Completa',
    primaTotal: 1850,
  },
  tipoCobertura: 'CC',
  insurerName: 'FEDPA Seguros',
  nroPoliza: 'FEDPA-CC-2026-00456',
  pdfUrl: 'https://example.com/poliza-cc.pdf',
  firmaDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};

const MOCK_INCOMPLETE_PAYLOAD: ExpedientePayloadSources = {
  clientData: {
    primerNombre: 'Test',
    primerApellido: 'User',
    cedula: '1-234-567',
    // Missing: email, telefono, direccion, fechaNacimiento, sexo, actividadEconomica, dondeTrabaja, nivelIngresos
  },
  vehicleData: {},
  quoteData: { marca: 'KIA' },
  tipoCobertura: 'DT',
  insurerName: 'Test Insurer',
  nroPoliza: '',
  pdfUrl: '',
  firmaDataUrl: '',
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: buildPdfDataFromPayload — DT (Third Party)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 1: buildPdfDataFromPayload — DT (Third Party)');
{
  const { pdfData, missingFields } = buildPdfDataFromPayload(MOCK_DT_PAYLOAD);

  assert(pdfData.kyc_nombreCompleto === 'Juan Carlos Pérez González', `Full name: "${pdfData.kyc_nombreCompleto}"`);
  assert(pdfData.kyc_cedula === '8-123-4567', `Cédula: "${pdfData.kyc_cedula}"`);
  assert(pdfData.kyc_fechaNacimiento === '15/03/1985', `Fecha nacimiento DD/MM/YYYY: "${pdfData.kyc_fechaNacimiento}"`);
  assert(pdfData.kyc_sexo === 'Masculino', `Sexo display: "${pdfData.kyc_sexo}"`);
  assert(pdfData.kyc_estadoCivil === 'Casado(a)', `Estado civil display: "${pdfData.kyc_estadoCivil}"`);
  assert(pdfData.kyc_email === 'juan.perez@gmail.com', `Email: "${pdfData.kyc_email}"`);
  assert(pdfData.kyc_actividadEconomica === 'Ingeniero Civil', `Actividad económica: "${pdfData.kyc_actividadEconomica}"`);
  assert(pdfData.kyc_nivelIngresos === '$30,000 a $50,000', `Nivel ingresos display: "${pdfData.kyc_nivelIngresos}"`);
  assert(pdfData.kyc_dondeTrabaja === 'Constructora ABC, S.A.', `Donde trabaja: "${pdfData.kyc_dondeTrabaja}"`);
  assert(pdfData.kyc_esPEP === false, `PEP: ${pdfData.kyc_esPEP}`);
  assert(pdfData.vehiculo_marca === 'TOYOTA', `Marca: "${pdfData.vehiculo_marca}"`);
  assert(pdfData.vehiculo_placa === 'AB1234', `Placa: "${pdfData.vehiculo_placa}"`);
  assert(pdfData.wizard_type === 'third_party', `Wizard type: "${pdfData.wizard_type}"`);
  assert(pdfData.consent_version === '1.0', `Consent version: "${pdfData.consent_version}"`);
  assert(missingFields.length === 0, `No missing fields (got ${missingFields.length})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: buildPdfDataFromPayload — CC (Full Coverage)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 2: buildPdfDataFromPayload — CC (Full Coverage)');
{
  const { pdfData, missingFields } = buildPdfDataFromPayload(MOCK_CC_PAYLOAD);

  assert(pdfData.kyc_nombreCompleto === 'María Rodríguez Sánchez', `Full name: "${pdfData.kyc_nombreCompleto}"`);
  assert(pdfData.kyc_sexo === 'Femenino', `Sexo: "${pdfData.kyc_sexo}"`);
  assert(pdfData.kyc_esPEP === true, `PEP: ${pdfData.kyc_esPEP}`);
  assert(pdfData.kyc_nivelIngresos === 'Más de $50,000', `Nivel ingresos: "${pdfData.kyc_nivelIngresos}"`);
  assert(pdfData.vehiculo_valorAsegurado === '$38,500', `Valor asegurado: "${pdfData.vehiculo_valorAsegurado}"`);
  assert(pdfData.wizard_type === 'full_coverage', `Wizard type: "${pdfData.wizard_type}"`);
  // celular is empty string → counts as 1 missing (optional) field
  const requiredMissingCC = missingFields.filter(f => f.required);
  assert(requiredMissingCC.length === 0, `No required missing fields (got ${requiredMissingCC.length})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: buildPdfDataFromPayload — Incomplete payload
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 3: buildPdfDataFromPayload — Incomplete payload');
{
  const { pdfData, missingFields } = buildPdfDataFromPayload(MOCK_INCOMPLETE_PAYLOAD);

  assert(pdfData.kyc_email === 'NO SUMINISTRADO', `Missing email shows fallback: "${pdfData.kyc_email}"`);
  assert(pdfData.kyc_telefono === 'NO SUMINISTRADO', `Missing telefono shows fallback: "${pdfData.kyc_telefono}"`);
  assert(pdfData.kyc_direccion === 'NO SUMINISTRADO', `Missing direccion shows fallback`);
  assert(pdfData.kyc_actividadEconomica === 'NO SUMINISTRADO', `Missing actividad shows fallback`);
  assert(missingFields.length > 0, `Has missing fields (${missingFields.length})`);

  const requiredMissing = missingFields.filter(f => f.required);
  assert(requiredMissing.length > 0, `Has required missing fields (${requiredMissing.length}): ${requiredMissing.map(f => f.pdf_label).join(', ')}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Determinism — same payload => same result
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 TEST 4: Determinism');
{
  const r1 = buildPdfDataFromPayload(MOCK_DT_PAYLOAD);
  const r2 = buildPdfDataFromPayload(MOCK_DT_PAYLOAD);

  // Compare all kyc fields
  const keys = Object.keys(r1.pdfData).filter(k => k.startsWith('kyc_') || k.startsWith('vehiculo_'));
  let allEqual = true;
  for (const k of keys) {
    if ((r1.pdfData as any)[k] !== (r2.pdfData as any)[k]) {
      allEqual = false;
      break;
    }
  }
  assert(allEqual, 'Same payload produces identical pdfData');
  assert(r1.missingFields.length === r2.missingFields.length, 'Same missing fields count');
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5 & 6: Generate actual PDFs (async — wrapped in IIFE)
// ═══════════════════════════════════════════════════════════════════════════

function buildAuthDataFromPdfData(pdfData: ReturnType<typeof buildPdfDataFromPayload>['pdfData']) {
  return {
    nombreCompleto: pdfData.kyc_nombreCompleto,
    cedula: pdfData.kyc_cedula,
    email: pdfData.kyc_email,
    direccion: pdfData.kyc_direccion,
    nroPoliza: pdfData.nroPoliza,
    marca: pdfData.vehiculo_marca,
    modelo: pdfData.vehiculo_modelo,
    anio: pdfData.vehiculo_anio,
    placa: pdfData.vehiculo_placa,
    chasis: pdfData.vehiculo_chasis,
    motor: pdfData.vehiculo_motor,
    color: pdfData.vehiculo_color,
    firmaDataUrl: pdfData.firmaDataUrl,
    fecha: pdfData.fecha,
    fechaNacimiento: pdfData.kyc_fechaNacimiento,
    sexo: pdfData.kyc_sexo,
    estadoCivil: pdfData.kyc_estadoCivil,
    telefono: pdfData.kyc_telefono,
    celular: pdfData.kyc_celular,
    actividadEconomica: pdfData.kyc_actividadEconomica,
    nivelIngresos: pdfData.kyc_nivelIngresos,
    dondeTrabaja: pdfData.kyc_dondeTrabaja,
    esPEP: pdfData.kyc_esPEP,
    tipoCobertura: pdfData.tipoCobertura,
    insurerName: pdfData.insurerName,
    valorAsegurado: pdfData.vehiculo_valorAsegurado,
  };
}

(async () => {
  console.log('\n📋 TEST 5: Generate PDF — DT (Third Party)');
  {
    const { pdfData } = buildPdfDataFromPayload(MOCK_DT_PAYLOAD);
    const authData = buildAuthDataFromPdfData(pdfData);

    try {
      const buffer = await generateAuthorizationPdf(authData);
      assert(buffer.length > 1000, `PDF generated: ${buffer.length} bytes`);

      const hash = createHash('sha256').update(buffer).digest('hex');
      assert(hash.length === 64, `SHA-256 hash: ${hash.substring(0, 16)}...`);

      const outPath = join(process.cwd(), 'scripts', 'test', 'output_dt.pdf');
      writeFileSync(outPath, buffer);
      console.log(`  📄 PDF saved to: ${outPath}`);
    } catch (e: any) {
      assert(false, `PDF generation failed: ${e.message}`);
    }
  }

  console.log('\n📋 TEST 6: Generate PDF — CC (Full Coverage)');
  {
    const { pdfData } = buildPdfDataFromPayload(MOCK_CC_PAYLOAD);
    const authData = buildAuthDataFromPdfData(pdfData);

    try {
      const buffer = await generateAuthorizationPdf(authData);
      assert(buffer.length > 1000, `PDF generated: ${buffer.length} bytes`);

      // Determinism check: generate again with same data
      const buffer2 = await generateAuthorizationPdf(authData);
      const hash1 = createHash('sha256').update(buffer).digest('hex');
      const hash2 = createHash('sha256').update(buffer2).digest('hex');
      assert(hash1 === hash2, `Deterministic: same input => same PDF hash`);

      const outPath = join(process.cwd(), 'scripts', 'test', 'output_cc.pdf');
      writeFileSync(outPath, buffer);
      console.log(`  📄 PDF saved to: ${outPath}`);
    } catch (e: any) {
      assert(false, `PDF generation failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) {
    console.error('❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
  }
})();
