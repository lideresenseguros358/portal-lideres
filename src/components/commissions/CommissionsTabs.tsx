'use client';

import { useState } from 'react';
import { FaEye, FaPlus, FaDollarSign, FaExclamationTriangle, FaChartLine, FaCircle, FaUniversity } from 'react-icons/fa';
import { PreviewTab } from './PreviewTab';
import BrokerPreviewTab from './broker/BrokerPreviewTab';
import AdjustmentsTab from './AdjustmentsTab';
import { YTDTab } from './YTDTab';
import { AdvancesTab } from './AdvancesTab';
import NewFortnightTab from './NewFortnightTab';
import BancoTab from './banco/BancoTab';

interface InitialData {
  draftFortnight: any;
  role: string;
  brokerId: string | null;
  brokers: { id: string; name: string | null }[];
  insurers: { id: string; name: string | null }[];
}

export default function CommissionsTabs({ initialData }: { initialData: InitialData }) {
  const { role, brokerId, brokers, insurers } = initialData;
  const [activeTab, setActiveTab] = useState('preview');
  const [draftFortnight, setDraftFortnight] = useState(initialData.draftFortnight);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const validBrokers = brokers.filter(b => b.name) as { id: string; name: string }[];
  const validInsurers = insurers.filter(i => i.name) as { id: string; name: string }[];

  // Tabs configuration
  const MASTER_TABS = [
    { id: 'preview', label: 'Historial', badge: 0, icon: FaEye },
    { id: 'new-fortnight', label: 'Nueva Quincena', badge: 0, priority: !!draftFortnight, icon: FaPlus },
    { id: 'banco', label: 'Banco', badge: 0, icon: FaUniversity },
    { id: 'advances', label: 'Adelantos', badge: 0, icon: FaDollarSign },
    { id: 'adjustments', label: 'Ajustes', badge: pendingCount, icon: FaExclamationTriangle },
    { id: 'ytd', label: 'Acumulado', badge: 0, icon: FaChartLine },
  ];

  const BROKER_TABS = [
    { id: 'preview', label: 'Historial', badge: 0, icon: FaEye },
    { id: 'advances', label: 'Adelantos', badge: 0, icon: FaDollarSign },
    { id: 'adjustments', label: 'Ajustes', badge: pendingCount, icon: FaExclamationTriangle },
    { id: 'ytd', label: 'Acumulado', badge: 0, icon: FaChartLine },
  ];

  const TABS = role === 'master' ? MASTER_TABS : BROKER_TABS;

  const handleFortnightCreated = (newFortnight: any) => {
    console.log('Quincena creada/actualizada:', newFortnight);
    setDraftFortnight(newFortnight);
    // Forzar refresh del componente
    setRefreshKey(prev => prev + 1);
    // Only change tab if creating a new fortnight (not deleting)
    if (newFortnight) {
      setActiveTab('new-fortnight');
    }
  };

  const handlePendingCountChange = (count: number) => {
    setPendingCount(count);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // MASTER view con patrón de Cheques
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-2 flex items-center gap-3 flex-wrap">
              💰 Comisiones
              {draftFortnight && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full text-xs sm:text-sm font-bold shadow-lg animate-pulse">
                  <FaCircle size={8} className="animate-pulse" />
                  LIVE
                </span>
              )}
            </h1>
            <p className="text-gray-600 text-base sm:text-lg">
              Sistema completo de gestión de comisiones y pagos
              {pendingCount > 0 && (
                <span className="ml-2 text-orange-600 font-semibold">
                  • {pendingCount} ajustes pendientes
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-2 flex gap-2 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={14} className="sm:hidden" />
                <Icon size={16} className="hidden sm:block" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                {tab.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === tab.id ? 'bg-[#8AAA19]' : 'bg-orange-500 text-white'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-300">
        {activeTab === 'preview' && role === 'master' && (
          <PreviewTab role={role} brokerId={brokerId || undefined} />
        )}
        {activeTab === 'preview' && role === 'broker' && brokerId && (
          <BrokerPreviewTab brokerId={brokerId} />
        )}
        {activeTab === 'new-fortnight' && role === 'master' && (
          <NewFortnightTab
            key={refreshKey}
            role={role}
            brokerId={brokerId}
            draftFortnight={draftFortnight}
            insurers={validInsurers}
            brokers={validBrokers}
            onFortnightCreated={handleFortnightCreated}
          />
        )}
        {activeTab === 'banco' && role === 'master' && (
          <BancoTab role={role} insurers={validInsurers} />
        )}
        {activeTab === 'advances' && (
          <AdvancesTab role={role} brokerId={brokerId} brokers={validBrokers} />
        )}
        {activeTab === 'adjustments' && (
          <AdjustmentsTab role={role} brokerId={brokerId} brokers={validBrokers} onPendingCountChange={handlePendingCountChange} />
        )}
        {activeTab === 'ytd' && (
          <YTDTab role={role} brokerId={brokerId} />
        )}
      </div>
    </div>
  );
}