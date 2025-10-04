'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FaHistory, FaClock } from 'react-icons/fa';
import BankHistoryTab from './BankHistoryTab';
import PendingPaymentsTab from './PendingPaymentsTab';
import RegisterPaymentWizard from './RegisterPaymentWizard';
import { actionGetAdvanceDetails } from '@/app/(app)/checks/actions';

export default function ChecksMainClient() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'history' | 'pending'>('history');
  const [showWizard, setShowWizard] = useState(false);
  const [advanceId, setAdvanceId] = useState<string | null>(null);
  const [advancePrefill, setAdvancePrefill] = useState<any>(null);
  const [loadingAdvance, setLoadingAdvance] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const advance_id = searchParams.get('advance_id');
    if (advance_id) {
      setActiveTab('pending');
      setShowWizard(true);
      setAdvanceId(advance_id);
      setLoadingAdvance(true);
      actionGetAdvanceDetails(advance_id)
        .then(result => {
          if (result.ok) {
            setAdvancePrefill(result.data);
          }
        })
        .finally(() => setLoadingAdvance(false));
    }
  }, [searchParams]);

  const handleWizardSuccess = () => {
    // Forzar refresh de pending payments
    setRefreshKey(prev => prev + 1);
    setAdvanceId(null);
    setAdvancePrefill(null);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setAdvanceId(null);
    setAdvancePrefill(null);
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#010139] mb-2">💰 Cheques y Transferencias</h1>
          <p className="text-gray-600 text-lg">Sistema completo de gestión de pagos bancarios</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-2 mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FaHistory size={16} />
            <span className="text-sm">Historial de Banco</span>
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'pending'
                ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FaClock size={16} />
            <span className="text-sm">Pagos Pendientes</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-300">
          {activeTab === 'history' && <BankHistoryTab key={`history-${refreshKey}`} />}
          {activeTab === 'pending' && (
            <PendingPaymentsTab 
              key={`pending-${refreshKey}`}
              onOpenWizard={() => setShowWizard(true)} 
            />
          )}
        </div>

        {/* Wizard Modal */}
        {showWizard && (
          <RegisterPaymentWizard
            onClose={handleCloseWizard}
            onSuccess={handleWizardSuccess}
            advanceId={advanceId}
            advancePrefill={advancePrefill}
            advanceLoading={loadingAdvance}
          />
        )}
      </div>
    </div>
  );
}
