'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { FaHistory, FaClipboardList, FaMoneyBillWave, FaChartBar } from 'react-icons/fa';
import BrokerPreviewTab from './broker/BrokerPreviewTab';
import BrokerPendingTab from './broker/BrokerPendingTab';
import BrokerAdvancesTab from './broker/BrokerAdvancesTab';
import BrokerYTDTab from './broker/BrokerYTDTab';

interface Props {
  brokerId: string;
}

export default function BrokerView({ brokerId }: Props) {
  const [activeTab, setActiveTab] = useState('preview');

  return (
    <Card className="shadow-lg p-0 overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Mobile: Scroll horizontal / Desktop: Grid */}
        <div className="overflow-x-auto bg-gray-50 rounded-t-lg">
          <TabsList className="flex md:grid w-full md:grid-cols-4 bg-gray-50 p-1 rounded-t-lg rounded-b-none min-w-max md:min-w-0">
            <TabsTrigger 
              value="preview"
              className="flex-shrink-0 data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:shadow-sm px-3 py-2 md:px-4"
            >
              <div className="flex items-center gap-1.5 md:gap-2">
                <FaHistory className="text-sm md:text-base flex-shrink-0" />
                <span className="text-xs md:text-sm whitespace-nowrap">Previsualización</span>
              </div>
            </TabsTrigger>
            <TabsTrigger 
              value="pending"
              className="flex-shrink-0 data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:shadow-sm px-3 py-2 md:px-4"
            >
              <div className="flex items-center gap-1.5 md:gap-2">
                <FaClipboardList className="text-sm md:text-base flex-shrink-0" />
                <span className="text-xs md:text-sm whitespace-nowrap">Pendientes</span>
              </div>
            </TabsTrigger>
            <TabsTrigger 
              value="advances"
              className="flex-shrink-0 data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:shadow-sm px-3 py-2 md:px-4"
            >
              <div className="flex items-center gap-1.5 md:gap-2">
                <FaMoneyBillWave className="text-sm md:text-base flex-shrink-0" />
                <span className="text-xs md:text-sm whitespace-nowrap">Adelantos</span>
              </div>
            </TabsTrigger>
            <TabsTrigger 
              value="ytd"
              className="flex-shrink-0 data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:shadow-sm px-3 py-2 md:px-4"
            >
              <div className="flex items-center gap-1.5 md:gap-2">
                <FaChartBar className="text-sm md:text-base flex-shrink-0" />
                <span className="text-xs md:text-sm whitespace-nowrap">Acumulado Anual</span>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        <CardContent className="p-3 sm:p-4 md:p-6">
          <TabsContent value="preview">
            <BrokerPreviewTab brokerId={brokerId} />
          </TabsContent>
          <TabsContent value="pending">
            <BrokerPendingTab brokerId={brokerId} />
          </TabsContent>
          <TabsContent value="advances">
            <BrokerAdvancesTab brokerId={brokerId} />
          </TabsContent>
          <TabsContent value="ytd">
            <BrokerYTDTab brokerId={brokerId} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
