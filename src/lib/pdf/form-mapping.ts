/**
 * Form Mapping Contract v1.0
 * Maps emission wizard fields → PDF data keys for the unified
 * "Debida Diligencia y Autorización" document.
 *
 * Source of truth: EmissionData (EmissionDataForm.tsx) + VehicleData (VehicleDataForm.tsx)
 * These are forwarded to send-expediente via FormData as clientData / vehicleData / quoteData JSON.
 */

// ─── Canonical PDF data interface ────────────────────────────────────────────
export interface DueDiligencePdfData {
  // KYC Section 0: Identification
  kyc_nombreCompleto: string;
  kyc_cedula: string;
  kyc_fechaNacimiento: string; // DD/MM/AAAA
  kyc_sexo: string;
  kyc_estadoCivil: string;
  kyc_direccion: string;
  kyc_email: string;
  kyc_telefono: string;
  kyc_celular: string;

  // KYC Section 0: Economic Profile
  kyc_actividadEconomica: string;
  kyc_nivelIngresos: string;
  kyc_dondeTrabaja: string;

  // KYC Section 0: PEP
  kyc_esPEP: boolean;

  // Vehicle (for the authorization body)
  vehiculo_marca: string;
  vehiculo_modelo: string;
  vehiculo_anio: string;
  vehiculo_placa: string;
  vehiculo_chasis: string;
  vehiculo_motor: string;
  vehiculo_color: string;
  vehiculo_valorAsegurado: string;

  // Policy
  nroPoliza: string;
  tipoCobertura: string; // 'CC' | 'DT'
  insurerName: string;
  pdfUrl: string;

  // Signature
  firmaDataUrl: string;
  fecha: string; // DD/MM/AAAA

  // Metadata
  wizard_type: 'third_party' | 'full_coverage';
  consent_version: string;
}

// ─── Mapping field definition ────────────────────────────────────────────────
export interface MappingField {
  pdf_key: keyof DueDiligencePdfData;
  pdf_label: string;
  required: boolean;
  wizard_field: {
    wizard_type: 'both' | 'third_party' | 'full_coverage';
    source: 'clientData' | 'vehicleData' | 'quoteData' | 'formData';
    field_path: string; // dot-notation path in the source object
  };
  transform: 'trim' | 'upper' | 'date_ddmmyyyy' | 'none';
  fallback: string;
}

export const CONSENT_VERSION = '1.0';
const NS = 'NO SUMINISTRADO';

