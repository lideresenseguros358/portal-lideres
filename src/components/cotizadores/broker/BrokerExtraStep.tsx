'use client';

import { useState, useRef } from 'react';
import { FaPlus, FaTrash, FaCreditCard, FaFileUpload, FaCheckCircle, FaTimes, FaPencilAlt } from 'react-icons/fa';

// ═══════════════════════════════════════════════════════════════
// TYPES
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
  formaPago: 'ach' | 'tcr' | 'descuento_salario' | '';
  archivoACH: FileAttachment | null;
  tcrNumero: string;
  tcrBanco: string;
  tcrTipo: 'visa' | 'mastercard' | '';
  tcrVencimiento: string;
  tcrCodigo: string;
  archivoDescuento: FileAttachment | null;
  beneficiarios: BeneficiarioData[];
  adminBeneficiario: AdminData | null;
  contingentes: BeneficiarioData[];
  adminContingente: AdminData | null;
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
  tcrVencimiento: '',
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
// VALIDATION
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

  if (!data.formaPago) e.formaPago = 'Selecciona una forma de pago';
  if (data.formaPago === 'ach' && !data.archivoACH) e.archivoACH = 'Adjunta el archivo ACH';
  if (data.formaPago === 'descuento_salario' && !data.archivoDescuento) e.archivoDescuento = 'Adjunta el archivo de descuento de salario';
  if (data.formaPago === 'tcr') {
    if (!data.tcrNumero.trim()) e.tcrNumero = 'Número de tarjeta es obligatorio';
    if (!data.tcrBanco.trim()) e.tcrBanco = 'Nombre del banco es obligatorio';
    if (!data.tcrTipo) e.tcrTipo = 'Selecciona el tipo de tarjeta';
    if (!data.tcrVencimiento.trim() || !/^\d{2}\/\d{2}$/.test(data.tcrVencimiento)) e.tcrVencimiento = 'Fecha de vencimiento inválida (MM/YY)';
    if (!data.tcrCodigo.trim()) e.tcrCodigo = 'Código de seguridad es obligatorio';
  }

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

  if (!data.archivoCedula) e.archivoCedula = 'Debes adjuntar la cédula del asegurado';
  if (!data.archivoCotizacion) e.archivoCotizacion = 'Debes adjuntar la cotización';

  return e;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
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

