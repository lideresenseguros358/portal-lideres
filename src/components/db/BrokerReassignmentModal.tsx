'use client';

import { useState } from 'react';
import { FaTimes, FaExclamationTriangle, FaArrowRight, FaCalendarAlt, FaDollarSign } from 'react-icons/fa';

interface CommissionByFortnight {
  fortnight_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  total_commission: number;
  items: Array<{
    id: string;
    policy_number: string;
    gross_amount: number;
    broker_commission: number;
  }>;
}

interface BrokerReassignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (makeAdjustments: boolean) => void;
  clientName: string;
  oldBrokerName: string;
  newBrokerName: string;
  totalAmount: number;
  commissionsByFortnight: CommissionByFortnight[];
  loading?: boolean;
}

export default function BrokerReassignmentModal({
  isOpen,
  onClose,
  onConfirm,
  clientName,
  oldBrokerName,
  newBrokerName,
  totalAmount,
  commissionsByFortnight,
  loading = false
}: BrokerReassignmentModalProps) {
  const [makeAdjustments, setMakeAdjustments] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-PA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-4 sm:my-8 shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-4 sm:p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <FaExclamationTriangle className="text-3xl flex-shrink-0" />
            <div>
              <h2 className="text-lg sm:text-2xl font-bold">
                Reasignación de Corredor
              </h2>
              <p className="text-white/90 text-xs sm:text-sm mt-1">
                Cliente con comisiones pagadas
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white hover:text-gray-200 transition ml-2 flex-shrink-0"
            disabled={loading}
          >
            <FaTimes size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Cliente */}
          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              👤 Cliente
            </h3>
            <p className="text-blue-800 text-lg font-semibold">{clientName}</p>
          </div>

          {/* Cambio de Corredor */}
          <div className="mb-6 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              👔 Cambio de Corredor
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <p className="text-xs text-gray-600 mb-1">Corredor Actual</p>
                <p className="font-semibold text-gray-900">{oldBrokerName}</p>
              </div>
              <FaArrowRight className="text-[#8AAA19] text-2xl flex-shrink-0" />
              <div className="flex-1 min-w-[120px]">
                <p className="text-xs text-gray-600 mb-1">Nuevo Corredor</p>
                <p className="font-semibold text-[#8AAA19]">{newBrokerName}</p>
              </div>
            </div>
          </div>

          {/* Resumen de Comisiones */}
          <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
            <h3 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
              <FaDollarSign /> Comisiones Pagadas al Corredor Actual
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-yellow-700 mb-1">Total Comisionado</p>
                <p className="text-2xl font-bold text-yellow-900">{formatCurrency(totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-yellow-700 mb-1">Quincenas Afectadas</p>
                <p className="text-2xl font-bold text-yellow-900">{commissionsByFortnight.length}</p>
              </div>
            </div>

            {/* Toggle Detalles */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-yellow-800 hover:text-yellow-900 font-semibold underline flex items-center gap-1"
            >
              {showDetails ? '▼ Ocultar' : '▶ Ver'} desglose por quincena
            </button>

            {/* Desglose por Quincena */}
            {showDetails && (
              <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
                {commissionsByFortnight.map((fortnight) => (
                  <div 
                    key={fortnight.fortnight_id}
                    className="bg-white p-3 rounded-lg border border-yellow-300"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FaCalendarAlt className="text-yellow-600 text-sm" />
                          <span className="font-semibold text-gray-900">
                            {fortnight.period_label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          {formatDate(fortnight.period_start)} - {formatDate(fortnight.period_end)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-yellow-900">
                          {formatCurrency(fortnight.total_commission)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {fortnight.items.length} póliza(s)
                        </p>
                      </div>
                    </div>
                    
                    {/* Pólizas de esta quincena */}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      {fortnight.items.map((item) => (
                        <div 
                          key={item.id}
                          className="flex justify-between items-center text-xs py-1"
                        >
                          <span className="text-gray-700 font-mono">
                            {item.policy_number}
                          </span>
                          <span className="text-gray-900 font-semibold">
                            {formatCurrency(item.broker_commission)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Opción de Ajustes Retroactivos */}
          <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={makeAdjustments}
                onChange={(e) => setMakeAdjustments(e.target.checked)}
                className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                disabled={loading}
              />
              <div className="flex-1">
                <p className="font-bold text-purple-900 mb-1">
                  ✅ Realizar ajustes retroactivos de comisiones
                </p>
                <p className="text-sm text-purple-700 mb-2">
                  Al activar esta opción, el sistema realizará los siguientes ajustes:
                </p>
                <ul className="text-xs text-purple-600 space-y-1 ml-4 list-disc">
                  <li>
                    Se creará un <strong>adelanto (deuda)</strong> al corredor actual por {formatCurrency(totalAmount)}
                  </li>
                  <li>
                    Se crearán <strong>reportes de ajuste</strong> para el nuevo corredor con las comisiones que le corresponden
                  </li>
                  <li>
                    Los ajustes quedarán <strong>pendientes de aprobación</strong> por Master
                  </li>
                  <li>
                    Se actualizará el corredor en el cliente y todas sus pólizas
                  </li>
                </ul>
                <p className="text-xs text-purple-600 mt-2 italic">
                  Si no activas esta opción, solo se cambiará el corredor asignado sin realizar ajustes retroactivos.
                </p>
              </div>
            </label>
          </div>

          {/* Advertencia Final */}
          <div className="p-3 bg-orange-50 border border-orange-300 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>⚠️ Importante:</strong> Esta acción no se puede deshacer automáticamente. 
              Los ajustes de comisiones deberán ser aprobados manualmente en la sección de Ajustes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t bg-gray-50 rounded-b-2xl flex-shrink-0">
          <div className="flex gap-3 flex-col sm:flex-row">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(makeAdjustments)}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Procesando...
                </span>
              ) : (
                `Confirmar ${makeAdjustments ? 'con Ajustes' : 'sin Ajustes'}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