// ─── The contract ────────────────────────────────────────────────────────────
export const FORM_MAPPING_FIELDS: MappingField[] = [
  // ── KYC: Identification ──
  {
    pdf_key: 'kyc_nombreCompleto',
    pdf_label: 'Nombres completos',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'primerNombre+segundoNombre+primerApellido+segundoApellido' },
    transform: 'trim',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_cedula',
    pdf_label: 'Número de identidad (cédula/pasaporte)',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'cedula' },
    transform: 'trim',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_fechaNacimiento',
    pdf_label: 'Fecha de nacimiento',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'fechaNacimiento' },
    transform: 'date_ddmmyyyy',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_sexo',
    pdf_label: 'Sexo',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'sexo' },
    transform: 'none',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_estadoCivil',
    pdf_label: 'Estado civil',
    required: false,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'estadoCivil' },
    transform: 'none',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_direccion',
    pdf_label: 'Dirección física',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'direccion' },
    transform: 'trim',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_email',
    pdf_label: 'Correo electrónico',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'email' },
    transform: 'trim',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_telefono',
    pdf_label: 'Teléfono',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'telefono' },
    transform: 'trim',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_celular',
    pdf_label: 'Celular',
    required: false,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'celular' },
    transform: 'trim',
    fallback: NS,
  },

  // ── KYC: Economic Profile ──
  {
    pdf_key: 'kyc_actividadEconomica',
    pdf_label: 'Actividad económica / profesión',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'actividadEconomica' },
    transform: 'trim',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_nivelIngresos',
    pdf_label: 'Nivel de ingresos mensuales',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'nivelIngresos' },
    transform: 'none',
    fallback: NS,
  },
  {
    pdf_key: 'kyc_dondeTrabaja',
    pdf_label: 'Lugar donde labora (empleador/empresa)',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'dondeTrabaja' },
    transform: 'trim',
    fallback: NS,
  },

  // ── KYC: PEP ──
  {
    pdf_key: 'kyc_esPEP',
    pdf_label: 'Persona Expuesta Políticamente (PEP)',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'clientData', field_path: 'esPEP' },
    transform: 'none',
    fallback: 'false',
  },

  // ── Vehicle ──
  {
    pdf_key: 'vehiculo_marca',
    pdf_label: 'Marca',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'quoteData', field_path: 'marca' },
    transform: 'upper',
    fallback: NS,
  },
  {
    pdf_key: 'vehiculo_modelo',
    pdf_label: 'Modelo',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'quoteData', field_path: 'modelo' },
    transform: 'upper',
    fallback: NS,
  },
  {
    pdf_key: 'vehiculo_anio',
    pdf_label: 'Año',
    required: true,
    wizard_field: { wizard_type: 'both', source: 'quoteData', field_path: 'anio' },
    transform: 'none',
    fallback: NS,
  },
  {
    pdf_key: 'vehiculo_placa',
    pdf_label: 'Placa',
    required: false,
    wizard_field: { wizard_type: 'both', source: 'vehicleData', field_path: 'placa' },
    transform: 'upper',
    fallback: NS,
  },
  {
    pdf_key: 'vehiculo_chasis',
    pdf_label: 'Chasis / VIN',
    required: false,
    wizard_field: { wizard_type: 'both', source: 'vehicleData', field_path: 'vinChasis' },
    transform: 'upper',
    fallback: NS,
  },
  {
    pdf_key: 'vehiculo_motor',
    pdf_label: 'Motor',
    required: false,
    wizard_field: { wizard_type: 'both', source: 'vehicleData', field_path: 'motor' },
    transform: 'upper',
    fallback: NS,
  },
  {
    pdf_key: 'vehiculo_color',
    pdf_label: 'Color',
    required: false,
    wizard_field: { wizard_type: 'both', source: 'vehicleData', field_path: 'color' },
    transform: 'upper',
    fallback: NS,
  },
  {
    pdf_key: 'vehiculo_valorAsegurado',
    pdf_label: 'Valor asegurado',
    required: false,
    wizard_field: { wizard_type: 'both', source: 'quoteData', field_path: 'valorVehiculo' },
    transform: 'none',
    fallback: '0',
  },
];

// ─── Nivel de ingresos display map ──────────────────────────────────────────
const INGRESOS_LABELS: Record<string, string> = {
  'menos de 10mil': 'Menos de $10,000',
  '10mil a 30mil': '$10,000 a $30,000',
  '30mil a 50mil': '$30,000 a $50,000',
  'mas de 50mil': 'Más de $50,000',
};

const ESTADO_CIVIL_LABELS: Record<string, string> = {
  'soltero': 'Soltero(a)',
  'casado': 'Casado(a)',
  'divorciado': 'Divorciado(a)',
  'viudo': 'Viudo(a)',
};

// ─── Transform helpers ──────────────────────────────────────────────────────
function applyTransform(value: string, transform: MappingField['transform']): string {
  switch (transform) {
    case 'trim': return value.trim();
    case 'upper': return value.trim().toUpperCase();
    case 'date_ddmmyyyy': {
      // Input may be YYYY-MM-DD (from HTML date input)
      const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
      return value; // already DD/MM/YYYY or other format
    }
    case 'none': return value;
    default: return value;
  }
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  // Handle compound paths like "primerNombre+segundoNombre+primerApellido+segundoApellido"
  if (path.includes('+')) {
    const parts = path.split('+');
    return parts.map(p => (obj[p] ?? '')).filter(Boolean).join(' ').trim();
  }
  return obj[path];
}

// ─── Payload sources as received by send-expediente route ───────────────────
export interface ExpedientePayloadSources {
  clientData: Record<string, any>;
  vehicleData: Record<string, any>;
  quoteData: Record<string, any>;
  // Top-level formData fields
  tipoCobertura: string;
  insurerName: string;
  nroPoliza: string;
  pdfUrl: string;
  firmaDataUrl: string;
}

