'use client';

/**
 * CASE DETAIL MODAL - Modal de Detalle Completo
 * ==============================================
 * Modal fullscreen tipo Monday con tabs:
 * - Información General
 * - Correos Vinculados
 * - Historial de Eventos
 * - Expediente/Adjuntos (solo master)
 * - Logs de Auditoría (solo master)
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  X, 
  Mail, 
  History, 
  FileText, 
  Shield,
  Calendar,
  User,
  Building,
  Clock
} from 'lucide-react';
import type { CasoPendiente, CaseEmail, CaseHistoryEvent } from '@/types/pendientes';
import { formatDatePanama } from '@/lib/timezone/time';

interface CaseDetailModalProps {
  caso: CasoPendiente | null;
  emails: CaseEmail[];
  history: CaseHistoryEvent[];
  isMaster: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<CasoPendiente>) => Promise<void>;
}

export default function CaseDetailModal({
  caso,
  emails,
  history,
  isMaster,
  onClose,
  onUpdate,
}: CaseDetailModalProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [updating, setUpdating] = useState(false);

  if (!caso) return null;

  return (
    <Dialog open={!!caso} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-[#010139] text-white">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">
                {caso.ticket || '(sin ticket)'}
              </DialogTitle>
              <p className="text-sm text-gray-300 mt-1">
                {caso.brokers?.name || 'Sin broker'} • Creado {formatDatePanama(caso.created_at)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start px-6 py-0 h-auto bg-gray-100 border-b">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Información
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Correos ({emails.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial ({history.length})
            </TabsTrigger>
            {isMaster && (
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Auditoría
              </TabsTrigger>
            )}
          </TabsList>

          {/* Contenido scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Tab: Información General */}
            <TabsContent value="info" className="mt-0 space-y-6">
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#8AAA19]" />
                  Detalles del Caso
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Estado</label>
                    <Badge className="mt-1 block w-fit">{caso.estado_simple}</Badge>
                  </div>
                  
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Bucket</label>
                    <p className="mt-1 text-sm">{caso.ramo_bucket}</p>
                  </div>
                  
                  {caso.ramo_code && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600">Ramo</label>
                      <p className="mt-1 text-sm">Código {caso.ramo_code}</p>
                    </div>
                  )}
                  
                  {caso.aseguradora_code && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600">Aseguradora</label>
                      <p className="mt-1 text-sm">Código {caso.aseguradora_code}</p>
                    </div>
                  )}
                  
                  {caso.tramite_code && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600">Trámite</label>
                      <p className="mt-1 text-sm">Código {caso.tramite_code}</p>
                    </div>
                  )}
                  
                  {caso.tipo_poliza && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600">Tipo de Póliza</label>
                      <p className="mt-1 text-sm">{caso.tipo_poliza}</p>
                    </div>
                  )}
                  
                  {caso.sla_due_date && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Fecha Límite SLA
                      </label>
                      <p className="mt-1 text-sm">{formatDatePanama(caso.sla_due_date)}</p>
                    </div>
                  )}
                  
                  {caso.detected_broker_email && (
                    <div>
                      <label className="text-sm font-semibold text-gray-600 flex items-center gap-1">
                        <User className="w-4 h-4" />
                        Email Detectado
                      </label>
                      <p className="mt-1 text-sm">{caso.detected_broker_email}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Clasificación AI */}
              {caso.ai_classification && (
                <Card className="p-6 bg-blue-50">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    🤖 Clasificación por IA
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Confianza:</strong>{' '}
                      {caso.ai_confidence ? `${Math.round(caso.ai_confidence * 100)}%` : 'N/A'}
                    </p>
                    {caso.missing_fields && caso.missing_fields.length > 0 && (
                      <p>
                        <strong>Campos faltantes:</strong> {caso.missing_fields.join(', ')}
                      </p>
                    )}
                    {caso.special_flags && caso.special_flags.length > 0 && (
                      <p>
                        <strong>Flags especiales:</strong> {caso.special_flags.join(', ')}
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Correos */}
            <TabsContent value="emails" className="mt-0 space-y-4">
              {emails.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay correos vinculados</p>
                </div>
              ) : (
                emails.map((email) => (
                  <Card key={email.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">
                          {email.inbound_emails?.from_name || email.inbound_emails?.from_email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {email.inbound_emails?.subject_normalized || '(sin asunto)'}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {email.inbound_emails?.date_sent && formatDatePanama(email.inbound_emails.date_sent)}
                      </span>
                    </div>
                    {email.inbound_emails?.body_text_normalized && (
                      <p className="text-sm text-gray-600 line-clamp-3 mt-2">
                        {email.inbound_emails.body_text_normalized}
                      </p>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Tab: Historial */}
            <TabsContent value="history" className="mt-0 space-y-3">
              {history.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay eventos en el historial</p>
                </div>
              ) : (
                history.map((event) => (
                  <Card key={event.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-[#8AAA19] text-white rounded-full p-2">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{event.event_type}</p>
                        <p className="text-xs text-gray-500">
                          {event.profiles?.full_name || 'Sistema'} • {formatDatePanama(event.created_at)}
                        </p>
                        {event.payload && (
                          <pre className="text-xs bg-gray-100 p-2 mt-2 rounded overflow-x-auto">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Tab: Auditoría (solo master) */}
            {isMaster && (
              <TabsContent value="audit" className="mt-0">
                <div className="text-center text-gray-400 py-12">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Logs de auditoría (implementación pendiente)</p>
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
