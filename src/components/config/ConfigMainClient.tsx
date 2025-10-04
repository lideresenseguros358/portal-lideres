'use client';

import { useState } from 'react';
import { 
  FaCog, 
  FaBuilding, 
  FaDollarSign, 
  FaExclamationTriangle, 
  FaFileAlt, 
  FaDownload, 
  FaBook, 
  FaCalendarAlt,
  FaUndo 
} from 'react-icons/fa';
import { toast } from 'sonner';
import GeneralTab from './tabs/GeneralTab';
import InsurersTab from './tabs/InsurersTab';
import CommissionsTab from './tabs/CommissionsTab';
import DelinquencyTab from './tabs/DelinquencyTab';
import CasesTab from './tabs/CasesTab';
import DownloadsTab from './tabs/DownloadsTab';
import GuidesTab from './tabs/GuidesTab';
import AgendaTab from './tabs/AgendaTab';

interface ConfigMainClientProps {
  userId: string;
}

type TabKey = 'general' | 'insurers' | 'commissions' | 'delinquency' | 'cases' | 'downloads' | 'guides' | 'agenda';

const TABS = [
  { key: 'general' as TabKey, label: 'Generales', icon: FaCog },
  { key: 'insurers' as TabKey, label: 'Aseguradoras', icon: FaBuilding },
  { key: 'commissions' as TabKey, label: 'Comisiones', icon: FaDollarSign },
  { key: 'delinquency' as TabKey, label: 'Morosidad', icon: FaExclamationTriangle },
  { key: 'cases' as TabKey, label: 'Trámites', icon: FaFileAlt },
  { key: 'downloads' as TabKey, label: 'Descargas', icon: FaDownload },
  { key: 'guides' as TabKey, label: 'Guías', icon: FaBook },
  { key: 'agenda' as TabKey, label: 'Agenda', icon: FaCalendarAlt },
];

export default function ConfigMainClient({ userId }: ConfigMainClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [resetting, setResetting] = useState(false);

  const handleResetToDefaults = async () => {
    if (!confirm('¿Estás seguro de restablecer TODA la configuración a valores por defecto? Esta acción no se puede deshacer.')) {
      return;
    }

    setResetting(true);
    try {
      const response = await fetch('/api/config/reset-defaults', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Configuración restablecida a valores por defecto');
        window.location.reload();
      } else {
        toast.error('Error al restablecer configuración');
      }
    } catch (error) {
      toast.error('Error inesperado');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-2">
              ⚙️ Configuración del Sistema
            </h1>
            <p className="text-gray-600 text-base sm:text-lg">
              Panel de control maestro para administrar todas las funcionalidades
            </p>
          </div>
          <button
            onClick={handleResetToDefaults}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {resetting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span className="text-sm">Restableciendo...</span>
              </>
            ) : (
              <>
                <FaUndo />
                <span className="text-sm">Restablecer Todo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Navigation - Horizontal Scroll on Mobile */}
      <div className="bg-white rounded-2xl shadow-lg p-2 mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max sm:min-w-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={14} className="flex-shrink-0" />
                <span className="text-xs sm:text-sm">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-300">
        {activeTab === 'general' && <GeneralTab userId={userId} />}
        {activeTab === 'insurers' && <InsurersTab userId={userId} />}
        {activeTab === 'commissions' && <CommissionsTab userId={userId} />}
        {activeTab === 'delinquency' && <DelinquencyTab userId={userId} />}
        {activeTab === 'cases' && <CasesTab userId={userId} />}
        {activeTab === 'downloads' && <DownloadsTab userId={userId} />}
        {activeTab === 'guides' && <GuidesTab userId={userId} />}
        {activeTab === 'agenda' && <AgendaTab userId={userId} />}
      </div>
    </div>
  );
}
