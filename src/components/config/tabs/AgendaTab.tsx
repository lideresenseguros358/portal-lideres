'use client';

import { useState } from 'react';
import { FaCalendarAlt, FaBell, FaSync, FaUsers, FaCalendarPlus } from 'react-icons/fa';

interface AgendaTabProps {
  userId: string;
}

const RECURRING_TEMPLATES = [
  { name: 'Junta de Agencia', frequency: 'Mensual', description: 'Primera semana de cada mes' },
  { name: 'Curso RG', frequency: 'Trimestral', description: 'Curso de regulaciones generales' },
  { name: 'Curso Novatos L-V × 3 semanas', frequency: 'Bajo demanda', description: 'Programa intensivo de inducción' },
  { name: 'Convivio LISSA', frequency: 'Semestral', description: 'Evento de integración' },
  { name: 'Días Libres', frequency: 'Variable', description: 'Feriados y días no laborables' },
];

export default function AgendaTab({ userId }: AgendaTabProps) {
  const [reminder24h, setReminder24h] = useState(true);
  const [reminder1h, setReminder1h] = useState(true);
  const [icsEnabled, setIcsEnabled] = useState(true);
  const [multiDateEnabled, setMultiDateEnabled] = useState(true);

  return (
    <div className="space-y-6">
      {/* Reminders */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaBell className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Recordatorios por Defecto</h2>
            <p className="text-sm text-gray-600">Notificaciones automáticas de eventos</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-800">24 horas antes</p>
              <p className="text-sm text-gray-600">Recordatorio un día antes del evento</p>
            </div>
            <button
              onClick={() => setReminder24h(!reminder24h)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                reminder24h ? 'bg-[#8AAA19]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  reminder24h ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-semibold text-gray-800">1 hora antes</p>
              <p className="text-sm text-gray-600">Recordatorio inmediato antes del evento</p>
            </div>
            <button
              onClick={() => setReminder1h(!reminder1h)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                reminder1h ? 'bg-[#8AAA19]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  reminder1h ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Los recordatorios se envían automáticamente a todos los asistentes confirmados
          </p>
        </div>
      </div>

      {/* Recurring Templates */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaSync className="text-[#8AAA19] text-2xl" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#010139]">Plantillas Recurrentes</h2>
            <p className="text-sm text-gray-600">Eventos predefinidos para uso frecuente</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm">
            <FaCalendarPlus />
            <span>Nueva Plantilla</span>
          </button>
        </div>

        <div className="space-y-3">
          {RECURRING_TEMPLATES.map((template, index) => (
            <div
              key={index}
              className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <FaCalendarAlt className="text-[#8AAA19]" />
                  <h3 className="font-semibold text-gray-800">{template.name}</h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    {template.frequency}
                  </span>
                </div>
                <p className="text-sm text-gray-600 ml-8">{template.description}</p>
              </div>
              <button className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-semibold">
                Usar
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Audience Segmentation */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaUsers className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Segmentación de Audiencia</h2>
            <p className="text-sm text-gray-600">Control de visibilidad de eventos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <FaUsers className="text-green-600 text-xl mt-1" />
              <div>
                <p className="font-semibold text-green-900 mb-1">Todos los Brokers</p>
                <p className="text-sm text-green-700">
                  El evento es visible para todos los corredores
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <FaUsers className="text-blue-600 text-xl mt-1" />
              <div>
                <p className="font-semibold text-blue-900 mb-1">Audiencia Seleccionada</p>
                <p className="text-sm text-blue-700">
                  Solo visible para brokers específicos
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Date Creation */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaCalendarPlus className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Creación Multi-Fecha</h2>
            <p className="text-sm text-gray-600">Eventos en múltiples fechas</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
          <div>
            <p className="font-semibold text-purple-900">Habilitar Multi-Fecha</p>
            <p className="text-sm text-purple-700">
              Permite crear N eventos independientes en diferentes fechas
            </p>
          </div>
          <button
            onClick={() => setMultiDateEnabled(!multiDateEnabled)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              multiDateEnabled ? 'bg-[#8AAA19]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                multiDateEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Ejemplo:</strong> Crear "Curso Novatos" para los días 10, 12, 14, 17, 19, 21 de febrero genera 6 eventos independientes
          </p>
        </div>
      </div>

      {/* ICS Export */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaCalendarAlt className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Exportación ICS</h2>
            <p className="text-sm text-gray-600">Integración con calendarios externos</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-semibold text-gray-800">ICS Habilitado</p>
            <p className="text-sm text-gray-600">
              Permite descargar eventos en formato iCalendar (.ics)
            </p>
          </div>
          <button
            onClick={() => setIcsEnabled(!icsEnabled)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              icsEnabled ? 'bg-[#8AAA19]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                icsEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Los brokers pueden añadir eventos a sus calendarios personales (Google Calendar, Outlook, Apple Calendar, etc.)
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-[#010139] to-[#020270] rounded-2xl shadow-lg p-6 text-white">
        <h3 className="text-xl font-bold mb-4">✅ Features Implementadas</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#8AAA19] rounded-full"></span>
            <span>Recordatorios automáticos (24h y 1h)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#8AAA19] rounded-full"></span>
            <span>Plantillas recurrentes predefinidas</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#8AAA19] rounded-full"></span>
            <span>Segmentación por brokers (audiencia seleccionada)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#8AAA19] rounded-full"></span>
            <span>Creación multi-fecha (N eventos independientes)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#8AAA19] rounded-full"></span>
            <span>Exportación ICS activada</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