function formatDateDisplay(d: string): string {
  if (!d) return '--';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ═══════════════════════════════════════════════════════════════
// FILE UPLOAD FIELD
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// BENEFICIARIOS TABLE
// ═══════════════════════════════════════════════════════════════

function BeneficiariosTable({
  list, prefix, adultosExistentes, admin, hayMenores,
  onAdd, onRemove, onUpdate, onAdminChange, errors,
  label, emptyLabel, isOptional, onClose,
}: {
  list: BeneficiarioData[];
  prefix: string;
  adultosExistentes: { idx: number; nombre: string }[];
  admin: AdminData | null;
  hayMenores: boolean;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, partial: Partial<BeneficiarioData>) => void;
  onAdminChange: (a: AdminData | null) => void;
  errors: Record<string, string>;
  label: string;
  emptyLabel: string;
  isOptional?: boolean;
  onClose?: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [editingAdmin, setEditingAdmin] = useState(false);

  const total = list.reduce((s, b) => s + (parseFloat(b.porcentaje) || 0), 0);
  const totalClamped = Math.min(total, 100);

  function handleRemove(i: number) {
    setCollapsed(prev => {
      const next = new Set<number>();
      prev.forEach(idx => {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      });
      return next;
    });
    onRemove(i);
  }

  function handleAccept(i: number) {
    const b = list[i];
    if (!b) return;
    if (!b.nombre.trim() || !b.apellido.trim() || !b.cedula.trim() || !b.fechaNacimiento || !b.parentesco.trim() || !b.porcentaje.trim()) return;
    setCollapsed(prev => new Set([...prev, i]));
  }

  function handleEdit(i: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  }

  function getAdminInfo() {
    if (!admin) return null;
    if (admin.esExistente && admin.beneficiarioIdx !== null) {
      const b = list[admin.beneficiarioIdx];
      if (b) return { nombre: `${b.nombre} ${b.apellido}`.trim(), fecha: b.fechaNacimiento };
    }
    return { nombre: `${admin.nombre} ${admin.apellido}`.trim(), fecha: admin.fechaNacimiento };
  }

  const adminInfo = getAdminInfo();
  const hasItemErrors = (i: number) => Object.keys(errors).some(k => k.startsWith(`${prefix}_${i}_`));

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#010139]">
          {label}
          {isOptional && <span className="ml-2 text-xs font-normal text-gray-400">(opcional)</span>}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-colors"
          >
            <FaPlus size={10} /> Agregar
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
              <FaTimes size={14} />
            </button>
          )}
        </div>
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

      {/* Empty state */}
      {list.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-3">{emptyLabel}</p>
      )}
      {errors['beneficiarios'] && prefix === 'ben' && (
        <p className="text-red-500 text-xs font-medium">{errors.beneficiarios}</p>
      )}

      {/* Beneficiario rows */}
      {list.map((b, i) => {
        const isCollapsed = collapsed.has(i);
        const edad = calcEdad(b.fechaNacimiento);
        const esMenor = edad >= 0 && edad < 18;
        const rowHasErr = hasItemErrors(i);

        if (isCollapsed) {
          return (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 bg-white ${rowHasErr ? 'border-red-300' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {esMenor && <span className="flex-shrink-0 text-base" title="Menor de edad">⚠️</span>}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {`${b.nombre} ${b.apellido}`.trim() || `${prefix === 'ben' ? 'Beneficiario' : 'Contingente'} #${i + 1}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateDisplay(b.fechaNacimiento)} · {b.parentesco} · {b.porcentaje}%
                  </p>
                  {rowHasErr && (
                    <p className="text-xs text-red-500">Campos incompletos — toca el lápiz para corregir</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleEdit(i)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-3 transition-colors"
                title="Editar"
              >
                <FaPencilAlt size={13} />
              </button>
            </div>
          );
        }

        // Expanded form
        return (
          <div
            key={i}
            className={`rounded-xl border-2 p-4 space-y-3 ${esMenor ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                {prefix === 'ben' ? 'Beneficiario' : 'Contingente'} #{i + 1} {esMenor ? '⚠️ Menor' : ''}
              </span>
              {(list.length > 1 || prefix === 'cont') && (
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Parentesco <span className="text-red-500">*</span></label>
                <input
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors[`${prefix}_${i}_parentesco`] ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={b.parentesco} onChange={e => onUpdate(i, { parentesco: e.target.value })} placeholder="Ej: Cónyuge, Hijo/a"
                />
                {errors[`${prefix}_${i}_parentesco`] && <p className="text-red-500 text-xs mt-0.5">{errors[`${prefix}_${i}_parentesco`]}</p>}
              </div>
              {/* Fecha nacimiento — col-span-2 to avoid overflow on small screens */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de nacimiento <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  style={{ minWidth: 0, fontSize: '0.8125rem' }}
                  className={`w-full px-3 py-2 rounded-lg border ${errors[`${prefix}_${i}_fechaNacimiento`] ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={b.fechaNacimiento}
                  onChange={e => onUpdate(i, { fechaNacimiento: e.target.value })}
                />
                {errors[`${prefix}_${i}_fechaNacimiento`] && <p className="text-red-500 text-xs mt-0.5">{errors[`${prefix}_${i}_fechaNacimiento`]}</p>}
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

            {/* Aceptar */}
            <button
              type="button"
              onClick={() => handleAccept(i)}
              className="w-full py-2 text-sm font-semibold text-white bg-[#8AAA19] rounded-lg hover:bg-[#6d8814] transition-colors"
            >
              Aceptar
            </button>
          </div>
        );
      })}

      {/* Admin extra row — shows below beneficiarios when admin is confirmed */}
      {hayMenores && admin && !editingAdmin && adminInfo && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">Admin</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{adminInfo.nombre || 'Administrador'}</p>
              <p className="text-xs text-gray-500">{formatDateDisplay(adminInfo.fecha)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingAdmin(true)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-3 transition-colors"
            title="Editar administrador"
          >
            <FaPencilAlt size={13} />
          </button>
        </div>
      )}

      {/* Admin form — shown when there are minors and (no admin set OR editing) */}
      {hayMenores && (!admin || editingAdmin) && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
          <span className="text-sm font-bold text-amber-800">⚠️ Administrador de menores de edad</span>
          <p className="text-xs text-amber-700">
            Uno o más beneficiarios son menores de edad. Designa un administrador mayor de edad.
          </p>

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
                <p className="text-xs text-red-600">No hay beneficiarios mayores de edad. Ingresa una nueva persona.</p>
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
                { key: 'nombre',   label: 'Nombre',   errKey: prefix === 'ben' ? 'adminBen_nombre'   : 'adminCont_nombre' },
                { key: 'apellido', label: 'Apellido', errKey: prefix === 'ben' ? 'adminBen_apellido' : 'adminCont_apellido' },
                { key: 'cedula',   label: 'Cédula',   errKey: prefix === 'ben' ? 'adminBen_cedula'   : 'adminCont_cedula' },
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
                  type="date"
                  max={new Date(Date.now() - 18 * 365.25 * 24 * 3600000).toISOString().split('T')[0]}
                  style={{ minWidth: 0, fontSize: '0.8125rem' }}
                  className={`w-full px-3 py-2 rounded-lg border ${errors[prefix === 'ben' ? 'adminBen_fecha' : 'adminCont_fecha'] ? 'border-red-400' : 'border-amber-300'} focus:outline-none focus:border-amber-600 bg-white`}
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

          {/* Aceptar admin */}
          {admin && (
            <button
              type="button"
              onClick={() => setEditingAdmin(false)}
              className="w-full py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Aceptar
            </button>
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
  { value: 'ach',               label: 'ACH',                     desc: 'Transferencia bancaria automática' },
  { value: 'tcr',               label: 'Tarjeta de crédito (TCR)', desc: 'Visa o Mastercard' },
  { value: 'descuento_salario', label: 'Descuento de salario',     desc: 'Descuento directo de nómina' },
] as const;

export default function BrokerExtraStep({ producto, clientName, data, onChange, errors }: BrokerExtraStepProps) {
  const [showContingentes, setShowContingentes] = useState(data.contingentes.length > 0);

  // ── beneficiarios helpers ────────────────────────────────────────────────────

  function updBen(i: number, partial: Partial<BeneficiarioData>) {
    const next = [...data.beneficiarios];
    next[i] = { ...next[i], ...partial } as BeneficiarioData;
    const hayMenores = next.some(b => { const a = calcEdad(b.fechaNacimiento); return a >= 0 && a < 18; });
    onChange({ beneficiarios: next, adminBeneficiario: hayMenores ? (data.adminBeneficiario ?? null) : null });
  }
  function addBen() { onChange({ beneficiarios: [...data.beneficiarios, { ...EMPTY_BENEFICIARIO }] }); }
  function removeBen(i: number) { onChange({ beneficiarios: data.beneficiarios.filter((_, idx) => idx !== i) }); }

  // ── contingentes helpers ─────────────────────────────────────────────────────

  function updCont(i: number, partial: Partial<BeneficiarioData>) {
    const next = [...data.contingentes];
    next[i] = { ...next[i], ...partial } as BeneficiarioData;
    const hayMenores = next.some(c => { const a = calcEdad(c.fechaNacimiento); return a >= 0 && a < 18; });
    onChange({ contingentes: next, adminContingente: hayMenores ? (data.adminContingente ?? null) : null });
  }
  function addCont() { onChange({ contingentes: [...data.contingentes, { ...EMPTY_BENEFICIARIO }] }); }
  function removeCont(i: number) { onChange({ contingentes: data.contingentes.filter((_, idx) => idx !== i) }); }

  const adultosEnBen = data.beneficiarios
    .map((b, idx) => ({ idx, nombre: `${b.nombre} ${b.apellido}`.trim(), edad: calcEdad(b.fechaNacimiento) }))
    .filter(x => x.edad >= 18 && x.nombre.trim());

  const adultosEnCont = data.contingentes
    .map((c, idx) => ({ idx, nombre: `${c.nombre} ${c.apellido}`.trim(), edad: calcEdad(c.fechaNacimiento) }))
    .filter(x => x.edad >= 18 && x.nombre.trim());

  const hayMenoresBen  = data.beneficiarios.some(b => { const a = calcEdad(b.fechaNacimiento); return a >= 0 && a < 18; });
  const hayMenoresCont = data.contingentes.some(c => { const a = calcEdad(c.fechaNacimiento); return a >= 0 && a < 18; });

  // ── TCR vencimiento auto-format ──────────────────────────────────────────────

  function handleVencimiento(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    onChange({ tcrVencimiento: formatted });
  }

  return (
    <div className="space-y-8">

      {/* ── FORMA DE PAGO ─────────────────────────────────────────────────────── */}
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

        {/* ACH */}
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

        {/* TCR */}
        {data.formaPago === 'tcr' && (
          <div className="mt-4 pl-4 border-l-2 border-[#010139]/20 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <FaCreditCard className="text-[#010139]" size={14} />
              <span className="text-xs font-bold text-[#010139] uppercase tracking-wide">Datos de la tarjeta</span>
            </div>

            {/* Número */}
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

            {/* Titular (read-only) */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del titular</label>
              <input
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                value={clientName} readOnly disabled
              />
              <p className="text-xs text-gray-400 mt-0.5">El titular debe coincidir con el asegurado</p>
            </div>

            {/* Banco */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del banco <span className="text-red-500">*</span></label>
              <input
                className={`w-full px-3 py-2 text-sm rounded-lg border ${errors.tcrBanco ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                value={data.tcrBanco} onChange={e => onChange({ tcrBanco: e.target.value })} placeholder="Ej: Banco General"
              />
              {errors.tcrBanco && <p className="text-red-500 text-xs mt-0.5">{errors.tcrBanco}</p>}
            </div>

            {/* Tipo */}
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

            {/* Vencimiento + CVV en misma fila */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Vencimiento <span className="text-red-500">*</span></label>
                <input
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors.tcrVencimiento ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={data.tcrVencimiento}
                  onChange={e => handleVencimiento(e.target.value)}
                  placeholder="MM/YY" maxLength={5}
                  inputMode="numeric"
                />
                {errors.tcrVencimiento && <p className="text-red-500 text-xs mt-0.5">{errors.tcrVencimiento}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Código de seguridad <span className="text-red-500">*</span></label>
                <input
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${errors.tcrCodigo ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-[#010139]`}
                  value={data.tcrCodigo}
                  onChange={e => onChange({ tcrCodigo: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="CVV" maxLength={4} type="password"
                  inputMode="numeric"
                />
                {errors.tcrCodigo && <p className="text-red-500 text-xs mt-0.5">{errors.tcrCodigo}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Descuento salario */}
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

      {/* ── BENEFICIARIOS PRINCIPALES ─────────────────────────────────────────── */}
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

      {/* ── BENEFICIARIOS CONTINGENTES ────────────────────────────────────────── */}
      {producto === 'vida' && (
        <div className="pt-2 border-t border-gray-200">
          {showContingentes ? (
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
              emptyLabel="Sin beneficiarios contingentes"
              isOptional
              onClose={() => {
                onChange({ contingentes: [], adminContingente: null });
                setShowContingentes(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => { addCont(); setShowContingentes(true); }}
              className="flex items-center gap-2 text-sm text-[#010139] font-semibold hover:underline transition-colors"
            >
              <FaPlus size={11} /> Agregar beneficiarios contingentes <span className="font-normal text-gray-400">(opcional)</span>
            </button>
          )}
        </div>
      )}

      {/* ── DOCUMENTOS ADJUNTOS ──────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-gray-200 space-y-4">
        <h3 className="text-sm font-bold text-[#010139]">Documentos adjuntos</h3>
        <FileUploadField
          label="Cédula del asegurado" required
          value={data.archivoCedula}
          onChange={f => onChange({ archivoCedula: f })}
          error={errors.archivoCedula}
        />
        <FileUploadField
          label="Cotización" required
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
