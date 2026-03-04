'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaPencilAlt, FaSave, FaSpinner, FaUser, FaBriefcase, FaHome, FaHeartbeat, FaShieldAlt, FaLock, FaDollarSign, FaMapMarkerAlt, FaGem } from 'react-icons/fa';

// ════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════

interface PetQuoteDetailModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  ramo: string | null;
  clientName: string | null;
  onSaved?: () => void;
}

interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'boolean' | 'textarea';
  suffix?: string;
  prefix?: string;
  format?: (v: any) => string;
}

interface SectionDef {
  title: string;
  icon: React.ReactNode;
  path: string; // dot-path into details, e.g. "datos_personales"
  fields: FieldDef[];
}

// ════════════════════════════════════════════
// SECTION DEFINITIONS PER RAMO
// ════════════════════════════════════════════

const VIDA_SECTIONS: SectionDef[] = [
  {
    title: 'Datos Personales',
    icon: <FaUser />,
    path: 'datos_personales',
    fields: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'apellido', label: 'Apellido' },
      { key: 'fecha_nacimiento', label: 'Fecha de nacimiento' },
      { key: 'edad', label: 'Edad', suffix: ' años' },
      { key: 'celular', label: 'Celular' },
      { key: 'correo', label: 'Correo' },
      { key: 'nacionalidad', label: 'Nacionalidad' },
    ],
  },
  {
    title: 'Trabajo e Ingresos',
    icon: <FaBriefcase />,
    path: 'trabajo_ingresos',
    fields: [
      { key: 'ocupacion', label: 'Ocupación' },
      { key: 'lugar_trabajo', label: 'Lugar de trabajo' },
      { key: 'funciones', label: 'Funciones' },
      { key: 'salario_mensual', label: 'Salario mensual', prefix: '$', type: 'number' },
      { key: 'ingreso_anual', label: 'Ingreso anual', prefix: '$', type: 'number' },
    ],
  },
  {
    title: 'Dirección',
    icon: <FaMapMarkerAlt />,
    path: 'direccion',
    fields: [
      { key: 'provincia', label: 'Provincia' },
      { key: 'distrito', label: 'Distrito' },
      { key: 'corregimiento', label: 'Corregimiento' },
      { key: 'barriada', label: 'Barriada' },
      { key: 'referencias', label: 'Referencias' },
    ],
  },
  {
    title: 'Salud',
    icon: <FaHeartbeat />,
    path: 'salud',
    fields: [
      { key: 'altura_m', label: 'Altura', suffix: ' m', type: 'number' },
      { key: 'peso_lbs', label: 'Peso', suffix: ' lbs', type: 'number' },
      { key: 'tiene_enfermedad', label: '¿Tiene enfermedad?', type: 'boolean' },
      { key: 'descripcion_enfermedad', label: 'Descripción enfermedad' },
      { key: 'ha_fumado', label: '¿Ha fumado?', type: 'boolean' },
      { key: 'fuma_actualmente', label: '¿Fuma actualmente?', type: 'boolean' },
      { key: 'ultima_vez_fumo', label: 'Última vez que fumó' },
    ],
  },
  {
    title: 'Cobertura Actual',
    icon: <FaShieldAlt />,
    path: 'cobertura',
    fields: [
      { key: 'tiene_seguro_vida', label: '¿Tiene seguro de vida?', type: 'boolean' },
      { key: 'compania_actual', label: 'Compañía actual' },
      { key: 'suma_asegurada_actual', label: 'Suma asegurada actual', prefix: '$', type: 'number' },
      { key: 'es_hipoteca', label: '¿Es para hipoteca?', type: 'boolean' },
      { key: 'anios_hipoteca', label: 'Años de hipoteca', type: 'number' },
    ],
  },
  {
    title: 'Cálculo y Propuesta',
    icon: <FaDollarSign />,
    path: 'calculo',
    fields: [
      { key: 'suma_asegurada_solicitada', label: 'Suma asegurada solicitada', prefix: '$', type: 'number' },
      { key: 'maximo_calculado', label: 'Máximo calculado', prefix: '$', type: 'number' },
      { key: 'multiplicador', label: 'Multiplicador', prefix: 'x' },
      { key: 'minimo', label: 'Mínimo', prefix: '$', type: 'number' },
    ],
  },
];

