'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaChartLine, FaClipboardList, FaHistory, FaMoneyBillWave } from 'react-icons/fa';

import BrokerPreviewTab from './broker/BrokerPreviewTab';
import BrokerPendingTab from './broker/BrokerPendingTab';
import BrokerAdvancesTab from './broker/BrokerAdvancesTab';
import BrokerYTDTab from './broker/BrokerYTDTab';

interface BrokerViewProps {
  brokerId: string;
}

export default function BrokerView({ brokerId }: BrokerViewProps) {
  const [activeTab, setActiveTab] = useState('preview');

  const TAB_DEFINITIONS = [
    {
      id: 'preview',
      label: 'Previsualización',
      icon: FaHistory,
      description: 'Resumen de quincenas cerradas',
    },
    {
      id: 'pending',
      label: 'Pendientes',
      icon: FaClipboardList,
      description: 'Solicitudes y ajustes en curso',
    },
    {
      id: 'advances',
      label: 'Adelantos',
      icon: FaMoneyBillWave,
      description: 'Pagos adelantados y descuentos',
    },
    {
      id: 'ytd',
      label: 'Acumulado Anual',
      icon: FaChartLine,
      description: 'Analytics por aseguradora',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">Panel de Comisiones</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#010139]">Mi Centro de Comisiones</h1>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl">
              Revisa tu historial, pendientes, adelantos y análisis anual de manera unificada con la misma experiencia del panel master.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 overflow-x-auto">
            <TabsList className="flex gap-2 px-3 py-2 min-w-max sm:min-w-0 sm:grid sm:grid-cols-4">
              {TAB_DEFINITIONS.map(({ id, label, icon: Icon, description }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="flex flex-1 min-w-[200px] flex-col items-start justify-center gap-1 rounded-xl border border-transparent bg-white/80 px-3 py-3 text-left shadow-sm transition-all hover:shadow-md data-[state=active]:translate-y-[-2px] data-[state=active]:border-[#010139] data-[state=active]:shadow-xl data-[state=active]:bg-white"
                >
                  <div className="flex items-center gap-2 text-[#010139]">
                    <Icon className="text-base" />
                    <span className="font-semibold text-sm sm:text-base">{label}</span>
                  </div>
                  <span className="text-xs text-gray-500 line-clamp-1 sm:pr-4">
                    {description}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="p-4 sm:p-6 bg-white">
            <TabsContent value="preview" className="focus:outline-none">
              <BrokerPreviewTab brokerId={brokerId} />
            </TabsContent>
            <TabsContent value="pending" className="focus:outline-none">
              <BrokerPendingTab brokerId={brokerId} />
            </TabsContent>
            <TabsContent value="advances" className="focus:outline-none">
              <BrokerAdvancesTab brokerId={brokerId} />
            </TabsContent>
            <TabsContent value="ytd" className="focus:outline-none">
              <BrokerYTDTab brokerId={brokerId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
