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
    <Card className="shadow-lg p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-50 p-1 rounded-t-lg rounded-b-none">
          <TabsTrigger 
            value="preview"
            className="data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <FaHistory className="text-sm" />
              <span>Previsualización</span>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="pending"
            className="data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <FaClipboardList className="text-sm" />
              <span>Pendientes</span>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="advances"
            className="data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <FaMoneyBillWave className="text-sm" />
              <span>Adelantos</span>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="ytd"
            className="data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <FaChartBar className="text-sm" />
              <span>Acumulado Anual</span>
            </div>
          </TabsTrigger>
        </TabsList>

        <CardContent className="p-6">
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