const INCENDIO_SECTIONS: SectionDef[] = [
  {
    title: 'Datos del Cliente',
    icon: <FaUser />,
    path: 'datos_cliente',
    fields: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'apellido', label: 'Apellido' },
      { key: 'fecha_nacimiento', label: 'Fecha de nacimiento' },
      { key: 'edad', label: 'Edad', suffix: ' años' },
      { key: 'celular', label: 'Celular' },
      { key: 'correo', label: 'Correo' },
    ],
  },
  {
    title: 'Dirección',
    icon: <FaMapMarkerAlt />,
    path: 'direccion',
    fields: [
      { key: 'provincia', label: 'Provincia' },
      { key: 'distrito', label: 'Distrito' },
      { key: 'corregimiento', label: 'Corregimiento' },
      { key: 'barriada', label: 'Barriada' },
      { key: 'tipo_vivienda', label: 'Tipo de vivienda' },
      { key: 'calle', label: 'Calle' },
      { key: 'numero_casa', label: 'Número de casa' },
      { key: 'nombre_edificio', label: 'Nombre del edificio' },
      { key: 'piso', label: 'Piso' },
      { key: 'numero_apto', label: 'N° de apartamento' },
    ],
  },
  {
    title: 'Medidas de Seguridad',
    icon: <FaLock />,
    path: 'security_measures',
    fields: [], // Rendered specially (array)
  },
  {
    title: 'Valor del Bien',
    icon: <FaDollarSign />,
    path: '_root',
    fields: [
      { key: 'valor_bien_estructura', label: 'Valor de la estructura', prefix: '$', type: 'number' },
    ],
  },
];

const CONTENIDO_SECTIONS: SectionDef[] = [
  {
    title: 'Datos del Cliente',
    icon: <FaUser />,
    path: 'datos_cliente',
    fields: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'apellido', label: 'Apellido' },
      { key: 'fecha_nacimiento', label: 'Fecha de nacimiento' },
      { key: 'edad', label: 'Edad', suffix: ' años' },
      { key: 'celular', label: 'Celular' },
      { key: 'correo', label: 'Correo' },
    ],
  },
  {
    title: 'Dirección',
    icon: <FaMapMarkerAlt />,
    path: 'direccion',
    fields: [
      { key: 'provincia', label: 'Provincia' },
      { key: 'distrito', label: 'Distrito' },
      { key: 'corregimiento', label: 'Corregimiento' },
      { key: 'barriada', label: 'Barriada' },
      { key: 'tipo_vivienda', label: 'Tipo de vivienda' },
      { key: 'calle', label: 'Calle' },
      { key: 'numero_casa', label: 'Número de casa' },
      { key: 'nombre_edificio', label: 'Nombre del edificio' },
      { key: 'piso', label: 'Piso' },
      { key: 'numero_apto', label: 'N° de apartamento' },
    ],
  },
  {
    title: 'Medidas de Seguridad',
    icon: <FaLock />,
    path: 'security_measures',
    fields: [],
  },
  {
    title: 'Valor del Contenido',
    icon: <FaDollarSign />,
    path: '_root',
    fields: [
      { key: 'valor_contenido', label: 'Valor del contenido', prefix: '$', type: 'number' },
    ],
  },
  {
    title: 'Artículos de Alto Valor',
    icon: <FaGem />,
    path: '_articulos',
    fields: [],
  },
];

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

function getSections(ramo: string | null): SectionDef[] {
  const r = (ramo || '').toLowerCase();
  if (r === 'vida') return VIDA_SECTIONS;
  if (r === 'incendio') return INCENDIO_SECTIONS;
  if (r === 'hogar' || r === 'contenido') return CONTENIDO_SECTIONS;
  return [];
}

function getNestedValue(obj: any, path: string, key: string): any {
  if (path === '_root') return obj?.[key];
  const section = obj?.[path];
  return section?.[key];
}

function setNestedValue(obj: any, path: string, key: string, value: any): any {
  const copy = JSON.parse(JSON.stringify(obj || {}));
  if (path === '_root') {
    copy[key] = value;
  } else {
    if (!copy[path]) copy[path] = {};
    copy[path][key] = value;
  }
  return copy;
}

