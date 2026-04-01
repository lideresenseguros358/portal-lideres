'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaArrowRight, FaCheck, FaSpinner, FaInfoCircle, FaChevronDown, FaChevronUp, FaUser, FaBriefcase, FaHome, FaHeartbeat, FaShieldAlt, FaClipboardCheck } from 'react-icons/fa';
import { createPetitionFromQuote } from '@/lib/operaciones/createPetitionFromQuote';
import { trackQuoteCreated } from '@/lib/adm-cot/track-quote';
import EmissionProgressBar from '@/components/cotizadores/EmissionProgressBar';
import EmissionBreadcrumb, { type BreadcrumbStepDef } from '@/components/cotizadores/EmissionBreadcrumb';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface VidaFormData {
  // Step 1 — Datos personales
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  sexo: 'M' | 'F' | '';
  celular: string;
  correo: string;
  nacionalidad: string;
  // Step 2 — Trabajo e ingresos
  ocupacion: string;
  lugarTrabajo: string;
  funcionesTrabajo: string;
  salarioMensual: string;
  // Step 3 — Dirección residencial
  provincia: string;
  distrito: string;
  corregimiento: string;
  barriada: string;
  direccionReferencias: string;
  // Step 4 — Datos físicos y salud
  altura: string;
  peso: string;
  tieneEnfermedad: boolean | null;
  descripcionEnfermedad: string;
  haFumadoAlgunaVez: boolean | null;
  fumaActualmente: boolean | null;
  ultimaVezFumo: string;
  // Step 5 — Cobertura
  tieneSeguroVida: boolean | null;
  companiaSeguroActual: string;
  sumaAseguradaActual: string;
  esCubrirHipoteca: boolean | null;
  aniosHipoteca: string;
  sumaAseguradaSolicitada: string;
  // Step 6 — Tipo de propuesta
  propuestaConAhorros: boolean;
  propuestaATermino: boolean;
  confirmaInformacion: boolean;
}

interface AddressCatalogItem {
  DATO: number;
  TEXTO: string;
}

const TOTAL_STEPS = 6;

const INITIAL_DATA: VidaFormData = {
  nombre: '',
  apellido: '',
  fechaNacimiento: '',
  sexo: '',
  celular: '',
  correo: '',
  nacionalidad: 'Panamá',
  ocupacion: '',
  lugarTrabajo: '',
  funcionesTrabajo: '',
  salarioMensual: '',
  provincia: '',
  distrito: '',
  corregimiento: '',
  barriada: '',
  direccionReferencias: '',
  altura: '',
  peso: '',
  tieneEnfermedad: null,
  descripcionEnfermedad: '',
  haFumadoAlgunaVez: null,
  fumaActualmente: null,
  ultimaVezFumo: '',
  tieneSeguroVida: null,
  companiaSeguroActual: '',
  sumaAseguradaActual: '',
  esCubrirHipoteca: null,
  aniosHipoteca: '',
  sumaAseguradaSolicitada: '',
  propuestaConAhorros: false,
  propuestaATermino: false,
  confirmaInformacion: false,
};

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function calcularEdad(fechaNacimiento: string): number {
  if (!fechaNacimiento) return 0;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function getMultiplicador(edad: number): number {
  if (edad <= 50) return 20;
  if (edad <= 60) return 12;
  return 7;
}

function calcularMaximo(salarioMensual: number, edad: number): number {
  const anual = salarioMensual * 12;
  return anual * getMultiplicador(edad);
}

function formatUSD(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function parseCurrency(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

function formatCurrencyBlur(s: string): string {
  const n = parseCurrency(s);
  if (!n) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sanitizeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatInteger(s: string): string {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;
  return n > 0 ? n.toLocaleString('en-US') : '';
}

// ─── Requisitos de Asegurabilidad ───────────────────────────────────

interface ReqItem { key: string; label: string; detalle: string; }

const REQ_META: Record<string, { label: string; detalle: string }> = {
  examen_medico_urinalisis_nicotina: {
    label: 'EXM/UL — Examen Médico y Uroanálisis',
    detalle: 'Incluye: Prueba de Nicotina',
  },
  lab_a: {
    label: 'LAB A',
    detalle: 'Biometría Hemática Completa, VSG, Glicemia, HbA1c, Perfil Lipídico, Creatinina, BUN, Transaminasas, Bilirrubina, Fosfatasa Alcalina, Ácido Úrico',
  },
  ecg: { label: 'ECG — Electrocardiograma', detalle: 'Electrocardiograma en reposo' },
  psa_41_plus: { label: 'PSA — Antígeno Prostático', detalle: 'Aplica a hombres mayores de 41 años' },
  ecgm: { label: 'ECGM — Electrocardiograma con Esfuerzo', detalle: 'Electrocardiograma con prueba de esfuerzo' },
  form_activos_pasivos: { label: 'Formulario de Activos y Pasivos', detalle: 'Declaración financiera de activos y pasivos' },
  cuestionario_financiero: { label: 'Cuestionario Financiero', detalle: 'Evaluación del perfil financiero del asegurado' },
};

type ReqTable = { edadMin: number; edadMax: number; rangos: { min: number; max: number; reqs: Record<string, boolean> }[] };

const TABLA_REQUISITOS: ReqTable[] = [
  {
    edadMin: 0, edadMax: 19,
    rangos: [
      { min: 25000, max: Infinity, reqs: { examen_medico_urinalisis_nicotina: false, lab_a: false, ecg: false, psa_41_plus: false, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
    ],
  },
  {
    edadMin: 20, edadMax: 45,
    rangos: [
      { min: 25000, max: 400000, reqs: { examen_medico_urinalisis_nicotina: false, lab_a: false, ecg: false, psa_41_plus: false, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 400001, max: 500000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: false, ecg: false, psa_41_plus: false, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 500001, max: 750000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 750001, max: 1000000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: true, cuestionario_financiero: false } },
      { min: 1000001, max: 2000000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: true, cuestionario_financiero: true } },
      { min: 2000001, max: Infinity, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: true, form_activos_pasivos: true, cuestionario_financiero: true } },
    ],
  },
  {
    edadMin: 46, edadMax: 55,
    rangos: [
      { min: 25000, max: 200000, reqs: { examen_medico_urinalisis_nicotina: false, lab_a: false, ecg: false, psa_41_plus: false, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 200001, max: 300000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: false, ecg: false, psa_41_plus: true, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 300001, max: 500000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: false, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 500001, max: 750000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 750001, max: 1000000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: true, cuestionario_financiero: false } },
      { min: 1000001, max: Infinity, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: true, form_activos_pasivos: true, cuestionario_financiero: true } },
    ],
  },
  {
    edadMin: 56, edadMax: 60,
    rangos: [
      { min: 25000, max: 75000, reqs: { examen_medico_urinalisis_nicotina: false, lab_a: false, ecg: false, psa_41_plus: false, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 75001, max: 100000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: false, ecg: false, psa_41_plus: true, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 100001, max: 500000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: false, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 500001, max: 750000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 750001, max: 1000000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: true, form_activos_pasivos: true, cuestionario_financiero: false } },
      { min: 1000001, max: Infinity, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: true, form_activos_pasivos: true, cuestionario_financiero: true } },
    ],
  },
  {
    edadMin: 61, edadMax: Infinity,
    rangos: [
      { min: 25000, max: 200000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: false, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 200001, max: 750000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: false, form_activos_pasivos: false, cuestionario_financiero: false } },
      { min: 750001, max: 1000000, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: true, form_activos_pasivos: true, cuestionario_financiero: false } },
      { min: 1000001, max: Infinity, reqs: { examen_medico_urinalisis_nicotina: true, lab_a: true, ecg: true, psa_41_plus: true, ecgm: true, form_activos_pasivos: true, cuestionario_financiero: true } },
    ],
  },
];

function calcularRequisitos(edad: number, suma: number, esFumador: boolean, esMasculino: boolean): ReqItem[] {
  if (!edad || !suma) return [];
  const grupo = TABLA_REQUISITOS.find(g => edad >= g.edadMin && edad <= g.edadMax);
  if (!grupo) return [];
  const found = grupo.rangos.find(r => suma >= r.min && suma <= r.max);
  const rango = found ?? grupo.rangos[grupo.rangos.length - 1];
  if (!rango) return [];
  const reqs = { ...rango.reqs };
  // Fumador: always EXM/UL (which includes nicotina)
  if (esFumador) reqs.examen_medico_urinalisis_nicotina = true;
  // PSA only for males over 41
  if (!esMasculino || edad <= 41) reqs.psa_41_plus = false;
  return Object.entries(reqs)
    .filter(([, v]) => v)
    .map(([k]) => {
      const meta = REQ_META[k] ?? { label: k, detalle: '' };
      return { key: k, label: meta.label, detalle: meta.detalle };
    });
}

