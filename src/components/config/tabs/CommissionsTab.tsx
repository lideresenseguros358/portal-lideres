'use client';

import { useState, useEffect } from 'react';
import { FaFileCsv, FaBell, FaClock } from 'react-icons/fa';
import { toast } from 'sonner';

interface CommissionsTabProps {
  userId: string;
}

export default function CommissionsTab({ userId }: CommissionsTabProps) {
  const [csvColumns, setCsvColumns] = useState<string[]>([
    'Nombre',
    'Cédula',
    'Banco',
    'Tipo Cuenta',
    'Número Cuenta',
    'Monto',
  ]);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [pendingDays, setPendingDays] = useState(90); // Días para caducidad
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/config/commission-csv');
      if (response.ok) {
        const data = await response.json();
        if (data.columns) setCsvColumns(data.columns);
        if (data.send_notifications !== undefined) setSendNotifications(data.send_notifications);
        if (data.pending_days) setPendingDays(data.pending_days);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/config/commission-csv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: csvColumns,
          send_notifications: sendNotifications,
          pending_days: pendingDays,
        }),
      });

      if (response.ok) {
        toast.success('Configuración guardada exitosamente');
        setHasChanges(false);
      } else {
        toast.error('Error al guardar configuración');
      }
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const markAsChanged = () => {
    if (!hasChanges) setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CSV Editor */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaFileCsv className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Editor de CSV Banco</h2>
            <p className="text-sm text-gray-600">Configura las columnas del archivo CSV para el banco</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {csvColumns.map((column, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-[#010139] text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <input
                  type="text"
                  value={column}
                  onChange={(e) => {
                    const newColumns = [...csvColumns];
                    newColumns[index] = e.target.value;
                    setCsvColumns(newColumns);
                    markAsChanged();
                  }}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                />
                <button
                  onClick={() => {
                    setCsvColumns(csvColumns.filter((_, i) => i !== index));
                    markAsChanged();
                  }}
                  className="text-red-600 hover:text-red-800 font-bold text-xl"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setCsvColumns([...csvColumns, 'Nueva Columna'])}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#8AAA19] hover:text-[#8AAA19] transition-colors font-semibold"
          >
            + Agregar Columna
          </button>
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-semibold text-gray-700 mb-2">Vista Previa CSV:</p>
          <p className="text-xs font-mono text-gray-600">
            {csvColumns.join(' | ')}
          </p>
        </div>
      </div>

      {/* Notifications Toggle */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaBell className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Cierre de Quincena</h2>
            <p className="text-sm text-gray-600">Configuración de notificaciones</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-semibold text-gray-800">Enviar Notificaciones al Cerrar</p>
            <p className="text-sm text-gray-600">Notificar a brokers cuando se cierre la quincena</p>
          </div>
          <button
            onClick={() => {
              setSendNotifications(!sendNotifications);
              markAsChanged();
            }}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              sendNotifications ? 'bg-[#8AAA19]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                sendNotifications ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Para pruebas:</strong> Puedes desactivar las notificaciones temporalmente
          </p>
        </div>
      </div>

      {/* Pending Unidentified */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaClock className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Pendientes Sin Identificar</h2>
            <p className="text-sm text-gray-600">Parámetros de agrupación y caducidad</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-2">Agrupación</p>
            <p className="text-gray-600">Por número de póliza (policy_number)</p>
            <p className="text-xs text-gray-500 mt-1">No configurable - Estándar del sistema</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-3">Caducidad Automática</p>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="1"
                max="365"
                value={pendingDays}
                onChange={(e) => {
                  setPendingDays(parseInt(e.target.value) || 90);
                  markAsChanged();
                }}
                className="w-24 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-semibold text-center"
              />
              <span className="text-gray-600">días sin identificar → Asignación automática a Oficina</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Después de este período, los pendientes se asignan automáticamente a la Oficina
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 bg-white rounded-2xl shadow-2xl p-4 border-2 border-[#8AAA19] animate-[slideUp_0.3s_ease-out]">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <FaClock />
                <span>Guardar Configuración de Comisiones</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