function formatValue(val: any, field: FieldDef): string {
  if (val === null || val === undefined || val === '') return '—';
  if (field.type === 'boolean') return val ? 'Sí' : 'No';
  if (field.type === 'number' && typeof val === 'number') {
    const formatted = val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${field.prefix || ''}${formatted}${field.suffix || ''}`;
  }
  return `${field.prefix || ''}${String(val)}${field.suffix || ''}`;
}

function formatUSD(val: number): string {
  return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ════════════════════════════════════════════
// SECTION RENDERER (VIEW MODE)
// ════════════════════════════════════════════

function SectionView({ section, details }: { section: SectionDef; details: any }) {
  // Special: security_measures (array of objects)
  if (section.path === 'security_measures') {
    const measures = details?.security_measures;
    if (!measures || (Array.isArray(measures) && measures.length === 0)) {
      return (
        <SectionWrapper title={section.title} icon={section.icon}>
          <p className="text-xs text-gray-400 italic">Sin medidas de seguridad registradas</p>
        </SectionWrapper>
      );
    }
    // Could be array of strings or objects
    const items = Array.isArray(measures) ? measures : Object.entries(measures).map(([k, v]) => ({ label: k, value: v }));
    return (
      <SectionWrapper title={section.title} icon={section.icon}>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item: any, i: number) => {
            const label = typeof item === 'string' ? item : (item.label || item.name || item.key || JSON.stringify(item));
            return (
              <span key={i} className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-[11px] font-medium rounded-md border border-green-100">
                ✓ {label}
              </span>
            );
          })}
        </div>
      </SectionWrapper>
    );
  }

  // Special: articulos de alto valor
  if (section.path === '_articulos') {
    const articulos = details?.articulos_alto_valor;
    const tiene = details?.tiene_articulos_alto_valor;
    if (!tiene || !articulos || articulos.length === 0) {
      return (
        <SectionWrapper title={section.title} icon={section.icon}>
          <p className="text-xs text-gray-400 italic">No tiene artículos de alto valor</p>
        </SectionWrapper>
      );
    }
    return (
      <SectionWrapper title={section.title} icon={section.icon}>
        <div className="space-y-1.5">
          {articulos.map((art: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-2.5 bg-gray-50 rounded-md">
              <span className="text-xs text-gray-700">{art.descripcion || '—'}</span>
              <span className="text-xs font-semibold text-[#010139]">${formatUSD(art.valor || 0)}</span>
            </div>
          ))}
        </div>
      </SectionWrapper>
    );
  }

  // Standard fields
  const visibleFields = section.fields.filter(f => {
    const val = getNestedValue(details, section.path, f.key);
    return val !== null && val !== undefined && val !== '';
  });

  if (visibleFields.length === 0) return null;

  return (
    <SectionWrapper title={section.title} icon={section.icon}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {visibleFields.map((f) => {
          const val = getNestedValue(details, section.path, f.key);
          return (
            <div key={f.key} className="min-w-0">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">{f.label}</p>
              <p className="text-xs font-semibold text-gray-700 truncate">{formatValue(val, f)}</p>
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}

// ════════════════════════════════════════════
// SECTION RENDERER (EDIT MODE)
// ════════════════════════════════════════════

function SectionEdit({ section, details, onChange }: { section: SectionDef; details: any; onChange: (newDetails: any) => void }) {
  // Special sections: read-only in edit mode (security measures, articulos)
  if (section.path === 'security_measures' || section.path === '_articulos') {
    return <SectionView section={section} details={details} />;
  }

  const allFields = section.fields;
  if (allFields.length === 0) return null;

  return (
    <SectionWrapper title={section.title} icon={section.icon}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {allFields.map((f) => {
          const val = getNestedValue(details, section.path, f.key);
          
          if (f.type === 'boolean') {
            return (
              <div key={f.key} className="min-w-0">
                <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1 block">{f.label}</label>
                <select
                  value={val === true ? 'true' : val === false ? 'false' : ''}
                  onChange={(e) => {
                    const newVal = e.target.value === '' ? null : e.target.value === 'true';
                    onChange(setNestedValue(details, section.path, f.key, newVal));
                  }}
                  className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:border-[#8AAA19] focus:outline-none transition-colors"
                >
                  <option value="">—</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>
            );
          }

          return (
            <div key={f.key} className="min-w-0">
              <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-1 block">{f.label}</label>
              <div className="relative">
                {f.prefix && (
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium leading-none">{f.prefix}</span>
                )}
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={val ?? ''}
                  onChange={(e) => {
                    const newVal = f.type === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : e.target.value;
                    onChange(setNestedValue(details, section.path, f.key, newVal));
                  }}
                  className={`w-full ${f.prefix ? 'pl-6' : 'pl-2.5'} pr-2.5 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:border-[#8AAA19] focus:outline-none transition-colors`}
                />
                {f.suffix && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">{f.suffix}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}

// ════════════════════════════════════════════
// SECTION WRAPPER
// ════════════════════════════════════════════

function SectionWrapper({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-100">
        <span className="text-gray-400 text-[10px]">{icon}</span>
        <span className="text-xs font-semibold text-[#010139]">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// ════════════════════════════════════════════
// TIPO PROPUESTA (vida-specific, top-level)
// ════════════════════════════════════════════

function TipoPropuestaView({ details }: { details: any }) {
  const tipos = details?.tipo_propuesta;
  if (!tipos || !Array.isArray(tipos) || tipos.length === 0) return null;
  return (
    <SectionWrapper title="Tipo de Propuesta" icon={<FaShieldAlt />}>
      <div className="flex flex-wrap gap-1.5">
        {tipos.map((t: string, i: number) => (
          <span key={i} className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-semibold rounded-md border border-indigo-100">
            {t}
          </span>
        ))}
      </div>
    </SectionWrapper>
  );
}

// ════════════════════════════════════════════
// MAIN MODAL
// ════════════════════════════════════════════

export default function PetQuoteDetailModal({ open, onClose, caseId, ramo, clientName, onSaved }: PetQuoteDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [editDetails, setEditDetails] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/operaciones/petitions?view=details&case_id=${caseId}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDetails(json.data?.details || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (open && caseId) {
      fetchDetails();
      setEditing(false);
    }
  }, [open, caseId, fetchDetails]);

  const handleStartEdit = () => {
    setEditDetails(JSON.parse(JSON.stringify(details || {})));
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditDetails(null);
  };

  const handleSave = async () => {
    if (!editDetails) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/operaciones/petitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          id: caseId,
          details: editDetails,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDetails(editDetails);
      setEditing(false);
      setEditDetails(null);
      onSaved?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const sections = getSections(ramo);
  const currentDetails = editing ? editDetails : details;
  const ramoLabel = ramo === 'vida' ? 'Vida' : ramo === 'incendio' ? 'Incendio' : ramo === 'hogar' ? 'Contenido / Hogar' : ramo || '—';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0 bg-gradient-to-r from-[#010139] to-[#020270]">
          <div>
            <h2 className="text-base font-bold text-white">Solicitud de Cotización</h2>
            <p className="text-[11px] text-white/50 mt-0.5">
              {clientName} · {ramoLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!editing && !loading && details && (
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                title="Editar solicitud"
              >
                <FaPencilAlt className="text-[10px]" /> Editar
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                >
                  {saving ? <FaSpinner className="animate-spin text-[10px]" /> : <FaSave className="text-[10px]" />}
                  Guardar
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white cursor-pointer transition-colors ml-1"
            >
              <FaTimes className="text-base" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FaSpinner className="animate-spin text-gray-300 text-xl mb-3" />
              <p className="text-xs text-gray-400">Cargando datos de la solicitud...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-xs text-red-600 font-medium">{error}</p>
              <button onClick={fetchDetails} className="mt-2 text-xs text-red-500 hover:text-red-700 underline cursor-pointer">Reintentar</button>
            </div>
          ) : !details || Object.keys(details).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <FaShieldAlt className="text-xl text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">Sin datos detallados</p>
              <p className="text-[10px] text-gray-400 mt-1 max-w-xs">
                Esta petición no tiene información estructurada del cotizador. Puede que haya sido creada manualmente o desde un correo.
              </p>
            </div>
          ) : (
            <>
              {/* Body text summary if present */}
              {details.body_text && !editing && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1.5">Resumen</p>
                  <pre className="text-[11px] text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-auto">
                    {details.body_text}
                  </pre>
                </div>
              )}

              {/* Sections */}
              {sections.map((section, i) => (
                editing
                  ? <SectionEdit key={i} section={section} details={currentDetails} onChange={setEditDetails} />
                  : <SectionView key={i} section={section} details={currentDetails} />
              ))}

              {/* Tipo propuesta (vida only) */}
              {!editing && ramo === 'vida' && <TipoPropuestaView details={currentDetails} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