// ═══════════════════════════════════════════════════════════════════
// STABLE INPUT FIELD (defined outside component to prevent re-mount)
// ═══════════════════════════════════════════════════════════════════

function StableInputField({ label, name, type = 'text', placeholder, required = true, hint, inputMode, value, onChange, error, ...props }: any) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none transition-colors appearance-none min-w-0 ${
          error ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-200 bg-white focus:border-[#8AAA19]'
        }`}
        {...props}
      />
      {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
      {hint && !error && <p className="text-gray-400 text-xs mt-1">{hint}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INPUT FIELD OUTSIDE COMPONENT (prevents remount on every keystroke)
// ═══════════════════════════════════════════════════════════════════

function WizardInputField({ name, data, errors, onUpdate, ...props }: any) {
  return (
    <StableInputField
      name={name}
      value={(data as any)[name] ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ [name]: e.target.value })}
      error={errors[name]}
      {...props}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function VidaWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<VidaFormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const formRef = useRef<HTMLDivElement>(null);

  // Address catalogs
  const [provincias, setProvincias] = useState<AddressCatalogItem[]>([]);
  const [distritos, setDistritos] = useState<AddressCatalogItem[]>([]);
  const [corregimientos, setCorregimientos] = useState<AddressCatalogItem[]>([]);
  const [urbanizaciones, setUrbanizaciones] = useState<AddressCatalogItem[]>([]);
  const [loadingAddr, setLoadingAddr] = useState('');
  const catalogsFetched = useRef(false);

  // Computed values
  const edad = calcularEdad(data.fechaNacimiento);
  const salarioNum = parseCurrency(data.salarioMensual);
  const multiplicador = getMultiplicador(edad);
  const ingresoAnual = salarioNum * 12;
  const maximoCalculado = calcularMaximo(salarioNum, edad);
  const minimoFijo = 25000;
  // Minors (< 18) are capped at $25,000 regardless of income
  const esMenor = edad > 0 && edad < 18;
  const maximoEfectivo = esMenor ? 25000 : maximoCalculado;

  // ── Load address catalogs ──
  useEffect(() => {
    if (catalogsFetched.current) return;
    catalogsFetched.current = true;
    setLoadingAddr('provincias');
    Promise.all([
      fetch('/api/is/catalogos/direccion?tipo=provincias&codpais=1').then(r => r.json()),
      fetch('/api/is/catalogos/direccion?tipo=urbanizaciones&page=1&size=5000').then(r => r.json()),
    ]).then(([provData, urbData]) => {
      if (provData.data) setProvincias(provData.data);
      if (urbData.data) setUrbanizaciones(urbData.data);
    }).catch(() => {}).finally(() => setLoadingAddr(''));
  }, []);

  // ── Fetch distritos ──
  const fetchDistritos = useCallback((codProvincia: number) => {
    setDistritos([]);
    setCorregimientos([]);
    update({ distrito: '', corregimiento: '', barriada: '' });
    if (!codProvincia) return;
    setLoadingAddr('distritos');
    fetch(`/api/is/catalogos/direccion?tipo=distritos&codpais=1&codprovincia=${codProvincia}`)
      .then(r => r.json())
      .then(d => { if (d.data) setDistritos(d.data); })
      .catch(() => {})
      .finally(() => setLoadingAddr(''));
  }, []);

  // ── Fetch corregimientos ──
  const fetchCorregimientos = useCallback((codProvincia: number, codDistrito: number) => {
    setCorregimientos([]);
    update({ corregimiento: '', barriada: '' });
    if (!codDistrito) return;
    setLoadingAddr('corregimientos');
    fetch(`/api/is/catalogos/direccion?tipo=corregimientos&codpais=1&codprovincia=${codProvincia}&coddistrito=${codDistrito}`)
      .then(r => r.json())
      .then(d => { if (d.data) setCorregimientos(d.data); })
      .catch(() => {})
      .finally(() => setLoadingAddr(''));
  }, []);

  // (no auto-fill for sumaAseguradaSolicitada — user fills it manually)

  // ── Update helper ──
  function update(partial: Partial<VidaFormData>) {
    setData(prev => ({ ...prev, ...partial }));
  }

  // ── Scroll to top on step change ──
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {};

    if (s === 1) {
      if (!data.nombre.trim()) e.nombre = 'Nombre es obligatorio';
      if (!data.apellido.trim()) e.apellido = 'Apellido es obligatorio';
      if (!data.fechaNacimiento) e.fechaNacimiento = 'Fecha de nacimiento es obligatoria';
      else {
        const nacDate = new Date(data.fechaNacimiento);
        if (nacDate > new Date()) e.fechaNacimiento = 'La fecha no puede ser futura';
        else if (edad > 85) e.fechaNacimiento = 'Edad máxima permitida: 85 años';
      }
      if (!data.sexo) e.sexo = 'Selecciona una opción';
      if (!data.celular.trim()) e.celular = 'Celular es obligatorio';
      else if (data.celular.replace(/\D/g, '').length < 7) e.celular = 'Celular debe tener al menos 7 dígitos';
      if (!data.correo.trim()) e.correo = 'Correo es obligatorio';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) e.correo = 'Correo inválido';
      if (!data.nacionalidad.trim()) e.nacionalidad = 'Nacionalidad es obligatoria';
    }

    if (s === 2) {
      if (!data.ocupacion.trim()) e.ocupacion = 'Ocupación es obligatoria';
      if (!data.lugarTrabajo.trim()) e.lugarTrabajo = 'Lugar de trabajo es obligatorio';
      if (!data.funcionesTrabajo.trim()) e.funcionesTrabajo = 'Describe tus funciones';
      if (!data.salarioMensual || parseCurrency(data.salarioMensual) <= 0) e.salarioMensual = 'Salario debe ser mayor a 0';
    }

    if (s === 3) {
      if (!data.provincia) e.provincia = 'Selecciona una provincia';
      if (!data.distrito) e.distrito = 'Selecciona un distrito';
      if (!data.corregimiento) e.corregimiento = 'Selecciona un corregimiento';
    }

    if (s === 4) {
      if (!data.altura || parseFloat(data.altura) < 0.5 || parseFloat(data.altura) > 2.5) e.altura = 'Altura debe estar entre 0.5 y 2.5 metros';
      if (!data.peso || parseFloat(data.peso) < 30 || parseFloat(data.peso) > 600) e.peso = 'Peso debe estar entre 30 y 600 libras';
      if (data.tieneEnfermedad === null) e.tieneEnfermedad = 'Selecciona una opción';
      if (data.tieneEnfermedad && !data.descripcionEnfermedad.trim()) e.descripcionEnfermedad = 'Describe la condición';
      if (data.haFumadoAlgunaVez === null) e.haFumadoAlgunaVez = 'Selecciona una opción';
      if (data.haFumadoAlgunaVez && data.fumaActualmente === null) e.fumaActualmente = 'Selecciona una opción';
      if (data.haFumadoAlgunaVez && data.fumaActualmente === false && !data.ultimaVezFumo.trim()) e.ultimaVezFumo = 'Indica cuándo fumaste por última vez';
    }

    if (s === 5) {
      if (data.tieneSeguroVida === null) e.tieneSeguroVida = 'Selecciona una opción';
      if (data.tieneSeguroVida) {
        if (!data.companiaSeguroActual.trim()) e.companiaSeguroActual = 'Indica la compañía';
        if (!data.sumaAseguradaActual || parseCurrency(data.sumaAseguradaActual) <= 0) e.sumaAseguradaActual = 'Indica la suma asegurada actual';
      }
      if (data.esCubrirHipoteca === null) e.esCubrirHipoteca = 'Selecciona una opción';
      if (data.esCubrirHipoteca && (!data.aniosHipoteca || parseInt(data.aniosHipoteca) <= 0)) e.aniosHipoteca = 'Indica los años de la hipoteca';
      const suma = parseCurrency(data.sumaAseguradaSolicitada);
      if (suma <= 0) e.sumaAseguradaSolicitada = 'Indica la suma asegurada';
      else if (suma < minimoFijo) e.sumaAseguradaSolicitada = `Mínimo permitido: $${formatUSD(minimoFijo)}`;
      else if (maximoEfectivo > 0 && suma > maximoEfectivo) e.sumaAseguradaSolicitada = `Máximo permitido: $${formatUSD(maximoEfectivo)}`;
    }

    if (s === 6) {
      if (!data.propuestaConAhorros && !data.propuestaATermino) e.tiposPropuesta = 'Selecciona al menos un tipo de propuesta';
      if (!data.confirmaInformacion) e.confirmaInformacion = 'Debes confirmar que la información es correcta';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  function goNext() {
    if (!validateStep(step)) return;
    // Clean conditional fields
    if (step === 4) {
      if (!data.tieneEnfermedad) update({ descripcionEnfermedad: '' });
      if (!data.haFumadoAlgunaVez) update({ fumaActualmente: null, ultimaVezFumo: '' });
      if (data.haFumadoAlgunaVez && data.fumaActualmente) update({ ultimaVezFumo: '' });
    }
    if (step === 5) {
      if (!data.tieneSeguroVida) update({ companiaSeguroActual: '', sumaAseguradaActual: '' });
      if (!data.esCubrirHipoteca) update({ aniosHipoteca: '' });
    }
    setDirection('forward');
    setStep(prev => Math.min(prev + 1, TOTAL_STEPS));
  }

  function goBack() {
    setDirection('backward');
    setStep(prev => Math.max(prev - 1, 1));
  }

  function goToStep(s: number) {
    if (s < step) {
      setDirection('backward');
      setStep(s);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SUBMIT
  // ═══════════════════════════════════════════════════════════════

  async function handleSubmit() {
    if (!validateStep(6)) return;

    // Backend recalc for anti-manipulation
    const beEdad = calcularEdad(data.fechaNacimiento);
    const beSalario = parseCurrency(data.salarioMensual);
    const beMax = beEdad < 18 ? 25000 : calcularMaximo(beSalario, beEdad);
    const beSuma = parseCurrency(data.sumaAseguradaSolicitada);

    if (beSuma < minimoFijo || (beMax > 0 && beSuma > beMax)) {
      setErrors({ sumaAseguradaSolicitada: 'Suma asegurada fuera del rango permitido. Vuelve al paso 5.' });
      return;
    }

    setSubmitting(true);
    try {
      const provName = provincias.find(p => String(p.DATO) === data.provincia)?.TEXTO || data.provincia;
      const distName = distritos.find(d => String(d.DATO) === data.distrito)?.TEXTO || data.distrito;
      const corrName = corregimientos.find(c => String(c.DATO) === data.corregimiento)?.TEXTO || data.corregimiento;
      const urbName = urbanizaciones.find(u => String(u.DATO) === data.barriada)?.TEXTO || data.barriada;

      const tiposPropuesta: string[] = [];
      if (data.propuestaConAhorros) tiposPropuesta.push('Con Ahorros');
      if (data.propuestaATermino) tiposPropuesta.push('A Término');

      // Build detailed body for the petition
      const bodyLines = [
        '══════════════════════════════════════',
        'SOLICITUD DE COTIZACIÓN - SEGURO DE VIDA',
        '══════════════════════════════════════',
        '',
        '── DATOS PERSONALES ──',
        `Nombre: ${sanitizeHTML(data.nombre)} ${sanitizeHTML(data.apellido)}`,
        `Sexo: ${data.sexo === 'M' ? 'Masculino' : data.sexo === 'F' ? 'Femenino' : ''}`,
        `Fecha de nacimiento: ${data.fechaNacimiento} (Edad: ${beEdad} años)`,
        `Celular: ${sanitizeHTML(data.celular)}`,
        `Correo: ${sanitizeHTML(data.correo)}`,
        `Nacionalidad: ${sanitizeHTML(data.nacionalidad)}`,
        '',
        '── TRABAJO E INGRESOS ──',
        `Ocupación: ${sanitizeHTML(data.ocupacion)}`,
        `Lugar de trabajo: ${sanitizeHTML(data.lugarTrabajo)}`,
        `Funciones: ${sanitizeHTML(data.funcionesTrabajo)}`,
        `Salario mensual: $${formatUSD(beSalario)}`,
        `Ingreso anual: $${formatUSD(ingresoAnual)}`,
        '',
        '── DIRECCIÓN RESIDENCIAL ──',
        `Provincia: ${sanitizeHTML(provName)}`,
        `Distrito: ${sanitizeHTML(distName)}`,
        `Corregimiento: ${sanitizeHTML(corrName)}`,
        urbName ? `Barriada/Urbanización: ${sanitizeHTML(urbName)}` : '',
        data.direccionReferencias ? `Referencias: ${sanitizeHTML(data.direccionReferencias)}` : '',
        '',
        '── DATOS FÍSICOS Y SALUD ──',
        `Altura: ${data.altura} m`,
        `Peso: ${data.peso} lbs`,
        `¿Enfermedad/medicamento/condición?: ${data.tieneEnfermedad ? 'Sí' : 'No'}`,
        data.tieneEnfermedad ? `  Descripción: ${sanitizeHTML(data.descripcionEnfermedad)}` : '',
        `¿Ha fumado alguna vez?: ${data.haFumadoAlgunaVez ? 'Sí' : 'No'}`,
        data.haFumadoAlgunaVez ? `  ¿Fuma actualmente?: ${data.fumaActualmente ? 'Sí' : 'No'}` : '',
        data.haFumadoAlgunaVez && !data.fumaActualmente ? `  Última vez que fumó: ${sanitizeHTML(data.ultimaVezFumo)}` : '',
        '',
        '── COBERTURA Y OBJETIVO ──',
        `¿Tiene seguro de vida?: ${data.tieneSeguroVida ? 'Sí' : 'No'}`,
        data.tieneSeguroVida ? `  Compañía actual: ${sanitizeHTML(data.companiaSeguroActual)}` : '',
        data.tieneSeguroVida ? `  Suma asegurada actual: $${formatUSD(parseFloat(data.sumaAseguradaActual) || 0)}` : '',
        `¿Para cubrir hipoteca?: ${data.esCubrirHipoteca ? 'Sí' : 'No'}`,
        data.esCubrirHipoteca ? `  Años de hipoteca: ${data.aniosHipoteca}` : '',
        '',
        '── SUMA ASEGURADA SOLICITADA ──',
        `Suma solicitada: $${formatUSD(beSuma)}`,
        `Máximo calculado: $${formatUSD(beMax)}`,
        `Multiplicador: x${getMultiplicador(beEdad)} (edad ${beEdad})`,
        `Rango permitido: $${formatUSD(minimoFijo)} – $${formatUSD(beMax)}`,
        '',
        '── TIPO DE PROPUESTA ──',
        `Tipo(s): ${tiposPropuesta.join(', ')}`,
        '',
        '══════════════════════════════════════',
        `Enviado desde: Cotizador Vida Web`,
        `Fecha: ${new Date().toLocaleString('es-PA')}`,
        '══════════════════════════════════════',
      ].filter(Boolean);

      const subject = `Petición Vida Web - ${data.nombre} ${data.apellido} - ${new Date().toLocaleDateString('es-PA')}`;

      const result = await createPetitionFromQuote({
        client_name: `${data.nombre} ${data.apellido}`.trim(),
        client_email: data.correo.trim(),
        client_phone: data.celular.trim(),
        ramo: 'vida',
        source: 'COTIZADOR_VIDA_WIZARD',
        details: {
          channel: 'cotizadores_web',
          product: 'vida',
          subject,
          from_name: `${data.nombre} ${data.apellido}`,
          from_email: data.correo,
          from_phone: data.celular,
          body_text: bodyLines.join('\n'),
          sla_target_hours: 24,
          priority: 'normal',
          // Structured metadata
          datos_personales: {
            nombre: data.nombre,
            apellido: data.apellido,
            fecha_nacimiento: data.fechaNacimiento,
            edad: beEdad,
            sexo: data.sexo,
            celular: data.celular,
            correo: data.correo,
            nacionalidad: data.nacionalidad,
          },
          trabajo_ingresos: {
            ocupacion: data.ocupacion,
            lugar_trabajo: data.lugarTrabajo,
            funciones: data.funcionesTrabajo,
            salario_mensual: beSalario,
            ingreso_anual: ingresoAnual,
          },
          direccion: {
            provincia: provName,
            distrito: distName,
            corregimiento: corrName,
            barriada: urbName,
            referencias: data.direccionReferencias,
          },
          salud: {
            altura_m: parseFloat(data.altura) || 0,
            peso_lbs: parseFloat(data.peso) || 0,
            tiene_enfermedad: data.tieneEnfermedad,
            descripcion_enfermedad: data.tieneEnfermedad ? data.descripcionEnfermedad : null,
            ha_fumado: data.haFumadoAlgunaVez,
            fuma_actualmente: data.haFumadoAlgunaVez ? data.fumaActualmente : null,
            ultima_vez_fumo: data.haFumadoAlgunaVez && !data.fumaActualmente ? data.ultimaVezFumo : null,
          },
          cobertura: {
            tiene_seguro_vida: data.tieneSeguroVida,
            compania_actual: data.tieneSeguroVida ? data.companiaSeguroActual : null,
            suma_asegurada_actual: data.tieneSeguroVida ? parseFloat(data.sumaAseguradaActual) || 0 : null,
            es_hipoteca: data.esCubrirHipoteca,
            anios_hipoteca: data.esCubrirHipoteca ? parseInt(data.aniosHipoteca) || 0 : null,
          },
          calculo: {
            suma_asegurada_solicitada: beSuma,
            maximo_calculado: beMax,
            multiplicador: getMultiplicador(beEdad),
            edad: beEdad,
            ingreso_anual: ingresoAnual,
            minimo: minimoFijo,
          },
          tipo_propuesta: tiposPropuesta,
        },
      });

      // Track in ADM COT cotizaciones log
      trackQuoteCreated({
        quoteRef: `VIDA-${result.ticket || Date.now()}`,
        insurer: 'INTERNACIONAL',
        clientName: `${data.nombre} ${data.apellido}`.trim(),
        cedula: undefined,
        email: data.correo.trim(),
        phone: data.celular.trim(),
        ramo: 'VIDA',
        coverageType: tiposPropuesta.join(', ') || 'Vida',
        planName: tiposPropuesta.join(' + ') || 'Seguro de Vida',
        annualPremium: undefined,
      });

      // Save to session for confirmation page
      sessionStorage.setItem('vidaQuoteSubmission', JSON.stringify({
        nombre: `${data.nombre} ${data.apellido}`,
        correo: data.correo,
        sumaAsegurada: beSuma,
        tiposPropuesta,
        ticket: result.ticket || null,
      }));

      router.push('/cotizadores/vida/confirmacion');
    } catch (err: any) {
      console.error('[VidaWizard] Submit error:', err);
      setErrors({ submit: 'Ocurrió un error al enviar. Intenta nuevamente.' });
    } finally {
      setSubmitting(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SHARED UI COMPONENTS
  // ═══════════════════════════════════════════════════════════════

  const YesNoCards = ({ name, label, value }: { name: string; label: string; value: boolean | null }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label} <span className="text-red-500">*</span></label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => update({ [name]: true } as any)}
          className={`py-3 rounded-xl font-semibold text-sm border-2 transition-all ${
            value === true
              ? 'bg-[#010139] text-white border-[#010139] shadow-lg'
              : 'bg-white text-gray-600 border-gray-200 hover:border-[#8AAA19]'
          }`}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => update({ [name]: false } as any)}
          className={`py-3 rounded-xl font-semibold text-sm border-2 transition-all ${
            value === false
              ? 'bg-[#010139] text-white border-[#010139] shadow-lg'
              : 'bg-white text-gray-600 border-gray-200 hover:border-[#8AAA19]'
          }`}
        >
          No
        </button>
      </div>
      {errors[name] && <p className="text-red-500 text-xs mt-1 font-medium">{errors[name]}</p>}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // STEP RENDERERS
  // ═══════════════════════════════════════════════════════════════

  function renderStep1() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <WizardInputField label="Nombre" name="nombre" placeholder="Juan" data={data} errors={errors} onUpdate={update} />
          <WizardInputField label="Apellido" name="apellido" placeholder="Pérez" data={data} errors={errors} onUpdate={update} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Fecha de nacimiento <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={data.fechaNacimiento}
            onChange={(e) => update({ fechaNacimiento: e.target.value })}
            max={new Date().toISOString().split('T')[0]}
            className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none transition-colors appearance-none min-w-0 ${
              errors.fechaNacimiento ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-200 bg-white focus:border-[#8AAA19]'
            }`}
          />
          {edad > 0 && (
            <p className="text-sm text-[#8AAA19] font-semibold mt-1">Edad: {edad} años{esMenor ? ' — Menor de edad' : ''}</p>
          )}
          {errors.fechaNacimiento && <p className="text-red-500 text-xs mt-1 font-medium">{errors.fechaNacimiento}</p>}
        </div>
        {/* Sexo */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Sexo <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['M', 'F'] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => update({ sexo: val })}
                className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                  data.sexo === val
                    ? 'border-[#8AAA19] bg-[#8AAA19]/10 text-[#8AAA19]'
                    : errors.sexo
                    ? 'border-red-300 bg-red-50 text-gray-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {val === 'M' ? '♂ Masculino' : '♀ Femenino'}
              </button>
            ))}
          </div>
          {errors.sexo && <p className="text-red-500 text-xs mt-1 font-medium">{errors.sexo}</p>}
        </div>
        <WizardInputField label="Celular" name="celular" type="tel" inputMode="tel" placeholder="+507 6000-0000" hint="Formato: +507 y número local" data={data} errors={errors} onUpdate={update} />
        <WizardInputField label="Correo electrónico" name="correo" type="email" inputMode="email" placeholder="correo@ejemplo.com" data={data} errors={errors} onUpdate={update} />
        {/* Nacionalidad */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nacionalidad <span className="text-red-500">*</span>
          </label>
          <select
            value={data.nacionalidad}
            onChange={(e) => update({ nacionalidad: e.target.value })}
            className="w-full px-3 py-2.5 md:px-4 md:py-3 text-base border-2 border-gray-300 focus:border-[#8AAA19] rounded-lg focus:outline-none bg-white"
            style={{ minHeight: '50px' }}
          >
            <option value="">Seleccionar</option>
            <option value="Panamá">Panamá</option>
            <option disabled>──────────</option>
            <option value="Afganistán">Afganistán</option>
            <option value="Albania">Albania</option>
            <option value="Alemania">Alemania</option>
            <option value="Andorra">Andorra</option>
            <option value="Angola">Angola</option>
            <option value="Antigua y Barbuda">Antigua y Barbuda</option>
            <option value="Arabia Saudita">Arabia Saudita</option>
            <option value="Argelia">Argelia</option>
            <option value="Argentina">Argentina</option>
            <option value="Armenia">Armenia</option>
            <option value="Australia">Australia</option>
            <option value="Austria">Austria</option>
            <option value="Azerbaiyán">Azerbaiyán</option>
            <option value="Bahamas">Bahamas</option>
            <option value="Bangladés">Bangladés</option>
            <option value="Barbados">Barbados</option>
            <option value="Baréin">Baréin</option>
            <option value="Bélgica">Bélgica</option>
            <option value="Belice">Belice</option>
            <option value="Benín">Benín</option>
            <option value="Bielorrusia">Bielorrusia</option>
            <option value="Birmania">Birmania</option>
            <option value="Bolivia">Bolivia</option>
            <option value="Bosnia y Herzegovina">Bosnia y Herzegovina</option>
            <option value="Botsuana">Botsuana</option>
            <option value="Brasil">Brasil</option>
            <option value="Brunéi">Brunéi</option>
            <option value="Bulgaria">Bulgaria</option>
            <option value="Burkina Faso">Burkina Faso</option>
            <option value="Burundi">Burundi</option>
            <option value="Bután">Bután</option>
            <option value="Cabo Verde">Cabo Verde</option>
            <option value="Camboya">Camboya</option>
            <option value="Camerún">Camerún</option>
            <option value="Canadá">Canadá</option>
            <option value="Catar">Catar</option>
            <option value="Chad">Chad</option>
            <option value="Chile">Chile</option>
            <option value="China">China</option>
            <option value="Chipre">Chipre</option>
            <option value="Colombia">Colombia</option>
            <option value="Comoras">Comoras</option>
            <option value="Corea del Norte">Corea del Norte</option>
            <option value="Corea del Sur">Corea del Sur</option>
            <option value="Costa de Marfil">Costa de Marfil</option>
            <option value="Costa Rica">Costa Rica</option>
            <option value="Croacia">Croacia</option>
            <option value="Cuba">Cuba</option>
            <option value="Dinamarca">Dinamarca</option>
            <option value="Dominica">Dominica</option>
            <option value="Ecuador">Ecuador</option>
            <option value="Egipto">Egipto</option>
            <option value="El Salvador">El Salvador</option>
            <option value="Emiratos Árabes Unidos">Emiratos Árabes Unidos</option>
            <option value="Eritrea">Eritrea</option>
            <option value="Eslovaquia">Eslovaquia</option>
            <option value="Eslovenia">Eslovenia</option>
            <option value="España">España</option>
            <option value="Estados Unidos">Estados Unidos</option>
            <option value="Estonia">Estonia</option>
            <option value="Etiopía">Etiopía</option>
            <option value="Filipinas">Filipinas</option>
            <option value="Finlandia">Finlandia</option>
            <option value="Fiyi">Fiyi</option>
            <option value="Francia">Francia</option>
            <option value="Gabón">Gabón</option>
            <option value="Gambia">Gambia</option>
            <option value="Georgia">Georgia</option>
            <option value="Ghana">Ghana</option>
            <option value="Granada">Granada</option>
            <option value="Grecia">Grecia</option>
            <option value="Guatemala">Guatemala</option>
            <option value="Guinea">Guinea</option>
            <option value="Guinea Ecuatorial">Guinea Ecuatorial</option>
            <option value="Guinea-Bisáu">Guinea-Bisáu</option>
            <option value="Guyana">Guyana</option>
            <option value="Haití">Haití</option>
            <option value="Honduras">Honduras</option>
            <option value="Hungría">Hungría</option>
            <option value="India">India</option>
            <option value="Indonesia">Indonesia</option>
            <option value="Irak">Irak</option>
            <option value="Irán">Irán</option>
            <option value="Irlanda">Irlanda</option>
            <option value="Islandia">Islandia</option>
            <option value="Israel">Israel</option>
            <option value="Italia">Italia</option>
            <option value="Jamaica">Jamaica</option>
            <option value="Japón">Japón</option>
            <option value="Jordania">Jordania</option>
            <option value="Kazajistán">Kazajistán</option>
            <option value="Kenia">Kenia</option>
            <option value="Kirguistán">Kirguistán</option>
            <option value="Kiribati">Kiribati</option>
            <option value="Kuwait">Kuwait</option>
            <option value="Laos">Laos</option>
            <option value="Lesoto">Lesoto</option>
            <option value="Letonia">Letonia</option>
            <option value="Líbano">Líbano</option>
            <option value="Liberia">Liberia</option>
            <option value="Libia">Libia</option>
            <option value="Liechtenstein">Liechtenstein</option>
            <option value="Lituania">Lituania</option>
            <option value="Luxemburgo">Luxemburgo</option>
            <option value="Madagascar">Madagascar</option>
            <option value="Malasia">Malasia</option>
            <option value="Malaui">Malaui</option>
            <option value="Maldivas">Maldivas</option>
            <option value="Malí">Malí</option>
            <option value="Malta">Malta</option>
            <option value="Marruecos">Marruecos</option>
            <option value="Mauricio">Mauricio</option>
            <option value="Mauritania">Mauritania</option>
            <option value="México">México</option>
            <option value="Micronesia">Micronesia</option>
            <option value="Moldavia">Moldavia</option>
            <option value="Mónaco">Mónaco</option>
            <option value="Mongolia">Mongolia</option>
            <option value="Montenegro">Montenegro</option>
            <option value="Mozambique">Mozambique</option>
            <option value="Namibia">Namibia</option>
            <option value="Nauru">Nauru</option>
            <option value="Nepal">Nepal</option>
            <option value="Nicaragua">Nicaragua</option>
            <option value="Níger">Níger</option>
            <option value="Nigeria">Nigeria</option>
            <option value="Noruega">Noruega</option>
            <option value="Nueva Zelanda">Nueva Zelanda</option>
            <option value="Omán">Omán</option>
            <option value="Países Bajos">Países Bajos</option>
            <option value="Pakistán">Pakistán</option>
            <option value="Palaos">Palaos</option>
            <option value="Paraguay">Paraguay</option>
            <option value="Perú">Perú</option>
            <option value="Polonia">Polonia</option>
            <option value="Portugal">Portugal</option>
            <option value="Reino Unido">Reino Unido</option>
            <option value="República Centroafricana">República Centroafricana</option>
            <option value="República Checa">República Checa</option>
            <option value="República del Congo">República del Congo</option>
            <option value="República Democrática del Congo">República Democrática del Congo</option>
            <option value="República Dominicana">República Dominicana</option>
            <option value="Ruanda">Ruanda</option>
            <option value="Rumanía">Rumanía</option>
            <option value="Rusia">Rusia</option>
            <option value="Samoa">Samoa</option>
            <option value="San Cristóbal y Nieves">San Cristóbal y Nieves</option>
            <option value="San Marino">San Marino</option>
            <option value="San Vicente y las Granadinas">San Vicente y las Granadinas</option>
            <option value="Santa Lucía">Santa Lucía</option>
            <option value="Santo Tomé y Príncipe">Santo Tomé y Príncipe</option>
            <option value="Senegal">Senegal</option>
            <option value="Serbia">Serbia</option>
            <option value="Seychelles">Seychelles</option>
            <option value="Sierra Leona">Sierra Leona</option>
            <option value="Singapur">Singapur</option>
            <option value="Siria">Siria</option>
            <option value="Somalia">Somalia</option>
            <option value="Sri Lanka">Sri Lanka</option>
            <option value="Suazilandia">Suazilandia</option>
            <option value="Sudáfrica">Sudáfrica</option>
            <option value="Sudán">Sudán</option>
            <option value="Sudán del Sur">Sudán del Sur</option>
            <option value="Suecia">Suecia</option>
            <option value="Suiza">Suiza</option>
            <option value="Surinam">Surinam</option>
            <option value="Tailandia">Tailandia</option>
            <option value="Tanzania">Tanzania</option>
            <option value="Tayikistán">Tayikistán</option>
            <option value="Timor Oriental">Timor Oriental</option>
            <option value="Togo">Togo</option>
            <option value="Tonga">Tonga</option>
            <option value="Trinidad y Tobago">Trinidad y Tobago</option>
            <option value="Túnez">Túnez</option>
            <option value="Turkmenistán">Turkmenistán</option>
            <option value="Turquía">Turquía</option>
            <option value="Tuvalu">Tuvalu</option>
            <option value="Ucrania">Ucrania</option>
            <option value="Uganda">Uganda</option>
            <option value="Uruguay">Uruguay</option>
            <option value="Uzbekistán">Uzbekistán</option>
            <option value="Vanuatu">Vanuatu</option>
            <option value="Venezuela">Venezuela</option>
            <option value="Vietnam">Vietnam</option>
            <option value="Yemen">Yemen</option>
            <option value="Yibuti">Yibuti</option>
            <option value="Zambia">Zambia</option>
            <option value="Zimbabue">Zimbabue</option>
          </select>
          {errors.nacionalidad && <p className="text-xs text-red-500 mt-1">{errors.nacionalidad}</p>}
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        <WizardInputField label="Ocupación actual" name="ocupacion" placeholder="Ingeniero Civil" data={data} errors={errors} onUpdate={update} />
        <WizardInputField label="¿Dónde trabaja?" name="lugarTrabajo" placeholder="Empresa ABC" data={data} errors={errors} onUpdate={update} />
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Describa sus funciones <span className="text-red-500">*</span>
          </label>
          <textarea
            value={data.funcionesTrabajo}
            onChange={(e) => update({ funcionesTrabajo: e.target.value })}
            placeholder="Descripción breve de sus funciones laborales"
            rows={3}
            className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none transition-colors resize-none ${
              errors.funcionesTrabajo ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-200 bg-white focus:border-[#8AAA19]'
            }`}
          />
          {errors.funcionesTrabajo && <p className="text-red-500 text-xs mt-1 font-medium">{errors.funcionesTrabajo}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Salario mensual (USD) <span className="text-red-500">*</span>
          </label>
          <div className={`flex items-center gap-2 px-4 py-4 border-2 rounded-xl transition-colors ${errors.salarioMensual ? 'border-red-400 bg-red-50 focus-within:border-red-500' : 'border-gray-200 bg-white focus-within:border-[#8AAA19]'}`}>
            <span className="flex-shrink-0 text-gray-500 font-bold text-xl sm:text-2xl select-none">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={data.salarioMensual}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                const parts = raw.split('.');
                const cleaned = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw;
                update({ salarioMensual: cleaned });
              }}
              onBlur={() => { const fmt = formatCurrencyBlur(data.salarioMensual); if (fmt) update({ salarioMensual: fmt }); }}
              onFocus={(e) => {
                const raw = data.salarioMensual.replace(/,/g, '');
                update({ salarioMensual: raw });
                setTimeout(() => e.target.select(), 0);
              }}
              placeholder="0.00"
              onWheel={(e) => e.currentTarget.blur()}
              className="flex-1 min-w-0 p-0 border-0 bg-transparent text-2xl sm:text-3xl font-bold focus:outline-none focus:ring-0 appearance-none"
            />
          </div>
          {errors.salarioMensual && <p className="text-red-500 text-xs mt-1 font-medium">{errors.salarioMensual}</p>}
          {!errors.salarioMensual && <p className="text-gray-400 text-xs mt-1">Ingresa tu salario mensual bruto</p>}
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-4">
        {/* Provincia */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Provincia <span className="text-red-500">*</span>
          </label>
          <select
            value={data.provincia}
            onChange={(e) => {
              update({ provincia: e.target.value });
              fetchDistritos(parseInt(e.target.value) || 0);
            }}
            className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none bg-white transition-colors ${
              errors.provincia ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#8AAA19]'
            }`}
            disabled={loadingAddr === 'provincias'}
          >
            <option value="">{loadingAddr === 'provincias' ? 'Cargando...' : 'Seleccionar provincia'}</option>
            {provincias.map(p => <option key={p.DATO} value={p.DATO}>{p.TEXTO}</option>)}
          </select>
          {errors.provincia && <p className="text-red-500 text-xs mt-1 font-medium">{errors.provincia}</p>}
        </div>

        {/* Distrito */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Distrito <span className="text-red-500">*</span>
          </label>
          <select
            value={data.distrito}
            onChange={(e) => {
              update({ distrito: e.target.value });
              if (data.provincia) fetchCorregimientos(parseInt(data.provincia), parseInt(e.target.value) || 0);
            }}
            className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none bg-white transition-colors ${
              errors.distrito ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#8AAA19]'
            }`}
            disabled={!data.provincia || loadingAddr === 'distritos'}
          >
            <option value="">{loadingAddr === 'distritos' ? 'Cargando...' : 'Seleccionar distrito'}</option>
            {distritos.map(d => <option key={d.DATO} value={d.DATO}>{d.TEXTO}</option>)}
          </select>
          {errors.distrito && <p className="text-red-500 text-xs mt-1 font-medium">{errors.distrito}</p>}
        </div>

        {/* Corregimiento */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Corregimiento <span className="text-red-500">*</span>
          </label>
          <select
            value={data.corregimiento}
            onChange={(e) => update({ corregimiento: e.target.value })}
            className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none bg-white transition-colors ${
              errors.corregimiento ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#8AAA19]'
            }`}
            disabled={!data.distrito || loadingAddr === 'corregimientos'}
          >
            <option value="">{loadingAddr === 'corregimientos' ? 'Cargando...' : 'Seleccionar corregimiento'}</option>
            {corregimientos.map(c => <option key={c.DATO} value={c.DATO}>{c.TEXTO}</option>)}
          </select>
          {errors.corregimiento && <p className="text-red-500 text-xs mt-1 font-medium">{errors.corregimiento}</p>}
        </div>

        {/* Barriada / Urbanización */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Barriada / Urbanización
          </label>
          <select
            value={data.barriada}
            onChange={(e) => update({ barriada: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none bg-white focus:border-[#8AAA19] transition-colors"
          >
            <option value="">Seleccionar (opcional)</option>
            {urbanizaciones.map(u => <option key={u.DATO} value={u.DATO}>{u.TEXTO}</option>)}
          </select>
        </div>

        {/* Dirección / Referencias */}
        <WizardInputField label="Dirección / referencias" name="direccionReferencias" placeholder="Calle principal, edificio azul, piso 3" required={false} data={data} errors={errors} onUpdate={update} />
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Altura — auto-decimal after first digit, max 2 decimal places */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Altura (metros) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={data.altura}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                if (raw === '') { update({ altura: '' }); return; }
                // First digit becomes "X."
                const integer = raw[0];
                const decimals = raw.slice(1, 3); // max 2 decimal digits
                const formatted = decimals.length > 0 ? `${integer}.${decimals}` : `${integer}.`;
                update({ altura: formatted });
              }}
              placeholder="1.85"
              maxLength={4}
              className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none transition-colors ${
                errors.altura ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-200 bg-white focus:border-[#8AAA19]'
              }`}
            />
            {errors.altura && <p className="text-red-500 text-xs mt-1 font-medium">{errors.altura}</p>}
            {!errors.altura && <p className="text-gray-400 text-xs mt-1">Ej: 1.85</p>}
          </div>

          {/* Peso — integers only, max 3 digits */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Peso (libras) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={data.peso}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                update({ peso: raw });
              }}
              placeholder="180"
              maxLength={3}
              className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none transition-colors ${
                errors.peso ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-200 bg-white focus:border-[#8AAA19]'
              }`}
            />
            {errors.peso && <p className="text-red-500 text-xs mt-1 font-medium">{errors.peso}</p>}
            {!errors.peso && <p className="text-gray-400 text-xs mt-1">Ej: 180</p>}
          </div>
        </div>

        {/* IMC Banner */}
        {(() => {
          const alturaM = parseFloat(data.altura) || 0;
          const pesoLb = parseFloat(data.peso) || 0;
          if (alturaM < 0.5 || pesoLb < 30) return null;
          const pulgadas = alturaM * 39.37;
          const imc = (pesoLb * 703) / (pulgadas * pulgadas);
          const imcStr = imc.toFixed(1);
          let color = '';
          let label = '';
          let warning = false;
          if (imc < 18.5) { color = 'bg-red-50 border-red-300 text-red-700'; label = 'Bajo peso'; warning = true; }
          else if (imc < 25) { color = 'bg-green-50 border-green-300 text-green-700'; label = 'Normal'; }
          else if (imc < 30) { color = 'bg-yellow-50 border-yellow-300 text-yellow-700'; label = 'Sobrepeso'; }
          else { color = 'bg-red-50 border-red-300 text-red-700'; label = 'Obesidad'; warning = true; }
          return (
            <div className={`border rounded-xl px-4 py-3 ${color}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Índice de Masa Corporal (IMC)</span>
                <span className="text-lg font-bold">{imcStr} — {label}</span>
              </div>
              {warning && (
                <p className="text-xs mt-1 font-medium">⚠️ Posibilidad de recargo en prima o rechazo para asegurabilidad</p>
              )}
            </div>
          );
        })()}

        {/* Enfermedad */}
        <YesNoCards
          name="tieneEnfermedad"
          label="¿Sufre de alguna enfermedad, toma algún medicamento diario o está diagnosticado por alguna condición?"
          value={data.tieneEnfermedad}
        />
        {data.tieneEnfermedad && (
          <div className="animate-fadeIn">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Describa (diagnóstico/medicamento/condición) <span className="text-red-500">*</span>
            </label>
            <textarea
              value={data.descripcionEnfermedad}
              onChange={(e) => update({ descripcionEnfermedad: e.target.value })}
              placeholder="Ej: Hipertensión, tomo Losartán 50mg diario"
              rows={3}
              className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none transition-colors resize-none ${
                errors.descripcionEnfermedad ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-200 bg-white focus:border-[#8AAA19]'
              }`}
            />
            {errors.descripcionEnfermedad && <p className="text-red-500 text-xs mt-1 font-medium">{errors.descripcionEnfermedad}</p>}
          </div>
        )}

        {/* Fumador */}
        <YesNoCards
          name="haFumadoAlgunaVez"
          label="¿Ha fumado alguna vez en su vida?"
          value={data.haFumadoAlgunaVez}
        />
        {data.haFumadoAlgunaVez && (
          <div className="animate-fadeIn">
            <YesNoCards
              name="fumaActualmente"
              label="¿Actualmente fuma?"
              value={data.fumaActualmente}
            />
          </div>
        )}
        {data.haFumadoAlgunaVez && data.fumaActualmente === false && (
          <div className="animate-fadeIn">
            <WizardInputField
              label="¿Cuándo fue la última vez que fumó?"
              name="ultimaVezFumo"
              placeholder="Ej: Hace 3 años"
              data={data} errors={errors} onUpdate={update}
            />
          </div>
        )}
      </div>
    );
  }

  function renderStep5() {
    const sumaActualNum = parseCurrency(data.sumaAseguradaActual);
    const sumaSolicitadaNum = parseCurrency(data.sumaAseguradaSolicitada);
    const cumuloTotal = (data.tieneSeguroVida && sumaActualNum > 0) ? sumaSolicitadaNum + sumaActualNum : sumaSolicitadaNum;
    const esFumador = !!data.haFumadoAlgunaVez;
    const esMasculino = data.sexo === 'M';
    const requisitos = calcularRequisitos(edad, cumuloTotal, esFumador, esMasculino);
    const tieneCumulo = data.tieneSeguroVida && sumaActualNum > 0 && sumaSolicitadaNum > 0;

    return (
      <div className="space-y-5">
        {/* Seguro actual */}
        <YesNoCards name="tieneSeguroVida" label="¿Tiene ya seguro de vida?" value={data.tieneSeguroVida} />
        {data.tieneSeguroVida && (
          <div className="animate-fadeIn space-y-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <WizardInputField label="Compañía aseguradora" name="companiaSeguroActual" placeholder="ASSA, Mapfre, etc." data={data} errors={errors} onUpdate={update} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Suma asegurada actual (USD) <span className="text-red-500">*</span>
              </label>
              <div className={`flex items-center gap-2 px-4 py-4 border-2 rounded-xl transition-colors ${errors.sumaAseguradaActual ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white focus-within:border-[#8AAA19]'}`}>
                <span className="flex-shrink-0 text-gray-500 font-bold text-xl sm:text-2xl select-none">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={data.sumaAseguradaActual}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = raw.split('.');
                    const cleaned = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw;
                    const decimals = cleaned.split('.')[1];
                    if (decimals && decimals.length > 2) return;
                    update({ sumaAseguradaActual: cleaned });
                  }}
                  onBlur={() => { const fmt = formatCurrencyBlur(data.sumaAseguradaActual); if (fmt) update({ sumaAseguradaActual: fmt }); }}
                  onFocus={(e) => { const raw = data.sumaAseguradaActual.replace(/,/g, ''); update({ sumaAseguradaActual: raw }); setTimeout(() => e.target.select(), 0); }}
                  placeholder="0.00"
                  onWheel={(e) => e.currentTarget.blur()}
                  className="flex-1 min-w-0 p-0 border-0 bg-transparent text-2xl sm:text-3xl font-bold focus:outline-none focus:ring-0 appearance-none"
                />
              </div>
              {errors.sumaAseguradaActual && <p className="text-red-500 text-xs mt-1 font-medium">{errors.sumaAseguradaActual}</p>}
            </div>
          </div>
        )}

        {/* Hipoteca */}
        <YesNoCards name="esCubrirHipoteca" label="¿La póliza es para cubrir una hipoteca?" value={data.esCubrirHipoteca} />
        {data.esCubrirHipoteca && (
          <div className="animate-fadeIn">
            <WizardInputField label="¿A cuántos años es la hipoteca?" name="aniosHipoteca" type="number" inputMode="numeric" placeholder="20" data={data} errors={errors} onUpdate={update} />
          </div>
        )}

        {/* Suma asegurada solicitada */}
        <div className="bg-gradient-to-br from-[#010139]/5 to-[#8AAA19]/5 rounded-xl p-4 sm:p-5 border-2 border-[#8AAA19]/20">
          <h4 className="text-base font-bold text-[#010139] mb-0.5">Resultado</h4>

          {esMenor ? (
            <p className="text-sm text-gray-600 mb-3">
              Para menores de edad, la suma asegurada máxima permitida es de{' '}
              <span className="font-bold text-[#010139]">$25,000.00</span>.
            </p>
          ) : edad > 0 && ingresoAnual > 0 ? (
            <p className="text-sm text-gray-600 mb-3">
              Basado en tu edad de <span className="font-semibold">{edad} años</span> y tus ingresos anuales de{' '}
              <span className="font-semibold">${formatUSD(ingresoAnual)}</span>, puedes aspirar a una suma asegurada de hasta:
            </p>
          ) : (
            <p className="text-sm text-gray-500 mb-3">Completa tu fecha de nacimiento y salario para ver tu máximo recomendado.</p>
          )}

          {maximoEfectivo > 0 && (
            <p className="text-3xl sm:text-4xl font-extrabold text-[#8AAA19] mb-4">
              ${formatUSD(maximoEfectivo)}
            </p>
          )}

          {/* Input label */}
          <p className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
            Suma asegurada solicitada — ingrese aquí
            <span className="text-[#8AAA19]">↓</span>
          </p>

          {(() => {
            const belowMin = sumaSolicitadaNum > 0 && sumaSolicitadaNum < minimoFijo;
            const aboveMax = maximoEfectivo > 0 && sumaSolicitadaNum > maximoEfectivo;
            const inRange = sumaSolicitadaNum >= minimoFijo && (!maximoEfectivo || sumaSolicitadaNum <= maximoEfectivo);
            const borderClass = belowMin || aboveMax
              ? 'border-red-400 bg-red-50 focus-within:border-red-500'
              : inRange
              ? 'border-[#8AAA19] bg-[#8AAA19]/5 focus-within:border-[#8AAA19]'
              : 'border-[#8AAA19]/40 bg-white focus-within:border-[#8AAA19]';
            return (
              <>
                <div className={`flex items-center gap-2 px-4 py-4 border-2 rounded-xl transition-colors ${borderClass}`}>
                  <span className="flex-shrink-0 text-gray-500 font-bold text-xl sm:text-2xl select-none">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={data.sumaAseguradaSolicitada}
                    onChange={(e) => { update({ sumaAseguradaSolicitada: formatInteger(e.target.value) }); }}
                    onFocus={(e) => { const raw = data.sumaAseguradaSolicitada.replace(/,/g, ''); update({ sumaAseguradaSolicitada: raw }); setTimeout(() => e.target.select(), 0); }}
                    onBlur={() => { const raw = data.sumaAseguradaSolicitada.replace(/,/g, ''); if (raw) update({ sumaAseguradaSolicitada: formatInteger(raw) }); }}
                    placeholder="Ej: 100,000"
                    onWheel={(e) => e.currentTarget.blur()}
                    className="flex-1 min-w-0 p-0 border-0 bg-transparent text-2xl sm:text-3xl font-bold focus:outline-none focus:ring-0 appearance-none"
                  />
                </div>
                {belowMin && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium">Está por debajo del mínimo permitido (${formatUSD(minimoFijo)})</p>
                )}
                {aboveMax && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium">Supera el máximo calculado para tu perfil (${formatUSD(maximoEfectivo)})</p>
                )}
                {!belowMin && !aboveMax && errors.sumaAseguradaSolicitada && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.sumaAseguradaSolicitada}</p>
                )}
                {maximoEfectivo > 0 && !belowMin && !aboveMax && (
                  <p className="text-xs text-gray-500 mt-1.5">Rango permitido: ${formatUSD(minimoFijo)} – ${formatUSD(maximoEfectivo)}</p>
                )}
              </>
            );
          })()}

          {/* Requisitos de Asegurabilidad */}
          {sumaSolicitadaNum >= minimoFijo && (
            <div className="mt-4 border border-blue-200 bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-bold text-blue-800 mb-2">Requisitos de asegurabilidad</p>

              {tieneCumulo && (
                <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-800">⚠️ Cúmulo ASSA detectado</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Suma solicitada ${formatUSD(sumaSolicitadaNum)} + seguro actual ${formatUSD(sumaActualNum)} = <span className="font-bold">${formatUSD(cumuloTotal)}</span>
                  </p>
                  <p className="text-xs text-amber-700">Los requisitos se calculan sobre el total acumulado.</p>
                </div>
              )}

              {esMenor && (
                <div className="mb-3 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-xs font-semibold text-purple-800">Menor de edad</p>
                  <p className="text-xs text-purple-700 mt-0.5">Suma máxima permitida para menores: $25,000.00</p>
                </div>
              )}

              {requisitos.length === 0 ? (
                <p className="text-sm text-green-700 font-medium">✓ No se requieren exámenes médicos para esta suma asegurada.</p>
              ) : (
                <ul className="space-y-2">
                  {requisitos.map((r) => (
                    <li key={r.key} className="text-sm">
                      <span className="font-semibold text-blue-900">{r.label}</span>
                      {r.detalle && <p className="text-xs text-blue-700 mt-0.5">{r.detalle}</p>}
                    </li>
                  ))}
                </ul>
              )}

              {esFumador && (
                <p className="text-xs text-gray-600 mt-2 border-t border-blue-200 pt-2">
                  * Fumador declarado — Prueba de Nicotina incluida en EXM/UL.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderStep6() {
    const provName = provincias.find(p => String(p.DATO) === data.provincia)?.TEXTO || data.provincia;
    const distName = distritos.find(d => String(d.DATO) === data.distrito)?.TEXTO || data.distrito;
    const corrName = corregimientos.find(c => String(c.DATO) === data.corregimiento)?.TEXTO || data.corregimiento;
    const urbName = urbanizaciones.find(u => String(u.DATO) === data.barriada)?.TEXTO || data.barriada;

    return (
      <div className="space-y-5">
        {/* Tipo de propuesta */}
        <div>
          <h4 className="text-sm font-bold text-[#010139] mb-3">¿Desea una propuesta con ahorros o a término? <span className="text-red-500">*</span></h4>

          {/* Con Ahorros Card */}
          <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all mb-3 ${
            data.propuestaConAhorros ? 'border-[#8AAA19] bg-[#8AAA19]/5 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}>
            <input
              type="checkbox"
              checked={data.propuestaConAhorros}
              onChange={(e) => update({ propuestaConAhorros: e.target.checked })}
              className="mt-1 w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
            />
            <div>
              <p className="font-semibold text-[#010139] text-sm">Con ahorros</p>
              <p className="text-xs text-gray-500 mt-1">Parte de tu prima se destina a un fondo de ahorro. La prima es mayor, pero acumulas un valor en efectivo que puedes retirar o utilizar según las condiciones de la póliza.</p>
            </div>
          </label>

          {/* A Término Card */}
          <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            data.propuestaATermino ? 'border-[#8AAA19] bg-[#8AAA19]/5 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}>
            <input
              type="checkbox"
              checked={data.propuestaATermino}
              onChange={(e) => update({ propuestaATermino: e.target.checked })}
              className="mt-1 w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
            />
            <div>
              <p className="font-semibold text-[#010139] text-sm">A término</p>
              <p className="text-xs text-gray-500 mt-1">Cobertura por un plazo definido. Si se usa para una hipoteca, la suma asegurada puede mantenerse nivelada: si la deuda baja con el tiempo, la diferencia puede quedar como protección para tu familia.</p>
            </div>
          </label>
          {errors.tiposPropuesta && <p className="text-red-500 text-xs mt-1 font-medium">{errors.tiposPropuesta}</p>}
        </div>

        {/* Confirmación */}
        <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
          data.confirmaInformacion ? 'border-[#8AAA19] bg-[#8AAA19]/5' : 'border-gray-200 bg-white'
        }`}>
          <input
            type="checkbox"
            checked={data.confirmaInformacion}
            onChange={(e) => update({ confirmaInformacion: e.target.checked })}
            className="mt-0.5 w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
          />
          <span className="text-sm font-medium text-gray-700">Confirmo que la información proporcionada es correcta.</span>
        </label>
        {errors.confirmaInformacion && <p className="text-red-500 text-xs mt-1 font-medium">{errors.confirmaInformacion}</p>}
        {errors.submit && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">
            {errors.submit}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  const VIDA_STEPS: BreadcrumbStepDef[] = [
    { key: 'payment' as any,       label: 'Datos personales',        shortLabel: 'Personal',   icon: FaUser },
    { key: 'emission-data' as any, label: 'Trabajo e ingresos',      shortLabel: 'Trabajo',    icon: FaBriefcase },
    { key: 'vehicle' as any,       label: 'Dirección residencial',   shortLabel: 'Dirección',  icon: FaHome },
    { key: 'inspection' as any,    label: 'Datos físicos y salud',   shortLabel: 'Salud',      icon: FaHeartbeat },
    { key: 'payment-info' as any,  label: 'Cobertura y objetivo',    shortLabel: 'Cobertura',  icon: FaShieldAlt },
    { key: 'review' as any,        label: 'Propuesta y resumen',     shortLabel: 'Resumen',    icon: FaClipboardCheck },
  ];

  const stepKeyByNumber = (n: number) => VIDA_STEPS[n - 1]?.key ?? 'payment';
  const completedStepKeys = VIDA_STEPS.slice(0, step - 1).map(s => s.key);

  const stepTitles = VIDA_STEPS.map(s => s.label);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100" ref={formRef}>
      {/* Progress Bar */}
      <div className="pt-6">
        <EmissionProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Breadcrumb — identical to emisor auto */}
      <EmissionBreadcrumb
        currentStep={stepKeyByNumber(step) as any}
        completedSteps={completedStepKeys as any}
        steps={VIDA_STEPS as any}
        onStepClick={(key: any) => {
          const idx = VIDA_STEPS.findIndex(s => s.key === key);
          if (idx !== -1 && idx + 1 < step) goToStep(idx + 1);
        }}
      />

      {/* Content */}
      <div className="py-8 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Back button */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => router.push('/cotizadores')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <FaArrowLeft size={12} /> Volver a Cotizadores
            </button>
          </div>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-1">Cotiza tu Seguro de Vida</h1>
            <p className="text-sm text-gray-500">Completa el formulario y recibirás tu cotización por correo en 24 horas.</p>
          </div>

          {/* Step Card */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-5 sm:p-7 mb-6">
            <div className="flex items-center gap-2 mb-5">
              {(() => { const Icon = VIDA_STEPS[step - 1]?.icon; return Icon ? <Icon className="text-xl text-[#8AAA19]" /> : null; })()}
              <h2 className="text-lg font-bold text-[#010139]">{stepTitles[step - 1]}</h2>
            </div>
            <div className={`transition-all duration-300 ${direction === 'forward' ? 'animate-slideInRight' : 'animate-slideInLeft'}`}>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
              {step === 5 && renderStep5()}
              {step === 6 && renderStep6()}
            </div>
          </div>

      {/* Summary Card — shown below step card on step 6 */}
      {step === 6 && (() => {
        const provName = provincias.find(p => String(p.DATO) === data.provincia)?.TEXTO || data.provincia;
        const distName = distritos.find(d => String(d.DATO) === data.distrito)?.TEXTO || data.distrito;
        const corrName = corregimientos.find(c => String(c.DATO) === data.corregimiento)?.TEXTO || data.corregimiento;
        const urbName = urbanizaciones.find(u => String(u.DATO) === data.barriada)?.TEXTO || data.barriada;
        return (
          <div className="bg-gray-50 rounded-2xl border-2 border-gray-200 overflow-hidden mb-6">
            <div className="bg-[#010139] px-4 py-3">
              <h4 className="text-white font-bold text-sm">Resumen de tu solicitud</h4>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <SummarySection title="Datos personales" onEdit={() => goToStep(1)} items={[
                { label: 'Nombre', value: `${data.nombre} ${data.apellido}` },
                { label: 'Nacimiento', value: `${data.fechaNacimiento} (${edad} años)` },
                { label: 'Celular', value: data.celular },
                { label: 'Correo', value: data.correo },
                { label: 'Nacionalidad', value: data.nacionalidad },
              ]} />
              <SummarySection title="Trabajo e ingresos" onEdit={() => goToStep(2)} items={[
                { label: 'Ocupación', value: data.ocupacion },
                { label: 'Trabaja en', value: data.lugarTrabajo },
                { label: 'Salario mensual', value: `$${formatUSD(salarioNum)}` },
              ]} />
              <SummarySection title="Dirección" onEdit={() => goToStep(3)} items={[
                { label: 'Ubicación', value: [provName, distName, corrName].filter(Boolean).join(', ') },
                urbName ? { label: 'Barriada', value: urbName } : null,
                data.direccionReferencias ? { label: 'Ref.', value: data.direccionReferencias } : null,
              ].filter(Boolean) as any} />
              <SummarySection title="Salud" onEdit={() => goToStep(4)} items={[
                { label: 'Altura / Peso', value: `${data.altura}m / ${data.peso} lbs` },
                { label: 'Enfermedad', value: data.tieneEnfermedad ? `Sí — ${data.descripcionEnfermedad}` : 'No' },
                { label: 'Fumador', value: !data.haFumadoAlgunaVez ? 'Nunca' : (data.fumaActualmente ? 'Sí, actualmente' : `No — Dejó: ${data.ultimaVezFumo}`) },
              ]} />
              <SummarySection title="Cobertura" onEdit={() => goToStep(5)} items={[
                { label: 'Seguro actual', value: data.tieneSeguroVida ? `Sí — ${data.companiaSeguroActual} ($${formatUSD(parseFloat(data.sumaAseguradaActual) || 0)})` : 'No' },
                { label: 'Hipoteca', value: data.esCubrirHipoteca ? `Sí — ${data.aniosHipoteca} años` : 'No' },
                { label: 'Suma solicitada', value: `$${formatUSD(parseFloat(data.sumaAseguradaSolicitada) || 0)}` },
              ]} />
            </div>
          </div>
        );
      })()}

          {/* Navigation */}
          <div className="flex items-center gap-3 mt-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200 bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
              >
                <FaArrowLeft size={16} /> Atrás
              </button>
            ) : <div className="w-full" />}

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={goNext}
                className="w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105"
              >
                Siguiente <FaArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
              >
                {submitting ? (
                  <><FaSpinner className="animate-spin" size={18} /> Enviando...</>
                ) : (
                  <><FaCheck size={16} /> Enviar solicitud</>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY SECTION SUB-COMPONENT
// ═══════════════════════════════════════════════════════════════════

function SummarySection({ title, items, onEdit }: {
  title: string;
  items: { label: string; value: string }[];
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-1"
      >
        <span className="text-xs font-bold text-[#010139] uppercase tracking-wide">{title}</span>
        <div className="flex items-center gap-2">
          <span onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-[10px] text-[#8AAA19] font-semibold hover:underline cursor-pointer">
            Editar
          </span>
          {open ? <FaChevronUp size={10} className="text-gray-400" /> : <FaChevronDown size={10} className="text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs">
              <span className="text-gray-500">{item.label}</span>
              <span className="text-gray-800 font-medium text-right max-w-[60%] break-words">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
