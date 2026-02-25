'use client';

import { useState } from 'react';
import {
  FaSearch,
  FaFolderOpen,
  FaChevronRight,
  FaFileAlt,
  FaSignature,
  FaCheckCircle,
  FaHistory,
  FaShieldAlt,
  FaTimesCircle,
  FaDownload,
  FaEye,
} from 'react-icons/fa';
import { useAdmCotFilters } from '@/hooks/useAdmCot';
import { maskIp, maskCedula } from '@/types/adm-cot.types';
import type { AdmCotExpediente, ExpedienteDocument, AuditEntry } from '@/types/adm-cot.types';

// ════════════════════════════════════════════
// DOCUMENT CHIP
// ════════════════════════════════════════════

function DocumentChip({ doc }: { doc: ExpedienteDocument }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs">
      <FaFileAlt className="text-blue-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[#010139] truncate">{doc.name}</p>
        <p className="text-gray-400 text-[10px]">{doc.type} · {(doc.size / 1024).toFixed(0)} KB</p>
      </div>
      <button className="text-gray-400 hover:text-[#010139] transition-colors" title="Descargar">
        <FaDownload />
      </button>
    </div>
  );
}

// ════════════════════════════════════════════
// AUDIT LOG ENTRY
// ════════════════════════════════════════════

