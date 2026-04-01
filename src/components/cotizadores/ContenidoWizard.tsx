'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft, FaArrowRight, FaCheck, FaSpinner, FaInfoCircle, FaChevronDown, FaChevronUp, FaPlus, FaTrash, FaExclamationTriangle, FaUser, FaHome, FaLock, FaDollarSign, FaClipboardCheck } from 'react-icons/fa';
import { createPetitionFromQuote } from '@/lib/operaciones/createPetitionFromQuote';
import { trackQuoteCreated } from '@/lib/adm-cot/track-quote';
import { SECURITY_MEASURES } from '@/lib/constants/securityMeasures';
import EmissionProgressBar from '@/components/cotizadores/EmissionProgressBar';
import EmissionBreadcrumb, { type BreadcrumbStepDef } from '@/components/cotizadores/EmissionBreadcrumb';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface HighValueItem {
  descripcion: string;
  valor: string;
}

interface ContenidoFormData {
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
  barriadaOtro: string;
  tipoVivienda: 'casa' | 'apartamento' | '';
  calle: string;
  numeroCasa: string;
  piso: string;
  numeroApto: string;
  nombreEdificio: string;
  // Step 3 — Sistemas de seguridad
  seguridad: string[];
  // Step 4 — Valor del contenido + artículos alto valor
  valorContenido: string;
  tieneArticulosAltoValor: boolean | null;
  articulosAltoValor: HighValueItem[];
  // Step 5 — Confirmación
  confirmaInformacion: boolean;
}

interface AddressCatalogItem {
  DATO: number;
  TEXTO: string;
}


const TOTAL_STEPS = 5;

