'use client';

import { useState, useEffect } from 'react';
import { FaEnvelope, FaCheckCircle, FaTimes, FaExclamationCircle, FaClock, FaPlus } from 'react-icons/fa';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface UnclassifiedEmail {
  id: string;
  message_id?: string | null;
  thread_id?: string | null;
  from_email: string;
  from_name?: string | null;
  subject?: string | null;
  body_text?: string | null;
  received_at: string;
  grouped_until?: string | null;
  assigned_to_case_id?: string | null;
  status: 'PENDING' | 'GROUPED' | 'ASSIGNED' | 'DISCARDED';
  confidence_score?: number | null;
  created_at: string;
}

export default function UnclassifiedEmailsUI() {
  const [emails, setEmails] = useState<UnclassifiedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<UnclassifiedEmail | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    setLoading(true);
    
    // TODO: Implementar server action para obtener emails sin clasificar
    // const result = await actionGetUnclassifiedEmails();
    
    // Mock data por ahora
    setEmails([
      {
        id: '1',
        from_email: 'cliente@example.com',
        from_name: 'Juan Pérez',
        subject: 'Consulta sobre renovación de póliza',
        body_text: 'Hola, quisiera renovar mi póliza de auto...',
        received_at: new Date().toISOString(),
        grouped_until: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
        status: 'PENDING',
        confidence_score: 0.75,
        created_at: new Date().toISOString(),
      },
    ]);
    
    setLoading(false);
  };

  // Agrupar emails por thread_id o por similaridad
  const groupedEmails = emails.reduce((groups, email) => {
    const key = email.thread_id || email.id;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(email);
    return groups;
  }, {} as Record<string, UnclassifiedEmail[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-white rounded-xl p-6 border-l-4 border-orange-500 shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <FaEnvelope className="text-2xl text-orange-600" />
          <h2 className="text-2xl font-bold text-[#010139]">
            📧 Emails Sin Clasificar
          </h2>
        </div>
        <p className="text-gray-600">
          Emails que el sistema no pudo clasificar automáticamente. Ventana de agrupación: 24 horas.
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 mb-2">ℹ️ ¿Cómo funciona?</h3>
        <ul className="text-sm text-blue-700 space-y-1 ml-4">
          <li>• Los emails se agrupan automáticamente durante 24 horas desde su recepción</li>
          <li>• Emails similares (mismo thread o remitente) se agrupan juntos</li>
          <li>• Pasadas las 24 horas, debes asignarlos manualmente a un caso</li>
          <li>• Puedes crear un nuevo caso o asignar a uno existente</li>
          <li>• También puedes descartar emails que no son relevantes</li>
        </ul>
      </div>

      {/* Emails List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139] mx-auto"></div>
          <p className="text-gray-500 mt-4">Cargando emails...</p>
        </div>
      ) : Object.keys(groupedEmails).length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <FaCheckCircle className="text-6xl text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No hay emails sin clasificar
          </h3>
          <p className="text-gray-500">
            Todos los emails han sido procesados correctamente
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedEmails).map(([groupId, groupEmails]) => (
            <EmailGroup
              key={groupId}
              emails={groupEmails}
              onAssign={(email) => {
                setSelectedEmail(email);
                setShowAssignModal(true);
              }}
              onDiscard={(emailId) => handleDiscard(emailId)}
              onReload={loadEmails}
            />
          ))}
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedEmail && (
        <AssignmentModal
          email={selectedEmail}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedEmail(null);
          }}
          onSuccess={() => {
            setShowAssignModal(false);
            setSelectedEmail(null);
            loadEmails();
          }}
        />
      )}
    </div>
  );

  function handleDiscard(emailId: string) {
    toast.info('Descartando email...');
    // TODO: Implementar server action
  }
}

// =====================================================
// EMAIL GROUP
// =====================================================

function EmailGroup({
  emails,
  onAssign,
  onDiscard,
  onReload,
}: {
  emails: UnclassifiedEmail[];
  onAssign: (email: UnclassifiedEmail) => void;
  onDiscard: (emailId: string) => void;
  onReload: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  
  if (emails.length === 0) return null;
  
  const primaryEmail = emails[0];
  if (!primaryEmail) return null;
  
  const isExpired = primaryEmail.grouped_until ? new Date(primaryEmail.grouped_until) < new Date() : true;

  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${
      isExpired ? 'border-red-400' : 'border-orange-400'
    }`}>
      {/* Group Header */}
      <div className={`p-4 ${
        isExpired 
          ? 'bg-gradient-to-r from-red-50 to-red-100' 
          : 'bg-gradient-to-r from-orange-50 to-orange-100'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg ${
              isExpired ? 'bg-red-200' : 'bg-orange-200'
            }`}>
              {isExpired ? (
                <FaExclamationCircle className="text-red-600 text-xl" />
              ) : (
                <FaClock className="text-orange-600 text-xl" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-[#010139]">
                  {primaryEmail.from_name || primaryEmail.from_email}
                </h3>
                {emails.length > 1 && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                    {emails.length} emails
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-1">
                {primaryEmail.from_email}
              </p>

              {primaryEmail.subject && (
                <p className="text-sm text-gray-800 font-semibold mb-2">
                  {primaryEmail.subject}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-500">
                  Recibido: {format(new Date(primaryEmail.received_at), 'PPp', { locale: es })}
                </span>
                {primaryEmail.grouped_until && (
                  <span className={`font-bold ${
                    isExpired ? 'text-red-600' : 'text-orange-600'
                  }`}>
                    {isExpired 
                      ? '⚠️ Ventana expirada - Requiere asignación manual'
                      : `⏱️ Agrupando hasta: ${format(new Date(primaryEmail.grouped_until), 'PPp', { locale: es })}`
                    }
                  </span>
                )}
              </div>

              {primaryEmail.confidence_score !== null && primaryEmail.confidence_score !== undefined && (
                <div className="mt-2">
                  <span className="text-xs text-gray-600">
                    Confianza IA: {Math.round(primaryEmail.confidence_score * 100)}%
                  </span>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full ${
                        primaryEmail.confidence_score >= 0.8 
                          ? 'bg-green-500' 
                          : primaryEmail.confidence_score >= 0.5 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${primaryEmail.confidence_score * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onAssign(primaryEmail)}
              className="bg-[#8AAA19] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6d8814] transition-colors text-sm flex items-center gap-2"
            >
              <FaPlus className="text-white" /> Asignar
            </button>
            <button
              onClick={() => {
                if (confirm('¿Descartar este email?')) {
                  onDiscard(primaryEmail.id);
                }
              }}
              className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors text-sm flex items-center gap-2"
            >
              <FaTimes className="text-white" /> Descartar
            </button>
          </div>
        </div>
      </div>

      {/* Email Body Preview */}
      {expanded && primaryEmail.body_text && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">
            {primaryEmail.body_text}
          </p>
          {primaryEmail.body_text.length > 500 && (
            <button className="text-xs text-blue-600 hover:text-blue-800 font-semibold mt-2">
              Ver completo →
            </button>
          )}
        </div>
      )}

      {/* Multiple Emails in Group */}
      {emails.length > 1 && expanded && (
        <div className="p-4 border-t border-gray-200 bg-white">
          <p className="text-sm font-bold text-gray-700 mb-2">
            Emails agrupados ({emails.length}):
          </p>
          <div className="space-y-2">
            {emails.slice(1).map((email, idx) => (
              <div key={email.id} className="text-sm text-gray-600 border-l-2 border-blue-400 pl-3">
                {email.subject || 'Sin asunto'} - {format(new Date(email.received_at), 'PPp', { locale: es })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// ASSIGNMENT MODAL
// =====================================================

function AssignmentModal({
  email,
  onClose,
  onSuccess,
}: {
  email: UnclassifiedEmail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [assignmentType, setAssignmentType] = useState<'existing' | 'new'>('new');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [formData, setFormData] = useState({
    ramo_code: '',
    aseguradora_code: '',
    tramite_code: '',
    broker_id: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (assignmentType === 'new') {
      // TODO: Crear nuevo caso desde email
      toast.success('Caso creado y email asignado');
    } else {
      // TODO: Asignar a caso existente
      toast.success('Email asignado al caso existente');
    }
    
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl my-8">
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-2xl">
          <h3 className="text-xl font-bold">Asignar Email a Caso</h3>
          <p className="text-sm text-blue-100 mt-1">De: {email.from_email}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Email Preview */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm font-bold text-gray-700 mb-2">
              {email.subject || 'Sin asunto'}
            </p>
            <p className="text-sm text-gray-600 line-clamp-4">
              {email.body_text || 'Sin contenido'}
            </p>
          </div>

          {/* Assignment Type */}
          <div className="bg-blue-50 rounded-lg p-4">
            <label className="block text-sm font-bold text-gray-700 mb-3">
              Tipo de asignación
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="assignmentType"
                  value="new"
                  checked={assignmentType === 'new'}
                  onChange={(e) => setAssignmentType(e.target.value as 'existing' | 'new')}
                  className="w-4 h-4"
                />
                <span className="font-semibold">Crear nuevo caso</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="assignmentType"
                  value="existing"
                  checked={assignmentType === 'existing'}
                  onChange={(e) => setAssignmentType(e.target.value as 'existing' | 'new')}
                  className="w-4 h-4"
                />
                <span className="font-semibold">Asignar a caso existente</span>
              </label>
            </div>
          </div>

          {/* New Case Form */}
          {assignmentType === 'new' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Ramo
                  </label>
                  <select
                    value={formData.ramo_code}
                    onChange={(e) => setFormData({ ...formData, ramo_code: e.target.value })}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-[#8AAA19] focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option value="01">01 - Autos</option>
                    <option value="02">02 - Incendio</option>
                    <option value="03">03 - Vida</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Aseguradora
                  </label>
                  <select
                    value={formData.aseguradora_code}
                    onChange={(e) => setFormData({ ...formData, aseguradora_code: e.target.value })}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-[#8AAA19] focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option value="01">01 - ASSA</option>
                    <option value="02">02 - SURA</option>
                    <option value="03">03 - ANCON</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Trámite
                  </label>
                  <select
                    value={formData.tramite_code}
                    onChange={(e) => setFormData({ ...formData, tramite_code: e.target.value })}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:border-[#8AAA19] focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option value="1">1 - Emisión</option>
                    <option value="2">2 - Renovación</option>
                    <option value="3">3 - Siniestro</option>
                  </select>
                </div>
              </div>

              {formData.ramo_code && formData.aseguradora_code && formData.tramite_code && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-bold text-green-900">
                    Preview de ticket que se generará:
                  </p>
                  <p className="text-lg font-mono font-bold text-green-700 mt-1">
                    2601{formData.ramo_code}{formData.aseguradora_code}{formData.tramite_code.padStart(2, '0')}001
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Existing Case Selection */}
          {assignmentType === 'existing' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Buscar caso existente
              </label>
              <input
                type="text"
                placeholder="Buscar por ticket, cliente o póliza..."
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                Escribe para buscar casos existentes
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-[#010139] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#020270] transition-colors"
            >
              Asignar Email
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
