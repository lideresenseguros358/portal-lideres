'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, Edit3, Trash2, ChevronDown, ChevronUp, FileDown, FileSpreadsheet, Download, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import ClientForm from './ClientForm';
import ClientsByInsurer from './ClientsByInsurer';
import ClientPolicyWizard from './ClientPolicyWizard';
import PreliminaryClientsTab from './PreliminaryClientsTab';
import ExportFormatModal from './ExportFormatModal';
import ExpedienteManager from '@/components/expediente/ExpedienteManager';
import { ClientWithPolicies, InsurerWithCount } from '@/types/db';
import { actionGetPreliminaryClients } from '@/app/(app)/db/preliminary-actions';

interface DatabaseTabsProps {
  activeTab: string;
  clients: ClientWithPolicies[];
  insurers: InsurerWithCount[];
  brokers: any[];
  searchQuery?: string;
  role: string;
  userEmail: string;
}

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('es-PA');
};

const getPoliciesCount = (client: ClientWithPolicies) => client.policies?.length ?? 0;

const getPrimaryInsurerName = (client: ClientWithPolicies) => {
  const primary = client.policies?.find((policy) => policy.insurers?.name);
  return primary?.insurers?.name?.toUpperCase?.() || 'SIN ASEGURADORA';
};

const getClientRenewalDisplay = (client: ClientWithPolicies) => {
  const withDates = (client.policies || []).filter((policy) => policy.renewal_date);
  if (!withDates.length) {
    return '—';
  }

  const earliest = withDates.reduce<Date | null>((acc, policy) => {
    if (!policy.renewal_date) return acc;
    const current = new Date(policy.renewal_date);
    if (Number.isNaN(current.getTime())) return acc;
    if (!acc || current < acc) return current;
    return acc;
  }, null);

  return earliest ? earliest.toLocaleDateString('es-PA') : '—';
};

// Función para exportar a PDF
const exportToPDF = async (clients: ClientWithPolicies[], role: string) => {
  try {
    toast.loading('Generando PDF...');
    
    // Importación dinámica de jsPDF
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    
    const doc = new jsPDF() as any;
    
    // Logo y Header
    doc.setFillColor(1, 1, 57); // #010139
    doc.rect(0, 0, 210, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LÍDERES EN SEGUROS', 105, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Base de Datos de Clientes', 105, 23, { align: 'center' });
    doc.text(new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' }), 105, 30, { align: 'center' });
    
    // Preparar datos
    const tableData = clients.map(client => {
      const row: any[] = [
        client.name?.toUpperCase() || '—',
        client.national_id?.toUpperCase() || '—',
        client.phone || '—',
        client.email || '—',
        client.policies?.length || 0,
        getPrimaryInsurerName(client),
        getClientRenewalDisplay(client)
      ];
      
      if (role === 'master') {
        row.push((client as any).brokers?.name || '—');
      }
      
      return row;
    });
    
    const headers = role === 'master' 
      ? ['Cliente', 'Cédula', 'Celular', 'Correo', 'Pólizas', 'Aseguradora', 'Renovación', 'Corredor']
      : ['Cliente', 'Cédula', 'Celular', 'Correo', 'Pólizas', 'Aseguradora', 'Renovación'];
    
    // Tabla
    doc.autoTable({
      head: [headers],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: {
        fillColor: [1, 1, 57], // #010139
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 23 },
        3: { cellWidth: 35 },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 25 },
        6: { cellWidth: 22 },
      },
      margin: { left: 10, right: 10 }
    });
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Página ${i} de ${pageCount}`,
        105,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
    
    // Guardar
    doc.save(`clientes-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast.dismiss();
    toast.success('PDF descargado correctamente');
  } catch (error) {
    console.error('Error al generar PDF:', error);
    toast.dismiss();
    toast.error('Error al generar el PDF');
  }
};

