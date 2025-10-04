'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FaClipboardList, FaCheckCircle, FaClock, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionGetPendingItems, actionClaimPendingItem } from '@/app/(app)/commissions/actions';

interface Props {
  brokerId: string;
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export default function BrokerPendingTab({ brokerId }: Props) {
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [paidAdjustments, setPaidAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const result = await actionGetPendingItems();
        if (result.ok) {
          setPendingItems(result.data || []);
        }
      } catch (error) {
        console.error('Error loading pending items:', error);
      }
      setLoading(false);
    };
    loadData();
  }, [brokerId]);

  const handleClaimItem = async (policyNumber: string) => {
    try {
      // Find the item to claim
      const itemToClaim = pendingItems.find(item => item.policy_number === policyNumber);
      if (!itemToClaim) return;
      
      const result = await actionClaimPendingItem([itemToClaim.id]);
      if (result.ok) {
        toast.success('Marcado como mío exitosamente');
        // Move item from pending to requests
        const claimedItem = pendingItems.find(item => item.policy_number === policyNumber);
        if (claimedItem) {
          setPendingItems(prev => prev.filter(item => item.policy_number !== policyNumber));
          setMyRequests(prev => [...prev, { ...claimedItem, status: 'pending' }]);
        }
      } else {
        toast.error('Error al marcar como mío');
      }
    } catch (error) {
      console.error('Error claiming item:', error);
      toast.error('Error al marcar como mío');
    }
  };

  const handleCancelRequest = (policyNumber: string) => {
    // Move item back to pending
    const requestItem = myRequests.find(item => item.policy_number === policyNumber);
    if (requestItem) {
      setMyRequests(prev => prev.filter(item => item.policy_number !== policyNumber));
      setPendingItems(prev => [...prev, requestItem]);
      toast.success('Solicitud eliminada');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="shadow-lg border-2 border-gray-100">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <FaClipboardList className="text-[#010139] text-xl" />
            <h2 className="text-xl sm:text-2xl font-bold text-[#010139]">AJUSTES Y PENDIENTES</h2>
          </div>
          <p className="text-sm text-gray-600">
            Gestiona tus solicitudes de ajustes y revisa pendientes sin identificar
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2">
          <TabsTrigger value="pending" className="flex items-center justify-center gap-2">
            <span>Pendientes sin Identificar</span>
            {pendingItems.length > 0 && (
              <Badge variant="warning" className="ml-1">{pendingItems.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center justify-center gap-2">
            <span>Mis Solicitudes</span>
            {myRequests.length > 0 && (
              <Badge variant="info" className="ml-1">{myRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex items-center justify-center gap-2">
            <span>Ajustes Pagados</span>
            {paidAdjustments.length > 0 && (
              <Badge variant="success" className="ml-1">{paidAdjustments.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-6">
          <Card className="shadow-lg border-2 border-gray-100">
            <CardContent className="p-4 sm:p-6">
              {pendingItems.length === 0 ? (
                <div className="text-center py-12 sm:py-20">
                  <FaClipboardList className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                    No hay pendientes sin identificar
                  </h3>
                  <p className="text-sm text-gray-500">Los ajustes pendientes aparecerán aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Póliza</TableHead>
                        <TableHead className="font-semibold text-gray-700">Cliente</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Monto</TableHead>
                        <TableHead className="font-semibold text-gray-700">Fecha</TableHead>
                        <TableHead className="text-center font-semibold text-gray-700">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="font-medium text-gray-700">{item.policy_number}</TableCell>
                          <TableCell className="text-gray-600">{item.insured_name}</TableCell>
                          <TableCell className="text-right font-mono text-[#010139] font-semibold">
                            {formatCurrency(item.gross_amount)}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {new Date(item.created_at).toLocaleDateString('es-PA')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              size="sm"
                              onClick={() => handleClaimItem(item.policy_number)}
                              className="bg-[#010139] hover:bg-[#8AAA19] text-white transition-colors duration-200"
                            >
                              Marcar como Mío
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="requests" className="mt-6">
          <Card className="shadow-lg border-2 border-gray-100">
            <CardContent className="p-4 sm:p-6">
              {myRequests.length === 0 ? (
                <div className="text-center py-12 sm:py-20">
                  <FaClock className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                    No hay solicitudes pendientes
                  </h3>
                  <p className="text-sm text-gray-500">Tus solicitudes de ajustes aparecerán aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Póliza</TableHead>
                        <TableHead className="font-semibold text-gray-700">Cliente</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Monto</TableHead>
                        <TableHead className="font-semibold text-gray-700">Estado</TableHead>
                        <TableHead className="text-center font-semibold text-gray-700">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myRequests.map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="font-medium text-gray-700">{item.policy_number}</TableCell>
                          <TableCell className="text-gray-600">{item.insured_name}</TableCell>
                          <TableCell className="text-right font-mono text-[#010139] font-semibold">
                            {formatCurrency(item.gross_amount)}
                          </TableCell>
                          <TableCell>
                            {item.status === 'pending' && (
                              <Badge variant="warning">
                                <FaClock className="mr-1" size={10} /> Esperando
                              </Badge>
                            )}
                            {item.status === 'approved' && (
                              <Badge variant="success">
                                <FaCheckCircle className="mr-1" size={10} /> Aprobado
                              </Badge>
                            )}
                            {item.status === 'rejected' && (
                              <Badge variant="danger">
                                <FaTimesCircle className="mr-1" size={10} /> Rechazado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.status === 'pending' && (
                              <Button 
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancelRequest(item.policy_number)}
                                className="transition-colors duration-200"
                              >
                                Eliminar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="paid" className="mt-6">
          <Card className="shadow-lg border-2 border-gray-100">
            <CardContent className="p-4 sm:p-6">
              {paidAdjustments.length === 0 ? (
                <div className="text-center py-12 sm:py-20">
                  <FaCheckCircle className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                    No hay ajustes pagados
                  </h3>
                  <p className="text-sm text-gray-500">Tu historial de ajustes pagados aparecerá aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Póliza</TableHead>
                        <TableHead className="font-semibold text-gray-700">Cliente</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Monto</TableHead>
                        <TableHead className="font-semibold text-gray-700">Fecha Pagado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidAdjustments.map((item) => (
                        <TableRow key={item.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="font-medium text-gray-700">{item.policy_number}</TableCell>
                          <TableCell className="text-gray-600">{item.insured_name}</TableCell>
                          <TableCell className="text-right font-mono text-[#8AAA19] font-bold text-lg">
                            {formatCurrency(item.gross_amount)}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {new Date(item.paid_date).toLocaleDateString('es-PA')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
