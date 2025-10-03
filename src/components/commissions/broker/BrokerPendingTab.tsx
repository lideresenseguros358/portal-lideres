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
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            Pendientes sin Identificar
            {pendingItems.length > 0 && (
              <Badge variant="warning" className="ml-2">{pendingItems.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Mis Solicitudes
            {myRequests.length > 0 && (
              <Badge variant="info" className="ml-2">{myRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="paid">
            Ajustes Pagados
            {paidAdjustments.length > 0 && (
              <Badge variant="success" className="ml-2">{paidAdjustments.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-4">
          <Card className="shadow-inner">
            <CardContent className="p-4">
              {pendingItems.length === 0 ? (
                <div className="text-center py-8">
                  <FaClipboardList className="text-6xl text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay pendientes sin identificar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Póliza</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.policy_number}</TableCell>
                        <TableCell>{item.insured_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.gross_amount)}
                        </TableCell>
                        <TableCell>
                          {new Date(item.created_at).toLocaleDateString('es-PA')}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            size="sm"
                            onClick={() => handleClaimItem(item.policy_number)}
                            className="bg-[#010139] hover:bg-[#8AAA19] text-white"
                          >
                            Marcar como Mío
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="requests" className="mt-4">
          <Card className="shadow-inner">
            <CardContent className="p-4">
              {myRequests.length === 0 ? (
                <div className="text-center py-8">
                  <FaClock className="text-6xl text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay solicitudes pendientes</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Póliza</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myRequests.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.policy_number}</TableCell>
                        <TableCell>{item.insured_name}</TableCell>
                        <TableCell className="text-right font-mono">
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
                            >
                              Eliminar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="paid" className="mt-4">
          <Card className="shadow-inner">
            <CardContent className="p-4">
              {paidAdjustments.length === 0 ? (
                <div className="text-center py-8">
                  <FaCheckCircle className="text-6xl text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay ajustes pagados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Póliza</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Fecha Pagado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidAdjustments.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.policy_number}</TableCell>
                        <TableCell>{item.insured_name}</TableCell>
                        <TableCell className="text-right font-mono text-green-600 font-semibold">
                          {formatCurrency(item.gross_amount)}
                        </TableCell>
                        <TableCell>
                          {new Date(item.paid_date).toLocaleDateString('es-PA')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
