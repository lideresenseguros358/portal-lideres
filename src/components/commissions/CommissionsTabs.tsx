'use client';

import { useState } from 'react';
import { FaMoneyBillWave, FaCalendarAlt, FaCog, FaChartBar, FaEye } from 'react-icons/fa';
import { PreviewTab } from './PreviewTab';
import AdjustmentsTab from './AdjustmentsTab';
import { YTDTab } from './YTDTab';
import { AdvancesTab } from './AdvancesTab';
import BrokerView from './BrokerView';
import NewFortnightTab from './NewFortnightTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface InitialData {
  draftFortnight: any;
  role: string;
  brokerId: string | null;
  brokers: { id: string; name: string | null }[];
  insurers: { id: string; name: string | null }[];
}

export default function CommissionsTabs({ initialData }: { initialData: InitialData }) {
  const { role, brokerId, brokers, insurers } = initialData;
  const [activeTab, setActiveTab] = useState(role === 'broker' ? 'broker-view' : 'preview');
  const [draftFortnight, setDraftFortnight] = useState(initialData.draftFortnight);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const validBrokers = brokers.filter(b => b.name) as { id: string; name: string }[];
  const validInsurers = insurers.filter(i => i.name) as { id: string; name: string }[];

  // MASTER tiene 5 tabs según el esquema actualizado
  const MASTER_TABS = [
    { id: 'preview', label: 'Previsualización', icon: FaEye, description: 'Histórico de quincenas cerradas' },
    { id: 'new-fortnight', label: 'Nueva Quincena', icon: FaCalendarAlt, description: 'Gestión de la quincena actual', highlight: !!draftFortnight },
    { id: 'advances', label: 'Adelantos', icon: FaMoneyBillWave, description: 'Gestión de adelantos' },
    { id: 'adjustments', label: 'Ajustes', icon: FaCog, description: 'Pendientes sin identificar', badge: pendingCount },
    { id: 'ytd', label: 'Acumulado Anual', icon: FaChartBar, description: 'Resumen anual por corredor' },
  ];

  const TABS = role === 'master' ? MASTER_TABS : [];

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

  const renderTabContent = (tab: { id: string }) => (
    <TabsContent key={tab.id} value={tab.id} className="mt-6 space-y-6">
      {tab.id === 'preview' && (
        <PreviewTab role={role} brokerId={brokerId || undefined} />
      )}
      {tab.id === 'new-fortnight' && (
        <NewFortnightTab 
          key={`fortnight-${refreshKey}`}
          role={role} 
          brokerId={brokerId} 
          draftFortnight={draftFortnight} 
          insurers={validInsurers} 
          brokers={validBrokers} 
          onFortnightCreated={handleFortnightCreated} 
        />
      )}
      {tab.id === 'advances' && (
        <AdvancesTab 
          role={role} 
          brokerId={brokerId} 
          brokers={validBrokers}
        />
      )}
      {tab.id === 'adjustments' && (
        <AdjustmentsTab 
          role={role} 
          brokerId={brokerId} 
          brokers={validBrokers}
          onPendingCountChange={handlePendingCountChange}
        />
      )}
      {tab.id === 'ytd' && (
        <YTDTab role={role} brokerId={brokerId} />
      )}
    </TabsContent>
  );

  // BROKER view - Una sola vista con todo integrado
  if (role === 'broker') {
    if (!brokerId) {
      return (
        <Card className="shadow-lg p-8 text-center">
          <p className="text-red-600 font-semibold">Error: No se pudo identificar al corredor.</p>
        </Card>
      );
    }
    return <BrokerView brokerId={brokerId} />;
  }

  // MASTER view - 4 tabs exactamente según el esquema
  return (
    <Card className="shadow-lg p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-gray-50 p-1 rounded-t-lg rounded-b-none">
          {TABS.map(tab => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id}
              className={`relative data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:shadow-sm ${
                tab.highlight ? 'ring-2 ring-[#8AAA19] ring-opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <tab.icon className="text-sm" />
                <span className="font-medium">{tab.label}</span>
                {tab.badge && tab.badge > 0 && (
                  <Badge 
                    className="ml-2 bg-[#8AAA19] text-white px-2 py-0 text-xs"
                  >
                    {tab.badge}
                  </Badge>
                )}
                {tab.highlight && (
                  <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8AAA19] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#8AAA19]"></span>
                  </span>
                )}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>
        
        <div className="p-6">
          {TABS.map(renderTabContent)}
        </div>
      </Tabs>
    </Card>
  );
}