/**
 * PÁGINA DE PRUEBAS DE CORREOS
 * =============================
 * Permite probar todos los tipos de correos del sistema
 * Solo accesible para usuarios Master
 */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FaEnvelope, FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa';

interface EmailTest {
  template: string;
  name: string;
  description: string;
  category: string;
  fromType: 'PORTAL' | 'TRAMITES';
}

const EMAIL_TESTS: EmailTest[] = [
  // RENOVACIONES
  {
    template: 'renewalReminder',
    name: 'Recordatorio de Renovación',
    description: 'Correo automático que se envía a brokers sobre pólizas próximas a vencer',
    category: 'Renovaciones',
    fromType: 'PORTAL',
  },
  {
    template: 'renewalConfirm',
    name: 'Confirmación de Renovación',
    description: 'Correo al master para confirmar una renovación reportada',
    category: 'Renovaciones',
    fromType: 'PORTAL',
  },
  
  // CUMPLEAÑOS
  {
    template: 'birthdayClient',
    name: 'Cumpleaños de Cliente',
    description: 'Recordatorio al broker del cumpleaños de su cliente',
    category: 'Cumpleaños',
    fromType: 'PORTAL',
  },
  {
    template: 'birthdayBroker',
    name: 'Cumpleaños de Broker',
    description: 'Felicitación al broker en su cumpleaños',
    category: 'Cumpleaños',
    fromType: 'PORTAL',
  },
  
  // COMISIONES
  {
    template: 'commissionPaid',
    name: 'Comisión Pagada',
    description: 'Notificación al broker de pago de comisión quincenal',
    category: 'Comisiones',
    fromType: 'PORTAL',
  },
  {
    template: 'commissionAdjustmentPaid',
    name: 'Ajuste de Comisión',
    description: 'Notificación de ajuste manual de comisión',
    category: 'Comisiones',
    fromType: 'PORTAL',
  },
  
  // PRELIMINAR Y MOROSIDAD
  {
    template: 'preliminarIncomplete',
    name: 'Cliente Preliminar Incompleto',
    description: 'Alerta al broker sobre cliente con datos incompletos',
    category: 'Base de Datos',
    fromType: 'PORTAL',
  },
  {
    template: 'morosidadImported',
    name: 'Morosidad Importada',
    description: 'Notificación al broker sobre reporte de morosidad importado',
    category: 'Base de Datos',
    fromType: 'PORTAL',
  },
  
  // PENDIENTES
  {
    template: 'pendienteCreated',
    name: 'Trámite Creado',
    description: 'Confirmación al broker de nuevo trámite creado',
    category: 'Trámites',
    fromType: 'TRAMITES',
  },
  {
    template: 'pendienteUpdated',
    name: 'Trámite Actualizado',
    description: 'Notificación de actualización en estado del trámite',
    category: 'Trámites',
    fromType: 'TRAMITES',
  },
  {
    template: 'pendienteClosedApproved',
    name: 'Trámite Aprobado',
    description: 'Notificación de trámite cerrado exitosamente',
    category: 'Trámites',
    fromType: 'TRAMITES',
  },
  {
    template: 'pendienteClosedRejected',
    name: 'Trámite Rechazado',
    description: 'Notificación de trámite rechazado',
    category: 'Trámites',
    fromType: 'TRAMITES',
  },
  {
    template: 'pendienteAplazado',
    name: 'Trámite Aplazado',
    description: 'Notificación de trámite aplazado temporalmente',
    category: 'Trámites',
    fromType: 'TRAMITES',
  },
  {
    template: 'pendientesDailyDigest',
    name: 'Resumen Diario de Trámites',
    description: 'Resumen diario de todos los trámites pendientes (Cron Job)',
    category: 'Trámites',
    fromType: 'TRAMITES',
  },
  
  // AGENDA
  {
    template: 'agendaCreated',
    name: 'Evento Creado',
    description: 'Notificación de nuevo evento en agenda',
    category: 'Agenda',
    fromType: 'PORTAL',
  },
  {
    template: 'agendaUpdated',
    name: 'Evento Actualizado',
    description: 'Notificación de cambios en evento existente',
    category: 'Agenda',
    fromType: 'PORTAL',
  },
  {
    template: 'agendaDeleted',
    name: 'Evento Cancelado',
    description: 'Notificación de evento cancelado',
    category: 'Agenda',
    fromType: 'PORTAL',
  },
  {
    template: 'agendaReminder',
    name: 'Recordatorio de Evento',
    description: 'Recordatorio 1 día antes del evento (Cron Job)',
    category: 'Agenda',
    fromType: 'PORTAL',
  },
];

