'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaArrowRight, FaCheck, FaSpinner, FaInfoCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { createPetitionFromQuote } from '@/lib/operaciones/createPetitionFromQuote';
import { SECURITY_MEASURES } from '@/lib/constants/securityMeasures';
import EmissionProgressBar from '@/components/cotizadores/EmissionProgressBar';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface IncendioFormData {
  // Step 1 — Datos del cliente
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  celular: string;
  correo: string;
  // Step 2 — Dirección residencial
  provincia: string;
  distrito: string;
  corregimiento: string;
  barriada: string;
  tipoVivienda: 'casa' | 'apartamento' | '';
  // Casa
  calle: string;
  numeroCasa: string;
  // Apartamento
  piso: string;
  numeroApto: string;
  nombreEdificio: string;
  // Step 3 — Sistemas de seguridad
  seguridad: string[];
  // Step 4 — Valor del bien
  valorBien: string;
  // Step 5 — Confirmación
  confirmaInformacion: boolean;
}

interface AddressCatalogItem {
  DATO: number;
  TEXTO: string;
}


const TOTAL_STEPS = 5;

const INITIAL_DATA: IncendioFormData = {
  nombre: '',
  apellido: '',
  fechaNacimiento: '',
  celular: '',
  correo: '',
  provincia: '',
  distrito: '',
  corregimiento: '',
  barriada: '',
  tipoVivienda: '',
  calle: '',
  numeroCasa: '',
  piso: '',
  numeroApto: '',
  nombreEdificio: '',
  seguridad: [],
  valorBien: '',
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

export default function IncendioWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<IncendioFormData>(INITIAL_DATA);
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

  // Computed
  const edad = calcularEdad(data.fechaNacimiento);

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

  // ── Update helper ──
  function update(partial: Partial<IncendioFormData>) {
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
        else if (edad < 18 || edad > 100) e.fechaNacimiento = 'Edad debe estar entre 18 y 100 años';
      }
      if (!data.celular.trim()) e.celular = 'Celular es obligatorio';
      else if (data.celular.replace(/\D/g, '').length < 7) e.celular = 'Celular debe tener al menos 7 dígitos';
      if (!data.correo.trim()) e.correo = 'Correo es obligatorio';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) e.correo = 'Correo inválido';
    }

    if (s === 2) {
      if (!data.provincia) e.provincia = 'Selecciona una provincia';
      if (!data.distrito) e.distrito = 'Selecciona un distrito';
      if (!data.corregimiento) e.corregimiento = 'Selecciona un corregimiento';
      if (!data.tipoVivienda) e.tipoVivienda = 'Selecciona el tipo de vivienda';
      if (data.tipoVivienda === 'casa') {
        if (!data.calle.trim()) e.calle = 'Calle es obligatoria';
        if (!data.numeroCasa.trim()) e.numeroCasa = 'Número de casa es obligatorio';
      }
      if (data.tipoVivienda === 'apartamento') {
        if (!data.piso.trim()) e.piso = 'Piso es obligatorio';
        if (!data.numeroApto.trim()) e.numeroApto = 'Número de apto es obligatorio';
        if (!data.nombreEdificio.trim()) e.nombreEdificio = 'Nombre del edificio es obligatorio';
      }
    }

    if (s === 3) {
      if (data.seguridad.length === 0) e.seguridad = 'Debes seleccionar al menos una medida de seguridad.';
    }

    if (s === 4) {
      const val = parseFloat(data.valorBien) || 0;
      if (val <= 0) e.valorBien = 'Ingresa el valor del bien';
      else if (val < 10000) e.valorBien = 'Valor mínimo: $10,000';
    }

    if (s === 5) {
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
    // Clean conditional fields when switching vivienda type
    if (step === 2) {
      if (data.tipoVivienda === 'casa') update({ piso: '', numeroApto: '', nombreEdificio: '' });
      if (data.tipoVivienda === 'apartamento') update({ calle: '', numeroCasa: '' });
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
    if (!validateStep(5)) return;

    setSubmitting(true);
    try {
      const provName = provincias.find(p => String(p.DATO) === data.provincia)?.TEXTO || data.provincia;
      const distName = distritos.find(d => String(d.DATO) === data.distrito)?.TEXTO || data.distrito;
      const corrName = corregimientos.find(c => String(c.DATO) === data.corregimiento)?.TEXTO || data.corregimiento;
      const urbName = urbanizaciones.find(u => String(u.DATO) === data.barriada)?.TEXTO || data.barriada;
      const valorNum = parseFloat(data.valorBien) || 0;
      const seguridadMeta = data.seguridad.map(key => {
        const m = SECURITY_MEASURES.find(o => o.key === key);
        return { key, label: m?.label || key };
      });

      const tipoViviendaLabel = data.tipoVivienda === 'casa' ? 'Casa' : 'Apartamento';
      let direccionDetalle = '';
      if (data.tipoVivienda === 'casa') {
        direccionDetalle = `Calle: ${data.calle}, N° Casa: ${data.numeroCasa}`;
      } else if (data.tipoVivienda === 'apartamento') {
        direccionDetalle = `Edificio: ${data.nombreEdificio}, Piso: ${data.piso}, Apto: ${data.numeroApto}`;
      }

      // Build body text
      const bodyLines = [
        '══════════════════════════════════════',
        'SOLICITUD DE COTIZACIÓN - SEGURO DE INCENDIO',
        '══════════════════════════════════════',
        '',
        '── DATOS DEL CLIENTE ──',
        `Nombre: ${sanitizeHTML(data.nombre)} ${sanitizeHTML(data.apellido)}`,
        `Fecha de nacimiento: ${data.fechaNacimiento} (Edad: ${edad} años)`,
        `Celular: ${sanitizeHTML(data.celular)}`,
        `Correo: ${sanitizeHTML(data.correo)}`,
        '',
        '── DIRECCIÓN RESIDENCIAL ──',
        `Provincia: ${sanitizeHTML(provName)}`,
        `Distrito: ${sanitizeHTML(distName)}`,
        `Corregimiento: ${sanitizeHTML(corrName)}`,
        urbName ? `Barriada/Urbanización: ${sanitizeHTML(urbName)}` : '',
        `Tipo de vivienda: ${tipoViviendaLabel}`,
        `Detalle: ${sanitizeHTML(direccionDetalle)}`,
        '',
        '── MEDIDAS DE SEGURIDAD ──',
        ...seguridadMeta.map(s => `  • ${sanitizeHTML(s.label)}`),
        '',
        '── VALOR DEL BIEN (ESTRUCTURA) ──',
        `Valor: $${formatUSD(valorNum)}`,
        '',
        '══════════════════════════════════════',
        `Enviado desde: Cotizador Incendio Web`,
        `Fecha: ${new Date().toLocaleString('es-PA')}`,
        '══════════════════════════════════════',
      ].filter(Boolean);

      const subject = `Petición Incendio Web - ${data.nombre} ${data.apellido} - ${new Date().toLocaleDateString('es-PA')}`;

      const result = await createPetitionFromQuote({
        client_name: `${data.nombre} ${data.apellido}`.trim(),
        client_email: data.correo.trim(),
        client_phone: data.celular.trim(),
        ramo: 'incendio',
        source: 'COTIZADOR_INCENDIO_WIZARD',
        details: {
          channel: 'cotizadores_web',
          product: 'incendio',
          subject,
          from_name: `${data.nombre} ${data.apellido}`,
          from_email: data.correo,
          from_phone: data.celular,
          body_text: bodyLines.join('\n'),
          sla_target_hours: 24,
          priority: 'normal',
          // Structured metadata
          datos_cliente: {
            nombre: data.nombre,
            apellido: data.apellido,
            fecha_nacimiento: data.fechaNacimiento,
            edad,
            celular: data.celular,
            correo: data.correo,
          },
          direccion: {
            provincia: provName,
            distrito: distName,
            corregimiento: corrName,
            barriada: urbName,
            tipo_vivienda: data.tipoVivienda,
            ...(data.tipoVivienda === 'casa' ? {
              calle: data.calle,
              numero_casa: data.numeroCasa,
            } : {}),
            ...(data.tipoVivienda === 'apartamento' ? {
              nombre_edificio: data.nombreEdificio,
              piso: data.piso,
              numero_apto: data.numeroApto,
            } : {}),
          },
          security_measures: seguridadMeta,
          valor_bien_estructura: valorNum,
        },
      });

      // Save to session for confirmation page
      sessionStorage.setItem('incendioQuoteSubmission', JSON.stringify({
        nombre: `${data.nombre} ${data.apellido}`,
        correo: data.correo,
        valorBien: valorNum,
        tipoVivienda: tipoViviendaLabel,
        seguridadCount: data.seguridad.length,
        ticket: result.ticket || null,
      }));

      router.push('/cotizadores/incendio/confirmacion');
    } catch (err: any) {
      console.error('[IncendioWizard] Submit error:', err);
      setErrors({ submit: 'Ocurrió un error al enviar. Intenta nuevamente.' });
    } finally {
      setSubmitting(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SHARED UI COMPONENTS
  // ═══════════════════════════════════════════════════════════════

  const InputField = ({ name, ...props }: any) => (
    <WizardInputField name={name} data={data} errors={errors} onUpdate={update} {...props} />
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
      </div>
    );
  }

  function renderStep2() {
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

        {/* Barriada */}
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

        {/* Tipo de vivienda */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tipo de vivienda <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => update({ tipoVivienda: 'casa', piso: '', numeroApto: '', nombreEdificio: '' })}
              className={`py-4 rounded-xl font-semibold text-sm border-2 transition-all flex flex-col items-center gap-1 ${
                data.tipoVivienda === 'casa'
                  ? 'bg-[#010139] text-white border-[#010139] shadow-lg'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#8AAA19]'
              }`}
            >
              <span className="text-2xl">🏠</span>
              Casa
            </button>
            <button
              type="button"
              onClick={() => update({ tipoVivienda: 'apartamento', calle: '', numeroCasa: '' })}
              className={`py-4 rounded-xl font-semibold text-sm border-2 transition-all flex flex-col items-center gap-1 ${
                data.tipoVivienda === 'apartamento'
                  ? 'bg-[#010139] text-white border-[#010139] shadow-lg'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#8AAA19]'
              }`}
            >
              <span className="text-2xl">🏢</span>
              Apartamento
            </button>
          </div>
          {errors.tipoVivienda && <p className="text-red-500 text-xs mt-1 font-medium">{errors.tipoVivienda}</p>}
        </div>

        {/* Casa fields */}
        {data.tipoVivienda === 'casa' && (
          <div className="animate-fadeIn space-y-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <InputField label="Calle" name="calle" placeholder="Calle principal" />
            <InputField label="Número de casa" name="numeroCasa" placeholder="123" />
          </div>
        )}

        {/* Apartamento fields */}
        {data.tipoVivienda === 'apartamento' && (
          <div className="animate-fadeIn space-y-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <InputField label="Nombre del edificio" name="nombreEdificio" placeholder="Torre del Sol" />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Piso" name="piso" placeholder="15" />
              <InputField label="N° de apartamento" name="numeroApto" placeholder="15A" />
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep3() {
    const toggleSecurity = (key: string) => {
      setData(prev => ({
        ...prev,
        seguridad: prev.seguridad.includes(key)
          ? prev.seguridad.filter(s => s !== key)
          : [...prev.seguridad, key],
      }));
    };

    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Selecciona las medidas de seguridad con las que cuenta la propiedad <strong className="text-[#010139]">(mínimo 1)</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SECURITY_MEASURES.map((m) => {
            const selected = data.seguridad.includes(m.key);
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleSecurity(m.key)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? 'border-[#8AAA19] bg-[#8AAA19]/5 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  selected ? 'bg-[#8AAA19] border-[#8AAA19]' : 'border-gray-300 bg-white'
                }`}>
                  {selected && <FaCheck size={10} className="text-white" />}
                </div>
                <span className="text-base flex-shrink-0">{m.icon}</span>
                <span className={`text-xs font-semibold leading-tight ${selected ? 'text-[#010139]' : 'text-gray-700'}`}>{m.label}</span>
              </button>
            );
          })}
        </div>

        {errors.seguridad && <p className="text-red-500 text-xs mt-1 font-medium">{errors.seguridad}</p>}

        {data.seguridad.length > 0 && (
          <div className="flex items-center gap-2 text-sm font-semibold text-[#8AAA19]">
            <FaCheck size={12} />
            {data.seguridad.length} medida{data.seguridad.length !== 1 ? 's' : ''} seleccionada{data.seguridad.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-br from-[#010139]/5 to-[#8AAA19]/5 rounded-xl p-4 sm:p-5 border-2 border-[#8AAA19]/20">
          <div className="flex items-start gap-2 mb-4">
            <h4 className="text-sm font-bold text-[#010139]">Valor del bien — Estructura (USD)</h4>
            <div className="group relative">
              <FaInfoCircle className="text-[#8AAA19] text-sm cursor-help" />
              <div className="hidden group-hover:block absolute z-10 left-0 top-6 w-72 bg-white p-3 rounded-lg shadow-xl border text-xs text-gray-600 leading-relaxed">
                Este valor es el de la estructura (casa o apartamento) a asegurar. Los bancos suelen dar este monto. Si no lo tienes, puedes estimarlo como ~70% del valor de compra de la propiedad. Es una estimación: lo ideal es reconfirmarlo para evitar infraseguro o supraseguro.
              </div>
            </div>
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
            <input
              type="number"
              inputMode="numeric"
              value={data.valorBien}
              onChange={(e) => update({ valorBien: e.target.value })}
              placeholder="Valor de la estructura"
              min="10000"
              step="5000"
              onWheel={(e) => e.currentTarget.blur()}
              className={`w-full pl-10 pr-4 py-4 border-2 rounded-xl text-lg font-bold focus:outline-none transition-colors appearance-none ${
                errors.valorBien ? 'border-red-400 bg-red-50' : 'border-[#8AAA19]/40 bg-white focus:border-[#8AAA19]'
              }`}
            />
          </div>
          {errors.valorBien && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.valorBien}</p>}
          {!errors.valorBien && (
            <p className="text-xs text-gray-500 mt-1.5">
              Ingresa el valor de reposición de la estructura. Mínimo: $10,000
            </p>
          )}
        </div>

        {/* Helpful note */}
        <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4 text-left">
          <div className="flex items-start gap-3">
            <FaInfoCircle className="text-blue-500 mt-0.5 text-base flex-shrink-0" />
            <div className="text-xs text-blue-700 leading-relaxed">
              <p className="font-semibold text-blue-900 mb-1">¿No conoces el valor exacto?</p>
              <p>Como referencia, puedes estimar ~70% del valor de compra de la propiedad. Si la propiedad se compró en $200,000, el valor de la estructura sería aproximadamente $140,000. Un ajustador podrá reconfirmarlo si es necesario.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderStep5() {
    const provName = provincias.find(p => String(p.DATO) === data.provincia)?.TEXTO || data.provincia;
    const distName = distritos.find(d => String(d.DATO) === data.distrito)?.TEXTO || data.distrito;
    const corrName = corregimientos.find(c => String(c.DATO) === data.corregimiento)?.TEXTO || data.corregimiento;
    const urbName = urbanizaciones.find(u => String(u.DATO) === data.barriada)?.TEXTO || data.barriada;
    const seguridadLabels = data.seguridad.map(key => SECURITY_MEASURES.find(o => o.key === key)?.label || key);
    const valorNum = parseFloat(data.valorBien) || 0;

    const tipoViviendaLabel = data.tipoVivienda === 'casa' ? 'Casa' : 'Apartamento';
    let direccionDetalle = '';
    if (data.tipoVivienda === 'casa') {
      direccionDetalle = `Calle ${data.calle}, N° ${data.numeroCasa}`;
    } else if (data.tipoVivienda === 'apartamento') {
      direccionDetalle = `${data.nombreEdificio}, Piso ${data.piso}, Apto ${data.numeroApto}`;
    }

    return (
      <div className="space-y-5">
        {/* Resumen */}
        <div className="bg-gray-50 rounded-xl border-2 border-gray-200 overflow-hidden">
          <div className="bg-[#010139] px-4 py-3">
            <h4 className="text-white font-bold text-sm">Resumen de tu solicitud</h4>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <SummarySection title="Datos del cliente" onEdit={() => goToStep(1)} items={[
              { label: 'Nombre', value: `${data.nombre} ${data.apellido}` },
              { label: 'Nacimiento', value: `${data.fechaNacimiento} (${edad} años)` },
              { label: 'Celular', value: data.celular },
              { label: 'Correo', value: data.correo },
            ]} />
            <SummarySection title="Dirección" onEdit={() => goToStep(2)} items={[
              { label: 'Ubicación', value: [provName, distName, corrName].filter(Boolean).join(', ') },
              urbName ? { label: 'Barriada', value: urbName } : null,
              { label: 'Tipo', value: tipoViviendaLabel },
              { label: 'Detalle', value: direccionDetalle },
            ].filter(Boolean) as any} />
            <SummarySection title="Medidas de seguridad" onEdit={() => goToStep(3)} items={
              seguridadLabels.map(s => ({ label: '•', value: s }))
            } />
            <SummarySection title="Valor del bien" onEdit={() => goToStep(4)} items={[
              { label: 'Estructura', value: `$${formatUSD(valorNum)}` },
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
    'Datos del cliente',
    'Dirección residencial',
    'Medidas de seguridad',
    'Valor del bien',
    'Resumen y enviar',
  ];

  const stepIcons = ['👤', '🏠', '🔒', '💰', '📋'];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10" ref={formRef}>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-1">
          Cotiza tu Seguro de Incendio
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