// Función para exportar a Excel
const exportToExcel = async (clients: ClientWithPolicies[], role: string) => {
  try {
    toast.loading('Generando archivo Excel...');
    
    // Importación dinámica de xlsx
    const XLSX = await import('xlsx');
    
    // Preparar datos
    const data = clients.map(client => {
      const row: any = {
        'Cliente': client.name?.toUpperCase() || '—',
        'Cédula': client.national_id?.toUpperCase() || '—',
        'Celular': client.phone || '—',
        'Correo': client.email || '—',
        'Pólizas': client.policies?.length || 0,
        'Aseguradora Principal': getPrimaryInsurerName(client),
        'Próxima Renovación': getClientRenewalDisplay(client)
      };
      
      if (role === 'master') {
        row['Corredor Asignado'] = (client as any).brokers?.name || '—';
      }
      
      return row;
    });
    
    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 30 }, // Cliente
      { wch: 15 }, // Cédula
      { wch: 15 }, // Celular
      { wch: 30 }, // Correo
      { wch: 10 }, // Pólizas
      { wch: 20 }, // Aseguradora
      { wch: 15 }, // Renovación
    ];
    
    if (role === 'master') {
      colWidths.push({ wch: 25 }); // Corredor
    }
    
    ws['!cols'] = colWidths;
    
    // Agregar hoja al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    
    // Descargar archivo
    XLSX.writeFile(wb, `clientes-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.dismiss();
    toast.success('Archivo Excel descargado correctamente');
  } catch (error) {
    console.error('Error al generar Excel:', error);
    toast.dismiss();
    toast.error('Error al generar el archivo Excel');
  }
};

type ClientRowData = {
  client: ClientWithPolicies;
  primaryInsurer: string;
  renewalDisplay: string;
  policiesCount: number;
  nationalId: string;
  email: string;
  phone: string;
  brokerName: string;
};

interface ClientsListViewProps {
  clients: ClientWithPolicies[];
  onView: (clientId: string) => void;
  onEdit: (clientId: string) => void;
  onDelete: (clientId: string) => void;
  role: string;
  selectedClients: Set<string>;
  onToggleClient: (clientId: string) => void;
  onSelectAll: () => void;
}

const ClientsListView = ({ clients, onView, onEdit, onDelete, role, selectedClients, onToggleClient, onSelectAll }: ClientsListViewProps) => {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const items = useMemo<ClientRowData[]>(
    () =>
      clients.map((client) => ({
        client,
        primaryInsurer: getPrimaryInsurerName(client),
        renewalDisplay: getClientRenewalDisplay(client),
        policiesCount: getPoliciesCount(client),
        nationalId: client.national_id?.toUpperCase?.() || '—',
        email: client.email || '—',
        phone: client.phone || '—',
        brokerName: (client as any).brokers?.name || '—',
      })),
    [clients]
  );

  if (clients.length === 0) {
    return (
      <div className="empty-state">
        <p>No se encontraron clientes</p>
        <Link href="/db?modal=new-client" className="btn-primary">
          Crear primer cliente
        </Link>
      </div>
    );
  }

  const allSelected = clients.length > 0 && selectedClients.size === clients.length;

  return (
    <div className="clients-wrapper">
      <table className="clients-table">
        <thead>
          <tr className="ct-head">
            <th className="ct-th" style={{ width: '50px' }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] cursor-pointer"
              />
            </th>
            <th className="ct-th">Cliente</th>
            <th className="ct-th">Cédula</th>
            <th className="ct-th">Celular</th>
            <th className="ct-th">Pólizas</th>
            <th className="ct-th">Aseguradora</th>
            <th className="ct-th">Ramo</th>
            <th className="ct-th">Renovación</th>
            {role === 'master' && <th className="ct-th">Corredor</th>}
            <th className="ct-th text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ client, nationalId, email, phone, brokerName }) => {
            const isExpanded = expandedClients.has(client.id);
            const isSelected = selectedClients.has(client.id);
            return (
              <React.Fragment key={client.id}>
                <tr className="ct-item">
                  <td className="ct-td">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleClient(client.id)}
                      className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="ct-td">
                    <button
                      className="ct-trigger"
                      aria-expanded={isExpanded}
                      onClick={() => toggleClient(client.id)}
                    >
                      <span className="ct-name">{client.name}</span>
                      {isExpanded ? (
                        <ChevronUp size={18} className="ct-chevron" />
                      ) : (
                        <ChevronDown size={18} className="ct-chevron" />
                      )}
                    </button>
                  </td>
                  <td className="ct-td">{nationalId}</td>
                  <td className="ct-td">{phone}</td>
                  <td className="ct-td">
                    <span className="font-semibold text-[#010139]">{client.policies?.length || 0}</span>
                  </td>
                  <td className="ct-td">
                    {client.policies?.length ? (
                      <div className="flex flex-col gap-1">
                        {client.policies.slice(0, 2).map((pol: any, idx: number) => (
                          <span key={idx} className="text-xs text-gray-700 truncate">
                            {pol.insurers?.name || '—'}
                          </span>
                        ))}
                        {client.policies.length > 2 && (
                          <span className="text-xs text-gray-500">+{client.policies.length - 2} más</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="ct-td">
                    {client.policies?.length ? (
                      <div className="flex flex-col gap-1">
                        {client.policies.slice(0, 2).map((pol: any, idx: number) => (
                          <span key={idx} className="text-xs text-gray-700 truncate">
                            {pol.ramo || '—'}
                          </span>
                        ))}
                        {client.policies.length > 2 && (
                          <span className="text-xs text-gray-500">+{client.policies.length - 2} más</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="ct-td">
                    {client.policies?.length ? (
                      <div className="flex flex-col gap-1">
                        {client.policies.slice(0, 2).map((pol: any, idx: number) => (
                          <span key={idx} className="text-xs text-gray-700">
                            {pol.renewal_date ? new Date(pol.renewal_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        ))}
                        {client.policies.length > 2 && (
                          <span className="text-xs text-gray-500">...</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {role === 'master' && <td className="ct-td">{brokerName}</td>}
                  <td className="ct-td">
                    <div className="ct-actions">
                      <button 
                        className="icon-btn folder" 
                        onClick={() => {
                          toggleClient(client.id);
                          toast.success('Expandir para ver expediente del cliente');
                        }}
                        aria-label="Ver expediente"
                        title="Ver Expediente"
                      >
                        <FolderOpen size={18} />
                      </button>
                      <button 
                        className="icon-btn view" 
                        onClick={() => onView(client.id)}
                        aria-label="Ver cliente"
                        title="Ver Detalles"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        className="icon-btn edit" 
                        onClick={() => onEdit(client.id)}
                        aria-label="Editar cliente"
                        title="Editar Cliente"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        className="icon-btn delete" 
                        onClick={() => onDelete(client.id)}
                        aria-label="Eliminar cliente"
                        title="Eliminar Cliente"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan={role === 'master' ? 10 : 9} className="ct-detail">
                      <div className="pol-panel">
                        <div className="pol-header">
                          <h4 className="pol-title">Pólizas del Cliente</h4>
                          <span className="pol-count">{client.policies?.length || 0} póliza(s)</span>
                        </div>
                        {client.policies?.length ? (
                          <div className="pol-list">
                            {client.policies.map((policy) => (
                              <div key={policy.id} className="pol-row">
                                <div className="pol-main">
                                  <div className="pol-number">
                                    📋 {policy.policy_number || 'Sin número'}
                                  </div>
                                  <div className="pol-meta">
                                    <span><strong>Aseguradora:</strong> {policy.insurers?.name?.toUpperCase?.() || '—'}</span>
                                    <span>•</span>
                                    <span><strong>Ramo:</strong> {policy.ramo?.toUpperCase?.() || '—'}</span>
                                  </div>
                                  <div className="pol-meta">
                                    <span><strong>Inicio:</strong> {formatDate((policy as any).start_date)}</span>
                                    <span>•</span>
                                    <span><strong>Renovación:</strong> {formatDate(policy.renewal_date)}</span>
                                    <span>•</span>
                                    <span className={`font-semibold ${
                                      policy.status === 'ACTIVA' ? 'text-green-600' : 
                                      policy.status === 'VENCIDA' ? 'text-red-600' : 
                                      'text-gray-600'
                                    }`}>
                                      {policy.status || 'SIN ESTADO'}
                                    </span>
                                  </div>
                                  {(policy as any).notas && (
                                    <div className="pol-notas">
                                      <span className="pol-notas-label">💬 Notas:</span>
                                      <span className="pol-notas-text">{(policy as any).notas}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="pol-actions">
                                  <button 
                                    className="icon-btn view" 
                                    aria-label="Ver póliza"
                                    onClick={() => console.log('Ver póliza:', policy.id)}
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button 
                                    className="icon-btn edit" 
                                    aria-label="Editar póliza"
                                    onClick={() => console.log('Editar póliza:', policy.id)}
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button 
                                    className="icon-btn delete" 
                                    aria-label="Eliminar póliza"
                                    onClick={() => console.log('Eliminar póliza:', policy.id)}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="no-policies">Este cliente no tiene pólizas registradas</p>
                        )}

                        {/* Expediente Section */}
                        <div className="expediente-section">
                          <div className="expediente-header">
                            <h4 className="pol-title">📁 Expediente del Cliente</h4>
                            <span className="text-xs text-gray-600">Documentos permanentes</span>
                          </div>
                          <ExpedienteManager
                            clientId={(client as any).id}
                            showClientDocs={true}
                            showPolicyDocs={false}
                            showOtros={true}
                            readOnly={role !== 'master'}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default function DatabaseTabs({ 
  activeTab, 
  clients, 
  insurers,
  brokers,
  role,
  userEmail,
}: DatabaseTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modal = searchParams.get('modal');
  const clientToEditId = searchParams.get('editClient');
  const view = searchParams.get('view') || 'clients';
  const [preliminaryCount, setPreliminaryCount] = useState<number>(0);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  // Load preliminary count
  useEffect(() => {
    const loadCount = async () => {
      const result = await actionGetPreliminaryClients();
      if (result.ok) {
        setPreliminaryCount(result.data.length);
      }
    };
    loadCount();
  }, [view]);

  const clientToEdit = clientToEditId ? clients.find(c => c.id === clientToEditId) : null;

  const handleView = (id: string) => router.push(`/db?tab=clients&modal=edit-client&editClient=${id}`, { scroll: false });
  const handleEdit = handleView;
  const handleDelete = (id: string) => router.push(`/db?tab=clients&modal=delete-client&deleteClient=${id}`, { scroll: false });

  const handleToggleClient = (clientId: string) => {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.id)));
    }
  };

  const handleExportFormat = async (format: 'pdf' | 'excel') => {
    const clientsToExport = selectedClients.size > 0 
      ? clients.filter(c => selectedClients.has(c.id))
      : clients;
    
    if (format === 'pdf') {
      await exportToPDF(clientsToExport, role);
    } else {
      await exportToExcel(clientsToExport, role);
    }
    
    setShowExportModal(false);
    setSelectedClients(new Set());
  };

  const renderTabContent = () => {
    if (view === 'insurers') {
      return <ClientsByInsurer clients={clients} insurers={insurers} />;
    }
    if (view === 'preliminary') {
      return <PreliminaryClientsTab insurers={insurers} brokers={brokers} userRole={role} />;
    }
    return (
      <ClientsListView 
        clients={clients} 
        onView={handleView} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        role={role}
        selectedClients={selectedClients}
        onToggleClient={handleToggleClient}
        onSelectAll={handleSelectAll}
      />
    );
  };

  return (
    <>
      {modal === 'new-client' && (
        <ClientPolicyWizard
          onClose={() => router.push('/db?tab=clients')}
          onSuccess={() => {
            router.push('/db?tab=clients');
            router.refresh();
          }}
          role={role}
          userEmail={userEmail}
        />
      )}
      {modal === 'edit-client' && clientToEdit && (
        <Modal title="Editar Cliente" onClose={() => router.push('/db?tab=clients')}>
          <ClientForm client={clientToEdit} onClose={() => router.push('/db?tab=clients', { scroll: false })} />
        </Modal>
      )}

      {/* Integrated Toolbar: Tabs + Actions */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* View Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                view === 'clients'
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => router.push('/db?tab=clients&view=clients', { scroll: false })}
            >
              Clientes
            </button>
            <button
              className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 relative ${
                view === 'preliminary'
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => router.push('/db?tab=clients&view=preliminary', { scroll: false })}
            >
              Preliminares
              {preliminaryCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
                  {preliminaryCount}
                </span>
              )}
            </button>
            <button
              className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
                view === 'insurers'
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => router.push('/db?tab=clients&view=insurers', { scroll: false })}
            >
              Aseguradoras
            </button>
          </div>

          {/* Export Actions - Only for clients view */}
          {view === 'clients' && clients.length > 0 && (
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-[#010139] to-[#020270] hover:from-[#020270] hover:to-[#010139] text-white rounded-lg transition-all duration-200 font-semibold text-sm whitespace-nowrap shadow-lg hover:shadow-xl"
              title="Exportar clientes"
            >
              <Download size={18} />
              <span>
                Descargar {selectedClients.size > 0 ? `(${selectedClients.size})` : ''}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="tab-content">
        {renderTabContent()}
      </div>

      {/* Export Format Modal */}
      <ExportFormatModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSelectFormat={handleExportFormat}
        selectedCount={selectedClients.size}
        totalCount={clients.length}
      />

      <style jsx>{`
        :global(:root) {
          --brand-primary: #010139;
          --brand-primary-dark: #020270;
          --brand-secondary: #8aaa19;
          --brand-secondary-dark: #6d8814;
          --brand-danger: #dc2626;
          --brand-muted: #6b7280;
          --brand-surface: #ffffff;
          --brand-border: #e5e7eb;
          --text-muted: #6b7280;
          --gray-200: #e5e7eb;
        }

        /* Container */
        .tab-content {
          background: var(--brand-surface);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        /* ============================================
           TABLA DE CLIENTES - HTML TABLE
           5 Columnas | Íconos Profesionales | Branding
           ============================================ */
        
        :global(.clients-wrapper) {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        :global(.clients-table) {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }

        :global(.clients-table thead) {
          background: #f9fafb;
        }

        :global(.ct-th) {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          font-size: 0.875rem;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
        }
        :global(.ct-th:nth-child(1)) { width: 50px; }
        :global(.ct-th:nth-child(2)) { width: 18%; }
        :global(.ct-th:nth-child(3)) { width: 10%; }
        :global(.ct-th:nth-child(4)) { width: 10%; }
        :global(.ct-th:nth-child(5)) { width: 8%; }
        :global(.ct-th:nth-child(6)) { width: 14%; }
        :global(.ct-th:nth-child(7)) { width: 10%; }
        :global(.ct-th:nth-child(8)) { width: 10%; }
        :global(.ct-th:nth-child(9)) { width: 12%; }
        :global(.ct-th:nth-child(10)) { width: 8%; }

        :global(.text-right) {
          text-align: right;
        }

        /* FILAS */
        :global(.ct-item) {
          border-bottom: 1px solid #e5e7eb;
        }
        :global(.ct-item:hover) {
          background: #f9fafb;
        }

        /* CELDAS */
        :global(.ct-td) {
          padding: 16px;
          font-size: 0.875rem;
          color: #111827;
          vertical-align: middle;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* TRIGGER PARA DESPLEGAR */
        :global(.ct-trigger) {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0;
          gap: 8px;
        }
        :global(.ct-name) {
          font-weight: 600;
          color: #111827;
        }
        :global(.ct-trigger:hover .ct-name) {
          color: #3b82f6;
        }
        :global(.ct-chevron) {
          color: #9ca3af;
          flex-shrink: 0;
        }

        /* ACCIONES */
        :global(.ct-actions) {
          display: flex;
          justify-content: flex-end;
          gap: 4px;
        }
        :global(.icon-btn) {
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
        }
        :global(.icon-btn:hover) {
          color: #111827;
        }
        :global(.icon-btn.delete:hover) {
          color: #dc2626;
        }

        /* PANEL DE PÓLIZAS */
        :global(.ct-detail) {
          padding: 16px !important;
          background: #f9fafb !important;
        }
        :global(.pol-panel) {
          background: white;
          padding: 16px;
        }

        :global(.pol-header) {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        :global(.pol-title) {
          font-size: 0.875rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }
        :global(.pol-count) {
          font-size: 0.75rem;
          color: #6b7280;
        }

        :global(.pol-list) {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        :global(.pol-row) {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          gap: 12px;
        }
        :global(.pol-row:hover) {
          background: #f9fafb;
        }

        :global(.pol-main) {
          flex: 1;
          min-width: 0; /* Permite que el flex item se encoja */
        }
        :global(.pol-number) {
          font-weight: 600;
          color: #111827;
          font-size: 0.875rem;
          margin-bottom: 4px;
          word-break: break-word;
        }
        :global(.pol-meta) {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 0.75rem;
          color: #6b7280;
        }

        :global(.pol-notas) {
          margin-top: 8px;
          padding: 8px 12px;
          background: #f0f9ff;
          border-left: 3px solid #0ea5e9;
          border-radius: 4px;
          font-size: 0.75rem;
          line-height: 1.5;
        }
        :global(.pol-notas-label) {
          font-weight: 600;
          color: #0369a1;
          margin-right: 6px;
        }
        :global(.pol-notas-text) {
          color: #374151;
        }

        :global(.pol-actions) {
          display: flex;
          gap: 4px;
          flex-shrink: 0; /* No permite que se encoja */
        }

        :global(.no-policies) {
          text-align: center;
          padding: 20px;
          color: #9ca3af;
          font-size: 0.875rem;
        }

        /* EXPEDIENTE SECTION */
        :global(.expediente-section) {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 2px solid #e5e7eb;
        }
        :global(.expediente-header) {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        /* BOTONES DE ACCIÓN */
        :global(.icon-btn) {
          padding: 8px;
          border-radius: 6px;
          transition: all 0.2s;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        :global(.icon-btn.folder) {
          color: #8AAA19;
        }
        :global(.icon-btn.folder:hover) {
          background: #f0f9ff;
          border-color: #8AAA19;
        }
        :global(.icon-btn.view) {
          color: #010139;
        }
        :global(.icon-btn.view:hover) {
          background: #eff6ff;
          border-color: #010139;
        }
        :global(.icon-btn.edit) {
          color: #8AAA19;
        }
        :global(.icon-btn.edit:hover) {
          background: #f7fee7;
          border-color: #8AAA19;
        }
        :global(.icon-btn.delete) {
          color: #dc2626;
        }
        :global(.icon-btn.delete:hover) {
          background: #fef2f2;
          border-color: #dc2626;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          :global(.ct-th:nth-child(4)),
          :global(.ct-th:nth-child(5)),
          :global(.ct-th:nth-child(6)),
          :global(.ct-th:nth-child(7)),
          :global(.ct-th:nth-child(8)),
          :global(.ct-td:nth-child(4)),
          :global(.ct-td:nth-child(5)),
          :global(.ct-td:nth-child(6)),
          :global(.ct-td:nth-child(7)),
          :global(.ct-td:nth-child(8)) {
            display: none;
          }
          :global(.ct-th:nth-child(1)) { width: 50px; }
          :global(.ct-th:nth-child(2)) { width: 40%; }
          :global(.ct-th:nth-child(3)) { width: 30%; }
          :global(.ct-th:nth-child(9)) { width: 15%; }
          :global(.ct-th:nth-child(10)) { width: 15%; }
          
          /* Pólizas en tablet */
          :global(.pol-row) {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          :global(.pol-actions) {
            width: 100%;
            justify-content: flex-end;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
          }
        }
        @media (max-width: 480px) {
          :global(.ct-th:nth-child(3)),
          :global(.ct-td:nth-child(3)) {
            display: none;
          }
          :global(.ct-th:nth-child(1)) { width: 50px; }
          :global(.ct-th:nth-child(2)) { width: 50%; }
          :global(.ct-th:nth-child(9)) { width: 20%; }
          :global(.ct-th:nth-child(10)) { width: 30%; }
          
          /* Pólizas en móvil */
          :global(.pol-panel) {
            padding: 12px;
          }
          :global(.pol-row) {
            padding: 10px;
          }
          :global(.pol-number) {
            font-size: 0.8125rem;
          }
          :global(.pol-meta) {
            font-size: 0.6875rem;
            gap: 4px;
          }
          :global(.pol-meta span) {
            white-space: nowrap;
          }
          :global(.icon-btn) {
            width: 40px;
            height: 40px;
            padding: 10px;
          }
          :global(.ct-actions) {
            gap: 2px;
          }
        }
        
        /* Mobile First - Pantallas muy pequeñas */
        @media (max-width: 360px) {
          :global(.ct-actions) {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 4px;
          }
          :global(.pol-actions) {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
          }
          :global(.icon-btn) {
            width: 100%;
            min-height: 40px;
          }
        }

        /* Empty State */
        :global(.empty-state) {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }
        :global(.empty-state .btn-primary) {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 12px 24px;
          border-radius: 12px;
          background: var(--brand-primary);
          color: white;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        :global(.empty-state .btn-primary:hover) {
          background: var(--brand-secondary);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(1, 1, 57, 0.3);
        }
      `}</style>
    </>
  );
}
