'use client';

import { useState } from 'react';
import { FaHistory, FaClock } from 'react-icons/fa';
import BankHistoryTab from './BankHistoryTab';
import PendingPaymentsTab from './PendingPaymentsTab';
import RegisterPaymentWizard from './RegisterPaymentWizard';

export default function ChecksMainClient() {
  const [activeTab, setActiveTab] = useState<'history' | 'pending'>('history');
  const [showWizard, setShowWizard] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleWizardSuccess = () => {
    // Forzar refresh de pending payments
    setRefreshKey(prev => prev + 1);
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
            onClose={() => setShowWizard(false)}
            onSuccess={handleWizardSuccess}
          />
        )}
      </div>
    </div>
  );
}