const INITIAL_DATA: ContenidoFormData = {
  nombre: '',
  apellido: '',
  fechaNacimiento: '',
  celular: '',
  correo: '',
  provincia: '',
  distrito: '',
  corregimiento: '',
  barriada: '',
  barriadaOtro: '',
  tipoVivienda: '',
  calle: '',
  numeroCasa: '',
  piso: '',
  numeroApto: '',
  nombreEdificio: '',
  seguridad: [],
  valorContenido: '',
  tieneArticulosAltoValor: null,
  articulosAltoValor: [],
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

/** Strip commas/formatting and parse to number */
function parseCurrency(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

/** On blur: format raw to "10,000.00" */
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

export default function ContenidoWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<ContenidoFormData>(INITIAL_DATA);
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

  function update(partial: Partial<ContenidoFormData>) {
    setData(prev => ({ ...prev, ...partial }));
  }

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  // ═══════════════════════════════════════════════════════════════
  // ARTICULOS ALTO VALOR HELPERS
  // ═══════════════════════════════════════════════════════════════

  function addArticulo() {
    setData(prev => ({
      ...prev,
      articulosAltoValor: [...prev.articulosAltoValor, { descripcion: '', valor: '' }],
    }));
  }

  function updateArticulo(index: number, field: keyof HighValueItem, value: string) {
    setData(prev => {
      const items = [...prev.articulosAltoValor];
      const existing = items[index];
      if (!existing) return prev;
      items[index] = { ...existing, [field]: value };
      return { ...prev, articulosAltoValor: items };
    });
  }

  function removeArticulo(index: number) {
    setData(prev => ({
      ...prev,
      articulosAltoValor: prev.articulosAltoValor.filter((_, i) => i !== index),
    }));
  }

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
      const val = parseCurrency(data.valorContenido);
      if (val <= 0) e.valorContenido = 'Ingresa el valor del contenido';
      else if (val < 5000) e.valorContenido = 'Valor mínimo: $5,000';

      if (data.tieneArticulosAltoValor === null) e.tieneArticulosAltoValor = 'Selecciona una opción';

      if (data.tieneArticulosAltoValor) {
        if (data.articulosAltoValor.length === 0) {
          e.articulos = 'Agrega al menos un artículo de alto valor';
        } else {
          for (let i = 0; i < data.articulosAltoValor.length; i++) {
            const item = data.articulosAltoValor[i]!;
            if (!item.descripcion.trim()) { e[`art_desc_${i}`] = 'Descripción requerida'; }
            const itemVal = parseCurrency(item.valor);
            if (itemVal < 2000) { e[`art_val_${i}`] = 'Valor debe ser mayor a $2,000'; }
          }
          // Soft validation: sum of articles > total content value
          const sumaArticulos = data.articulosAltoValor.reduce((acc, item) => acc + parseCurrency(item.valor), 0);
          if (val > 0 && sumaArticulos > val) {
            e.articulos_suma = 'La suma de artículos de alto valor supera el valor total del contenido. Ajusta los valores.';
          }
        }
      }
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
    if (step === 2) {
      if (data.tipoVivienda === 'casa') update({ piso: '', numeroApto: '', nombreEdificio: '' });
      if (data.tipoVivienda === 'apartamento') update({ calle: '', numeroCasa: '' });
    }
    if (step === 4) {
      if (!data.tieneArticulosAltoValor) update({ articulosAltoValor: [] });
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
      const urbName = data.barriada === 'OTRO' ? data.barriadaOtro : (urbanizaciones.find(u => String(u.DATO) === data.barriada)?.TEXTO || data.barriada);
      const valorNum = parseCurrency(data.valorContenido);
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
        'SOLICITUD DE COTIZACIÓN - SEGURO DE CONTENIDO/HOGAR',
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
        '── VALOR DEL CONTENIDO ──',
        `Valor estimado: $${formatUSD(valorNum)}`,
      ];

      if (data.tieneArticulosAltoValor && data.articulosAltoValor.length > 0) {
        bodyLines.push('');
        bodyLines.push('── ARTÍCULOS DE ALTO VALOR ──');
        data.articulosAltoValor.forEach((item, i) => {
          bodyLines.push(`  ${i + 1}. ${sanitizeHTML(item.descripcion)} — $${formatUSD(parseCurrency(item.valor))}`);
        });
        const sumaArt = data.articulosAltoValor.reduce((acc, item) => acc + (parseCurrency(item.valor)), 0);
        bodyLines.push(`  Total artículos alto valor: $${formatUSD(sumaArt)}`);
      }

      bodyLines.push('');
      bodyLines.push('══════════════════════════════════════');
      bodyLines.push(`Enviado desde: Cotizador Contenido/Hogar Web`);
      bodyLines.push(`Fecha: ${new Date().toLocaleString('es-PA')}`);
      bodyLines.push('══════════════════════════════════════');

      const subject = `Petición Contenido/Hogar Web - ${data.nombre} ${data.apellido} - ${new Date().toLocaleDateString('es-PA')}`;

      const articulosMeta = data.tieneArticulosAltoValor
        ? data.articulosAltoValor.map(a => ({ descripcion: a.descripcion, valor: parseCurrency(a.valor) }))
        : [];

      const result = await createPetitionFromQuote({
        client_name: `${data.nombre} ${data.apellido}`.trim(),
        client_email: data.correo.trim(),
        client_phone: data.celular.trim(),
        ramo: 'hogar',
        source: 'COTIZADOR_CONTENIDO_WIZARD',
        details: {
          channel: 'cotizadores_web',
          product: 'contenido_hogar',
          subject,
          from_name: `${data.nombre} ${data.apellido}`,
          from_email: data.correo,
          from_phone: data.celular,
          body_text: bodyLines.filter(Boolean).join('\n'),
          sla_target_hours: 24,
          priority: 'normal',
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
            ...(data.tipoVivienda === 'casa' ? { calle: data.calle, numero_casa: data.numeroCasa } : {}),
            ...(data.tipoVivienda === 'apartamento' ? { nombre_edificio: data.nombreEdificio, piso: data.piso, numero_apto: data.numeroApto } : {}),
          },
          security_measures: seguridadMeta,
          valor_contenido: valorNum,
          tiene_articulos_alto_valor: !!data.tieneArticulosAltoValor,
          articulos_alto_valor: articulosMeta,
        },
      });

      // Track in ADM COT cotizaciones log
      trackQuoteCreated({
        quoteRef: `CONTENIDO-${result.ticket || Date.now()}`,
        insurer: 'INTERNACIONAL',
        clientName: `${data.nombre} ${data.apellido}`.trim(),
        email: data.correo.trim(),
        phone: data.celular.trim(),
        ramo: 'CONTENIDO',
        coverageType: tipoViviendaLabel,
        planName: 'Seguro de Contenido/Hogar',
        annualPremium: undefined,
      });

      sessionStorage.setItem('contenidoQuoteSubmission', JSON.stringify({
        nombre: `${data.nombre} ${data.apellido}`,
        correo: data.correo,
        valorContenido: valorNum,
        tipoVivienda: tipoViviendaLabel,
        seguridadCount: data.seguridad.length,
        articulosCount: articulosMeta.length,
        ticket: result.ticket || null,
      }));

      router.push('/cotizadores/contenido/confirmacion');
    } catch (err: any) {
      console.error('[ContenidoWizard] Submit error:', err);
      setErrors({ submit: 'Ocurrió un error al enviar. Intenta nuevamente.' });
    } finally {
      setSubmitting(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SHARED UI
  // ═══════════════════════════════════════════════════════════════

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
          {edad > 0 && <p className="text-sm text-[#8AAA19] font-semibold mt-1">Edad: {edad} años</p>}
          {errors.fechaNacimiento && <p className="text-red-500 text-xs mt-1 font-medium">{errors.fechaNacimiento}</p>}
        </div>
        <WizardInputField label="Celular" name="celular" type="tel" inputMode="tel" placeholder="+507 6000-0000" hint="Formato: +507 y número local" data={data} errors={errors} onUpdate={update} />
        <WizardInputField label="Correo electrónico" name="correo" type="email" inputMode="email" placeholder="correo@ejemplo.com" data={data} errors={errors} onUpdate={update} />
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-4">
        {/* Provincia */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Provincia <span className="text-red-500">*</span></label>
          <select
            value={data.provincia}
            onChange={(e) => { update({ provincia: e.target.value }); fetchDistritos(parseInt(e.target.value) || 0); }}
            className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none bg-white transition-colors ${errors.provincia ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#8AAA19]'}`}
            disabled={loadingAddr === 'provincias'}
          >
            <option value="">{loadingAddr === 'provincias' ? 'Cargando...' : 'Seleccionar provincia'}</option>
            {provincias.map(p => <option key={p.DATO} value={p.DATO}>{p.TEXTO}</option>)}
          </select>
          {errors.provincia && <p className="text-red-500 text-xs mt-1 font-medium">{errors.provincia}</p>}
        </div>

        {/* Distrito */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Distrito <span className="text-red-500">*</span></label>
          <select
            value={data.distrito}
            onChange={(e) => { update({ distrito: e.target.value }); if (data.provincia) fetchCorregimientos(parseInt(data.provincia), parseInt(e.target.value) || 0); }}
            className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none bg-white transition-colors ${errors.distrito ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#8AAA19]'}`}
            disabled={!data.provincia || loadingAddr === 'distritos'}
          >
            <option value="">{loadingAddr === 'distritos' ? 'Cargando...' : 'Seleccionar distrito'}</option>
            {distritos.map(d => <option key={d.DATO} value={d.DATO}>{d.TEXTO}</option>)}
          </select>
          {errors.distrito && <p className="text-red-500 text-xs mt-1 font-medium">{errors.distrito}</p>}
        </div>

        {/* Corregimiento */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Corregimiento <span className="text-red-500">*</span></label>
          <select
            value={data.corregimiento}
            onChange={(e) => update({ corregimiento: e.target.value })}
            className={`w-full px-4 py-3 border-2 rounded-xl text-base focus:outline-none bg-white transition-colors ${errors.corregimiento ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#8AAA19]'}`}
            disabled={!data.distrito || loadingAddr === 'corregimientos'}
          >
            <option value="">{loadingAddr === 'corregimientos' ? 'Cargando...' : 'Seleccionar corregimiento'}</option>
            {corregimientos.map(c => <option key={c.DATO} value={c.DATO}>{c.TEXTO}</option>)}
          </select>
          {errors.corregimiento && <p className="text-red-500 text-xs mt-1 font-medium">{errors.corregimiento}</p>}
        </div>

        {/* Barriada */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Barriada / Urbanización</label>
          <select
            value={data.barriada}
            onChange={(e) => update({ barriada: e.target.value, barriadaOtro: e.target.value === 'OTRO' ? data.barriadaOtro : '' })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none bg-white focus:border-[#8AAA19] transition-colors"
          >
            <option value="">Seleccionar (opcional)</option>
            {urbanizaciones.map(u => <option key={u.DATO} value={u.DATO}>{u.TEXTO}</option>)}
            <option value="OTRO">Otro (especificar)</option>
          </select>
          {data.barriada === 'OTRO' && (
            <input
              type="text"
              value={data.barriadaOtro}
              onChange={(e) => update({ barriadaOtro: e.target.value })}
              placeholder="Nombre de la urbanización o barriada"
              className="w-full mt-2 px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none bg-white focus:border-[#8AAA19] transition-colors"
            />
          )}
        </div>

        {/* Tipo vivienda */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de vivienda <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => update({ tipoVivienda: 'casa', piso: '', numeroApto: '', nombreEdificio: '' })}
              className={`py-4 rounded-xl font-semibold text-sm border-2 transition-all flex flex-col items-center gap-1 ${data.tipoVivienda === 'casa' ? 'bg-[#010139] text-white border-[#010139] shadow-lg' : 'bg-white text-gray-600 border-gray-200 hover:border-[#8AAA19]'}`}>
              <span className="text-2xl">🏠</span>Casa
            </button>
            <button type="button" onClick={() => update({ tipoVivienda: 'apartamento', calle: '', numeroCasa: '' })}
              className={`py-4 rounded-xl font-semibold text-sm border-2 transition-all flex flex-col items-center gap-1 ${data.tipoVivienda === 'apartamento' ? 'bg-[#010139] text-white border-[#010139] shadow-lg' : 'bg-white text-gray-600 border-gray-200 hover:border-[#8AAA19]'}`}>
              <span className="text-2xl">🏢</span>Apartamento
            </button>
          </div>
          {errors.tipoVivienda && <p className="text-red-500 text-xs mt-1 font-medium">{errors.tipoVivienda}</p>}
        </div>

        {data.tipoVivienda === 'casa' && (
          <div className="animate-fadeIn space-y-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <WizardInputField label="Calle" name="calle" placeholder="Calle principal" data={data} errors={errors} onUpdate={update} />
            <WizardInputField label="Número de casa" name="numeroCasa" placeholder="123" data={data} errors={errors} onUpdate={update} />
          </div>
        )}

        {data.tipoVivienda === 'apartamento' && (
          <div className="animate-fadeIn space-y-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <WizardInputField label="Nombre del edificio" name="nombreEdificio" placeholder="Torre del Sol" data={data} errors={errors} onUpdate={update} />
            <div className="grid grid-cols-2 gap-3">
              <WizardInputField label="Piso" name="piso" placeholder="15" data={data} errors={errors} onUpdate={update} />
              <WizardInputField label="N° de apartamento" name="numeroApto" placeholder="15A" data={data} errors={errors} onUpdate={update} />
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
        seguridad: prev.seguridad.includes(key) ? prev.seguridad.filter(s => s !== key) : [...prev.seguridad, key],
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
              <button key={m.key} type="button" onClick={() => toggleSecurity(m.key)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${selected ? 'border-[#8AAA19] bg-[#8AAA19]/5 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-[#8AAA19] border-[#8AAA19]' : 'border-gray-300 bg-white'}`}>
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
            <FaCheck size={12} /> {data.seguridad.length} medida{data.seguridad.length !== 1 ? 's' : ''} seleccionada{data.seguridad.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  }

  function renderStep4() {
    const valorNum = parseCurrency(data.valorContenido);
    const sumaArticulos = data.articulosAltoValor.reduce((acc, item) => acc + parseCurrency(item.valor), 0);

    return (
      <div className="space-y-5">
        {/* Valor del contenido */}
        <div className="bg-gradient-to-br from-[#010139]/5 to-[#8AAA19]/5 rounded-xl p-4 sm:p-5 border-2 border-[#8AAA19]/20">
          <div className="flex items-start gap-2 mb-4">
            <h4 className="text-sm font-bold text-[#010139]">Valor del contenido (USD)</h4>
            <div className="group relative">
              <FaInfoCircle className="text-[#8AAA19] text-sm cursor-help" />
              <div className="hidden group-hover:block absolute z-10 left-0 top-6 w-72 bg-white p-3 rounded-lg shadow-xl border text-xs text-gray-600 leading-relaxed">
                Este valor es un estimado del contenido dentro del hogar: mobiliario, línea blanca, TV, computadoras, joyería, arte, etc. No tiene que ser exacto; la idea es aproximar el valor total a proteger.
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-4 border-2 rounded-xl transition-colors ${errors.valorContenido ? 'border-red-400 bg-red-50' : 'border-[#8AAA19]/40 bg-white focus-within:border-[#8AAA19]'}`}>
            <span className="flex-shrink-0 text-gray-500 font-bold text-xl sm:text-2xl select-none">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={data.valorContenido}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                const parts = raw.split('.');
                const cleaned = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw;
                update({ valorContenido: cleaned });
              }}
              onBlur={() => { const fmt = formatCurrencyBlur(data.valorContenido); if (fmt) update({ valorContenido: fmt }); }}
              onFocus={(e) => {
                const raw = data.valorContenido.replace(/,/g, '');
                update({ valorContenido: raw });
                setTimeout(() => e.target.select(), 0);
              }}
              placeholder="0.00"
              onWheel={(e) => e.currentTarget.blur()}
              className="flex-1 min-w-0 p-0 border-0 bg-transparent text-2xl sm:text-3xl font-bold focus:outline-none focus:ring-0 appearance-none"
            />
          </div>
          {errors.valorContenido && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.valorContenido}</p>}
          {!errors.valorContenido && <p className="text-xs text-gray-500 mt-1.5">Incluye muebles, electrodomésticos, equipos electrónicos, ropa, etc. Mínimo: $5,000</p>}
          {/* ── Estimado de prima ── */}
          {(() => {
            const v = parseCurrency(data.valorContenido);
            if (!v) return null;
            const prima = v * 0.005; // 0.5%
            return (
              <div className="mt-3 flex items-center gap-2 bg-[#8AAA19]/8 border border-[#8AAA19]/25 rounded-lg px-3 py-2">
                <span className="text-lg">🏡</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[#010139]/60 uppercase tracking-wide leading-none mb-0.5">Costo aproximado</p>
                  <p className="text-sm font-bold text-[#010139]">
                    ${prima.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs font-normal text-gray-500 ml-1">/ año</span>
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">0.50% de la suma</span>
              </div>
            );
          })()}
        </div>

        {/* Artículos de alto valor */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            ¿Tiene artículos de valor (joyería, arte u otros) cuyo valor individual supere $2,000? <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => {
              update({ tieneArticulosAltoValor: true });
              if (data.articulosAltoValor.length === 0) addArticulo();
            }}
              className={`py-3 rounded-xl font-semibold text-sm border-2 transition-all ${data.tieneArticulosAltoValor === true ? 'bg-[#010139] text-white border-[#010139] shadow-lg' : 'bg-white text-gray-600 border-gray-200 hover:border-[#8AAA19]'}`}>
              Sí
            </button>
            <button type="button" onClick={() => update({ tieneArticulosAltoValor: false, articulosAltoValor: [] })}
              className={`py-3 rounded-xl font-semibold text-sm border-2 transition-all ${data.tieneArticulosAltoValor === false ? 'bg-[#010139] text-white border-[#010139] shadow-lg' : 'bg-white text-gray-600 border-gray-200 hover:border-[#8AAA19]'}`}>
              No
            </button>
          </div>
          {errors.tieneArticulosAltoValor && <p className="text-red-500 text-xs mt-1 font-medium">{errors.tieneArticulosAltoValor}</p>}
        </div>

        {/* Repeater */}
        {data.tieneArticulosAltoValor && (
          <div className="animate-fadeIn space-y-4">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <FaInfoCircle className="inline mr-1" />
              Estos montos deben estar contemplados dentro de la suma asegurada total (Valor del contenido).
            </div>

            {data.articulosAltoValor.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#010139] uppercase">Artículo {i + 1}</span>
                  {data.articulosAltoValor.length > 1 && (
                    <button type="button" onClick={() => removeArticulo(i)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                      <FaTrash size={12} />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={(e) => updateArticulo(i, 'descripcion', e.target.value)}
                    placeholder="Ej: Reloj Rolex Submariner"
                    className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm focus:outline-none transition-colors ${errors[`art_desc_${i}`] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white focus:border-[#8AAA19]'}`}
                  />
                  {errors[`art_desc_${i}`] && <p className="text-red-500 text-[11px] mt-0.5">{errors[`art_desc_${i}`]}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Valor (USD) <span className="text-red-500">*</span></label>
                  <div className={`flex items-center gap-1.5 px-3 py-2.5 border-2 rounded-lg transition-colors ${errors[`art_val_${i}`] ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white focus-within:border-[#8AAA19]'}`}>
                    <span className="flex-shrink-0 text-gray-400 font-semibold text-sm select-none">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.valor}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = raw.split('.');
                        const cleaned = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw;
                        updateArticulo(i, 'valor', cleaned);
                      }}
                      onBlur={() => { const fmt = formatCurrencyBlur(item.valor); if (fmt) updateArticulo(i, 'valor', fmt); }}
                      onFocus={(e) => {
                        const raw = item.valor.replace(/,/g, '');
                        updateArticulo(i, 'valor', raw);
                        setTimeout(() => e.target.select(), 0);
                      }}
                      placeholder="0.00"
                      onWheel={(e) => e.currentTarget.blur()}
                      className="flex-1 min-w-0 p-0 border-0 bg-transparent text-base font-semibold focus:outline-none focus:ring-0 appearance-none"
                    />
                  </div>
                  {errors[`art_val_${i}`] && <p className="text-red-500 text-[11px] mt-0.5">{errors[`art_val_${i}`]}</p>}
                </div>
              </div>
            ))}

            <button type="button" onClick={addArticulo}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#8AAA19]/40 text-sm font-semibold text-[#8AAA19] hover:bg-[#8AAA19]/5 transition-colors">
              <FaPlus size={10} /> Agregar otro artículo
            </button>

            {errors.articulos && <p className="text-red-500 text-xs font-medium">{errors.articulos}</p>}

            {/* Sum warning */}
            {errors.articulos_suma && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-2">
                <FaExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0" size={14} />
                <p className="text-xs text-red-700 font-medium">{errors.articulos_suma}</p>
              </div>
            )}

            {/* Running total */}
            {data.articulosAltoValor.length > 0 && !errors.articulos_suma && (
              <div className="text-xs text-gray-500 text-right">
                Total artículos: <strong className="text-[#010139]">${formatUSD(sumaArticulos)}</strong>
                {valorNum > 0 && <span> de ${formatUSD(valorNum)}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderStep5() {
    const provName = provincias.find(p => String(p.DATO) === data.provincia)?.TEXTO || data.provincia;
    const distName = distritos.find(d => String(d.DATO) === data.distrito)?.TEXTO || data.distrito;
    const corrName = corregimientos.find(c => String(c.DATO) === data.corregimiento)?.TEXTO || data.corregimiento;
    const urbName = data.barriada === 'OTRO' ? data.barriadaOtro : (urbanizaciones.find(u => String(u.DATO) === data.barriada)?.TEXTO || data.barriada);
    const seguridadLabels = data.seguridad.map(key => SECURITY_MEASURES.find(o => o.key === key)?.label || key);
    const valorNum = parseCurrency(data.valorContenido);

    const tipoViviendaLabel = data.tipoVivienda === 'casa' ? 'Casa' : 'Apartamento';
    let direccionDetalle = '';
    if (data.tipoVivienda === 'casa') direccionDetalle = `Calle ${data.calle}, N° ${data.numeroCasa}`;
    else if (data.tipoVivienda === 'apartamento') direccionDetalle = `${data.nombreEdificio}, Piso ${data.piso}, Apto ${data.numeroApto}`;

    const artItems: { label: string; value: string }[] = [];
    if (data.tieneArticulosAltoValor && data.articulosAltoValor.length > 0) {
      data.articulosAltoValor.forEach((a, i) => {
        artItems.push({ label: `${i + 1}. ${a.descripcion}`, value: `$${formatUSD(parseCurrency(a.valor))}` });
      });
    }

    return (
      <div className="space-y-5">
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
            <SummarySection title="Valor del contenido" onEdit={() => goToStep(4)} items={[
              { label: 'Contenido', value: `$${formatUSD(valorNum)}` },
              { label: 'Artículos alto valor', value: data.tieneArticulosAltoValor ? `${data.articulosAltoValor.length} artículo(s)` : 'No' },
            ]} />
            {artItems.length > 0 && (
              <SummarySection title="Detalle artículos" onEdit={() => goToStep(4)} items={artItems} />
            )}
          </div>
        </div>

        <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${data.confirmaInformacion ? 'border-[#8AAA19] bg-[#8AAA19]/5' : 'border-gray-200 bg-white'}`}>
          <input type="checkbox" checked={data.confirmaInformacion} onChange={(e) => update({ confirmaInformacion: e.target.checked })}
            className="mt-0.5 w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]" />
          <span className="text-sm font-medium text-gray-700">Confirmo que la información proporcionada es correcta.</span>
        </label>
        {errors.confirmaInformacion && <p className="text-red-500 text-xs mt-1 font-medium">{errors.confirmaInformacion}</p>}
        {errors.submit && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">{errors.submit}</div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  const CONTENIDO_STEPS: BreadcrumbStepDef[] = [
    { key: 'payment' as any,       label: 'Datos del cliente',       shortLabel: 'Cliente',    icon: FaUser },
    { key: 'emission-data' as any, label: 'Dirección residencial',   shortLabel: 'Dirección',  icon: FaHome },
    { key: 'vehicle' as any,       label: 'Medidas de seguridad',    shortLabel: 'Seguridad',  icon: FaLock },
    { key: 'inspection' as any,    label: 'Valor del contenido',     shortLabel: 'Valor',      icon: FaDollarSign },
    { key: 'payment-info' as any,  label: 'Resumen y enviar',        shortLabel: 'Resumen',    icon: FaClipboardCheck },
  ];

  const stepKeyByNumber = (n: number) => CONTENIDO_STEPS[n - 1]?.key ?? 'payment';
  const completedStepKeys = CONTENIDO_STEPS.slice(0, step - 1).map(s => s.key);
  const stepTitles = CONTENIDO_STEPS.map(s => s.label);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100" ref={formRef}>
      {/* Progress Bar */}
      <div className="pt-6">
        <EmissionProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Breadcrumb */}
      <EmissionBreadcrumb
        currentStep={stepKeyByNumber(step) as any}
        completedSteps={completedStepKeys as any}
        steps={CONTENIDO_STEPS as any}
        onStepClick={(key: any) => {
          const idx = CONTENIDO_STEPS.findIndex(s => s.key === key);
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
            <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-1">Cotiza tu Seguro de Contenido/Hogar</h1>
            <p className="text-sm text-gray-500">Completa el formulario y recibirás tu cotización por correo en 24 horas.</p>
          </div>

          {/* Step Card */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-5 sm:p-7 mb-6">
            <div className="flex items-center gap-2 mb-5">
              {(() => { const Icon = CONTENIDO_STEPS[step - 1]?.icon; return Icon ? <Icon className="text-xl text-[#8AAA19]" /> : null; })()}
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
                {submitting ? (<><FaSpinner className="animate-spin" size={18} /> Enviando...</>) : (<><FaCheck size={16} /> Enviar solicitud</>)}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY SECTION
// ═══════════════════════════════════════════════════════════════════

function SummarySection({ title, items, onEdit }: { title: string; items: { label: string; value: string }[]; onEdit: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-1">
        <span className="text-xs font-bold text-[#010139] uppercase tracking-wide">{title}</span>
        <div className="flex items-center gap-2">
          <span onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-[10px] text-[#8AAA19] font-semibold hover:underline cursor-pointer">Editar</span>
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
