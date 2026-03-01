'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaCog,
  FaSave,
  FaSync,
  FaToggleOn,
  FaToggleOff,
  FaClock,
  FaCalendarAlt,
  FaEnvelope,
  FaExclamationTriangle,
  FaUsers,
  FaChevronDown,
  FaChevronUp,
  FaRobot,
  FaServer,
  FaArchive,
  FaChartLine,
  FaInbox,
  FaPlay,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationCircle,
  FaInfoCircle,
} from 'react-icons/fa';

// ════════════════════════════════════════════
// Types
// ════════════════════════════════════════════

interface CfgMap { [key: string]: any }

interface CronJob {
  name: string;
  label: string;
  expectedIntervalMin: number;
  badge: 'green' | 'yellow' | 'red';
  lastRun: {
    started_at: string;
    finished_at: string | null;
    status: string;
    processed_count: number | null;
    error_message: string | null;
    metadata: any;
  } | null;
}

interface EmailTemplate {
  id: string;
  template_key: string;
  label: string;
  subject: string;
  body_html: string;
  body_text: string;
  merge_vars: string[];
}

interface Toast { id: number; msg: string; type: 'success' | 'error' }

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

function parseVal(v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

function fmtAgo(iso: string | null): string {
  if (!iso) return 'Nunca';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'Hace <1 min';
  if (ms < 3600000) return `Hace ${Math.floor(ms / 60000)} min`;
  if (ms < 86400000) return `Hace ${Math.floor(ms / 3600000)}h`;
  return `Hace ${Math.floor(ms / 86400000)}d`;
}

// ════════════════════════════════════════════
// Accordion Section
// ════════════════════════════════════════════

function Section({ title, icon: Icon, defaultOpen, children }: {
  title: string;
  icon: typeof FaCog;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="text-[#010139] text-sm" />
          <span className="text-sm font-bold text-[#010139]">{title}</span>
        </div>
        {open ? <FaChevronUp className="text-gray-400 text-xs" /> : <FaChevronDown className="text-gray-400 text-xs" />}
      </button>
      {open && <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold ${
          t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>{t.msg}</div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

const WORKDAY_LABELS = [
  { key: 'Mon', label: 'Lun' },
  { key: 'Tue', label: 'Mar' },
  { key: 'Wed', label: 'Mié' },
  { key: 'Thu', label: 'Jue' },
  { key: 'Fri', label: 'Vie' },
  { key: 'Sat', label: 'Sáb' },
  { key: 'Sun', label: 'Dom' },
];

export default function OpsConfigTab() {
  const [cfg, setCfg] = useState<CfgMap>({});
  const [dirty, setDirty] = useState<CfgMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selTemplate, setSelTemplate] = useState<string>('');
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [tplVars, setTplVars] = useState<string[]>([]);

  // Cron
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronLoading, setCronLoading] = useState(false);

  // AI re-eval
  const [aiReevaling, setAiReevaling] = useState(false);

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);
  const toast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = ++tid.current;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Fetch config ──
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/operaciones/config');
      const json = await res.json();
      const map: CfgMap = {};
      for (const row of (json.data || [])) {
        map[row.key] = parseVal(row.value);
      }
      setCfg(map);
      setDirty({});
    } catch { toast('Error cargando configuración', 'error'); }
    setLoading(false);
  }, [toast]);

  // ── Fetch templates ──
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/operaciones/config?view=templates');
      const json = await res.json();
      setTemplates(json.data || []);
      if (json.data?.length && !selTemplate) {
        const first = json.data[0];
        setSelTemplate(first.template_key);
        setTplSubject(first.subject);
        setTplBody(first.body_text);
        setTplVars(first.merge_vars || []);
      }
    } catch {}
  }, [selTemplate]);

  // ── Fetch cron health ──
  const fetchCron = useCallback(async () => {
    setCronLoading(true);
    try {
      const res = await fetch('/api/operaciones/config?view=cron_health');
      const json = await res.json();
      setCronJobs(json.data || []);
    } catch {}
    setCronLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); fetchTemplates(); fetchCron(); }, [fetchConfig, fetchTemplates, fetchCron]);

  // ── Dirty tracking ──
  const getVal = (key: string, fallback?: any) => {
    if (key in dirty) return dirty[key];
    if (key in cfg) return cfg[key];
    return fallback;
  };
  const setVal = (key: string, value: any) => {
    setDirty(prev => ({ ...prev, [key]: value }));
  };

  const hasDirty = Object.keys(dirty).length > 0;

  // ── Save ──
  const handleSave = async () => {
    if (!hasDirty) return;
    setSaving(true);
    try {
      const configs = Object.entries(dirty).map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? value : value,
      }));
      const res = await fetch('/api/operaciones/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_update', configs }),
      });
      const json = await res.json();
      if (json.success) {
        toast(`Guardado (${json.changes_count || configs.length} cambios)`);
        setCfg(prev => ({ ...prev, ...dirty }));
        setDirty({});
      } else {
        toast(json.error || 'Error al guardar', 'error');
      }
    } catch { toast('Error de conexión', 'error'); }
    setSaving(false);
  };

  // ── Save template ──
  const handleSaveTemplate = async () => {
    if (!selTemplate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/operaciones/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_template',
          template_key: selTemplate,
          subject: tplSubject,
          body_html: `<p>${tplBody.replace(/\n/g, '</p><p>')}</p>`,
          body_text: tplBody,
          merge_vars: tplVars,
        }),
      });
      const json = await res.json();
      if (json.success) toast('Plantilla guardada');
      else toast(json.error || 'Error', 'error');
    } catch { toast('Error de conexión', 'error'); }
    setSaving(false);
  };

  // ── AI re-eval ──
  const handleAiReeval = async () => {
    setAiReevaling(true);
    try {
      const res = await fetch('/api/operaciones/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_ai_reeval' }),
      });
      const json = await res.json();
      if (json.success) toast('Re-evaluación IA ejecutada');
      else toast(json.error || 'Error', 'error');
    } catch { toast('Error', 'error'); }
    setAiReevaling(false);
  };

  // ── Template selector change ──
  const onTemplateChange = (key: string) => {
    setSelTemplate(key);
    const tpl = templates.find(t => t.template_key === key);
    if (tpl) {
      setTplSubject(tpl.subject);
      setTplBody(tpl.body_text);
      setTplVars(tpl.merge_vars || []);
    }
  };

  // ── Business hours helpers ──
  const bh = getVal('business_hours', { timezone: 'America/Panama', workdays: ['Mon','Tue','Wed','Thu','Fri'], start: '08:00', end: '18:00' });
  const toggleWorkday = (day: string) => {
    const days: string[] = bh.workdays || [];
    const next = days.includes(day) ? days.filter((d: string) => d !== day) : [...days, day];
    setVal('business_hours', { ...bh, workdays: next });
  };

  // Productivity preview
  const prodRatio = getVal('low_productivity_threshold_ratio', 0.4);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Save bar ── */}
      {hasDirty && (
        <div className="sticky top-0 z-20 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-sm">
          <p className="text-xs text-amber-800 font-semibold">
            {Object.keys(dirty).length} cambio(s) sin guardar
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setDirty({})} className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#010139] rounded-lg cursor-pointer hover:bg-[#020270] disabled:opacity-40"
            >
              <FaSave className="text-white text-[10px]" /> {saving ? 'Guardando...' : 'Guardar Todo'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 1) AUTOASIGNACIÓN */}
      {/* ═══════════════════════════════════════════ */}
      <Section title="Autoasignación" icon={FaUsers} defaultOpen>
        <div className="space-y-3 mt-2">
          {/* Global toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs font-semibold text-[#010139]">Autoasignación Global</p>
              <p className="text-[10px] text-gray-500">Activa/desactiva la autoasignación en todos los módulos</p>
            </div>
            <button onClick={() => setVal('auto_assignment_enabled', !getVal('auto_assignment_enabled', false))} className="text-2xl cursor-pointer">
              {getVal('auto_assignment_enabled', false)
                ? <FaToggleOn className="text-[#8AAA19]" />
                : <FaToggleOff className="text-gray-300" />
              }
            </button>
          </div>

          {/* Per-module toggles */}
          {getVal('auto_assignment_enabled', false) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['renovaciones', 'peticiones', 'urgencias'].map(mod => {
                const modules = getVal('auto_assignment_modules', { renovaciones: true, peticiones: true, urgencias: true });
                const on = modules[mod] ?? true;
                return (
                  <div key={mod} className="flex items-center justify-between p-2.5 bg-blue-50/50 rounded-lg border border-blue-100">
                    <span className="text-xs font-semibold text-[#010139] capitalize">{mod}</span>
                    <button
                      onClick={() => setVal('auto_assignment_modules', { ...modules, [mod]: !on })}
                      className="text-xl cursor-pointer"
                    >
                      {on ? <FaToggleOn className="text-[#8AAA19]" /> : <FaToggleOff className="text-gray-300" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Strategy */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <FaInfoCircle className="text-blue-400 text-xs flex-shrink-0" />
            <p className="text-[10px] text-gray-600">
              <span className="font-semibold">Estrategia:</span> &quot;Equilibrado&quot; — asigna al master con menos casos abiertos.
            </p>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════ */}
      {/* 2) SLA + HORARIOS */}
      {/* ═══════════════════════════════════════════ */}
      <Section title="SLA y Horario Laboral" icon={FaClock} defaultOpen>
        <div className="space-y-4 mt-2">
          {/* SLA inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">SLA Renovaciones / Peticiones (horas)</label>
              <input
                type="number"
                value={getVal('sla_hours_renewals_petitions', 48)}
                onChange={e => setVal('sla_hours_renewals_petitions', Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[#010139]/30"
              />
              <p className="text-[9px] text-gray-400 mt-1">Horas calendario totales</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">SLA Urgencias (horas hábiles)</label>
              <input
                type="number"
                value={getVal('sla_business_hours_urgencies', 24)}
                onChange={e => setVal('sla_business_hours_urgencies', Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[#010139]/30"
              />
              <p className="text-[9px] text-gray-400 mt-1">Solo cuenta dentro del horario laboral configurado</p>
            </div>
          </div>

          {/* Warning thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(() => {
              const th = getVal('sla_warning_thresholds', { renewals: 24, urgencies: 12 });
              return (
                <>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <label className="block text-[10px] font-semibold text-amber-700 mb-1">Warning Renovaciones (horas antes)</label>
                    <input
                      type="number"
                      value={th.renewals ?? 24}
                      onChange={e => setVal('sla_warning_thresholds', { ...th, renewals: Number(e.target.value) })}
                      className="w-full text-sm border border-amber-200 rounded-lg px-3 py-1.5 outline-none"
                    />
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <label className="block text-[10px] font-semibold text-amber-700 mb-1">Warning Urgencias (horas hábiles antes)</label>
                    <input
                      type="number"
                      value={th.urgencies ?? 12}
                      onChange={e => setVal('sla_warning_thresholds', { ...th, urgencies: Number(e.target.value) })}
                      className="w-full text-sm border border-amber-200 rounded-lg px-3 py-1.5 outline-none"
                    />
                  </div>
                </>
              );
            })()}
          </div>

          {/* Business hours */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-[#010139] mb-2">Horario Laboral</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold mb-1">Inicio</label>
                <input
                  type="time"
                  value={bh.start || '08:00'}
                  onChange={e => setVal('business_hours', { ...bh, start: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold mb-1">Fin</label>
                <input
                  type="time"
                  value={bh.end || '18:00'}
                  onChange={e => setVal('business_hours', { ...bh, end: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 font-semibold mb-1">Zona Horaria</label>
                <input
                  type="text"
                  value={bh.timezone || 'America/Panama'}
                  readOnly
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-500"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[10px] text-gray-500 font-semibold mb-1.5">Días Laborales</label>
              <div className="flex gap-1.5 flex-wrap">
                {WORKDAY_LABELS.map(d => {
                  const active = (bh.workdays || []).includes(d.key);
                  return (
                    <button
                      key={d.key}
                      onClick={() => toggleWorkday(d.key)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                        active ? 'bg-[#010139] text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════ */}
      {/* 3) PRODUCTIVIDAD */}
      {/* ═══════════════════════════════════════════ */}
      <Section title="Detección de Días Improductivos" icon={FaChartLine}>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Ratio Mínimo (0-1)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={getVal('low_productivity_threshold_ratio', 0.4)}
                onChange={e => setVal('low_productivity_threshold_ratio', Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none"
              />
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Lookback (días)</label>
              <input
                type="number"
                value={getVal('low_productivity_lookback_days', 30)}
                onChange={e => setVal('low_productivity_lookback_days', Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none"
              />
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Cerrar Sesión Inactividad (h)</label>
              <input
                type="number"
                value={getVal('inactivity_close_session_hours', 2)}
                onChange={e => setVal('inactivity_close_session_hours', Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none"
              />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <FaInfoCircle className="text-blue-400 text-xs mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-blue-700">
              <strong>Vista previa:</strong> Si el promedio de casos es 10/día, un día es improductivo si maneja menos de{' '}
              <strong>{Math.round(10 * (typeof prodRatio === 'number' ? prodRatio : 0.4))}</strong> casos.
            </p>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════ */}
      {/* 4) PLANTILLAS EMAIL */}
      {/* ═══════════════════════════════════════════ */}
      <Section title="Plantillas de Correo" icon={FaEnvelope}>
        <div className="space-y-3 mt-2">
          {/* Template selector */}
          <div className="flex flex-wrap gap-1.5">
            {templates.map(t => (
              <button
                key={t.template_key}
                onClick={() => onTemplateChange(t.template_key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  selTemplate === t.template_key
                    ? 'bg-[#010139] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {selTemplate && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Asunto</label>
                <input
                  type="text"
                  value={tplSubject}
                  onChange={e => setTplSubject(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#010139]/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Cuerpo (texto)</label>
                <textarea
                  value={tplBody}
                  onChange={e => setTplBody(e.target.value)}
                  rows={6}
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 outline-none font-mono resize-none focus:ring-1 focus:ring-[#010139]/30"
                />
              </div>
              {tplVars.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-gray-500 mb-1">Variables disponibles:</p>
                  <div className="flex flex-wrap gap-1">
                    {tplVars.map(v => (
                      <button
                        key={v}
                        onClick={() => setTplBody(prev => prev + v)}
                        className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono text-[#010139] cursor-pointer hover:bg-blue-50"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={handleSaveTemplate}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#010139] rounded-lg cursor-pointer hover:bg-[#020270] disabled:opacity-40"
              >
                <FaSave className="text-white text-[10px]" /> Guardar Plantilla
              </button>
            </>
          )}

          {templates.length === 0 && (
            <div className="py-6 text-center">
              <FaEnvelope className="text-2xl text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No hay plantillas. Ejecuta la migración SQL para crear las plantillas por defecto.</p>
            </div>
          )}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════ */}
      {/* 5) IMAP */}
      {/* ═══════════════════════════════════════════ */}
      <Section title="IMAP (Correo Entrante)" icon={FaInbox}>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Intervalo Sync (min)</label>
              <input
                type="number"
                value={getVal('imap_sync_interval_minutes', 1)}
                readOnly
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-100 text-gray-500"
              />
              <p className="text-[9px] text-gray-400 mt-1">Definido por Vercel cron — solo lectura</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Retención No Clasificados (días)</label>
              <input
                type="number"
                value={getVal('unclassified_retention_days', 90)}
                onChange={e => setVal('unclassified_retention_days', Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-[10px] font-semibold text-gray-600">Rescate Huérfanos</p>
                <p className="text-[9px] text-gray-400">Por número de póliza</p>
              </div>
              <button
                onClick={() => setVal('orphan_match_policy_number_enabled', !getVal('orphan_match_policy_number_enabled', true))}
                className="text-xl cursor-pointer"
              >
                {getVal('orphan_match_policy_number_enabled', true)
                  ? <FaToggleOn className="text-[#8AAA19]" />
                  : <FaToggleOff className="text-gray-300" />
                }
              </button>
            </div>
          </div>

          {/* Last sync info from cron health */}
          {(() => {
            const imapJob = cronJobs.find(j => j.name === 'ops-imap-sync');
            if (!imapJob?.lastRun) return null;
            return (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-[10px] text-blue-700">
                  <strong>Último sync:</strong> {fmtAgo(imapJob.lastRun.started_at)} — {imapJob.lastRun.status}
                  {imapJob.lastRun.metadata?.new != null && ` — ${imapJob.lastRun.metadata.new} nuevos mensajes`}
                </p>
              </div>
            );
          })()}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════ */}
      {/* 6) IA */}
      {/* ═══════════════════════════════════════════ */}
      <Section title="Inteligencia Artificial" icon={FaRobot}>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Proveedor IA</label>
              <input
                type="text"
                value={process.env.NEXT_PUBLIC_AI_PROVIDER || getVal('ai_provider', 'vertex')}
                readOnly
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-100 text-gray-500"
              />
              <p className="text-[9px] text-gray-400 mt-1">Definido por env AI_PROVIDER — solo lectura</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Efectividad Mínima (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={getVal('ai_effectiveness_min', 70)}
                onChange={e => setVal('ai_effectiveness_min', Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Confianza Mín. Memoria (0-1)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={getVal('ai_confidence_min_memory', 0.3)}
                onChange={e => setVal('ai_confidence_min_memory', Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-[10px] font-semibold text-gray-600">Escalamiento Auto</p>
                <p className="text-[9px] text-gray-400">IA puede escalar automáticamente</p>
              </div>
              <button
                onClick={() => setVal('ai_escalation_auto', !getVal('ai_escalation_auto', true))}
                className="text-xl cursor-pointer"
              >
                {getVal('ai_escalation_auto', true)
                  ? <FaToggleOn className="text-[#8AAA19]" />
                  : <FaToggleOff className="text-gray-300" />
                }
              </button>
            </div>
          </div>

          <button
            onClick={handleAiReeval}
            disabled={aiReevaling}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#010139] bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 disabled:opacity-40 transition-colors"
          >
            <FaPlay className="text-[10px]" /> {aiReevaling ? 'Ejecutando...' : 'Re-evaluar últimos 10 urgentes'}
          </button>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════ */}
      {/* 7) RETENCIÓN / EXPORTS */}
      {/* ═══════════════════════════════════════════ */}
      <Section title="Retención y Exportables" icon={FaArchive}>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Retención de Datos (años)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={getVal('retention_years', 3)}
                onChange={e => setVal('retention_years', Number(e.target.value))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none"
              />
              <p className="text-[9px] text-gray-400 mt-1">Logs, métricas y auditoría se conservan por este periodo</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-[10px] font-semibold text-gray-600">Exportaciones Habilitadas</p>
                <p className="text-[9px] text-gray-400">Permitir exportar datos CSV/Excel</p>
              </div>
              <button
                onClick={() => setVal('exports_enabled', !getVal('exports_enabled', true))}
                className="text-xl cursor-pointer"
              >
                {getVal('exports_enabled', true)
                  ? <FaToggleOn className="text-[#8AAA19]" />
                  : <FaToggleOff className="text-gray-300" />
                }
              </button>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2">
            <FaInfoCircle className="text-gray-400 text-xs mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-gray-500">
              La funcionalidad de exportación completa se construirá en una fase posterior.
              Estos toggles preparan los parámetros que usará el sistema de exportación.
            </p>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════ */}
      {/* 8) SALUD DEL SISTEMA (CRONS) */}
      {/* ═══════════════════════════════════════════ */}
      <Section title="Salud del Sistema (Cron Jobs)" icon={FaServer}>
        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-500">Estado de procesos automáticos</p>
            <button
              onClick={fetchCron}
              disabled={cronLoading}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-gray-600 bg-gray-100 rounded cursor-pointer hover:bg-gray-200"
            >
              <FaSync className={`text-[8px] ${cronLoading ? 'animate-spin' : ''}`} /> Refrescar
            </button>
          </div>

          {cronJobs.length === 0 && !cronLoading && (
            <div className="py-6 text-center">
              <FaServer className="text-2xl text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Sin datos de cron runs. Ejecuta la migración de cron_runs.</p>
            </div>
          )}

          {cronJobs.map(job => {
            const BadgeIcon = job.badge === 'green' ? FaCheckCircle : job.badge === 'yellow' ? FaExclamationCircle : FaTimesCircle;
            const badgeColor = job.badge === 'green' ? 'text-green-500' : job.badge === 'yellow' ? 'text-amber-500' : 'text-red-500';
            const bgColor = job.badge === 'green' ? 'bg-green-50 border-green-200' : job.badge === 'yellow' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

            return (
              <div key={job.name} className={`flex items-center gap-3 p-3 rounded-lg border ${bgColor}`}>
                <BadgeIcon className={`text-sm flex-shrink-0 ${badgeColor}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#010139]">{job.label}</p>
                  <p className="text-[10px] text-gray-500">
                    {job.lastRun
                      ? `${fmtAgo(job.lastRun.started_at)} — ${job.lastRun.status}${
                          job.lastRun.processed_count ? ` (${job.lastRun.processed_count} procesados)` : ''
                        }`
                      : 'Sin registros'
                    }
                  </p>
                  {job.lastRun?.error_message && (
                    <p className="text-[9px] text-red-600 mt-0.5 truncate">{job.lastRun.error_message}</p>
                  )}
                </div>
                <span className="text-[9px] text-gray-400 flex-shrink-0">cada {job.expectedIntervalMin < 60 ? `${job.expectedIntervalMin}min` : `${Math.round(job.expectedIntervalMin / 60)}h`}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
