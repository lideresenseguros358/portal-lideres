'use client';

import { useRef } from 'react';
import { FaPlus, FaTrash, FaCreditCard, FaFileUpload, FaCheckCircle } from 'react-icons/fa';

// ═══════════════════════════════════════════════════════════════
// TYPES — exported so each wizard can import them
// ═══════════════════════════════════════════════════════════════

export interface BeneficiarioData {
  nombre: string;
  apellido: string;
  cedula: string;
  fechaNacimiento: string;
  parentesco: string;
  porcentaje: string;
}

export interface AdminData {
  esExistente: boolean;
  beneficiarioIdx: number | null;
  nombre: string;
  apellido: string;
  cedula: string;
  fechaNacimiento: string;
}

export interface FileAttachment {
  base64: string;
  name: string;
  mimeType: string;
}

export interface BrokerStepData {
  // Forma de pago
  formaPago: 'ach' | 'tcr' | 'descuento_salario' | '';
  archivoACH: FileAttachment | null;
  tcrNumero: string;
  tcrBanco: string;
  tcrTipo: 'visa' | 'mastercard' | '';
  tcrCodigo: string;
  archivoDescuento: FileAttachment | null;
  // Beneficiarios principales (vida only)
  beneficiarios: BeneficiarioData[];
  adminBeneficiario: AdminData | null;
  // Contingentes (vida only)
  contingentes: BeneficiarioData[];
  adminContingente: AdminData | null;
  // Documentos adjuntos
  archivoCedula: FileAttachment | null;
  archivoCotizacion: FileAttachment | null;
  archivoPago: FileAttachment | null;
}

const EMPTY_BENEFICIARIO: BeneficiarioData = {
  nombre: '', apellido: '', cedula: '', fechaNacimiento: '', parentesco: '', porcentaje: '',
};

export const BROKER_INITIAL: BrokerStepData = {
  formaPago: '',
  archivoACH: null,
  tcrNumero: '',
  tcrBanco: '',
  tcrTipo: '',
  tcrCodigo: '',
  archivoDescuento: null,
  beneficiarios: [{ ...EMPTY_BENEFICIARIO }],
  adminBeneficiario: null,
  contingentes: [],
  adminContingente: null,
  archivoCedula: null,
  archivoCotizacion: null,
  archivoPago: null,
};

// ═══════════════════════════════════════════════════════════════
// VALIDATION — exported so each wizard can run it on submit
// ═══════════════════════════════════════════════════════════════

