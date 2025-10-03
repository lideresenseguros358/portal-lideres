'use client';

import { useState } from 'react';
import { FaInfoCircle, FaAddressBook, FaDownload, FaProjectDiagram, FaVial, FaCode } from 'react-icons/fa';

import GeneralTab from '@/components/insurers/editor/GeneralTab';
import ContactsTab from '@/components/insurers/editor/ContactsTab';
import DownloadsTab from '@/components/insurers/editor/DownloadsTab';
import CommissionsTab from '@/components/insurers/editor/CommissionsTab';
import DelinquencyTab from '@/components/insurers/editor/DelinquencyTab';
import AssaCodesTab from '@/components/insurers/editor/AssaCodesTab';
import TestsTab from '@/components/insurers/editor/TestsTab';

const ALL_TABS = [
  { id: 'general', label: 'General', icon: FaInfoCircle },
  { id: 'contacts', label: 'Contactos', icon: FaAddressBook },
  { id: 'downloads', label: 'Descargas', icon: FaDownload },
  { id: 'commissions', label: 'Comisiones (Mapeo)', icon: FaProjectDiagram },
  { id: 'delinquency', label: 'Morosidad (Mapeo)', icon: FaProjectDiagram },
  { id: 'assa', label: 'Códigos ASSA', icon: FaCode },
  { id: 'tests', label: 'Pruebas', icon: FaVial },
];

interface InsurerEditorProps {
  initialData?: any;
  insurerId: string;
  insurer?: { name: string; };
}

export default function InsurerEditor({ initialData, insurerId, insurer }: InsurerEditorProps) {
  const [activeTab, setActiveTab] = useState('general');

  if (!insurer || !initialData) {
    return <div>Cargando...</div>; // Or some other placeholder
  }

  const TABS = ALL_TABS.filter(tab => {
    if (tab.id === 'assa') {
      return insurer.name.toUpperCase() === 'ASSA';
    }
    return true;
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab insurer={initialData.insurer} />;
      case 'contacts':
        return <ContactsTab contacts={initialData.contacts} insurerId={insurerId} />;
      case 'downloads':
        return <DownloadsTab downloads={initialData.downloads} insurerId={insurerId} />;
      case 'commissions':
        return <CommissionsTab rules={initialData.mappingRules} insurerId={insurerId} />;
      case 'delinquency':
        return <DelinquencyTab rules={initialData.mappingRules} insurerId={insurerId} />;
      case 'assa':
        return <AssaCodesTab insurerId={insurerId} />;
      case 'tests':
        return <TestsTab insurerId={insurerId} />;
      default:
        return null;
    }
  };

  return (
    <div className="editor-container">
      <div className="tabs-sidebar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="tab-content">
        {renderTabContent()}
      </div>

      <style>{`
        .editor-container {
          display: flex;
          gap: 24px;
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .tabs-sidebar {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 240px;
          flex-shrink: 0;
        }
        .tab-button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border: none;
          background: transparent;
          border-radius: 8px;
          text-align: left;
          font-weight: 500;
          color: #333;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-button:hover {
          background: #f6f6ff;
          color: #010139;
        }
        .tab-button.active {
          background: #010139;
          color: white;
        }
        .tab-content {
          flex-grow: 1;
        }
      `}</style>
    </div>
  );
}
