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
      <div className="space-y-8">
      {data.map((fortnight) => (
        <div key={fortnight.id} className="rounded-md border">
          <h3 className="text-lg font-semibold p-4 bg-muted/50">{fortnight.label}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Corredor</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Descuentos</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fortnight.brokers.map((broker) => (
                <TableRow key={broker.broker_id}>
                  <TableCell className="font-medium">{broker.broker_name}</TableCell>
                  <TableCell className="text-right font-bold">{broker.net_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                  <TableCell className="text-right">{broker.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                  <TableCell className="text-right">{broker.discounts.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" size="sm" onClick={() => setSelectedBroker(broker)}>Ver detalle</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
    </>
  );
}
