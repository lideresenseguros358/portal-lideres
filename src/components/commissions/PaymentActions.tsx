'use client';

import { useState } from 'react';
import { FaDownload } from 'react-icons/fa';
import { actionToggleNotify, actionPayFortnight } from '@/app/(app)/commissions/actions';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PaymentLoadingModal from '@/components/commissions/PaymentLoadingModal';

interface Props {
  draftFortnightId: string;
  initialNotifyState: boolean;
  onRecalculate: () => void;
}

export default function PaymentActions({ draftFortnightId, initialNotifyState, onRecalculate }: Props) {
  const { dialogState, closeDialog, confirm, alert: showAlert, success, error } = useConfirmDialog();
  const [notifyBrokers, setNotifyBrokers] = useState(initialNotifyState);
  const [paying, setPaying] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);

  const handleToggleNotify = async () => {
    const newValue = !notifyBrokers;
    const result = await actionToggleNotify(draftFortnightId, newValue);
    if (result.ok) {
      setNotifyBrokers(newValue);
    } else {
      await showAlert(`Error: ${(result as any).error || 'Error desconocido'}`, 'Error', 'error');
    }
  };

  const handlePayFortnight = async () => {
    const confirmed = await confirm('¿Cerrarás la quincena y se generará el CSV para Banco General. ¿Continuar?', 'Confirmar cierre de quincena');
    if (!confirmed) {
      return;
    }

    setPaying(true);
    // Mostrar el modal de loading para el proceso de cierre
    setShowLoadingModal(true);
  };
  
  // Esta función se pasa al modal y se ejecuta allí
  const executePayFortnight = async (fortnightId: string) => {
    return actionPayFortnight(fortnightId);
  };

  return (
    <div className="payment-actions-container">
      <h3 className="section-title">3. Recalcular y Pagar</h3>
      <div className="actions-content">
        <div className="toggle-container">
          <label htmlFor="notify-toggle" className="toggle-label">
            Notificar corredores al pagar
          </label>
          <button 
            id="notify-toggle"
            onClick={handleToggleNotify}
            className={`toggle-switch ${notifyBrokers ? 'active' : ''}`}
          >
            <span className="toggle-handle"></span>
          </button>
        </div>
        <button
          onClick={onRecalculate}
          className="btn-recalculate"
        >
          Recalcular Totales
        </button>
        <button
          onClick={handlePayFortnight}
          disabled={paying}
          className="btn-primary-pay"
        >
          <FaDownload />
          {paying ? 'Procesando...' : 'Cerrar Quincena y Generar Pagos'}
        </button>
      </div>

      <style>{`
        .payment-actions-container { background: #f8f9fa; border-radius: 12px; padding: 24px; }
        .section-title { font-size: 18px; font-weight: 600; color: #010139; margin-bottom: 16px; }
        .actions-content { display: flex; flex-direction: column; gap: 20px; }
        .toggle-container { display: flex; justify-content: space-between; align-items: center; }
        .toggle-label { font-weight: 500; color: #344054; }
        .toggle-switch { 
          position: relative; width: 44px; height: 24px; border-radius: 12px; 
          background: #d0d5dd; border: none; cursor: pointer; transition: background 0.2s;
        }
        .toggle-switch.active { background: #8aaa19; }
        .toggle-handle { 
          position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; 
          background: white; border-radius: 50%; transition: transform 0.2s;
        }
        .toggle-switch.active .toggle-handle { transform: translateX(20px); }
        .btn-primary-pay { 
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; 
          width: 100%; padding: 12px 24px; background: #16a34a; color: white; 
          border: none; border-radius: 8px; font-size: 16px; font-weight: 600; 
          cursor: pointer; transition: background 0.2s;
        }
        .btn-primary-pay:hover { background: #15803d; }
        .btn-primary-pay:disabled { background: #ccc; cursor: not-allowed; }
        .btn-recalculate { 
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; 
          width: 100%; padding: 12px 24px; background: #f0f0f0; color: #333; 
          border: 1px solid #ccc; border-radius: 8px; font-size: 16px; font-weight: 600; 
          cursor: pointer; transition: background 0.2s;
        }
        .btn-recalculate:hover { background: #e0e0e0; }
      `}</style>
      
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={() => closeDialog(false)}
        onConfirm={() => closeDialog(true)}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
      />
      
      {/* Modal de loading para proceso de cierre */}
      <PaymentLoadingModal
        isOpen={showLoadingModal}
        onClose={() => {
          setShowLoadingModal(false);
          setPaying(false);
        }}
        fortnightId={draftFortnightId}
        payFortnightAction={executePayFortnight}
      />
    </div>
  );
}
