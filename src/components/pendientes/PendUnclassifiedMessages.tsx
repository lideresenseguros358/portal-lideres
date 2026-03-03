'use client';

/**
 * PEND UNCLASSIFIED MESSAGES
 * ===========================
 * Panel for masters to manage unclassified inbound emails:
 * - View unlinked emails with AI suggestions
 * - Assign to existing case
 * - Create new case
 * - Archive (ignore)
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Mail,
  Paperclip,
  Sparkles,
  Link2,
  Plus,
  Archive,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

interface UnlinkedEmail {
  id: string;
  message_id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  date_sent: string;
  attachments_count: number;
  processed_status: string;
  body_text: string | null;
  ai_suggestion: {
    id: string;
    message_id: string;
    json_result: any;
    created_at: string;
    applied: boolean;
  } | null;
}

interface SinClasificarCase {
  id: string;
  ticket: string | null;
  estado_simple: string;
  created_at: string;
  detected_broker_email: string | null;
  ai_classification: any;
  ai_confidence: number | null;
}

interface Props {
  isMaster: boolean;
}

export default function PendUnclassifiedMessages({ isMaster }: Props) {
  const [unlinkedEmails, setUnlinkedEmails] = useState<UnlinkedEmail[]>([]);
  const [sinClasificarCases, setSinClasificarCases] = useState<SinClasificarCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [assigningEmail, setAssigningEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pendientes/unclassified');
      if (!res.ok) throw new Error('Error cargando datos');
      const data = await res.json();
      setUnlinkedEmails(data.unlinked_emails || []);
      setSinClasificarCases(data.sin_clasificar_cases || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isMaster) fetchData();
  }, [isMaster, fetchData]);

  const handleAction = async (
    action: 'assign' | 'create' | 'archive',
    emailId: string,
    caseId?: string,
    classificationId?: string,
  ) => {
    setActionLoading(emailId);
    try {
      const res = await fetch('/api/pendientes/unclassified/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          email_id: emailId,
          case_id: caseId,
          classification_id: classificationId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }

      // Remove from list
      setUnlinkedEmails(prev => prev.filter(e => e.id !== emailId));
      setAssigningEmail(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredEmails = unlinkedEmails.filter(email => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(q) ||
      email.from_email?.toLowerCase().includes(q) ||
      email.from_name?.toLowerCase().includes(q)
    );
  });

  if (!isMaster) return null;

  const totalCount = unlinkedEmails.length + sinClasificarCases.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[#010139]">Bandeja Sin Clasificar</h2>
          {totalCount > 0 && (
            <Badge className="bg-amber-500 text-white text-xs font-bold">
              {totalCount}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto text-red-700" onClick={() => setError(null)}>✕</Button>
        </div>
      )}

      {/* Search */}
      {unlinkedEmails.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por asunto, remitente..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {loading ? (
        <Card className="p-8 text-center">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500">Cargando correos...</p>
        </Card>
      ) : filteredEmails.length === 0 && sinClasificarCases.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="w-8 h-8 mx-auto text-green-400 mb-2" />
          <p className="text-gray-500 font-medium">No hay correos sin clasificar</p>
          <p className="text-gray-400 text-sm mt-1">Todos los correos están vinculados a un caso</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Unlinked emails */}
          {filteredEmails.map(email => (
            <Card key={email.id} className="border-l-4 border-l-amber-400 overflow-hidden">
              <div className="p-4">
                {/* Email header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-semibold text-sm text-[#010139] truncate">
                        {email.subject || '(sin asunto)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{email.from_name || email.from_email}</span>
                      <span>·</span>
                      <span>{new Date(email.date_sent).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      {email.attachments_count > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {email.attachments_count}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expand/collapse */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                  >
                    {expandedEmail === email.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>

                {/* AI Suggestion badge */}
                {email.ai_suggestion && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="border-purple-300 text-purple-700 text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI: {email.ai_suggestion.json_result?.case_type || 'clasificado'} · {email.ai_suggestion.json_result?.ramo || '?'} · {email.ai_suggestion.json_result?.aseguradora || '?'}
                      {email.ai_suggestion.json_result?.confidence && (
                        <span className="ml-1 opacity-75">({Math.round(email.ai_suggestion.json_result.confidence * 100)}%)</span>
                      )}
                    </Badge>
                    {email.ai_suggestion.json_result?.ticket_exception_reason && (
                      <Badge variant="outline" className="border-orange-300 text-orange-700 text-xs">
                        Sin ticket: {email.ai_suggestion.json_result.ticket_exception_reason}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Expanded body preview */}
                {expandedEmail === email.id && email.body_text && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                    {email.body_text.substring(0, 500)}
                    {email.body_text.length > 500 && '...'}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Assign to existing case */}
                  {assigningEmail === email.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <select
                        className="flex-1 text-xs border rounded px-2 py-1.5"
                        onChange={e => {
                          if (e.target.value) {
                            handleAction('assign', email.id, e.target.value, email.ai_suggestion?.id);
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Seleccionar caso...</option>
                        {sinClasificarCases.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.ticket || c.id.substring(0, 8)} — {c.detected_broker_email || 'sin broker'}
                          </option>
                        ))}
                      </select>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAssigningEmail(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={actionLoading === email.id || sinClasificarCases.length === 0}
                        onClick={() => setAssigningEmail(email.id)}
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        Asignar a caso
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={actionLoading === email.id}
                        onClick={() => handleAction('create', email.id, undefined, email.ai_suggestion?.id)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Crear caso
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-gray-500"
                        disabled={actionLoading === email.id}
                        onClick={() => handleAction('archive', email.id)}
                      >
                        <Archive className="w-3 h-3 mr-1" />
                        Archivar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
