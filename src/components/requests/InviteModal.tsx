'use client';

import { useState } from 'react';
import { FaEnvelope, FaTimes, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'sonner';

interface InviteModalProps {
  onClose: () => void;
}

export default function InviteModal({ onClose }: InviteModalProps) {
  const [emailsInput, setEmailsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const splitEmails = (input: string) => {
    return input
      .split(/[\s,;]+/)
      .map(email => email.trim())
      .filter(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emails = splitEmails(emailsInput);

    if (emails.length === 0) {
      toast.error('Ingresa al menos un email');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      });

      const data = await res.json();

      if (data.success) {
        setResults(data);
        toast.success(`${data.invited} invitación(es) enviada(s)`);
        
        if (data.failed > 0) {
          toast.warning(`${data.failed} invitación(es) fallaron`);
        }

        // Limpiar input después de 3 segundos
        setTimeout(() => {
          setEmailsInput('');
          setResults(null);
        }, 3000);
      } else {
        toast.error(data.error || 'Error al enviar invitaciones');
      }
    } catch (error) {
      console.error('Error sending invites:', error);
      toast.error('Error al enviar invitaciones');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">
              <FaEnvelope className="inline mr-2" />
              Invitar Usuarios
            </h2>
            <p className="standard-modal-subtitle">Enviar invitaciones por correo electrónico</p>
          </div>
          <button onClick={onClose} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <form id="invite-form" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#010139] mb-2">
                Correos Electrónicos *
              </label>
              <textarea
                value={emailsInput}
                onChange={(e) => setEmailsInput(e.target.value)}
                placeholder="correo1@dominio.com, correo2@dominio.com
O separa por líneas:
correo3@dominio.com
correo4@dominio.com"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-mono text-sm min-h-[150px]"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Separa múltiples correos con coma, punto y coma, espacios o líneas
              </p>
            </div>

            {/* Preview de emails */}
            {emailsInput && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Emails detectados: {splitEmails(emailsInput).length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {splitEmails(emailsInput).map((email, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-[#8AAA19] text-white rounded-full text-xs font-semibold"
                    >
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Resultados */}
            {results && (
              <div className="space-y-3">
                {/* Exitosos */}
                {results.results && results.results.length > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <FaCheckCircle />
                      Invitaciones Enviadas ({results.results.length})
                    </p>
                    <div className="space-y-1">
                      {results.results.map((r: any, idx: number) => (
                        <p key={idx} className="text-sm text-green-700">
                          ✓ {r.email}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallidos */}
                {results.errors && results.errors.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                      <FaTimesCircle />
                      Errores ({results.errors.length})
                    </p>
                    <div className="space-y-1">
                      {results.errors.map((err: any, idx: number) => (
                        <p key={idx} className="text-sm text-red-700">
                          ✗ {err.email}: {err.error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Los usuarios invitados recibirán un email con un link para configurar su contraseña y completar su perfil.
              </p>
            </div>
          </div>

          </form>
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="standard-modal-button-secondary"
            >
              Cerrar
            </button>
            <button
              type="submit"
              form="invite-form"
              disabled={loading || !emailsInput.trim()}
              className="standard-modal-button-primary"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <FaEnvelope className="mr-2" />
                  <span>Enviar Invitaciones</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
