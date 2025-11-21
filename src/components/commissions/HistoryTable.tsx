'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BrokerDetailModal } from './BrokerDetailModal';
import type { HistoricalFortnight, BrokerData } from '@/lib/commissions/types';

type HistoryTableProps = {
  data: HistoricalFortnight[];
};

export function HistoryTable({ data }: HistoryTableProps) {
  const [selectedBroker, setSelectedBroker] = useState<BrokerData | null>(null);
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-md border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No hay quincenas pagadas para el período seleccionado.</p>
      </div>
    );
  }

  // We will render a table for each fortnight found
  return (
    <>
      <BrokerDetailModal 
        isOpen={!!selectedBroker}
        onClose={() => setSelectedBroker(null)}
        brokerData={selectedBroker}
      />
      <div className="space-y-6 sm:space-y-8">
      {data.map((fortnight) => (
        <div key={fortnight.id} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <h3 className="text-base sm:text-lg font-bold text-[#010139]">{fortnight.label}</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="min-w-[150px]">
                    <span className="text-xs sm:text-sm font-semibold">Corredor</span>
                  </TableHead>
                  <TableHead className="text-right min-w-[100px]">
                    <span className="text-xs sm:text-sm font-semibold">Neto</span>
                  </TableHead>
                  <TableHead className="text-right min-w-[100px]">
                    <span className="text-xs sm:text-sm font-semibold">Bruto</span>
                  </TableHead>
                  <TableHead className="text-right min-w-[100px]">
                    <span className="text-xs sm:text-sm font-semibold">Descuentos</span>
                  </TableHead>
                  <TableHead className="text-center min-w-[120px]">
                    <span className="text-xs sm:text-sm font-semibold">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fortnight.brokers.map((broker) => (
                  <TableRow key={broker.broker_id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium text-xs sm:text-sm">{broker.broker_name}</TableCell>
                    <TableCell className="text-right font-bold text-[#8AAA19] text-xs sm:text-sm font-mono">
                      {broker.net_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </TableCell>
                    <TableCell className="text-right text-gray-700 text-xs sm:text-sm font-mono">
                      {broker.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </TableCell>
                    <TableCell className="text-right text-red-600 text-xs sm:text-sm font-mono">
                      {broker.discounts.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedBroker(broker)}
                        className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 whitespace-nowrap border-[#010139]/20 hover:bg-[#010139] hover:text-white transition-colors"
                      >
                        <span className="hidden sm:inline">Ver detalle</span>
                        <span className="sm:hidden">Ver</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
    </>
  );
}
