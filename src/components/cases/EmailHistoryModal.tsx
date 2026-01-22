'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaEnvelope, FaPaperclip, FaDownload, FaInbox, FaPaperPlane, FaClock } from 'react-icons/fa';
import { toast } from 'sonner';

interface EmailHistoryModalProps {
  caseId: string;
  onClose: () => void;
}

interface EmailData {
  id: string;
  subject: string;
  from: string;
  to: string;
  received_at: string;
  body_text: string;
  body_html: string | null;
  attachments: any[];
  direction: 'INBOUND' | 'OUTBOUND' | 'SYSTEM';
  message_id: string;
  thread_id: string | null;
}

export default function EmailHistoryModal({ caseId, onClose }: EmailHistoryModalProps) {
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);

  useEffect(() => {
    loadEmails();
  }, [caseId]);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pendientes/casos/${caseId}/emails`);
      const result = await response.json();
      
      if (result.ok) {
        setEmails(result.data || []);
      } else {
        toast.error('Error al cargar correos');
      }
    } catch (error) {
      console.error('Error loading emails:', error);
      toast.error('Error al cargar correos');
    } finally {
      setLoading(false);
    }
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'INBOUND':
        return <FaInbox className="text-blue-600" />;
      case 'OUTBOUND':
        return <FaPaperPlane className="text-green-600" />;
      case 'SYSTEM':
        return <FaEnvelope className="text-gray-600" />;
      default:
        return <FaEnvelope className="text-gray-600" />;
    }
  };

  const getDirectionLabel = (direction: string) => {
    switch (direction) {
      case 'INBOUND':
        return 'Entrante (IMAP)';
      case 'OUTBOUND':
        return 'Saliente (SMTP)';
      case 'SYSTEM':
        return 'Sistema';
      default:
        return 'Desconocido';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-PA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col my-4 sm:my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <FaEnvelope className="text-2xl" />
            <h3 className="text-lg font-bold">Historial de Correos</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-12">
              <FaEnvelope className="mx-auto text-6xl text-gray-300 mb-4" />
              <h4 className="text-xl font-bold text-gray-600 mb-2">No hay correos</h4>
              <p className="text-gray-500">Este caso no tiene correos asociados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Lista de correos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Lista cronológica */}
                <div className="space-y-3">
                  <h4 className="text-lg font-bold text-[#010139] mb-3">
                    Correos ({emails.length})
                  </h4>
                  
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedEmail?.id === email.id
                          ? 'border-[#8AAA19] bg-green-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {/* Direction y fecha */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getDirectionIcon(email.direction)}
                          <span className="text-xs font-semibold text-gray-600">
                            {getDirectionLabel(email.direction)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <FaClock />
                          {formatDate(email.received_at)}
                        </div>
                      </div>

                      {/* Remitente */}
                      <p className="text-sm font-semibold text-[#010139] mb-1 truncate">
                        De: {email.from}
                      </p>

                      {/* Subject (no repetir si es el mismo del ticket) */}
                      <p className="text-sm text-gray-700 truncate mb-2">
                        {email.subject}
                      </p>

                      {/* Adjuntos */}
                      {email.attachments && email.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <FaPaperclip />
                          <span>{email.attachments.length} adjunto(s)</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Detalle del correo seleccionado */}
                <div className="sticky top-0">
                  {selectedEmail ? (
                    <div className="bg-gray-50 rounded-lg border-2 border-gray-200 p-6">
                      <div className="mb-4 pb-4 border-b border-gray-300">
                        <div className="flex items-center gap-2 mb-3">
                          {getDirectionIcon(selectedEmail.direction)}
                          <h5 className="font-bold text-[#010139]">
                            {getDirectionLabel(selectedEmail.direction)}
                          </h5>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="font-semibold">De:</span> {selectedEmail.from}
                          </p>
                          <p>
                            <span className="font-semibold">Para:</span> {selectedEmail.to}
                          </p>
                          <p>
                            <span className="font-semibold">Fecha:</span>{' '}
                            {formatDate(selectedEmail.received_at)}
                          </p>
                          <p>
                            <span className="font-semibold">Asunto:</span> {selectedEmail.subject}
                          </p>
                        </div>
                      </div>

                      {/* Contenido del correo */}
                      <div className="mb-4">
                        <h6 className="font-semibold text-gray-700 mb-2">Contenido:</h6>
                        <div className="bg-white rounded p-4 border border-gray-200 max-h-64 overflow-y-auto">
                          {selectedEmail.body_html ? (
                            <div
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                              {selectedEmail.body_text}
                            </pre>
                          )}
                        </div>
                      </div>

                      {/* Adjuntos */}
                      {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                        <div>
                          <h6 className="font-semibold text-gray-700 mb-2">
                            Adjuntos ({selectedEmail.attachments.length}):
                          </h6>
                          <div className="space-y-2">
                            {selectedEmail.attachments.map((attachment: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                              >
                                <div className="flex items-center gap-2">
                                  <FaPaperclip className="text-gray-500" />
                                  <span className="text-sm font-medium text-gray-700">
                                    {attachment.filename}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    ({(attachment.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    // TODO: Implementar descarga
                                    toast.info('Descarga en desarrollo');
                                  }}
                                  className="p-2 text-[#8AAA19] hover:bg-green-50 rounded transition-all"
                                  title="Descargar"
                                >
                                  <FaDownload />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg border-2 border-gray-200 p-12 text-center">
                      <FaEnvelope className="mx-auto text-4xl text-gray-300 mb-3" />
                      <p className="text-gray-500">
                        Selecciona un correo para ver su contenido
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
