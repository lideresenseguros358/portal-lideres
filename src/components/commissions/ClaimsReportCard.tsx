'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FaChevronDown, FaChevronRight, FaUser, FaListUl } from 'react-icons/fa';
import { formatCurrency as formatMoney, formatPercent } from '@/lib/commissions/adjustments-utils';

interface ClaimItem {
  id: string;
  comm_item_id: string;
  broker_id: string;
  status: string;
  created_at: string;
  comm_items?: {
    policy_number: string;
    insured_name: string | null;
    gross_amount: number;
    insurers?: {
      name: string;
    };
  };
  brokers?: {
    percent_default: number | null;
  };
}

interface ClaimsReportCardProps {
  brokerId: string;
  brokerName: string;
  brokerEmail: string;
  items: ClaimItem[];
  isSelected: boolean;
  onToggle: (brokerId: string) => void;
}

export function ClaimsReportCard({
  brokerId,
  brokerName,
  brokerEmail,
  items,
  isSelected,
  onToggle,
}: ClaimsReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calcular totales
  const totalRaw = items.reduce((sum, item) => {
    const amount = item.comm_items?.gross_amount || 0;
    return sum + Math.abs(amount);
  }, 0);

  const brokerPercent = items[0]?.brokers?.percent_default || 0;
  const totalBroker = totalRaw * brokerPercent; // percent_default es DECIMAL (0.80 = 80%), NO dividir /100

  return (
    <Card 
      className={`shadow-lg border-2 transition-all ${
        isSelected ? 'border-[#8AAA19] bg-green-50' : 'border-gray-200'
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggle(brokerId)}
            />
          </div>

          {/* Content */}
          <div className="flex-1">
            {/* Header */}
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center gap-3">
                <button className="text-gray-600 hover:text-[#010139]">
                  {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                </button>
                
                <div>
                  <div className="flex items-center gap-2">
                    <FaUser className="text-[#010139]" />
                    <h3 className="font-bold text-[#010139] text-lg">{brokerName}</h3>
                  </div>
                  <p className="text-xs text-gray-500">{brokerEmail}</p>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Items</p>
                    <p className="font-bold text-[#010139]">{items.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Monto Crudo</p>
                    <p className="font-mono text-gray-700 font-semibold">{formatMoney(totalRaw)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Comisión ({formatPercent(brokerPercent)})</p>
                    <p className="font-mono text-[#8AAA19] font-bold text-lg">{formatMoney(totalBroker)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detalles Expandibles */}
            {isExpanded && (
              <div className="mt-4 border-t-2 border-gray-200 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <FaListUl className="text-gray-600" />
                  <h4 className="font-semibold text-gray-700">Detalle de Items</h4>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Póliza</TableHead>
                        <TableHead className="font-semibold text-gray-700">Cliente</TableHead>
                        <TableHead className="font-semibold text-gray-700">Aseguradora</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Monto Crudo</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Comisión</TableHead>
                        <TableHead className="font-semibold text-gray-700">Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((claim) => {
                        const item = claim.comm_items;
                        if (!item) return null;

                        const rawAmount = Math.abs(item.gross_amount);
                        const brokerAmount = rawAmount * brokerPercent; // percent_default es DECIMAL, NO dividir /100

                        return (
                          <TableRow key={claim.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium text-gray-700">
                              {item.policy_number}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {item.insured_name || '—'}
                            </TableCell>
                            <TableCell className="text-gray-600 text-sm">
                              {item.insurers?.name || '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-gray-600">
                              {formatMoney(rawAmount)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-[#8AAA19]">
                              {formatMoney(brokerAmount)}
                            </TableCell>
                            <TableCell className="text-gray-600 text-sm">
                              {new Date(claim.created_at).toLocaleDateString('es-PA')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      
                      {/* Total Row */}
                      <TableRow className="bg-gray-100 font-semibold">
                        <TableCell colSpan={3} className="text-right text-gray-700">
                          TOTAL ({items.length} items)
                        </TableCell>
                        <TableCell className="text-right font-mono text-[#010139]">
                          {formatMoney(totalRaw)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[#8AAA19] font-bold">
                          {formatMoney(totalBroker)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