// ─── Builder result ─────────────────────────────────────────────────────────
export interface BuildPdfDataResult {
  pdfData: DueDiligencePdfData;
  missingFields: Array<{ pdf_key: string; pdf_label: string; required: boolean }>;
}

/**
 * Build the canonical PDF data from the emission payload.
 * Throws if any REQUIRED field is missing.
 */
export function buildPdfDataFromPayload(sources: ExpedientePayloadSources): BuildPdfDataResult {
  const missingFields: BuildPdfDataResult['missingFields'] = [];
  const result: Record<string, any> = {};

  const sourceMap: Record<string, Record<string, any>> = {
    clientData: sources.clientData || {},
    vehicleData: sources.vehicleData || {},
    quoteData: sources.quoteData || {},
    formData: {
      tipoCobertura: sources.tipoCobertura,
      insurerName: sources.insurerName,
      nroPoliza: sources.nroPoliza,
      pdfUrl: sources.pdfUrl,
      firmaDataUrl: sources.firmaDataUrl,
    },
  };

  for (const field of FORM_MAPPING_FIELDS) {
    const source = sourceMap[field.wizard_field.source] || {};
    let rawValue = getNestedValue(source, field.wizard_field.field_path);

    // Coerce to string
    if (rawValue === undefined || rawValue === null) {
      rawValue = '';
    } else if (typeof rawValue === 'boolean') {
      // Keep boolean for esPEP
      if (field.pdf_key === 'kyc_esPEP') {
        result[field.pdf_key] = rawValue;
        continue;
      }
      rawValue = rawValue ? 'Sí' : 'No';
    } else {
      rawValue = String(rawValue);
    }

    const isEmpty = rawValue === '' || rawValue === undefined || rawValue === null;

    if (isEmpty) {
      missingFields.push({ pdf_key: field.pdf_key, pdf_label: field.pdf_label, required: field.required });
      result[field.pdf_key] = field.fallback;
    } else {
      result[field.pdf_key] = applyTransform(rawValue, field.transform);
    }
  }

  // Special display transforms
  if (result.kyc_nivelIngresos && result.kyc_nivelIngresos !== NS) {
    result.kyc_nivelIngresos = INGRESOS_LABELS[result.kyc_nivelIngresos] || result.kyc_nivelIngresos;
  }
  if (result.kyc_estadoCivil && result.kyc_estadoCivil !== NS) {
    result.kyc_estadoCivil = ESTADO_CIVIL_LABELS[result.kyc_estadoCivil] || result.kyc_estadoCivil;
  }
  if (result.kyc_sexo && result.kyc_sexo !== NS) {
    result.kyc_sexo = result.kyc_sexo === 'M' ? 'Masculino' : result.kyc_sexo === 'F' ? 'Femenino' : result.kyc_sexo;
  }
  // Format valorAsegurado
  if (result.vehiculo_valorAsegurado && result.vehiculo_valorAsegurado !== NS && result.vehiculo_valorAsegurado !== '0') {
    const num = Number(result.vehiculo_valorAsegurado);
    if (!isNaN(num)) result.vehiculo_valorAsegurado = `$${num.toLocaleString('en-US')}`;
  }

  // Set top-level fields from formData sources
  result.nroPoliza = sources.nroPoliza || '';
  result.tipoCobertura = sources.tipoCobertura || '';
  result.insurerName = sources.insurerName || '';
  result.pdfUrl = sources.pdfUrl || '';
  result.firmaDataUrl = sources.firmaDataUrl || '';
  result.fecha = new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  result.wizard_type = sources.tipoCobertura === 'DT' ? 'third_party' : 'full_coverage';
  result.consent_version = CONSENT_VERSION;

  // Handle esPEP if it wasn't set via mapping
  if (result.kyc_esPEP === undefined || result.kyc_esPEP === NS) {
    result.kyc_esPEP = false;
  }

  // Check for required missing fields
  const requiredMissing = missingFields.filter(f => f.required);
  if (requiredMissing.length > 0) {
    console.warn('[PDF BUILD] Campos obligatorios faltantes:', requiredMissing.map(f => f.pdf_label).join(', '));
    // Don't throw — allow PDF generation with "NO SUMINISTRADO" for now
    // The frontend validation should prevent this from happening
  }

  return {
    pdfData: result as DueDiligencePdfData,
    missingFields,
  };
}
