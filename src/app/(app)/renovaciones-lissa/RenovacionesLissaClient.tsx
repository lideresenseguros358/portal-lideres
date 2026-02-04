'use client';

/**
 * RENOVACIONES LISSA CLIENT
 * Interfaz completa para gestionar renovaciones de oficina
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  RefreshCw, 
  Send, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Search,
  Building2,
  User,
  Mail,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDatePanama } from '@/lib/timezone/time';

interface Policy {
  id: string;
  policy_number: string;
  renewal_date: string | null;
  start_date: string | null;
  ramo: string | null;
  broker_id: string | null;
  client_id: string | null;
  insurer_id: string | null;
  clients: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    national_id: string | null;
  };
  insurers: {
    name: string;
  } | null;
  brokers: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

interface Case {
  id: string;
  ticket: string | null;
  client_name: string | null;
  policy_number: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

interface RenovacionesLissaClientProps {
  policies: Policy[];
  cases: Case[];
  lissaBroker: any;
  brokersWithNotifications: any[];
}

export default function RenovacionesLissaClient({
  policies,
  cases,
  lissaBroker,
  brokersWithNotifications,
}: RenovacionesLissaClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingEmails, setSendingEmails] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'policies' | 'cases'>('policies');

  // Filtrar pólizas por búsqueda
  const filteredPolicies = useMemo(() => {
    if (!searchQuery.trim()) return policies;
    
    const query = searchQuery.toLowerCase();
    return policies.filter(p => 
      p.policy_number?.toLowerCase().includes(query) ||
      p.clients.name.toLowerCase().includes(query) ||
      p.clients.email?.toLowerCase().includes(query) ||
      p.insurers?.name.toLowerCase().includes(query)
    );
  }, [policies, searchQuery]);

  // Filtrar casos por búsqueda
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    
    const query = searchQuery.toLowerCase();
    return cases.filter(c => 
      c.ticket?.toLowerCase().includes(query) ||
      c.client_name?.toLowerCase().includes(query) ||
      c.policy_number?.toLowerCase().includes(query)
    );
  }, [cases, searchQuery]);

  // Calcular días hasta renovación
  const getDaysUntilRenewal = (renewalDate: string | null) => {
    if (!renewalDate) return 0;
    const today = new Date();
    const renewal = new Date(renewalDate);
    const diffTime = renewal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Enviar email de renovación a cliente
  const handleSendRenewalEmail = async (policy: Policy) => {
    if (!policy.clients.email) {
      toast.error('Cliente sin email registrado');
      return;
    }

    setSendingEmails(prev => new Set(prev).add(policy.id));

    try {
      const daysUntil = getDaysUntilRenewal(policy.renewal_date);
      
      const response = await fetch('/api/lissa/send-renewal-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_id: policy.id,
          client_id: policy.client_id,
        }),
      });

      if (!response.ok) throw new Error('Error al enviar');

      toast.success(`✅ Email de renovación enviado a ${policy.clients.name}`);
      
      // Recargar página para actualizar datos
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar email');
    } finally {
      setSendingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(policy.id);
        return newSet;
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-4 rounded-full">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Renovaciones LISSA (Oficina)</h1>
            <p className="text-blue-100 mt-1">
              Gestión centralizada de renovaciones • contacto@lideresenseguros.com
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-3 rounded-full">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pólizas a Renovar</p>
              <p className="text-2xl font-bold text-[#010139]">{policies.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 p-3 rounded-full">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Casos Activos</p>
              <p className="text-2xl font-bold text-[#010139]">{cases.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500 p-3 rounded-full">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Brokers Notificados</p>
              <p className="text-2xl font-bold text-[#010139]">{brokersWithNotifications.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500 p-3 rounded-full">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Urgentes (≤7 días)</p>
              <p className="text-2xl font-bold text-[#010139]">
                {policies.filter(p => getDaysUntilRenewal(p.renewal_date) <= 7).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('policies')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'policies'
                ? 'border-b-2 border-[#8AAA19] text-[#8AAA19] bg-green-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <RefreshCw className="w-5 h-5 inline mr-2" />
            Pólizas a Renovar ({filteredPolicies.length})
          </button>
          <button
            onClick={() => setActiveTab('cases')}
            className={`flex-1 px-6 py-4 font-semibold transition-colors ${
              activeTab === 'cases'
                ? 'border-b-2 border-[#8AAA19] text-[#8AAA19] bg-green-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <CheckCircle className="w-5 h-5 inline mr-2" />
            Casos Activos ({filteredCases.length})
          </button>
        </div>

        {/* Buscador */}
        <div className="p-4 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por póliza, cliente, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Contenido Tabs */}
        <div className="p-4">
          {activeTab === 'policies' && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Póliza</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Aseguradora</TableHead>
                    <TableHead>Renovación</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay pólizas próximas a renovar</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPolicies.map((policy) => {
                      const days = getDaysUntilRenewal(policy.renewal_date);
                      const isUrgent = days <= 7;
                      
                      return (
                        <TableRow key={policy.id}>
                          <TableCell className="font-mono text-sm">
                            {policy.policy_number}
                            {policy.ramo && (
                              <div className="text-xs text-gray-500 mt-1">{policy.ramo}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold">{policy.clients.name}</div>
                            {policy.clients.national_id && (
                              <div className="text-xs text-gray-500">{policy.clients.national_id}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            {policy.clients.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="w-3 h-3 text-gray-400" />
                                {policy.clients.email}
                              </div>
                            )}
                            {policy.clients.phone && (
                              <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Phone className="w-3 h-3" />
                                {policy.clients.phone}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{policy.insurers?.name || 'N/A'}</TableCell>
                          <TableCell>
                            {policy.renewal_date ? formatDatePanama(policy.renewal_date) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isUrgent ? 'destructive' : 'secondary'}>
                              {days} días
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleSendRenewalEmail(policy)}
                              disabled={sendingEmails.has(policy.id) || !policy.clients.email}
                              className="bg-[#8AAA19] hover:bg-[#6d8814] text-white"
                            >
                              {sendingEmails.has(policy.id) ? (
                                <>⏳ Enviando...</>
                              ) : (
                                <>
                                  <Send className="w-4 h-4 mr-1" />
                                  Enviar Email
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {activeTab === 'cases' && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Póliza</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay casos activos</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCases.map((caso) => (
                      <TableRow key={caso.id}>
                        <TableCell className="font-mono text-sm">
                          {caso.ticket || 'Sin ticket'}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {caso.client_name || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {caso.policy_number || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge>{caso.status || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          {formatDatePanama(caso.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.href = `/pendientes?caso=${caso.id}`}
                          >
                            Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      {/* Info Footer */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Sobre esta sección:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Clientes asignados directamente a LISSA (contacto@lideresenseguros.com)</li>
              <li>Brokers que habilitaron notificaciones de renovación desde su perfil</li>
              <li>Los emails se envían directamente AL CLIENTE con botones SI/NO</li>
              <li>Las respuestas crean casos automáticos en el sistema de pendientes</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
