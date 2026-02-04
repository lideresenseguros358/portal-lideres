'use client';

/**
 * RENEWAL ACTIONS PANEL
 * Panel de acciones específicas para casos de renovación
 * Aparece en el modal de detalle cuando el caso es de tipo renovación
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Upload, 
  FileText,
  AlertCircle,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import type { CasoPendiente } from '@/types/pendientes';

interface RenewalActionsPanelProps {
  caso: CasoPendiente;
  onUpdate: () => void;
}

export default function RenewalActionsPanel({ caso, onUpdate }: RenewalActionsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Determinar respuesta del cliente desde notes
  const clientResponse = caso.notes?.includes('DESEA renovar') 
    ? 'acepta' 
    : caso.notes?.includes('NO DESEA renovar') 
    ? 'rechaza' 
    : 'desconocido';

  /**
   * ACCIÓN 1: Cliente acepta - Adjuntar carátula y cerrar
   */
  const handleAttachAndClose = async () => {
    if (!selectedFile) {
      toast.error('Selecciona un archivo primero');
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('case_id', caso.id);
      formData.append('action', 'attach_and_close');

      const response = await fetch('/api/cases/renewal-actions', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Error al procesar');

      toast.success('✅ Carátula adjuntada y caso cerrado');
      onUpdate();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al adjuntar archivo');
    } finally {
      setUploadingFile(false);
    }
  };

  /**
   * ACCIÓN 2: Cliente acepta - Enviar pregunta personalizada
   */
  const handleSendQuestion = async () => {
    if (!customQuestion.trim()) {
      toast.error('Escribe una pregunta primero');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/cases/renewal-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caso.id,
          action: 'send_question',
          question: customQuestion,
        }),
      });

      if (!response.ok) throw new Error('Error al enviar');

      toast.success('📧 Pregunta enviada al cliente');
      setCustomQuestion('');
      onUpdate();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar pregunta');
    } finally {
      setLoading(false);
    }
  };

  /**
   * ACCIÓN 3: Cliente rechaza - Cambiar a cancelación
   */
  const handleMarkCancellation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cases/renewal-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caso.id,
          action: 'mark_cancellation',
        }),
      });

      if (!response.ok) throw new Error('Error al marcar');

      toast.success('🚫 Caso marcado como CANCELACIÓN');
      onUpdate();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cambiar estado');
    } finally {
      setLoading(false);
    }
  };

  /**
   * ACCIÓN 4: Póliza eliminada - Cerrar caso
   */
  const handleCloseCancellation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cases/renewal-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caso.id,
          action: 'close_cancellation',
        }),
      });

      if (!response.ok) throw new Error('Error al cerrar');

      toast.success('✅ Caso de cancelación cerrado');
      onUpdate();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cerrar caso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Estado de Respuesta del Cliente */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${
            clientResponse === 'acepta' ? 'bg-green-500' : 
            clientResponse === 'rechaza' ? 'bg-red-500' : 
            'bg-gray-500'
          }`}>
            {clientResponse === 'acepta' ? (
              <CheckCircle2 className="w-5 h-5 text-white" />
            ) : clientResponse === 'rechaza' ? (
              <XCircle className="w-5 h-5 text-white" />
            ) : (
              <AlertCircle className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-bold text-[#010139]">
              {clientResponse === 'acepta' && '✅ Cliente DESEA renovar'}
              {clientResponse === 'rechaza' && '❌ Cliente NO desea renovar'}
              {clientResponse === 'desconocido' && '⚠️ Respuesta desconocida'}
            </p>
            <p className="text-sm text-gray-600">
              {caso.notes?.substring(0, 100)}...
            </p>
          </div>
        </div>
      </Card>

      {/* OPCIONES: Cliente ACEPTA */}
      {clientResponse === 'acepta' && (
        <>
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-[#010139]">
              <Upload className="w-5 h-5 text-[#8AAA19]" />
              Opción 1: Adjuntar Carátula y Cerrar
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label>Archivo de Carátula (PDF)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-2"
                />
                {selectedFile && (
                  <p className="text-sm text-gray-600 mt-1">
                    📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <Button
                onClick={handleAttachAndClose}
                disabled={!selectedFile || uploadingFile}
                className="w-full bg-[#8AAA19] hover:bg-[#6d8814]"
              >
                {uploadingFile ? (
                  <>⏳ Subiendo...</>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Adjuntar y Cerrar Caso
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500">
                Esto adjuntará la carátula al caso y lo cerrará como APROBADO automáticamente.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-[#010139]">
              <MessageSquare className="w-5 h-5 text-[#8AAA19]" />
              Opción 2: Enviar Pregunta Personalizada
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label>Pregunta para el Cliente</Label>
                <Textarea
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Ej: ¿Desea aumentar el monto de cobertura en la renovación?"
                  rows={4}
                  className="mt-2"
                />
              </div>

              <Button
                onClick={handleSendQuestion}
                disabled={!customQuestion.trim() || loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar Pregunta al Cliente
              </Button>

              <p className="text-xs text-gray-500">
                El cliente recibirá un email con tu pregunta y podrá responder. Luego podrás re-enviar el correo con botones SI/NO.
              </p>
            </div>
          </Card>
        </>
      )}

      {/* OPCIONES: Cliente RECHAZA */}
      {clientResponse === 'rechaza' && (
        <>
          <Card className="p-6 bg-red-50 border-red-200">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-900">
              <XCircle className="w-5 h-5 text-red-600" />
              Cliente Rechazó la Renovación
            </h3>
            
            <div className="space-y-4">
              {caso.status !== 'CERRADO' && caso.notes?.includes('CANCELACIÓN') === false && (
                <>
                  <p className="text-sm text-red-800 mb-4">
                    El cliente ha decidido no renovar su póliza. Debes marcar este caso como CANCELACIÓN y proceder con la eliminación de la póliza.
                  </p>

                  <Button
                    onClick={handleMarkCancellation}
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Marcar como CANCELACIÓN
                  </Button>
                </>
              )}

              {caso.notes?.includes('CANCELACIÓN') && caso.status !== 'CERRADO' && (
                <>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ <strong>Acción Requerida:</strong> El Master debe eliminar la póliza del sistema manualmente antes de cerrar este caso.
                    </p>
                  </div>

                  <Button
                    onClick={handleCloseCancellation}
                    disabled={loading}
                    className="w-full bg-gray-600 hover:bg-gray-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar Póliza Eliminada y Cerrar
                  </Button>
                </>
              )}

              {caso.status === 'CERRADO' && (
                <div className="bg-gray-100 p-4 rounded text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
                  <p className="text-sm text-gray-700 font-semibold">
                    Caso cerrado - Cancelación completada
                  </p>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Caso desconocido */}
      {clientResponse === 'desconocido' && (
        <Card className="p-6 bg-yellow-50 border-yellow-300">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-900">
                No se puede determinar la respuesta del cliente
              </p>
              <p className="text-sm text-yellow-800 mt-1">
                Verifica las notas del caso o el historial de correos para entender el estado de esta renovación.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
