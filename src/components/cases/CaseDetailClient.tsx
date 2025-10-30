'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaEdit, FaFileUpload, FaDownload, FaTrash, FaCheckCircle, FaTimesCircle, FaClock, FaUser, FaBuilding, FaFileAlt, FaFolder } from 'react-icons/fa';
import { toast } from 'sonner';
import { supabaseClient } from '@/lib/supabase/client';
import { CASE_SECTIONS, CASE_STATUSES, MANAGEMENT_TYPES, POLICY_TYPES, getSLALabel, getSLAColor, STATUS_COLORS } from '@/lib/constants/cases';
import { actionToggleChecklistItem, actionDeleteCaseFile } from '@/app/(app)/cases/actions-details';
import ExpedienteManager from '@/components/expediente/ExpedienteManager';

interface CaseDetailClientProps {
  caseData: any;
  userProfile: any;
}

export default function CaseDetailClient({ caseData, userProfile }: CaseDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'files' | 'checklist' | 'history' | 'expediente'>('info');

  // Leer tab desde URL al cargar
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['info', 'files', 'checklist', 'history', 'expediente'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const isMaster = userProfile.role === 'master';
  const isBroker = userProfile.role === 'broker';

  const daysRemaining = caseData.sla_date 
    ? Math.ceil((new Date(caseData.sla_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload to storage
      const fileExtension = file.name.split('.').pop() || 'pdf';
      const fileName = `${Date.now()}_${file.name}`;
      const storagePath = `${caseData.id}/${fileName}`;

      const supabase = supabaseClient();
      
      const { error: uploadError } = await supabase.storage
        .from('pendientes')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Error al subir archivo');
        return;
      }

      // Create file record in database
      const { error: dbError } = await supabase
        .from('case_files')
        .insert([{
          case_id: caseData.id,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: storagePath,
          created_by: userProfile.id,
        }]);

      if (dbError) {
        console.error('DB error:', dbError);
        toast.error('Error al guardar archivo');
        return;
      }

      toast.success('Archivo subido correctamente');
      router.refresh();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error inesperado');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = async (file: any) => {
    try {
      const supabase = supabaseClient();
      const { data, error } = await supabase.storage
        .from('pendientes')
        .download(file.storage_path);

      if (error) {
        toast.error('Error al descargar archivo');
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Error al descargar archivo');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!isMaster) {
      toast.error('Solo Master puede eliminar archivos');
      return;
    }

    if (!confirm('¿Estás seguro de eliminar este archivo?')) return;

    const result = await actionDeleteCaseFile(fileId);
    if (result.ok) {
      toast.success('Archivo eliminado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleToggleChecklist = async (itemId: string, completed: boolean) => {
    const result = await actionToggleChecklistItem(itemId, !completed);
    if (result.ok) {
      toast.success(completed ? 'Marcado como pendiente' : 'Marcado como completado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/cases"
              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <FaArrowLeft className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[#010139]">
                Caso #{caseData.id.slice(0, 8)}
              </h1>
              <p className="text-gray-600 mt-1">
                {caseData.client_name || 'Sin cliente'}
              </p>
            </div>
          </div>

          {isMaster && (
            <Link
              href={`/cases/${caseData.id}/edit`}
              className="px-6 py-3 bg-[#010139] hover:bg-[#020270] text-white rounded-lg flex items-center gap-2 font-semibold transition-all"
            >
              <FaEdit /> Editar
            </Link>
          )}
        </div>

        {/* Status and SLA */}
        <div className="flex flex-wrap gap-3 mt-4">
          <span className={`px-4 py-2 rounded-full text-sm font-semibold border-2 ${STATUS_COLORS[caseData.status as keyof typeof STATUS_COLORS]}`}>
            {CASE_STATUSES[caseData.status as keyof typeof CASE_STATUSES]}
          </span>
          {daysRemaining !== null && (
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getSLAColor(daysRemaining)}`}>
              <FaClock className="inline mr-1" />
              {getSLALabel(daysRemaining)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100">
        <div className="border-b-2 border-gray-100 overflow-x-auto">
          <div className="flex min-w-max">
            {[
              { id: 'info', label: 'Información', icon: FaFileAlt },
              { id: 'files', label: 'Archivos', icon: FaFileUpload },
              { id: 'checklist', label: 'Checklist', icon: FaCheckCircle },
              { id: 'history', label: 'Historial', icon: FaClock },
              ...(caseData.client_id ? [{ id: 'expediente', label: 'Expediente', icon: FaFolder }] : []),
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    px-6 py-4 font-semibold transition-all flex items-center gap-2
                    ${activeTab === tab.id
                      ? 'text-[#010139] border-b-4 border-[#010139] bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-[#010139] mb-4">Información General</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Sección</p>
                      <p className="font-semibold">{CASE_SECTIONS[caseData.section as keyof typeof CASE_SECTIONS]}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Tipo de Gestión</p>
                      <p className="font-semibold">{MANAGEMENT_TYPES[caseData.management_type as keyof typeof MANAGEMENT_TYPES]}</p>
                    </div>
                    {caseData.policy_type && (
                      <div>
                        <p className="text-sm text-gray-500">Tipo de Póliza</p>
                        <p className="font-semibold">{POLICY_TYPES[caseData.policy_type as keyof typeof POLICY_TYPES]}</p>
                      </div>
                    )}
                    {caseData.policy_number && (
                      <div>
                        <p className="text-sm text-gray-500">Número de Póliza</p>
                        <p className="font-semibold font-mono">{caseData.policy_number}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#010139] mb-4">Participantes</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Corredor</p>
                      <p className="font-semibold">
                        <FaUser className="inline mr-2" />
                        {caseData.broker?.name || caseData.broker?.profiles?.full_name || caseData.broker?.profiles?.email || 'Sin corredor'}
                      </p>
                    </div>
                    {caseData.insurer && (
                      <div>
                        <p className="text-sm text-gray-500">Aseguradora</p>
                        <p className="font-semibold">
                          <FaBuilding className="inline mr-2" />
                          {caseData.insurer.name}
                        </p>
                      </div>
                    )}
                    {caseData.client && (
                      <div>
                        <p className="text-sm text-gray-500">Cliente</p>
                        <p className="font-semibold">{caseData.client.name}</p>
                        {caseData.client.national_id && (
                          <p className="text-sm text-gray-600">{caseData.client.national_id}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {caseData.notes && (
                <div>
                  <h3 className="text-lg font-bold text-[#010139] mb-2">Notas</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                    <p className="text-gray-700 whitespace-pre-wrap">{caseData.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#010139]">Archivos Adjuntos</h3>
                <label className={`
                  px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-all cursor-pointer
                  ${uploading ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#8AAA19] hover:bg-[#7a9916] text-white'}
                `}>
                  <FaFileUpload />
                  {uploading ? 'Subiendo...' : 'Adjuntar Archivo'}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              {caseData.files && caseData.files.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {caseData.files.map((file: any) => (
                    <div
                      key={file.id}
                      className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{file.original_name}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span>{(file.size_bytes / 1024).toFixed(2)} KB</span>
                            <span>{new Date(file.created_at).toLocaleDateString('es-PA')}</span>
                            {file.document_type && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                {file.document_type}
                              </span>
                            )}
                            {file.category === 'inspection' && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                                📸 Inspección
                              </span>
                            )}
                          </div>
                          {file.is_multi_document && file.document_parts && (
                            <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                              <p className="font-semibold text-purple-800 mb-1">📦 Documento múltiple contiene:</p>
                              <p className="text-purple-700">{file.document_parts.join(', ')}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-all"
                          >
                            <FaDownload /> Descargar
                          </button>
                          {isMaster && (
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition-all"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-gray-400 text-6xl mb-4">📎</div>
                  <p className="text-gray-600">No hay archivos adjuntos</p>
                  <p className="text-sm text-gray-500 mt-1">Adjunta el primer archivo usando el botón de arriba</p>
                </div>
              )}
            </div>
          )}

          {/* Checklist Tab */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#010139]">Checklist de Documentos</h3>
              {caseData.checklist && caseData.checklist.length > 0 ? (
                <div className="space-y-3">
                  {caseData.checklist.map((item: any) => (
                    <div
                      key={item.id}
                      className={`
                        p-4 rounded-lg border-2 transition-all
                        ${item.completed ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggleChecklist(item.id, item.completed)}
                          className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`font-semibold ${item.completed ? 'text-green-700 line-through' : 'text-gray-700'}`}>
                              {item.label}
                            </p>
                            {item.required && !item.completed && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">
                                Requerido
                              </span>
                            )}
                          </div>
                          {item.completed && item.completed_at && (
                            <p className="text-xs text-green-600 mt-1">
                              Completado el {new Date(item.completed_at).toLocaleDateString('es-PA')}
                            </p>
                          )}
                        </div>
                        {item.completed ? (
                          <FaCheckCircle className="text-green-600 text-xl" />
                        ) : (
                          <FaTimesCircle className="text-gray-400 text-xl" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-600">No hay items en el checklist</p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#010139]">Historial de Cambios</h3>
              {caseData.history && caseData.history.length > 0 ? (
                <div className="space-y-3">
                  {caseData.history.map((entry: any) => (
                    <div key={entry.id} className="bg-gray-50 rounded-lg p-4 border-l-4 border-[#010139]">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{entry.action}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {entry.created_by_profile?.name || entry.created_by_profile?.email || 'Usuario'}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleString('es-PA')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-600">No hay historial disponible</p>
                </div>
              )}
            </div>
          )}

          {/* Expediente Tab */}
          {activeTab === 'expediente' && caseData.client_id && (
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-4">
                <p className="text-sm text-blue-800">
                  <strong>📁 Expediente del Cliente</strong> - Documentos permanentes del cliente (cédula, licencia, etc.)
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {isBroker && 'Puedes ver y descargar documentos. Para agregar nuevos documentos, contacta al administrador.'}
                  {isMaster && 'Puedes ver, descargar, agregar y eliminar documentos del expediente.'}
                </p>
              </div>
              <ExpedienteManager
                clientId={caseData.client_id}
                policyId={null}
                showClientDocs={true}
                showPolicyDocs={false}
                showOtros={true}
                readOnly={isBroker} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
