'use client';

import { useState, useEffect } from 'react';
import { 
  actionGetRetainedCommissions, 
  actionPayRetainedCommission,
  actionApplyRetainedToAdvance,
  actionGetAdvances,
} from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FaMoneyBillWave, FaHandHoldingUsd, FaCalendarPlus, FaChevronDown, FaChevronRight } from 'react-icons/fa';

interface RetainedCommission {
  id: string;
  broker_id: string;
  fortnight_id: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  status: string;
  insurers_detail: any;
  brokers: { id: string; name: string };
  fortnights: { period_start: string; period_end: string };
}

interface PaymentModalState {
  isOpen: boolean;
  retainedId: string | null;
  brokerName: string;
  amount: number;
}

interface ApplyToAdvanceModalState {
  isOpen: boolean;
  retainedId: string | null;
  brokerId: string | null;
  brokerName: string;
  availableAmount: number;
}

export function RetainedTab() {
  const [retainedCommissions, setRetainedCommissions] = useState<RetainedCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [paymentModal, setPaymentModal] = useState<PaymentModalState>({
    isOpen: false,
    retainedId: null,
    brokerName: '',
    amount: 0,
  });

  const [advanceModal, setAdvanceModal] = useState<ApplyToAdvanceModalState>({
    isOpen: false,
    retainedId: null,
    brokerId: null,
    brokerName: '',
    availableAmount: 0,
  });

  const [advances, setAdvances] = useState<any[]>([]);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState('');
  const [applyAmount, setApplyAmount] = useState('');

  useEffect(() => {
    loadRetainedCommissions();
  }, []);

  const loadRetainedCommissions = async () => {
    setLoading(true);
    const result = await actionGetRetainedCommissions();
    if (result.ok) {
      setRetainedCommissions(result.data as RetainedCommission[]);
    } else {
      toast.error('Error al cargar comisiones retenidas');
    }
    setLoading(false);
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleOpenPaymentModal = (retained: RetainedCommission) => {
    setPaymentModal({
      isOpen: true,
      retainedId: retained.id,
      brokerName: retained.brokers.name,
      amount: retained.net_amount,
    });
  };

  const handlePayRetained = async (option: 'immediate' | 'next_fortnight') => {
    if (!paymentModal.retainedId) return;

    const result = await actionPayRetainedCommission({
      retained_id: paymentModal.retainedId,
      pay_option: option,
    });

    if (result.ok) {
      toast.success(option === 'immediate' ? 'Pago registrado exitosamente' : 'Se aplicará en la siguiente quincena');
      setPaymentModal({ isOpen: false, retainedId: null, brokerName: '', amount: 0 });
      loadRetainedCommissions();
    } else {
      toast.error('Error al procesar pago');
    }
  };

  const handleOpenAdvanceModal = async (retained: RetainedCommission) => {
    // Cargar adelantos del broker
    const result = await actionGetAdvances(retained.broker_id);
    if (result.ok) {
      const pendingAdvances = (result.data || []).filter((a: any) => a.amount > 0);
      setAdvances(pendingAdvances);
    }

    setAdvanceModal({
      isOpen: true,
      retainedId: retained.id,
      brokerId: retained.broker_id,
      brokerName: retained.brokers.name,
      availableAmount: retained.net_amount,
    });
    setSelectedAdvanceId('');
    setApplyAmount('');
  };

  const handleApplyToAdvance = async () => {
    if (!advanceModal.retainedId || !selectedAdvanceId) {
      toast.error('Debe seleccionar un adelanto');
      return;
    }

    const amount = parseFloat(applyAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto inválido');
      return;
    }

    if (amount > advanceModal.availableAmount) {
      toast.error('El monto excede el disponible');
      return;
    }

    const result = await actionApplyRetainedToAdvance({
      retained_id: advanceModal.retainedId,
      advance_id: selectedAdvanceId,
      amount,
    });

    if (result.ok) {
      toast.success('Aplicado al adelanto exitosamente');
      setAdvanceModal({
        isOpen: false,
        retainedId: null,
        brokerId: null,
        brokerName: '',
        availableAmount: 0,
      });
      loadRetainedCommissions();
    } else {
      toast.error('Error al aplicar');
    }
  };

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('es-PA', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('es-PA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const totalRetained = retainedCommissions.reduce((sum, r) => sum + r.net_amount, 0);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="shadow-lg border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-[#010139] flex items-center gap-2">
            <FaHandHoldingUsd className="text-red-500" />
            Comisiones Retenidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
              <p className="text-sm text-gray-600 mb-1">Total Retenido</p>
              <p className="text-2xl font-bold text-red-600 font-mono">
                ${totalRetained.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Pagos Pendientes</p>
              <p className="text-2xl font-bold text-blue-600">
                {retainedCommissions.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-lg">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139]"></div>
            </div>
          ) : retainedCommissions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FaHandHoldingUsd className="mx-auto text-5xl mb-4 text-gray-300" />
              <p className="text-lg font-semibold">No hay comisiones retenidas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Corredor</TableHead>
                    <TableHead>Quincena</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Descuento</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retainedCommissions.map((retained) => (
                    <>
                      <TableRow key={retained.id} className="hover:bg-gray-50">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRow(retained.id)}
                          >
                            {expandedRows.has(retained.id) ? <FaChevronDown /> : <FaChevronRight />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-semibold">{retained.brokers.name}</TableCell>
                        <TableCell className="text-sm">
                          {formatPeriod(retained.fortnights.period_start, retained.fortnights.period_end)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${retained.gross_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          -${retained.discount_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-[#8AAA19]">
                          ${retained.net_amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPaymentModal(retained)}
                              className="hover:bg-green-100 hover:text-green-700"
                            >
                              <FaMoneyBillWave className="mr-1" />
                              Pagar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenAdvanceModal(retained)}
                              className="hover:bg-blue-100 hover:text-blue-700"
                            >
                              <FaCalendarPlus className="mr-1" />
                              Aplicar a Adelanto
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Row - Detalle por Aseguradora */}
                      {expandedRows.has(retained.id) && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-gray-50 p-4">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-sm text-gray-700">Detalle por Aseguradora:</h4>
                              {Object.keys(retained.insurers_detail || {}).map((insurerName) => {
                                const detail = retained.insurers_detail[insurerName];
                                return (
                                  <div key={insurerName} className="border rounded-lg p-3 bg-white">
                                    <div className="flex justify-between items-center mb-2">
                                      <h5 className="font-semibold text-[#010139]">{insurerName}</h5>
                                      <span className="font-mono font-bold text-[#8AAA19]">
                                        ${detail.total.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                                      {detail.clients.map((client: any, idx: number) => (
                                        <div key={idx} className="flex justify-between py-1 border-b last:border-b-0">
                                          <span className="text-gray-600">{client.client_name}</span>
                                          <span className="text-gray-500">{client.policy_number}</span>
                                          <span className="font-mono">${client.amount.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog open={paymentModal.isOpen} onOpenChange={(open) => !open && setPaymentModal({ ...paymentModal, isOpen: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar Comisión Retenida</DialogTitle>
            <DialogDescription>
              Corredor: <span className="font-semibold">{paymentModal.brokerName}</span><br />
              Monto: <span className="font-semibold text-[#8AAA19]">${paymentModal.amount.toFixed(2)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">¿Cómo desea procesar este pago?</p>
            
            <div className="grid grid-cols-1 gap-3">
              <Button
                onClick={() => handlePayRetained('immediate')}
                className="bg-[#8AAA19] hover:bg-[#6d8814] text-white h-auto py-4 flex-col items-start"
              >
                <div className="font-semibold mb-1">Pagar Ya</div>
                <div className="text-xs opacity-90">Generar pago inmediato y registrar en ajustes</div>
              </Button>
              
              <Button
                onClick={() => handlePayRetained('next_fortnight')}
                variant="outline"
                className="border-2 border-[#010139] hover:bg-[#010139] hover:text-white h-auto py-4 flex-col items-start"
              >
                <div className="font-semibold mb-1">Pagar en Siguiente Quincena</div>
                <div className="text-xs opacity-90">Se sumará al bruto de la siguiente quincena</div>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply to Advance Modal */}
      <Dialog open={advanceModal.isOpen} onOpenChange={(open) => !open && setAdvanceModal({ ...advanceModal, isOpen: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar a Adelanto</DialogTitle>
            <DialogDescription>
              Corredor: <span className="font-semibold">{advanceModal.brokerName}</span><br />
              Disponible: <span className="font-semibold text-[#8AAA19]">${advanceModal.availableAmount.toFixed(2)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {advances.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No hay adelantos pendientes para este corredor</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Seleccionar Adelanto</Label>
                  <Select value={selectedAdvanceId} onValueChange={setSelectedAdvanceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un adelanto" />
                    </SelectTrigger>
                    <SelectContent>
                      {advances.map((adv: any) => (
                        <SelectItem key={adv.id} value={adv.id}>
                          {adv.reason} - Saldo: ${adv.amount.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Monto a Aplicar</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={applyAmount}
                    onChange={(e) => setApplyAmount(e.target.value)}
                    placeholder="0.00"
                    max={advanceModal.availableAmount}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceModal({ ...advanceModal, isOpen: false })}>
              Cancelar
            </Button>
            <Button
              onClick={handleApplyToAdvance}
              disabled={!selectedAdvanceId || !applyAmount || advances.length === 0}
              className="bg-[#010139] hover:bg-[#8AAA19] text-white"
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
