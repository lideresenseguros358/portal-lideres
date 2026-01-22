'use client';

/**
 * PENDIENTES CLIENT - Componente Principal
 * =========================================
 * Vista completa tipo Monday con:
 * - 3 Tabs: Vida ASSA, Ramos Generales, Ramo Personas
 * - Filtros por estado, broker, fecha
 * - Búsqueda por ticket, cliente, email
 * - Board con columnas por estado
 * - Modal de detalle
 */

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Search, Filter, X, RefreshCw } from 'lucide-react';
import CaseBoard from '@/components/pendientes/CaseBoard';
import CaseDetailModal from '@/components/pendientes/CaseDetailModal';
import type { CasoPendiente, EstadoSimple, RamoBucket, CaseEmail, CaseHistoryEvent } from '@/types/pendientes';

interface PendientesClientProps {
  casos: CasoPendiente[];
  isMaster: boolean;
  userId: string;
  userRole: string;
}

const ESTADOS: EstadoSimple[] = [
  'Nuevo',
  'Sin clasificar',
  'En proceso',
  'Pendiente cliente',
  'Pendiente broker',
  'Enviado',
  'Aplazado',
  'Cerrado aprobado',
  'Cerrado rechazado',
];

export default function PendientesClient({
  casos,
  isMaster,
  userId,
  userRole,
}: PendientesClientProps) {
  const [selectedCaso, setSelectedCaso] = useState<CasoPendiente | null>(null);
  const [caseEmails, setCaseEmails] = useState<CaseEmail[]>([]);
  const [caseHistory, setCaseHistory] = useState<CaseHistoryEvent[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<EstadoSimple | 'all'>('all');
  const [activeTab, setActiveTab] = useState<RamoBucket>('vida_assa');

  // Filtrar casos por tab
  const casosPorTab = useMemo(() => {
    return casos.filter(c => c.ramo_bucket === activeTab);
  }, [casos, activeTab]);

  // Aplicar filtros y búsqueda
  const casosFiltrados = useMemo(() => {
    let filtered = casosPorTab;

    // Filtro por estado
    if (estadoFilter !== 'all') {
      filtered = filtered.filter(c => c.estado_simple === estadoFilter);
    }

    // Búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.ticket?.toLowerCase().includes(query) ||
        c.detected_broker_email?.toLowerCase().includes(query) ||
        c.brokers?.name?.toLowerCase().includes(query) ||
        c.tipo_poliza?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [casosPorTab, estadoFilter, searchQuery]);

  // Abrir caso y cargar detalles
  const handleCaseClick = async (caso: CasoPendiente) => {
    setSelectedCaso(caso);
    setLoadingDetails(true);

    try {
      // Cargar emails
      const emailsRes = await fetch(`/api/pendientes/casos/${caso.id}/emails`);
      if (emailsRes.ok) {
        const emailsData = await emailsRes.json();
        setCaseEmails(emailsData);
      }

      // Cargar historial
      const historyRes = await fetch(`/api/pendientes/casos/${caso.id}/history`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setCaseHistory(historyData);
      }
    } catch (error) {
      console.error('Error loading case details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Actualizar caso
  const handleUpdateCase = async (updates: Partial<CasoPendiente>) => {
    if (!selectedCaso) return;

    try {
      const res = await fetch(`/api/pendientes/casos/${selectedCaso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        // Recargar página para obtener datos actualizados
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating case:', error);
    }
  };

  // Contadores por tab
  const contadores = useMemo(() => ({
    vida_assa: casos.filter(c => c.ramo_bucket === 'vida_assa').length,
    ramos_generales: casos.filter(c => c.ramo_bucket === 'ramos_generales').length,
    ramo_personas: casos.filter(c => c.ramo_bucket === 'ramo_personas').length,
    desconocido: casos.filter(c => c.ramo_bucket === 'desconocido').length,
  }), [casos]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-[#010139]">Pendientes</h1>
              <p className="text-sm text-gray-600">
                {isMaster ? 'Vista Master - Todos los casos' : 'Tus casos asignados'}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por ticket, broker, tipo de póliza..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Filtro por estado */}
            <Select
              value={estadoFilter}
              onValueChange={(value: any) => setEstadoFilter(value)}
            >
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {ESTADOS.map(estado => (
                  <SelectItem key={estado} value={estado}>
                    {estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs principales */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="mb-6 bg-white border shadow-sm p-1">
            <TabsTrigger value="vida_assa" className="px-6">
              🏥 Vida ASSA
              <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                {contadores.vida_assa}
              </span>
            </TabsTrigger>
            <TabsTrigger value="ramos_generales" className="px-6">
              🚗 Ramos Generales
              <span className="ml-2 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                {contadores.ramos_generales}
              </span>
            </TabsTrigger>
            <TabsTrigger value="ramo_personas" className="px-6">
              👥 Ramo Personas
              <span className="ml-2 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">
                {contadores.ramo_personas}
              </span>
            </TabsTrigger>
            {contadores.desconocido > 0 && (
              <TabsTrigger value="desconocido" className="px-6">
                ❓ Sin Clasificar
                <span className="ml-2 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  {contadores.desconocido}
                </span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Contenido de tabs */}
          <TabsContent value={activeTab} className="mt-0">
            {casosFiltrados.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-gray-400 text-lg">
                  {searchQuery || estadoFilter !== 'all'
                    ? 'No se encontraron casos con los filtros aplicados'
                    : 'No hay casos en este bucket'}
                </p>
              </Card>
            ) : (
              <CaseBoard
                casos={casosFiltrados}
                onCaseClick={handleCaseClick}
                isMaster={isMaster}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de detalle */}
      <CaseDetailModal
        caso={selectedCaso}
        emails={caseEmails}
        history={caseHistory}
        isMaster={isMaster}
        onClose={() => {
          setSelectedCaso(null);
          setCaseEmails([]);
          setCaseHistory([]);
        }}
        onUpdate={handleUpdateCase}
      />
    </div>
  );
}