function AuditLogEntry({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
      <div className="w-1.5 h-1.5 rounded-full bg-[#010139] mt-1.5 flex-shrink-0" />
      <div className="text-xs">
        <p className="text-gray-700">
          <span className="font-medium">{entry.action}</span>
          {entry.by && <span className="text-gray-400"> — {entry.by}</span>}
        </p>
        <p className="text-gray-400 text-[10px]">
          {new Date(entry.at).toLocaleString('es-PA')}
          {entry.detail && ` · ${entry.detail}`}
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// DETAIL PANEL (slide-over)
// ════════════════════════════════════════════

function ExpedienteDetail({
  expediente,
  onClose,
}: {
  expediente: AdmCotExpediente;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'docs' | 'firma' | 'veracidad' | 'auditoria'>('docs');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#010139] text-white px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-200">Expediente de Emisión</p>
              <h2 className="text-lg font-bold">{expediente.client_name}</h2>
              <p className="text-xs text-blue-300 mt-0.5">
                {expediente.nro_poliza ? `Póliza ${expediente.nro_poliza}` : 'Sin número de póliza'} · {expediente.insurer}
              </p>
            </div>
            <button onClick={onClose} className="text-white hover:text-blue-200 text-lg">
              <FaTimesCircle />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Cédula</p>
            <p className="text-sm font-medium text-[#010139]">{maskCedula(expediente.cedula)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Prima Anual</p>
            <p className="text-sm font-medium text-[#8AAA19]">
              {expediente.annual_premium ? `$${Number(expediente.annual_premium).toFixed(2)}` : '—'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Cobertura</p>
            <p className="text-sm font-medium text-[#010139]">{expediente.coverage_type || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Emitida</p>
            <p className="text-sm font-medium text-[#010139]">
              {new Date(expediente.emitted_at).toLocaleDateString('es-PA')}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4">
          {([
            { key: 'docs', label: 'Documentos', icon: <FaFileAlt /> },
            { key: 'firma', label: 'Firma Digital', icon: <FaSignature /> },
            { key: 'veracidad', label: 'Veracidad', icon: <FaShieldAlt /> },
            { key: 'auditoria', label: 'Auditoría', icon: <FaHistory /> },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#010139] text-[#010139]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'docs' && (
            <div className="space-y-2">
              {expediente.documents.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FaFolderOpen className="text-3xl mx-auto mb-2" />
                  <p className="text-sm">No hay documentos adjuntos</p>
                </div>
              ) : (
                expediente.documents.map((doc, i) => <DocumentChip key={i} doc={doc} />)
              )}
            </div>
          )}

          {activeTab === 'firma' && (
            <div className="text-center py-6">
              {expediente.signature_url ? (
                <div className="space-y-3">
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 inline-block">
                    <img src={expediente.signature_url} alt="Firma digital" className="max-h-24" />
                  </div>
                  <p className="text-xs text-gray-500">
                    Firmado el {expediente.signature_at ? new Date(expediente.signature_at).toLocaleString('es-PA') : '—'}
                  </p>
                </div>
              ) : (
                <div className="text-gray-400">
                  <FaSignature className="text-3xl mx-auto mb-2" />
                  <p className="text-sm">Sin firma digital registrada</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'veracidad' && (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                expediente.veracidad_accepted
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                {expediente.veracidad_accepted ? (
                  <FaCheckCircle className="text-green-600 text-xl" />
                ) : (
                  <FaTimesCircle className="text-red-600 text-xl" />
                )}
                <div>
                  <p className={`text-sm font-bold ${expediente.veracidad_accepted ? 'text-green-800' : 'text-red-800'}`}>
                    {expediente.veracidad_accepted ? 'Aceptación de Veracidad Confirmada' : 'Veracidad No Aceptada'}
                  </p>
                  {expediente.veracidad_at && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(expediente.veracidad_at).toLocaleString('es-PA')}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-xs space-y-1 text-gray-600">
                <p><span className="font-medium">IP:</span> {maskIp(expediente.veracidad_ip)}</p>
                <p><span className="font-medium">User Agent:</span> {expediente.veracidad_user_agent || '—'}</p>
              </div>
            </div>
          )}

          {activeTab === 'auditoria' && (
            <div>
              {expediente.audit_log.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FaHistory className="text-3xl mx-auto mb-2" />
                  <p className="text-sm">Sin registros de auditoría</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {expediente.audit_log.map((entry, i) => <AuditLogEntry key={i} entry={entry} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tracking footer */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-[10px] text-gray-400 space-y-0.5">
          <p>IP: {maskIp(expediente.ip_address)} · Región: {expediente.region || '—'}</p>
          <p>User Agent: {expediente.user_agent || '—'}</p>
          <p className="font-medium text-gray-500">⚠ Solo lectura — Nada editable desde UI</p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

export default function AdmCotExpedientes() {
  const { filters, pagination, updateFilter, resetFilters, setPage } = useAdmCotFilters();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpediente, setSelectedExpediente] = useState<AdmCotExpediente | null>(null);

  // Placeholder — will be replaced with real data from getExpedientes()
  const expedientes: AdmCotExpediente[] = [];
  const totalPages = Math.ceil(pagination.total / pagination.pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[#010139]">Expedientes de Emisión</h2>
        <p className="text-xs text-gray-500">Solo lectura — Registro completo de emisiones confirmadas</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Buscar por nombre, cédula, póliza..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updateFilter('search', searchTerm || undefined)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#010139]/20 focus:border-[#010139] outline-none"
            />
          </div>
          <select
            value={filters.insurer || ''}
            onChange={(e) => updateFilter('insurer', e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5"
          >
            <option value="">Aseguradora</option>
            <option value="INTERNACIONAL">Internacional</option>
            <option value="FEDPA">FEDPA</option>
          </select>
          <select
            value={filters.ramo || ''}
            onChange={(e) => updateFilter('ramo', e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5"
          >
            <option value="">Ramo</option>
            <option value="AUTO">Auto</option>
          </select>
          <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-[#010139] underline">
            Limpiar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Póliza</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Cédula</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Aseguradora</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Cobertura</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Prima</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Docs</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Firma</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Veracidad</th>
                <th className="py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase">Emitida</th>
                <th className="py-2.5 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {expedientes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <FaFolderOpen className="text-4xl text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">No hay expedientes registrados</p>
                    <p className="text-xs text-gray-400 mt-1">Los expedientes se crean automáticamente al confirmar una emisión</p>
                  </td>
                </tr>
              ) : (
                expedientes.map((exp) => (
                  <tr
                    key={exp.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedExpediente(exp)}
                  >
                    <td className="py-2.5 px-3 text-xs font-mono text-[#010139] font-medium">{exp.nro_poliza || '—'}</td>
                    <td className="py-2.5 px-3 text-xs font-medium text-[#010139]">{exp.client_name}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{maskCedula(exp.cedula)}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{exp.insurer}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{exp.coverage_type || '—'}</td>
                    <td className="py-2.5 px-3 text-xs font-medium text-[#8AAA19]">
                      {exp.annual_premium ? `$${Number(exp.annual_premium).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">{exp.documents.length}</td>
                    <td className="py-2.5 px-3">
                      {exp.signature_url ? (
                        <FaCheckCircle className="text-green-500 text-sm" />
                      ) : (
                        <FaTimesCircle className="text-gray-300 text-sm" />
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {exp.veracidad_accepted ? (
                        <FaCheckCircle className="text-green-500 text-sm" />
                      ) : (
                        <FaTimesCircle className="text-gray-300 text-sm" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(exp.emitted_at).toLocaleDateString('es-PA')}
                    </td>
                    <td className="py-2.5 px-3">
                      <FaChevronRight className="text-gray-400 text-xs" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(1, pagination.page - 1))} disabled={pagination.page === 1}
                className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100">Anterior</button>
              <span className="px-3 py-1 text-xs text-gray-600">{pagination.page}/{totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, pagination.page + 1))} disabled={pagination.page === totalPages}
                className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100">Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail slide-over */}
      {selectedExpediente && (
        <ExpedienteDetail expediente={selectedExpediente} onClose={() => setSelectedExpediente(null)} />
      )}
    </div>
  );
}
