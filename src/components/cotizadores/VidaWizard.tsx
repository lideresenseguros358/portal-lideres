'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaArrowRight, FaCheck, FaSpinner, FaInfoCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { createPetitionFromQuote } from '@/lib/operaciones/createPetitionFromQuote';
import EmissionProgressBar from '@/components/cotizadores/EmissionProgressBar';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface VidaFormData {
  // Step 1 — Datos personales
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
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
  celular: '',
  correo: '',
  nacionalidad: 'Panameña',
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

function sanitizeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const salarioNum = parseFloat(data.salarioMensual) || 0;
  const multiplicador = getMultiplicador(edad);
  const ingresoAnual = salarioNum * 12;
  const maximoCalculado = calcularMaximo(salarioNum, edad);
  const minimoFijo = 25000;

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

  // ── Auto-fill suma asegurada when edad + salario change ──
  useEffect(() => {
    if (edad > 0 && salarioNum > 0 && !data.sumaAseguradaSolicitada) {
      const max = calcularMaximo(salarioNum, edad);
      setData(prev => ({ ...prev, sumaAseguradaSolicitada: max.toString() }));
    }
  }, [edad, salarioNum]);

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
        else if (edad < 18 || edad > 85) e.fechaNacimiento = 'Edad debe estar entre 18 y 85 años';
      }
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
      if (!data.salarioMensual || parseFloat(data.salarioMensual) <= 0) e.salarioMensual = 'Salario debe ser mayor a 0';
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
        if (!data.sumaAseguradaActual || parseFloat(data.sumaAseguradaActual) <= 0) e.sumaAseguradaActual = 'Indica la suma asegurada actual';
      }
      if (data.esCubrirHipoteca === null) e.esCubrirHipoteca = 'Selecciona una opción';
      if (data.esCubrirHipoteca && (!data.aniosHipoteca || parseInt(data.aniosHipoteca) <= 0)) e.aniosHipoteca = 'Indica los años de la hipoteca';
      const suma = parseFloat(data.sumaAseguradaSolicitada) || 0;
      if (suma < minimoFijo) e.sumaAseguradaSolicitada = `Mínimo permitido: $${formatUSD(minimoFijo)}`;
      else if (maximoCalculado > 0 && suma > maximoCalculado) e.sumaAseguradaSolicitada = `Máximo permitido: $${formatUSD(maximoCalculado)}`;
      else if (suma <= 0) e.sumaAseguradaSolicitada = 'Indica la suma asegurada';
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
    const beSalario = parseFloat(data.salarioMensual) || 0;
    const beMax = calcularMaximo(beSalario, beEdad);
    const beSuma = parseFloat(data.sumaAseguradaSolicitada) || 0;

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

  const InputField = ({ name, ...props }: any) => (
    <StableInputField
      name={name}
      value={(data as any)[name]}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ [name]: e.target.value })}
      error={errors[name]}
      {...props}
    />
  );

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
          <InputField label="Nombre" name="nombre" placeholder="Juan" />
          <InputField label="Apellido" name="apellido" placeholder="Pérez" />
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
            <p className="text-sm text-[#8AAA19] font-semibold mt-1">Edad: {edad} años</p>
          )}
          {errors.fechaNacimiento && <p className="text-red-500 text-xs mt-1 font-medium">{errors.fechaNacimiento}</p>}
        </div>
        <InputField label="Celular" name="celular" type="tel" inputMode="tel" placeholder="+507 6000-0000" hint="Formato: +507 y número local" />
        <InputField label="Correo electrónico" name="correo" type="email" inputMode="email" placeholder="correo@ejemplo.com" />
        <InputField label="Nacionalidad" name="nacionalidad" placeholder="Panameña" />
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        <InputField label="Ocupación actual" name="ocupacion" placeholder="Ingeniero Civil" />
        <InputField label="¿Dónde trabaja?" name="lugarTrabajo" placeholder="Empresa ABC" />
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
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
            <input
              type="number"
              inputMode="decimal"
              value={data.salarioMensual}
              onChange={(e) => update({ salarioMensual: e.target.value })}
              placeholder="1500"
              min="1"
              step="any"
              onWheel={(e) => e.currentTarget.blur()}
              className={`w-full pl-8 pr-4 py-3 border-2 rounded-xl text-base focus:outline-none transition-colors appearance-none ${
                errors.salarioMensual ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-gray-200 bg-white focus:border-[#8AAA19]'
              }`}
            />
          </div>
          {errors.salarioMensual && <p className="text-red-500 text-xs mt-1 font-medium">{errors.salarioMensual}</p>}
          {!errors.salarioMensual && <p className="text-gray-400 text-xs mt-1">Ejemplo: 1500</p>}
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
        <InputField label="Dirección / referencias" name="direccionReferencias" placeholder="Calle principal, edificio azul, piso 3" required={false} />
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Altura (metros)" name="altura" type="number" inputMode="decimal" placeholder="1.75" hint="Ej: 1.75" step="0.01" min="0.5" max="2.5" />
          <InputField label="Peso (libras)" name="peso" type="number" inputMode="numeric" placeholder="180" hint="Ej: 180" step="1" min="30" max="600" />
        </div>

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
            <InputField
              label="¿Cuándo fue la última vez que fumó?"
              name="ultimaVezFumo"
              placeholder="Ej: Hace 3 años"
            />
          </div>
        )}
      </div>
    );
  }

  function renderStep5() {
    return (
      <div className="space-y-5">
        {/* Seguro actual */}
        <YesNoCards name="tieneSeguroVida" label="¿Tiene ya seguro de vida?" value={data.tieneSeguroVida} />
        {data.tieneSeguroVida && (
          <div className="animate-fadeIn space-y-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <InputField label="Compañía aseguradora" name="companiaSeguroActual" placeholder="ASSA, Mapfre, etc." />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Suma asegurada actual (USD) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={data.sumaAseguradaActual}
                  onChange={(e) => update({ sumaAseguradaActual: e.target.value })}
                  placeholder="50000"
                  onWheel={(e) => e.currentTarget.blur()}
                  className={`w-full pl-8 pr-4 py-3 border-2 rounded-xl text-base focus:outline-none transition-colors appearance-none ${
                    errors.sumaAseguradaActual ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#8AAA19]'
                  }`}
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
            <InputField label="¿A cuántos años es la hipoteca?" name="aniosHipoteca" type="number" inputMode="numeric" placeholder="20" />
          </div>
        )}

        {/* Suma asegurada solicitada */}
        <div className="bg-gradient-to-br from-[#010139]/5 to-[#8AAA19]/5 rounded-xl p-4 sm:p-5 border-2 border-[#8AAA19]/20">
          <div className="flex items-start gap-2 mb-3">
            <h4 className="text-sm font-bold text-[#010139]">Suma asegurada solicitada (USD)</h4>
            <div className="group relative">
              <FaInfoCircle className="text-[#8AAA19] text-sm cursor-help" />
              <div className="hidden group-hover:block absolute z-10 left-0 top-6 w-64 bg-white p-3 rounded-lg shadow-xl border text-xs text-gray-600">
                Tu máximo recomendado se calcula con tu ingreso anual y un multiplicador según tu edad. Esto nos ayuda a sugerirte una suma asegurada acorde.
              </div>
            </div>
          </div>

          {edad > 0 && salarioNum > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="bg-white rounded-lg p-2 text-center border">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Edad</p>
                <p className="text-sm font-bold text-[#010139]">{edad} años</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center border">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Multiplicador</p>
                <p className="text-sm font-bold text-[#8AAA19]">x{multiplicador}</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center border">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Ingreso anual</p>
                <p className="text-sm font-bold text-[#010139]">${formatUSD(ingresoAnual)}</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center border">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">Máximo</p>
                <p className="text-sm font-bold text-[#8AAA19]">${formatUSD(maximoCalculado)}</p>
              </div>
            </div>
          )}

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
            <input
              type="number"
              inputMode="numeric"
              value={data.sumaAseguradaSolicitada}
              onChange={(e) => update({ sumaAseguradaSolicitada: e.target.value })}
              placeholder="Suma asegurada"
              min={minimoFijo}
              max={maximoCalculado || undefined}
              onWheel={(e) => e.currentTarget.blur()}
              className={`w-full pl-10 pr-4 py-4 border-2 rounded-xl text-lg font-bold focus:outline-none transition-colors appearance-none ${
                errors.sumaAseguradaSolicitada ? 'border-red-400 bg-red-50' : 'border-[#8AAA19]/40 bg-white focus:border-[#8AAA19]'
              }`}
            />
          </div>
          {errors.sumaAseguradaSolicitada && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.sumaAseguradaSolicitada}</p>}
          {maximoCalculado > 0 && !errors.sumaAseguradaSolicitada && (
            <p className="text-xs text-gray-500 mt-1.5">Rango permitido: ${formatUSD(minimoFijo)} – ${formatUSD(maximoCalculado)}</p>
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
              <p className="text-xs text-gray-500 mt-1">Parte de tu pago se acumula en un fondo. Ese valor puede estar disponible según las condiciones de la póliza y puede afectar el costo y las proyecciones del plan.</p>
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

        {/* Resumen */}
        <div className="bg-gray-50 rounded-xl border-2 border-gray-200 overflow-hidden">
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

  const stepTitles = [
    'Datos personales',
    'Trabajo e ingresos',
    'Dirección residencial',
    'Datos físicos y salud',
    'Cobertura y objetivo',
    'Tipo de propuesta y resumen',
  ];

  const stepIcons = ['👤', '💼', '🏠', '🏥', '🛡️', '📋'];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10" ref={formRef}>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-1">
          Cotiza tu Seguro de Vida
        </h1>
        <p className="text-sm text-gray-500">
          Completa el formulario y recibirás tu cotización por correo en 24 horas.
        </p>
      </div>

      {/* Progress Bar */}
      <EmissionProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

      {/* Step Card */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-5 sm:p-7 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xl">{stepIcons[step - 1]}</span>
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

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <FaArrowLeft size={12} /> Atrás
          </button>
        ) : <div />}

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#8AAA19] hover:bg-[#6d8814] transition-colors shadow-lg"
          >
            Siguiente <FaArrowRight size={12} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#8AAA19] hover:bg-[#6d8814] transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin" size={14} /> Enviando...
              </>
            ) : (
              <>
                Enviar solicitud <FaCheck size={12} />
              </>
            )}
          </button>
        )}
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
