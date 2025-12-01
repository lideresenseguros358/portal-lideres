'use client';

import { FaTimes, FaExclamationTriangle, FaFileAlt, FaDatabase } from 'react-icons/fa';

interface UnpaidReferenceModalProps {
  payment: {
    client_name: string;
    amount: number;
  };
  references: string[];
  action: 'paid' | 'pdf';
  onClose: () => void;
  onEditPayment?: () => void;
}

export default function UnpaidReferenceModal({ 
  payment, 
  references, 
  action,
  onClose,
  onEditPayment 
}: UnpaidReferenceModalProps) {
  const actionText = action === 'paid' ? 'marcar como pagado' : 'generar PDF';
  const actionIcon = action === 'paid' ? '💰' : '📄';

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">
              <FaExclamationTriangle className="inline mr-2" />
              No se puede {action === 'paid' ? 'pagar' : 'generar PDF'}
            </h2>
            <p className="text-white/90 text-sm mt-1">Referencia no conciliada en historial banco</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <div className="space-y-6">
          {/* Pago info */}
          <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FaFileAlt className="text-[#010139]" />
              Información del Pago
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cliente:</span>
                <span className="font-semibold text-gray-900">{payment.client_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Monto:</span>
                <span className="font-bold text-[#010139] text-lg">${payment.amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Referencias no conciliadas */}
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <FaDatabase className="text-red-600" />
              {references.length === 1 ? 'Referencia no encontrada' : 'Referencias no encontradas'}
            </h3>
            <div className="space-y-2">
              {references.map((ref, index) => (
                <div 
                  key={index} 
                  className="bg-white border-2 border-red-300 rounded-lg px-4 py-3 font-mono text-sm text-gray-800 font-semibold shadow-sm"
                >
                  {ref}
                </div>
              ))}
            </div>
            <p className="text-xs text-red-700 mt-3">
              {references.length === 1 ? 'Esta referencia' : 'Estas referencias'} no {references.length === 1 ? 'existe' : 'existen'} en el historial del banco.
            </p>
          </div>

          {/* Explicación */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-3">
              {actionIcon} ¿Por qué no puedo {actionText}?
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              El sistema necesita verificar que las transferencias bancarias realmente existen antes de {action === 'paid' ? 'marcar el pago como completado' : 'generar el comprobante PDF'}. 
              Esto garantiza la integridad financiera y evita errores.
            </p>
          </div>

          {/* Soluciones */}
          <div className="bg-gradient-to-br from-[#010139] to-[#020270] text-white rounded-xl p-5">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              💡 Soluciones
            </h3>
            <div className="space-y-4">
              <div className="bg-white/10 rounded-lg p-4 hover:bg-white/20 transition">
                <div className="flex items-start gap-3">
                  <div className="bg-[#8AAA19] rounded-full p-2 flex-shrink-0 mt-0.5">
                    <span className="text-white font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Verificar número de referencia</h4>
                    <p className="text-sm text-white/80">
                      Confirma que el número ingresado sea correcto. Puede haber un error de digitación.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 rounded-lg p-4 hover:bg-white/20 transition">
                <div className="flex items-start gap-3">
                  <div className="bg-[#8AAA19] rounded-full p-2 flex-shrink-0 mt-0.5">
                    <span className="text-white font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Actualizar historial del banco</h4>
                    <p className="text-sm text-white/80">
                      Importa el Excel más reciente del Banco General. La conciliación es automática.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 rounded-lg p-4 hover:bg-white/20 transition">
                <div className="flex items-start gap-3">
                  <div className="bg-[#8AAA19] rounded-full p-2 flex-shrink-0 mt-0.5">
                    <span className="text-white font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Esperar el depósito</h4>
                    <p className="text-sm text-white/80">
                      Si la transferencia aún no se ha recibido, espera a que aparezca en el estado de cuenta del banco.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div>
          
          <div className="flex gap-3">
            {onEditPayment && (
              <button
                type="button"
                onClick={() => {
                  onEditPayment();
                  onClose();
                }}
                className="standard-modal-button-primary"
              >
                ✏️ Editar Pago
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="standard-modal-button-secondary"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