export default function CorreosPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<any>(null);
  const [checkingSMTP, setCheckingSMTP] = useState(false);

  // Verificar estado SMTP
  const checkSMTPStatus = async () => {
    setCheckingSMTP(true);
    try {
      const response = await fetch('/api/test-emails');
      const data = await response.json();
      setSmtpStatus(data);
      
      if (data.success) {
        toast.success('Estado SMTP verificado');
      } else {
        toast.error('Error verificando SMTP');
      }
    } catch (error) {
      console.error('Error checking SMTP:', error);
      toast.error('Error al verificar estado SMTP');
    } finally {
      setCheckingSMTP(false);
    }
  };

  // Enviar correo de prueba
  const sendTestEmail = async (test: EmailTest) => {
    setLoading(test.template);
    
    try {
      const response = await fetch('/api/test-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: test.template,
          fromType: test.fromType,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`✓ Correo enviado: ${test.name}`, {
          description: `Revisa javiersamudio@lideresenseguros.com`,
        });
      } else {
        toast.error(`✗ Error: ${test.name}`, {
          description: data.error || 'Error desconocido',
        });
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error(`✗ Error enviando: ${test.name}`, {
        description: error.message,
      });
    } finally {
      setLoading(null);
    }
  };

  // Agrupar por categoría
  const categories = Array.from(new Set(EMAIL_TESTS.map(t => t.category)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#010139] flex items-center gap-3">
                <FaEnvelope className="text-[#8AAA19]" />
                Pruebas de Correos
              </h1>
              <p className="text-gray-600 mt-2">
                Prueba todos los correos automáticos del portal. Todos se enviarán a{' '}
                <span className="font-semibold text-[#010139]">javiersamudio@lideresenseguros.com</span>
              </p>
            </div>
            
            <button
              onClick={checkSMTPStatus}
              disabled={checkingSMTP}
              className="flex items-center gap-2 px-6 py-3 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all disabled:opacity-50"
            >
              {checkingSMTP ? (
                <>
                  <FaSpinner className="animate-spin text-white" />
                  Verificando...
                </>
              ) : (
                <>
                  <FaCheckCircle className="text-white" />
                  Verificar Estado SMTP
                </>
              )}
            </button>
          </div>
          
          {/* SMTP Status */}
          {smtpStatus && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">Estado de Conexión SMTP:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Portal:</span>
                  {smtpStatus.smtp?.portal === 'connected' ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <FaCheckCircle className="text-green-600" /> Conectado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600">
                      <FaTimesCircle className="text-red-600" /> Desconectado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Trámites:</span>
                  {smtpStatus.smtp?.tramites === 'connected' ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <FaCheckCircle className="text-green-600" /> Conectado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600">
                      <FaTimesCircle className="text-red-600" /> Desconectado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Host:</span>
                  <span className="text-gray-800">{smtpStatus.host}:{smtpStatus.port}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Categorías de Correos */}
        {categories.map(category => {
          const testsInCategory = EMAIL_TESTS.filter(t => t.category === category);
          
          return (
            <div key={category} className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-[#010139] mb-4 pb-3 border-b-2 border-gray-200">
                {category}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {testsInCategory.map(test => (
                  <div
                    key={test.template}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#8AAA19] transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-[#010139] text-sm">
                        {test.name}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        test.fromType === 'PORTAL'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {test.fromType}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-4 line-clamp-2">
                      {test.description}
                    </p>
                    
                    <button
                      onClick={() => sendTestEmail(test)}
                      disabled={loading !== null}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#7a9916] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading === test.template ? (
                        <>
                          <FaSpinner className="animate-spin text-white" />
                          <span className="text-sm">Enviando...</span>
                        </>
                      ) : (
                        <>
                          <FaEnvelope className="text-white" />
                          <span className="text-sm">Enviar Prueba</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Info Footer */}
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6">
          <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
            ℹ️ Información Importante
          </h3>
          <ul className="text-sm text-yellow-800 space-y-2">
            <li>• Todos los correos se envían con datos ficticios de prueba</li>
            <li>• El destinatario siempre será: javiersamudio@lideresenseguros.com</li>
            <li>• Los correos marcados como "(Cron Job)" normalmente se envían automáticamente</li>
            <li>• Revisa los logs del terminal para debugging detallado de SMTP</li>
            <li>• Si un correo falla, verifica la configuración SMTP en las variables de entorno</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