function calcEdad(fecha: string): number {
  if (!fecha) return -1;
  const hoy = new Date();
  const nac = new Date(fecha);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

export function validateBrokerStep(
  data: BrokerStepData,
  producto: 'vida' | 'incendio' | 'contenido',
): Record<string, string> {
  const e: Record<string, string> = {};

  // Forma de pago
  if (!data.formaPago) e.formaPago = 'Selecciona una forma de pago';
  if (data.formaPago === 'ach' && !data.archivoACH) e.archivoACH = 'Adjunta el archivo ACH';
  if (data.formaPago === 'descuento_salario' && !data.archivoDescuento) e.archivoDescuento = 'Adjunta el archivo de descuento de salario';
  if (data.formaPago === 'tcr') {
    if (!data.tcrNumero.trim()) e.tcrNumero = 'Número de tarjeta es obligatorio';
    if (!data.tcrBanco.trim()) e.tcrBanco = 'Nombre del banco es obligatorio';
    if (!data.tcrTipo) e.tcrTipo = 'Selecciona el tipo de tarjeta';
    if (!data.tcrCodigo.trim()) e.tcrCodigo = 'Código de seguridad es obligatorio';
  }

  // Beneficiarios (vida only)
  if (producto === 'vida') {
    if (data.beneficiarios.length === 0) {
      e.beneficiarios = 'Agrega al menos un beneficiario principal';
    } else {
      let totalPct = 0;
      data.beneficiarios.forEach((b, i) => {
        if (!b.nombre.trim()) e[`ben_${i}_nombre`] = 'Nombre obligatorio';
        if (!b.apellido.trim()) e[`ben_${i}_apellido`] = 'Apellido obligatorio';
        if (!b.cedula.trim()) e[`ben_${i}_cedula`] = 'Cédula obligatoria';
        if (!b.fechaNacimiento) e[`ben_${i}_fechaNacimiento`] = 'Fecha de nacimiento obligatoria';
        if (!b.parentesco.trim()) e[`ben_${i}_parentesco`] = 'Parentesco obligatorio';
        const pct = parseFloat(b.porcentaje);
        if (isNaN(pct) || pct <= 0) e[`ben_${i}_porcentaje`] = 'Porcentaje debe ser mayor a 0';
        else totalPct += pct;
      });
      if (totalPct > 100) e.benTotal = `La suma de porcentajes (${totalPct.toFixed(1)}%) supera el 100%`;

      // Admin for minors
      const hayMenoresBen = data.beneficiarios.some(b => { const a = calcEdad(b.fechaNacimiento); return a >= 0 && a < 18; });
      if (hayMenoresBen) {
        if (!data.adminBeneficiario) {
          e.adminBeneficiario = 'Designa un administrador para los beneficiarios menores de edad';
        } else if (!data.adminBeneficiario.esExistente) {
          if (!data.adminBeneficiario.nombre.trim()) e.adminBen_nombre = 'Nombre del administrador obligatorio';
          if (!data.adminBeneficiario.apellido.trim()) e.adminBen_apellido = 'Apellido del administrador obligatorio';
          if (!data.adminBeneficiario.cedula.trim()) e.adminBen_cedula = 'Cédula del administrador obligatoria';
          if (!data.adminBeneficiario.fechaNacimiento) e.adminBen_fecha = 'Fecha de nacimiento del administrador obligatoria';
          else if (calcEdad(data.adminBeneficiario.fechaNacimiento) < 18) e.adminBen_fecha = 'El administrador debe ser mayor de edad';
        }
      }
    }

    // Contingentes (optional but if any, validate them)
    if (data.contingentes.length > 0) {
      let totalCont = 0;
      data.contingentes.forEach((c, i) => {
        if (!c.nombre.trim()) e[`cont_${i}_nombre`] = 'Nombre obligatorio';
        if (!c.apellido.trim()) e[`cont_${i}_apellido`] = 'Apellido obligatorio';
        if (!c.cedula.trim()) e[`cont_${i}_cedula`] = 'Cédula obligatoria';
        if (!c.fechaNacimiento) e[`cont_${i}_fechaNacimiento`] = 'Fecha de nacimiento obligatoria';
        if (!c.parentesco.trim()) e[`cont_${i}_parentesco`] = 'Parentesco obligatorio';
        const pct = parseFloat(c.porcentaje);
        if (isNaN(pct) || pct <= 0) e[`cont_${i}_porcentaje`] = 'Porcentaje debe ser mayor a 0';
        else totalCont += pct;
      });
      if (totalCont > 100) e.contTotal = `La suma de porcentajes de contingentes (${totalCont.toFixed(1)}%) supera el 100%`;

      const hayMenoresCont = data.contingentes.some(c => { const a = calcEdad(c.fechaNacimiento); return a >= 0 && a < 18; });
      if (hayMenoresCont) {
        if (!data.adminContingente) {
          e.adminContingente = 'Designa un administrador para los contingentes menores de edad';
        } else if (!data.adminContingente.esExistente) {
          if (!data.adminContingente.nombre.trim()) e.adminCont_nombre = 'Nombre del administrador obligatorio';
          if (!data.adminContingente.apellido.trim()) e.adminCont_apellido = 'Apellido del administrador obligatorio';
          if (!data.adminContingente.cedula.trim()) e.adminCont_cedula = 'Cédula del administrador obligatoria';
          if (!data.adminContingente.fechaNacimiento) e.adminCont_fecha = 'Fecha de nacimiento del administrador obligatoria';
          else if (calcEdad(data.adminContingente.fechaNacimiento) < 18) e.adminCont_fecha = 'El administrador debe ser mayor de edad';
        }
      }
    }
  }

  // Documentos adjuntos (todos requieren cédula y cotización)
  if (!data.archivoCedula) e.archivoCedula = 'Debes adjuntar la cédula del asegurado';
  if (!data.archivoCotizacion) e.archivoCotizacion = 'Debes adjuntar la cotización';

  return e;
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve({ base64, name: file.name, mimeType: file.type || 'application/octet-stream' });
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function FileUploadField({
  label, hint, value, onChange, error, required = false,
}: {
  label: string; hint?: string; value: FileAttachment | null;
  onChange: (f: FileAttachment | null) => void; error?: string; required?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { onChange(await fileToAttachment(file)); } catch { /* ignore */ }
    e.target.value = '';
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-1 text-xs font-normal text-gray-400">({hint})</span>}
      </label>
      <div
        onClick={() => ref.current?.click()}
        className={`flex items-center gap-3 px-4 py-3 border-2 rounded-xl cursor-pointer transition-all
          ${value ? 'border-[#8AAA19] bg-green-50' : 'border-dashed border-gray-300 hover:border-[#8AAA19] bg-gray-50'}`}
      >
        {value
          ? <><FaCheckCircle className="text-[#8AAA19] flex-shrink-0" size={16} />
              <span className="text-sm text-gray-700 truncate flex-1">{value.name}</span>
              <button type="button" onClick={(ev) => { ev.stopPropagation(); onChange(null); }}
                className="text-xs text-red-500 hover:underline flex-shrink-0">Quitar</button></>
          : <><FaFileUpload className="text-gray-400 flex-shrink-0" size={16} />
              <span className="text-sm text-gray-400">Subir archivo (foto o PDF)</span></>
        }
      </div>
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
      {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
    </div>
  );
}

function BeneficiariosTable({
  list, prefix, adultosExistentes, admin, hayMenores,
  onAdd, onRemove, onUpdate, onAdminChange, errors,
  label, emptyLabel,
}: {
  list: BeneficiarioData[]; prefix: string; adultosExistentes: { idx: number; nombre: string }[];
  admin: AdminData | null; hayMenores: boolean;
  onAdd: () => void; onRemove: (i: number) => void;
  onUpdate: (i: number, partial: Partial<BeneficiarioData>) => void;
  onAdminChange: (a: AdminData | null) => void;
  errors: Record<string, string>; label: string; emptyLabel: string;
}) {
  const total = list.reduce((s, b) => s + (parseFloat(b.porcentaje) || 0), 0);
  const totalClamped = Math.min(total, 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#010139]">{label}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-colors"
        >
          <FaPlus size={10} /> Agregar
        </button>
      </div>

      {/* Progress bar */}
      {list.length > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Porcentaje asignado</span>
            <span className={total > 100 ? 'text-red-600 font-bold' : 'font-semibold'}>
              {total.toFixed(1)}% / 100%
            </span>
          </div>
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${total > 100 ? 'bg-red-500' : total === 100 ? 'bg-[#8AAA19]' : 'bg-[#010139]'}`}
              style={{ width: `${totalClamped}%` }}
            />
          </div>
          {errors[`${prefix}Total`] && (
            <p className="text-red-500 text-xs mt-1 font-medium">{errors[`${prefix}Total`]}</p>
          )}
        </div>
      )}

      {list.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">{emptyLabel}</p>
      )}
      {errors[prefix === 'ben' ? 'beneficiarios' : 'contingentes_none'] && (
        <p className="text-red-500 text-xs font-medium">{errors[prefix === 'ben' ? 'beneficiarios' : 'contingentes_none']}</p>
      )}

      {list.map((b, i) => {
        const edad = calcEdad(b.fechaNacimiento);
        const esMenor = edad >= 0 && edad < 18;
        return (
          <div key={i} className={`rounded-xl border-2 p-4 space-y-3 ${esMenor ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                Beneficiario #{i + 1} {esMenor ? '⚠️ Menor de edad' : ''}
              </span>
              {list.length > 1 && (
                <button type="button" onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600 transition-colors">
                  <FaTrash size={12} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre <span className="text-red-500">*</span></label>
                <input
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[`${prefix}_${i}_nombre`] ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={b.nombre} onChange={e => onUpdate(i, { nombre: e.target.value })} placeholder="Nombre"
                />
                {errors[`${prefix}_${i}_nombre`] && <p className="text-red-500 text-xs mt-0.5">{errors[`${prefix}_${i}_nombre`]}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Apellido <span className="text-red-500">*</span></label>
                <input
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[`${prefix}_${i}_apellido`] ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={b.apellido} onChange={e => onUpdate(i, { apellido: e.target.value })} placeholder="Apellido"
                />
                {errors[`${prefix}_${i}_apellido`] && <p className="text-red-500 text-xs mt-0.5">{errors[`${prefix}_${i}_apellido`]}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cédula <span className="text-red-500">*</span></label>
                <input
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[`${prefix}_${i}_cedula`] ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={b.cedula} onChange={e => onUpdate(i, { cedula: e.target.value })} placeholder="0-000-0000"
                />
                {errors[`${prefix}_${i}_cedula`] && <p className="text-red-500 text-xs mt-0.5">{errors[`${prefix}_${i}_cedula`]}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de nacimiento <span className="text-red-500">*</span></label>
                <input
                  type="date" max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[`${prefix}_${i}_fechaNacimiento`] ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={b.fechaNacimiento} onChange={e => onUpdate(i, { fechaNacimiento: e.target.value })}
                />
                {errors[`${prefix}_${i}_fechaNacimiento`] && <p className="text-red-500 text-xs mt-0.5">{errors[`${prefix}_${i}_fechaNacimiento`]}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Parentesco <span className="text-red-500">*</span></label>
                <input
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[`${prefix}_${i}_parentesco`] ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={b.parentesco} onChange={e => onUpdate(i, { parentesco: e.target.value })} placeholder="Ej: Cónyuge, Hijo/a"
                />
                {errors[`${prefix}_${i}_parentesco`] && <p className="text-red-500 text-xs mt-0.5">{errors[`${prefix}_${i}_parentesco`]}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Porcentaje (%) <span className="text-red-500">*</span></label>
                <input
                  type="number" min="1" max="100" step="1"
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[`${prefix}_${i}_porcentaje`] ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={b.porcentaje} onChange={e => onUpdate(i, { porcentaje: e.target.value })} placeholder="0"
                />
                {errors[`${prefix}_${i}_porcentaje`] && <p className="text-red-500 text-xs mt-0.5">{errors[`${prefix}_${i}_porcentaje`]}</p>}
              </div>
            </div>
          </div>
        );
      })}

      {/* Admin section — only shown if there are minors */}
      {hayMenores && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-amber-800">⚠️ Administrador de menores de edad</span>
          </div>
          <p className="text-xs text-amber-700">
            Uno o más beneficiarios son menores de edad. Designa un administrador mayor de edad.
          </p>

          {/* Toggle: existing beneficiary or new person */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAdminChange({ esExistente: true, beneficiarioIdx: adultosExistentes[0]?.idx ?? null, nombre: '', apellido: '', cedula: '', fechaNacimiento: '' })}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${admin?.esExistente === true ? 'bg-amber-600 text-white border-amber-600' : 'border-amber-300 text-amber-700 bg-white'}`}
            >
              Es uno de los beneficiarios
            </button>
            <button
              type="button"
              onClick={() => onAdminChange({ esExistente: false, beneficiarioIdx: null, nombre: '', apellido: '', cedula: '', fechaNacimiento: '' })}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${admin?.esExistente === false ? 'bg-amber-600 text-white border-amber-600' : 'border-amber-300 text-amber-700 bg-white'}`}
            >
              Nueva persona
            </button>
          </div>

          {admin?.esExistente === true && (
            <div>
              <label className="block text-xs font-semibold text-amber-800 mb-1">Selecciona el beneficiario adulto <span className="text-red-500">*</span></label>
              {adultosExistentes.length === 0 ? (
                <p className="text-xs text-red-600">No hay beneficiarios mayores de edad que puedan ser administradores. Ingresa una nueva persona.</p>
              ) : (
                <select
                  value={admin.beneficiarioIdx ?? ''}
                  onChange={e => onAdminChange({ ...admin, beneficiarioIdx: e.target.value !== '' ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-amber-300 focus:outline-none focus:border-amber-600 bg-white"
                >
                  <option value="">Seleccionar…</option>
                  {adultosExistentes.map(a => (
                    <option key={a.idx} value={a.idx}>#{a.idx + 1} — {a.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {admin?.esExistente === false && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'nombre', label: 'Nombre', errKey: prefix === 'ben' ? 'adminBen_nombre' : 'adminCont_nombre' },
                { key: 'apellido', label: 'Apellido', errKey: prefix === 'ben' ? 'adminBen_apellido' : 'adminCont_apellido' },
                { key: 'cedula', label: 'Cédula', errKey: prefix === 'ben' ? 'adminBen_cedula' : 'adminCont_cedula' },
              ].map(({ key, label: lbl, errKey }) => (
                <div key={key} className={key === 'cedula' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-amber-800 mb-1">{lbl} <span className="text-red-500">*</span></label>
                  <input
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[errKey] ? 'border-red-400' : 'border-amber-300'} focus:outline-none focus:border-amber-600 bg-white`}
                    value={(admin as any)[key] || ''}
                    onChange={e => onAdminChange({ ...admin!, [key]: e.target.value })}
                  />
                  {errors[errKey] && <p className="text-red-500 text-xs mt-0.5">{errors[errKey]}</p>}
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-amber-800 mb-1">Fecha de nacimiento <span className="text-red-500">*</span></label>
                <input
                  type="date" max={new Date(Date.now() - 18 * 365.25 * 24 * 3600000).toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[prefix === 'ben' ? 'adminBen_fecha' : 'adminCont_fecha'] ? 'border-red-400' : 'border-amber-300'} focus:outline-none focus:border-amber-600 bg-white`}
                  value={admin.fechaNacimiento || ''}
                  onChange={e => onAdminChange({ ...admin!, fechaNacimiento: e.target.value })}
                />
                {errors[prefix === 'ben' ? 'adminBen_fecha' : 'adminCont_fecha'] && (
                  <p className="text-red-500 text-xs mt-0.5">{errors[prefix === 'ben' ? 'adminBen_fecha' : 'adminCont_fecha']}</p>
                )}
              </div>
            </div>
          )}

          {errors[prefix === 'ben' ? 'adminBeneficiario' : 'adminContingente'] && !admin && (
            <p className="text-red-500 text-xs font-medium">{errors[prefix === 'ben' ? 'adminBeneficiario' : 'adminContingente']}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

interface BrokerExtraStepProps {
  producto: 'vida' | 'incendio' | 'contenido';
  clientName: string;
  data: BrokerStepData;
  onChange: (partial: Partial<BrokerStepData>) => void;
  errors: Record<string, string>;
}

const PAYMENT_OPTIONS = [
  { value: 'ach',               label: 'ACH',                    desc: 'Transferencia bancaria automática' },
  { value: 'tcr',               label: 'Tarjeta de crédito (TCR)', desc: 'Visa o Mastercard' },
  { value: 'descuento_salario', label: 'Descuento de salario',    desc: 'Descuento directo de nómina' },
] as const;

export default function BrokerExtraStep({ producto, clientName, data, onChange, errors }: BrokerExtraStepProps) {

  // ── helpers para beneficiarios ───────────────────────────────────────────────

  function updBen(i: number, partial: Partial<BeneficiarioData>) {
    const next = [...data.beneficiarios];
    next[i] = { ...next[i], ...partial } as BeneficiarioData;
    // Recalculate admin minors
    const hayMenores = next.some(b => { const a = calcEdad(b.fechaNacimiento); return a >= 0 && a < 18; });
    onChange({ beneficiarios: next, adminBeneficiario: hayMenores ? (data.adminBeneficiario ?? null) : null });
  }

  function addBen() {
    onChange({ beneficiarios: [...data.beneficiarios, { ...EMPTY_BENEFICIARIO }] });
  }

  function removeBen(i: number) {
    const next = data.beneficiarios.filter((_, idx) => idx !== i);
    onChange({ beneficiarios: next });
  }

  function updCont(i: number, partial: Partial<BeneficiarioData>) {
    const next = [...data.contingentes];
    next[i] = { ...next[i], ...partial } as BeneficiarioData;
    const hayMenores = next.some(c => { const a = calcEdad(c.fechaNacimiento); return a >= 0 && a < 18; });
    onChange({ contingentes: next, adminContingente: hayMenores ? (data.adminContingente ?? null) : null });
  }

  function addCont() {
    onChange({ contingentes: [...data.contingentes, { ...EMPTY_BENEFICIARIO }] });
  }

  function removeCont(i: number) {
    const next = data.contingentes.filter((_, idx) => idx !== i);
    onChange({ contingentes: next });
  }

  // Beneficiarios adultos disponibles como admin
  const adultosEnBen = data.beneficiarios
    .map((b, idx) => ({ idx, nombre: `${b.nombre} ${b.apellido}`.trim(), edad: calcEdad(b.fechaNacimiento) }))
    .filter(x => x.edad >= 18 && x.nombre.trim());

  const adultosEnCont = data.contingentes
    .map((c, idx) => ({ idx, nombre: `${c.nombre} ${c.apellido}`.trim(), edad: calcEdad(c.fechaNacimiento) }))
    .filter(x => x.edad >= 18 && x.nombre.trim());

  const hayMenoresBen = data.beneficiarios.some(b => { const a = calcEdad(b.fechaNacimiento); return a >= 0 && a < 18; });
  const hayMenoresCont = data.contingentes.some(c => { const a = calcEdad(c.fechaNacimiento); return a >= 0 && a < 18; });

  return (
    <div className="space-y-8">

      {/* ── FORMA DE PAGO ────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Forma de pago <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {PAYMENT_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all
                ${data.formaPago === opt.value
                  ? 'border-[#010139] bg-[#010139]/5'
                  : 'border-gray-200 hover:border-gray-300 bg-white'}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center
                ${data.formaPago === opt.value ? 'border-[#010139]' : 'border-gray-400'}`}>
                {data.formaPago === opt.value && <div className="w-2 h-2 rounded-full bg-[#010139]" />}
              </div>
              <input
                type="radio" className="sr-only" value={opt.value}
                checked={data.formaPago === opt.value}
                onChange={() => onChange({ formaPago: opt.value as any })}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {errors.formaPago && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.formaPago}</p>}

        {/* ACH upload */}
        {data.formaPago === 'ach' && (
          <div className="mt-4 pl-4 border-l-2 border-[#010139]/20">
            <FileUploadField
              label="Archivo ACH" hint="foto o PDF" required
              value={data.archivoACH}
              onChange={f => onChange({ archivoACH: f })}
              error={errors.archivoACH}
            />
          </div>
        )}

        {/* TCR inputs */}
        {data.formaPago === 'tcr' && (
          <div className="mt-4 pl-4 border-l-2 border-[#010139]/20 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <FaCreditCard className="text-[#010139]" size={14} />
              <span className="text-xs font-bold text-[#010139] uppercase tracking-wide">Datos de la tarjeta</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Número de tarjeta <span className="text-red-500">*</span></label>
              <input
                className={`w-full px-3 py-2 text-sm rounded-lg border ${errors.tcrNumero ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                value={data.tcrNumero}
                onChange={e => onChange({ tcrNumero: e.target.value.replace(/\D/g, '').slice(0, 19) })}
                placeholder="XXXX XXXX XXXX XXXX" maxLength={19}
              />
              {errors.tcrNumero && <p className="text-red-500 text-xs mt-0.5">{errors.tcrNumero}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del titular</label>
              <input
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                value={clientName} readOnly disabled
              />
              <p className="text-xs text-gray-400 mt-0.5">El titular debe coincidir con el asegurado</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del banco <span className="text-red-500">*</span></label>
              <input
                className={`w-full px-3 py-2 text-sm rounded-lg border ${errors.tcrBanco ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                value={data.tcrBanco} onChange={e => onChange({ tcrBanco: e.target.value })} placeholder="Ej: Banco General"
              />
              {errors.tcrBanco && <p className="text-red-500 text-xs mt-0.5">{errors.tcrBanco}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de tarjeta <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {(['visa', 'mastercard'] as const).map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => onChange({ tcrTipo: tipo })}
                    className={`py-2.5 rounded-xl font-semibold text-sm border-2 transition-all capitalize
                      ${data.tcrTipo === tipo ? 'bg-[#010139] text-white border-[#010139] shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-[#010139]'}`}
                  >
                    {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                  </button>
                ))}
              </div>
              {errors.tcrTipo && <p className="text-red-500 text-xs mt-0.5">{errors.tcrTipo}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Código de seguridad <span className="text-red-500">*</span></label>
              <input
                className={`w-32 px-3 py-2 text-sm rounded-lg border ${errors.tcrCodigo ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                value={data.tcrCodigo}
                onChange={e => onChange({ tcrCodigo: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                placeholder="CVV" maxLength={4} type="password"
              />
              {errors.tcrCodigo && <p className="text-red-500 text-xs mt-0.5">{errors.tcrCodigo}</p>}
            </div>
          </div>
        )}

        {/* Descuento de salario upload */}
        {data.formaPago === 'descuento_salario' && (
          <div className="mt-4 pl-4 border-l-2 border-[#010139]/20">
            <FileUploadField
              label="Archivo de descuento de salario" hint="foto o PDF" required
              value={data.archivoDescuento}
              onChange={f => onChange({ archivoDescuento: f })}
              error={errors.archivoDescuento}
            />
          </div>
        )}
      </div>

      {/* ── BENEFICIARIOS PRINCIPALES (vida only) ────────────────────────── */}
      {producto === 'vida' && (
        <div className="pt-2 border-t border-gray-200">
          <BeneficiariosTable
            list={data.beneficiarios}
            prefix="ben"
            adultosExistentes={adultosEnBen}
            admin={data.adminBeneficiario}
            hayMenores={hayMenoresBen}
            onAdd={addBen}
            onRemove={removeBen}
            onUpdate={updBen}
            onAdminChange={a => onChange({ adminBeneficiario: a })}
            errors={errors}
            label="Beneficiarios principales"
            emptyLabel="Sin beneficiarios"
          />
        </div>
      )}

      {/* ── BENEFICIARIOS CONTINGENTES (vida only) ───────────────────────── */}
      {producto === 'vida' && (
        <div className="pt-2 border-t border-gray-200">
          <BeneficiariosTable
            list={data.contingentes}
            prefix="cont"
            adultosExistentes={adultosEnCont}
            admin={data.adminContingente}
            hayMenores={hayMenoresCont}
            onAdd={addCont}
            onRemove={removeCont}
            onUpdate={updCont}
            onAdminChange={a => onChange({ adminContingente: a })}
            errors={errors}
            label="Beneficiarios contingentes"
            emptyLabel="Sin beneficiarios contingentes (opcional)"
          />
        </div>
      )}

      {/* ── DOCUMENTOS ADJUNTOS ──────────────────────────────────────────── */}
      <div className="pt-2 border-t border-gray-200 space-y-4">
        <h3 className="text-sm font-bold text-[#010139]">Documentos adjuntos</h3>
        <FileUploadField
          label="Cédula del asegurado" required
          value={data.archivoCedula}
          onChange={f => onChange({ archivoCedula: f })}
          error={errors.archivoCedula}
        />
        <FileUploadField
          label="Cotización"  required
          value={data.archivoCotizacion}
          onChange={f => onChange({ archivoCotizacion: f })}
          error={errors.archivoCotizacion}
        />
        <FileUploadField
          label="Comprobante de pago" hint="opcional"
          value={data.archivoPago}
          onChange={f => onChange({ archivoPago: f })}
          error={errors.archivoPago}
        />
      </div>

    </div>
  );
}
