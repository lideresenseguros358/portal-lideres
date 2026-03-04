'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaEnvelope, FaCheckCircle, FaTimes, FaExclamationCircle, FaClock, FaPlus, FaRobot, FaSync, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InboundEmail {
  id: string;
  message_id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  date_sent: string | null;
  attachments_count: number | null;
  processed_status: string;
  body_text: string | null;
  ai_suggestion?: {
    id: string;
    json_result: any;
    created_at: string;
  } | null;
}

interface SinClasificarCase {
  id: string;
  ticket: string | null;
  estado_simple: string | null;
  created_at: string;
  detected_broker_email: string | null;
  ai_classification: any;
  ai_confidence: number | null;
}

export default function UnclassifiedEmailsUI() {
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [sinClasificarCases, setSinClasificarCases] = useState<SinClasificarCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pendientes/unclassified');
      if (!res.ok) {
        toast.error('Error cargando emails sin clasificar');
        return;
      }
      const data = await res.json();
      setEmails(data.unlinked_emails || []);
      setSinClasificarCases(data.sin_clasificar_cases || []);
    } catch (err) {
      toast.error('Error de red al cargar emails');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const totalItems = emails.length + sinClasificarCases.length;

  // Don't render anything when there's nothing
  if (!loading && totalItems === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-8 mb-4 text-center">
        <FaCheckCircle className="text-green-400 text-3xl mx-auto mb-3" />
        <p className="text-gray-600 font-semibold">Todo clasificado</p>
        <p className="text-gray-400 text-sm mt-1">No hay correos ni casos pendientes de clasificación</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FaEnvelope className="text-orange-500 text-xl" />
          <div>
            <h2 className="text-lg font-bold text-[#010139]">
              Sin Clasificar
              {totalItems > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-sm font-bold">
                  {totalItems}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500">
              Correos y casos que requieren clasificación manual
            </p>
          </div>
        </div>
        <button
          onClick={loadEmails}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
        >
          <FaSync size={12} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#010139] mx-auto" />
          <p className="text-gray-500 mt-2 text-sm">Cargando...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Unlinked emails */}
          {emails.map((email) => (
            <EmailRow
              key={`email-${email.id}`}
              email={email}
              onAssign={() => {
                setSelectedEmail(email);
                setShowNewCaseModal(true);
              }}
              onReload={loadEmails}
            />
          ))}

          {/* Sin clasificar cases (already created but not classified) */}
          {sinClasificarCases.map((c) => (
            <div key={`case-${c.id}`} className="border-2 border-yellow-200 rounded-xl bg-yellow-50 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-bold">
                      Caso creado
                    </span>
                    {c.ticket && (
                      <span className="text-xs font-mono text-gray-500">{c.ticket}</span>
                    )}
                    {c.ai_confidence !== null && c.ai_confidence > 0 && (
                      <span className="flex items-center gap-1">
                        <FaRobot size={10} className="text-purple-500" />
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          c.ai_confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                          c.ai_confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {Math.round(c.ai_confidence * 100)}%
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {c.detected_broker_email || 'Sin remitente'}
                  </p>
                  {c.ai_classification && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-purple-700">
                      <FaRobot size={10} className="text-purple-500" />
                      <span>
                        IA: {c.ai_classification?.ramo_bucket || '—'} · {c.ai_classification?.case_type || c.ai_classification?.tramite_code || '—'}
                      </span>
                      {c.ai_classification?.detected_entities?.client_name && (
                        <span className="text-gray-600">
                          · Cliente: {c.ai_classification.detected_entities.client_name}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(c.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>
                <a
                  href={`/cases/${c.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-yellow-600 text-white rounded-lg text-xs font-bold hover:bg-yellow-700 transition-colors flex-shrink-0"
                >
                  Editar caso
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign modal */}
      {showNewCaseModal && selectedEmail && (
        <AssignEmailModal
          email={selectedEmail}
          onClose={() => { setShowNewCaseModal(false); setSelectedEmail(null); }}
          onSuccess={() => { setShowNewCaseModal(false); setSelectedEmail(null); loadEmails(); }}
        />
      )}
    </div>
  );
}

// =====================================================
// EMAIL ROW
// =====================================================

function EmailRow({
  email,
  onAssign,
  onReload,
}: {
  email: InboundEmail;
  onAssign: () => void;
  onReload: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ai = email.ai_suggestion?.json_result;
  const confidence = ai?.confidence ?? null;

  const dateSent = email.date_sent ? new Date(email.date_sent) : null;

  return (
    <div className="border-2 border-orange-200 rounded-xl bg-orange-50 overflow-hidden">
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-[#010139] text-sm">
                {email.from_name || email.from_email || 'Remitente desconocido'}
              </span>
              {email.from_name && email.from_email && (
                <span className="text-xs text-gray-500">&lt;{email.from_email}&gt;</span>
              )}
              {email.attachments_count !== null && email.attachments_count > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {email.attachments_count} adjunto{email.attachments_count > 1 ? 's' : ''}
                </span>
              )}
              {email.processed_status === 'error' && (
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <FaExclamationCircle size={10} /> Error
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-800 truncate">
              {email.subject || '(sin asunto)'}
            </p>
            {dateSent && (
              <p className="text-xs text-gray-400 mt-0.5">
                {format(dateSent, "d MMM yyyy, HH:mm", { locale: es })}
              </p>
            )}
            {/* AI suggestion badge */}
            {ai && confidence !== null && (
              <div className="flex items-center gap-2 mt-1.5">
                <FaRobot size={11} className="text-purple-500" />
                <span className="text-xs text-purple-700 font-semibold">
                  IA: {ai.ramo || ai.ramo_bucket || '—'} · {ai.case_type || '—'}
                </span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                  confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {Math.round(confidence * 100)}%
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {email.body_text && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-2 rounded-lg text-gray-500 hover:bg-orange-100 transition-colors"
              >
                {expanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
              </button>
            )}
            <button
              onClick={onAssign}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <FaPlus size={10} /> Crear caso
            </button>
          </div>
        </div>

        {expanded && email.body_text && (
          <div className="mt-3 pt-3 border-t border-orange-200">
            <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-8 font-mono text-xs bg-white rounded-lg p-3 border border-gray-200">
              {email.body_text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// ASSIGN EMAIL MODAL — creates a case from the email
// =====================================================

function AssignEmailModal({
  email,
  onClose,
  onSuccess,
}: {
  email: InboundEmail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const ai = email.ai_suggestion?.json_result;

  // Map AI ramo_bucket to section
  const aiSection = (() => {
    const bucket = ai?.ramo_bucket;
    if (bucket === 'vida_assa') return 'VIDA_ASSA';
    if (bucket === 'ramos_generales') return 'RAMOS_GENERALES';
    if (bucket === 'ramo_personas') return 'OTROS_PERSONAS';
    return 'SIN_CLASIFICAR';
  })();

  // Map AI case_type to management_type label
  const aiManagementType = (() => {
    const ct = ai?.case_type;
    const map: Record<string, string> = {
      emision: 'Emisión', reclamo: 'Reclamo', modificacion: 'Modificación',
      cambio_corredor: 'Cambio de Corredor', cotizacion: 'Cotización',
      cancelacion: 'Cancelación', rehabilitacion: 'Rehabilitación', otro: 'Otro',
    };
    return ct ? (map[ct] || ct) : '';
  })();

  // Pre-fill from AI
  const [section, setSection] = useState(aiSection);
  const [clientName, setClientName] = useState(ai?.detected_entities?.client_name || '');
  const [nationalId, setNationalId] = useState(ai?.detected_entities?.cedula || '');
  const [managementType, setManagementType] = useState(aiManagementType);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/pendientes/unclassified/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          email_id: email.id,
          classification_id: email.ai_suggestion?.id || undefined,
          section,
          client_name: clientName || undefined,
          national_id: nationalId || undefined,
          management_type: managementType || undefined,
          ctype: ai?.case_type || undefined,
          policy_number: ai?.policy_number || undefined,
          notes: notes || `Correo de: ${email.from_email}\nAsunto: ${email.subject}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Error al crear caso');
        return;
      }
      toast.success('Caso creado y correo asignado');
      onSuccess();
    } catch {
      toast.error('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  const confidence = ai?.confidence ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-5 rounded-t-2xl">
          <h3 className="text-lg font-bold">Clasificar correo</h3>
          <p className="text-sm text-blue-200 mt-0.5 truncate">De: {email.from_email}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Email preview */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm">
            <p className="font-semibold text-gray-800">{email.subject || '(sin asunto)'}</p>
            {email.body_text && (
              <p className="text-gray-500 mt-1 line-clamp-4 text-xs">{email.body_text}</p>
            )}
          </div>

          {/* AI suggestion badge */}
          {ai && confidence !== null && confidence > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <FaRobot size={14} className="text-purple-600" />
                <span className="text-sm font-bold text-purple-800">Sugerencia IA</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                  confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {Math.round(confidence * 100)}% confianza
                </span>
              </div>
              <div className="text-xs text-purple-700 space-y-0.5">
                {ai.ramo_bucket && <p><strong>Sección:</strong> {ai.ramo_bucket}</p>}
                {ai.case_type && <p><strong>Tipo:</strong> {ai.case_type}</p>}
                {ai.aseguradora && <p><strong>Aseguradora:</strong> {ai.aseguradora}</p>}
                {ai.detected_entities?.client_name && <p><strong>Cliente:</strong> {ai.detected_entities.client_name}</p>}
                {ai.detected_entities?.cedula && <p><strong>Cédula:</strong> {ai.detected_entities.cedula}</p>}
                {ai.policy_number && <p><strong>Póliza:</strong> {ai.policy_number}</p>}
              </div>
              <p className="text-[10px] text-purple-500 mt-1.5 italic">Los campos se pre-llenaron con la sugerencia. Verifica y ajusta lo que haga falta.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Sección *</label>
            <select
              value={section}
              onChange={e => setSection(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="SIN_CLASIFICAR">Sin clasificar</option>
              <option value="VIDA_ASSA">Vida ASSA</option>
              <option value="RAMOS_GENERALES">Ramos Generales</option>
              <option value="OTROS_PERSONAS">Ramo Personas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de trámite</label>
            <select
              value={managementType}
              onChange={e => setManagementType(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-[#8AAA19] focus:outline-none"
            >
              <option value="">Seleccionar...</option>
              <option value="Emisión">Emisión</option>
              <option value="Reclamo">Reclamo</option>
              <option value="Modificación">Modificación</option>
              <option value="Cambio de Corredor">Cambio de Corredor</option>
              <option value="Cotización">Cotización</option>
              <option value="Cancelación">Cancelación</option>
              <option value="Rehabilitación">Rehabilitación</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del cliente</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Nombre del asegurado..."
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-[#8AAA19] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Cédula</label>
              <input
                type="text"
                value={nationalId}
                onChange={e => setNationalId(e.target.value)}
                placeholder="X-XXX-XXXX"
                className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-[#8AAA19] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones..."
              className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-base focus:border-[#8AAA19] focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
              {submitting ? 'Creando...' : <><FaPlus size={12} /> Crear caso</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
