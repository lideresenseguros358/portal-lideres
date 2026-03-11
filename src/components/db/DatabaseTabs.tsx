'use client';

import React, { useMemo, useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, Edit3, Trash2, ChevronDown, ChevronUp, FileDown, FileSpreadsheet, Download, FolderOpen, Filter, Upload, CheckSquare, Search, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/Modal';
import ClientForm from './ClientForm';
import ClientDetailsModal from './ClientDetailsModal';
import ClientsByMonth from './ClientsByMonth';
import ClientPolicyWizard from './ClientPolicyWizard';
import PreliminaryClientsTab from './PreliminaryClientsTab';
import ExportFormatModal from './ExportFormatModal';
import ExpedienteManager from '@/components/expediente/ExpedienteManager';
import InlineSearchBar from './InlineSearchBar';
import DatabaseSkeleton from './DatabaseSkeleton';
import { ClientWithPolicies, InsurerWithCount } from '@/types/db';
import { actionGetPreliminaryClients } from '@/app/(app)/db/preliminary-actions';
import { actionLoadMoreClients } from '@/app/(app)/db/actions';
import { formatDateForDisplay } from '@/lib/utils/dates';

interface DatabaseTabsProps {
  activeTab: string;
  clients: ClientWithPolicies[];
  insurers: InsurerWithCount[];
  brokers: any[];
  searchQuery?: string;
  role: string;
  userEmail: string;
  initialLimit: number;
  totalCount: number;
}

interface PolicyModalData {
  id: string;
  policy_number: string;
  clientId: string;
  clientName: string;
}

interface FilterOptions {
  insurer?: string;
  ramo?: string;
  month?: number;
  broker?: string;
}

// Usar formatDateForDisplay importado que NO tiene timezone issues
const formatDate = (value?: string | null) => {
  return formatDateForDisplay(value);
};

const capitalizeText = (text?: string | null) => {
  if (!text) return '';
  return text.toLowerCase().replace(/(^|\s)\w/g, (match) => match.toUpperCase());
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

  const earliest = withDates.reduce<string | null>((acc, policy) => {
    if (!policy.renewal_date) return acc;
    // Comparar strings directamente sin Date objects para evitar timezone
    if (!acc || policy.renewal_date < acc) return policy.renewal_date;
    return acc;
  }, null);

  return earliest ? formatDateForDisplay(earliest) : '—';
};

// Función para exportar a PDF con tabla única denormalizada
const exportToPDF = async (clients: ClientWithPolicies[], role: string) => {
  const toastId = toast.loading('Generando PDF...');
  
  try {
    if (!clients || clients.length === 0) {
      toast.error('No hay clientes para exportar', { id: toastId });
      return;
    }
    
    console.log('[PDF] Iniciando generación de PDF para', clients.length, 'clientes');
    console.log('[PDF] Importando librerías...');
    
    // Importar autotable y usar su función default
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default;
    
    // Luego importar jsPDF
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
    
    console.log('[PDF] Librerías importadas, creando documento en modo landscape');
    
    const doc = new jsPDF('landscape') as any; // Horizontal para más columnas
    console.log('[PDF] Documento creado, usando autoTable como función externa');
    
    // Función para agregar header con logo
    const addHeader = () => {
      const pageWidth = doc.internal.pageSize.width;
      
      // Fondo azul
      doc.setFillColor(1, 1, 57); // #010139
      doc.rect(0, 0, pageWidth, 28, 'F');
      
      // Línea verde
      doc.setDrawColor(138, 170, 25); // #8AAA19
      doc.setLineWidth(0.8);
      doc.line(10, 24, pageWidth - 10, 24);
      
      // Logo (intentar cargar, si falla continuar sin logo)
      // Nota: En jsPDF, addImage requiere que la imagen esté cargada
      // Por ahora omitimos el logo para evitar errores async
      // TODO: Implementar carga async del logo si es necesario
      
      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('LÍDERES EN SEGUROS', pageWidth / 2, 11, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Base de Datos - Clientes y Pólizas', pageWidth / 2, 17, { align: 'center' });
      
      doc.setFontSize(7);
      doc.text(new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth / 2, 22, { align: 'center' });
    };
    
    // Función para agregar footer
    const addFooter = () => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        doc.setDrawColor(138, 170, 25);
        doc.setLineWidth(0.5);
        doc.line(10, pageHeight - 20, pageWidth - 10, pageHeight - 20);
        
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 12, { align: 'center' });
        
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text('Líderes en Seguros © 2025', pageWidth / 2, pageHeight - 7, { align: 'center' });
      }
    };
    
    try {
      addHeader();
      console.log('[PDF] Header agregado');
    } catch (headerError) {
      console.error('[PDF] Error en header:', headerError);
      throw new Error('Error al generar header del PDF');
    }
    
    // Preparar datos denormalizados (igual que Excel)
    console.log('[PDF] Preparando datos denormalizados...');
    const tableData: any[] = [];
    
    clients.forEach(client => {
      if (client.policies && client.policies.length > 0) {
        // Por cada póliza, crear una fila con info del cliente + póliza
        client.policies.forEach(policy => {
          try {
            const row = [
              client.name?.toUpperCase() || '—',
              client.national_id?.toUpperCase() || '—',
              client.email?.toLowerCase() || '—',
              client.phone || '—',
            ];
            
            if (role === 'master') {
              row.push(capitalizeText((client as any).brokers?.name) || '—');
            }
            
            row.push(
              policy.policy_number || '—',
              policy.insurers?.name || '—',
              policy.ramo || '—',
              policy.start_date ? new Date(policy.start_date).toLocaleDateString('es-PA') : '—',
              policy.renewal_date ? new Date(policy.renewal_date).toLocaleDateString('es-PA') : '—',
              policy.status || '—'
            );
            
            if (role === 'master') {
              row.push(policy.percent_override ? `${policy.percent_override}%` : 'Def');
            }
            
            // Agregar notas si existen (truncadas)
            const notes = policy.notas ? policy.notas.substring(0, 50) + (policy.notas.length > 50 ? '...' : '') : '';
            row.push(notes);
            
            tableData.push(row);
          } catch (policyError) {
            console.error(`[PDF] Error procesando póliza:`, policyError);
          }
        });
      } else {
        // Cliente sin pólizas
        const row = [
          client.name?.toUpperCase() || '—',
          client.national_id?.toUpperCase() || '—',
          client.email?.toLowerCase() || '—',
          client.phone || '—',
        ];
        
        if (role === 'master') {
          row.push(capitalizeText((client as any).brokers?.name) || '—');
        }
        
        row.push('SIN PÓLIZAS', '—', '—', '—', '—', '—');
        
        if (role === 'master') {
          row.push('—');
        }
        
        row.push(''); // Notas vacías
        
        tableData.push(row);
      }
    });
    
    console.log(`[PDF] ${tableData.length} registros preparados`);
    
    if (tableData.length === 0) {
      console.warn('[PDF] No hay datos para exportar');
      toast.error('No hay datos para exportar en PDF', { id: toastId });
      return;
    }
    
    // Headers de la tabla
    const headers = ['Cliente', 'Cédula', 'Email', 'Teléfono'];
    if (role === 'master') headers.push('Corredor');
    headers.push('N° Póliza', 'Aseguradora', 'Ramo', 'F. Inicio', 'F. Renovación', 'Estado');
    if (role === 'master') headers.push('% Com.');
    headers.push('Notas');
    
    console.log('[PDF] Headers:', headers.length, 'columnas');
    
    // Información del reporte
    try {
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(`Total: ${tableData.length} registros`, 14, 32);
      console.log('[PDF] Info del reporte agregada');
    } catch (infoError) {
      console.error('[PDF] Error agregando info:', infoError);
    }
    
    // Generar tabla única usando autoTable como función
    try {
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 38,  // Más espacio después del header
        theme: 'striped',
        headStyles: {
          fillColor: [1, 1, 57],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
          cellPadding: 1.5
        },
        bodyStyles: {
          fontSize: 6,
          textColor: [50, 50, 50],
          cellPadding: 1
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        columnStyles: role === 'master' ? {
          0: { cellWidth: 30 },  // Cliente
          1: { cellWidth: 18 },  // Cédula
          2: { cellWidth: 30 },  // Email
          3: { cellWidth: 18 },  // Teléfono
          4: { cellWidth: 25 },  // Corredor
          5: { cellWidth: 25 },  // N° Póliza
          6: { cellWidth: 25 },  // Aseguradora
          7: { cellWidth: 20 },  // Ramo
          8: { cellWidth: 18 },  // F. Inicio
          9: { cellWidth: 18 },  // F. Renovación
          10: { cellWidth: 15, halign: 'center' }, // Estado
          11: { cellWidth: 12, halign: 'center' }, // % Com.
          12: { cellWidth: 30 }  // Notas
        } : {
          0: { cellWidth: 35 },  // Cliente
          1: { cellWidth: 20 },  // Cédula
          2: { cellWidth: 35 },  // Email
          3: { cellWidth: 20 },  // Teléfono
          4: { cellWidth: 28 },  // N° Póliza
          5: { cellWidth: 28 },  // Aseguradora
          6: { cellWidth: 22 },  // Ramo
          7: { cellWidth: 20 },  // F. Inicio
          8: { cellWidth: 20 },  // F. Renovación
          9: { cellWidth: 18, halign: 'center' }, // Estado
          10: { cellWidth: 35 }  // Notas
        },
        margin: { top: 38, bottom: 25, left: 10, right: 10 },  // Márgenes top y bottom para evitar header/footer
        didDrawPage: function(data: any) {
          // Agregar header en cada página nueva
          if (data.pageNumber > 1) {
            addHeader();
          }
        }
      });
      
      console.log('[PDF] Tabla generada exitosamente');
    } catch (tableError) {
      console.error('[PDF] Error generando tabla:', tableError);
      throw tableError;
    }
    
    console.log('[PDF] Agregando footer...');
    
    try {
      addFooter();
      console.log('[PDF] Footer agregado');
    } catch (footerError) {
      console.error('[PDF] Error en footer:', footerError);
      // Continuar sin footer si falla
    }
    
    console.log('[PDF] Guardando archivo...');
    
    try {
      const fileName = `lideres-clientes-polizas-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      console.log('[PDF] PDF guardado exitosamente:', fileName);
      toast.success(`PDF descargado: ${fileName} (${tableData.length} registros)`, { id: toastId });
    } catch (saveError) {
      console.error('[PDF] Error al guardar:', saveError);
      throw new Error('Error al guardar el archivo PDF');
    }
  } catch (error) {
    console.error('[PDF] Error al generar PDF:', error);
    console.error('[PDF] Stack:', error instanceof Error ? error.stack : 'No stack available');
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    toast.error(`Error al generar el PDF: ${errorMsg}. Revisa la consola para más detalles.`, { id: toastId });
  }
};

// Función para exportar a Excel - Una sola hoja con clientes y pólizas denormalizados
const exportToExcel = async (clients: ClientWithPolicies[], role: string) => {
  const toastId = toast.loading('Generando archivo Excel...');
  
  try {
    const XLSX = await import('xlsx');
    
    // Crear una sola tabla con cliente + póliza en cada fila
    // Si un cliente tiene múltiples pólizas, repetir su info en cada fila
    const data: any[] = [];
    
    clients.forEach(client => {
      if (client.policies && client.policies.length > 0) {
        // Por cada póliza del cliente, crear una fila con info del cliente + póliza
        client.policies.forEach(policy => {
          const row: any = {
            'Cliente': client.name?.toUpperCase() || '—',
            'Cédula': client.national_id?.toUpperCase() || '—',
            'Email': client.email?.toLowerCase() || '—',
            'Teléfono': client.phone || '—',
          };
          
          if (role === 'master') {
            row['Corredor'] = capitalizeText((client as any).brokers?.name) || '—';
          }
          
          // Agregar información de la póliza
          row['N° Póliza'] = policy.policy_number || '—';
          row['Aseguradora'] = policy.insurers?.name || '—';
          row['Ramo'] = policy.ramo || '—';
          row['Fecha Inicio'] = policy.start_date ? new Date(policy.start_date).toLocaleDateString('es-PA') : '—';
          row['Fecha Renovación'] = policy.renewal_date ? new Date(policy.renewal_date).toLocaleDateString('es-PA') : '—';
          row['Estado'] = policy.status || '—';
          
          if (role === 'master') {
            row['% Comisión'] = policy.percent_override !== null && policy.percent_override !== undefined
              ? `${policy.percent_override}%`
              : 'Default';
          }
          
          row['Notas'] = policy.notas || '';
          
          data.push(row);
        });
      } else {
        // Si el cliente no tiene pólizas, agregar una fila solo con info del cliente
        const row: any = {
          'Cliente': client.name?.toUpperCase() || '—',
          'Cédula': client.national_id?.toUpperCase() || '—',
          'Email': client.email?.toLowerCase() || '—',
          'Teléfono': client.phone || '—',
        };
        
        if (role === 'master') {
          row['Corredor'] = capitalizeText((client as any).brokers?.name) || '—';
        }
        
        row['N° Póliza'] = 'SIN PÓLIZAS';
        row['Aseguradora'] = '—';
        row['Ramo'] = '—';
        row['Fecha Inicio'] = '—';
        row['Fecha Renovación'] = '—';
        row['Estado'] = '—';
        
        if (role === 'master') {
          row['% Comisión'] = '—';
        }
        
        row['Notas'] = '';
        
        data.push(row);
      }
    });
    
    // Crear workbook con una sola hoja
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 30 }, // Cliente
      { wch: 15 }, // Cédula
      { wch: 30 }, // Email
      { wch: 15 }, // Teléfono
    ];
    
    if (role === 'master') {
      colWidths.push({ wch: 25 }); // Corredor
    }
    
    colWidths.push(
      { wch: 22 }, // N° Póliza
      { wch: 22 }, // Aseguradora
      { wch: 20 }, // Ramo
      { wch: 15 }, // Fecha Inicio
      { wch: 15 }, // Fecha Renovación
      { wch: 12 }  // Estado
    );
    
    if (role === 'master') {
      colWidths.push({ wch: 15 }); // % Comisión
    }
    
    colWidths.push({ wch: 50 }); // Notas
    
    ws['!cols'] = colWidths;
    
    // Agregar hoja al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes y Pólizas');
    
    // Descargar archivo
    const fileName = `lideres-clientes-polizas-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success(`Excel descargado: ${fileName} (${data.length} registros)`, { id: toastId });
  } catch (error) {
    console.error('Error al generar Excel:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    toast.error(`Error al generar el Excel: ${errorMsg}`, { id: toastId });
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
  selectionMode: boolean;
  onViewPolicy: (policyId: string) => void;
  onEditPolicy: (policyId: string) => void;
  onDeletePolicy: (policyId: string, policyNumber: string) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  totalSelectableCount?: number;
  isSelectingAll?: boolean;
}

const ClientsListView = ({ clients, onView, onEdit, onDelete, role, selectedClients, onToggleClient, onSelectAll, selectionMode, onViewPolicy, onEditPolicy, onDeletePolicy, hasMore, isLoadingMore, onLoadMore, totalSelectableCount, isSelectingAll }: ClientsListViewProps) => {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [openMenuClient, setOpenMenuClient] = useState<string | null>(null);
  const [openMenuPolicy, setOpenMenuPolicy] = useState<string | null>(null);
  const [expandedExpedientes, setExpandedExpedientes] = useState<Set<string>>(new Set());
  const [expedienteModalOpen, setExpedienteModalOpen] = useState<Record<string, boolean>>({});

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
        email: client.email?.toLowerCase() || '—',
        phone: client.phone || '—',
        brokerName: capitalizeText((client as any).brokers?.name) || '—',
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

  const effectiveTotal = totalSelectableCount ?? clients.length;
  const allSelected = effectiveTotal > 0 && selectedClients.size >= effectiveTotal;

  return (
    <div className={`clients-wrapper ${selectionMode ? 'with-selection' : ''}`}>
      {/* Banner de selección total */}
      {selectionMode && selectedClients.size > 0 && selectedClients.size > clients.length && (
        <div className="bg-[#8AAA19]/10 border border-[#8AAA19]/30 rounded-lg px-4 py-2 mb-2 flex items-center gap-2 text-sm">
          <CheckSquare size={16} className="text-[#8AAA19]" />
          <span className="text-[#010139] font-medium">
            {selectedClients.size} clientes seleccionados en total
          </span>
          <span className="text-gray-500">
            (mostrando {clients.length} en esta vista)
          </span>
        </div>
      )}
      {/* Vista Desktop: Tabla */}
      <table className="clients-table hidden md:table">
        <thead>
          <tr className="ct-head">
            {selectionMode && (
              <th className="ct-th" style={{ width: '50px' }}>
                {isSelectingAll ? (
                  <div className="w-5 h-5 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#8AAA19]"></div>
                  </div>
                ) : (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] cursor-pointer"
                  />
                )}
              </th>
            )}
            <th className="ct-th ct-th-name">Cliente</th>
            <th className="ct-th ct-th-cedula">Cédula</th>
            <th className="ct-th ct-th-correo">Correo</th>
            <th className="ct-th ct-th-celular">Celular</th>
            <th className="ct-th ct-th-polizas">Pólizas</th>
            {role === 'master' && <th className="ct-th ct-th-corredor">Corredor</th>}
            <th className="ct-th ct-th-acciones"></th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ client, nationalId, email, phone, brokerName }) => {
            const isExpanded = expandedClients.has(client.id);
            const isSelected = selectedClients.has(client.id);
            return (
              <React.Fragment key={client.id}>
                <tr className="ct-item">
                  {selectionMode && (
                    <td className="ct-td">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleClient(client.id)}
                        className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  <td className="ct-td ct-td-name">
                    <button
                      className="ct-trigger"
                      aria-expanded={isExpanded}
                      onClick={() => toggleClient(client.id)}
                    >
                      <span className="ct-name">{capitalizeText(client.name)}</span>
                      {isExpanded ? (
                        <ChevronUp size={18} className="ct-chevron" />
                      ) : (
                        <ChevronDown size={18} className="ct-chevron" />
                      )}
                    </button>
                  </td>
                  <td className="ct-td ct-td-cedula">{nationalId}</td>
                  <td className="ct-td ct-td-correo">{email}</td>
                  <td className="ct-td ct-td-celular">{phone}</td>
                  <td className="ct-td ct-td-polizas">
                    <span className="font-semibold text-[#010139]">{client.policies?.length || 0}</span>
                  </td>
                  {role === 'master' && <td className="ct-td ct-td-corredor">{brokerName}</td>}
                  <td className="ct-td ct-td-acciones">
                    <div className="relative overflow-visible flex justify-center">
                      <button
                        ref={(el) => {
                          if (el && openMenuClient === client.id) {
                            const rect = el.getBoundingClientRect();
                            const menu = document.getElementById(`menu-client-table-${client.id}`);
                            if (menu) {
                              menu.style.top = `${rect.bottom + 4}px`;
                              menu.style.right = `${window.innerWidth - rect.right}px`;
                            }
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuClient(openMenuClient === client.id ? null : client.id);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                        aria-label="Acciones"
                      >
                        <MoreVertical size={20} className="text-gray-600" />
                      </button>
                      {openMenuClient === client.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-[100]" 
                            onClick={() => setOpenMenuClient(null)}
                          />
                          <div id={`menu-client-table-${client.id}`} className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[101]">
                            <button
                              onClick={() => {
                                toggleClient(client.id);
                                setOpenMenuClient(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700"
                            >
                              <ChevronDown size={16} className="text-[#8AAA19]" />
                              {isExpanded ? 'Contraer' : 'Expandir'}
                            </button>
                            <button
                              onClick={() => {
                                onView(client.id);
                                setOpenMenuClient(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700"
                            >
                              <Eye size={16} className="text-[#010139]" />
                              Ver Detalles
                            </button>
                            <button
                              onClick={() => {
                                onEdit(client.id);
                                setOpenMenuClient(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700"
                            >
                              <Edit3 size={16} className="text-[#8AAA19]" />
                              Editar Cliente
                            </button>
                            <div className="border-t border-gray-100 my-1"></div>
                            <button
                              onClick={() => {
                                onDelete(client.id);
                                setOpenMenuClient(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-3 text-sm text-red-600"
                            >
                              <Trash2 size={16} />
                              Eliminar Cliente
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan={selectionMode ? (role === 'master' ? 8 : 7) : (role === 'master' ? 7 : 6)} className="ct-detail">
                      <div className="pol-panel">
                        <div className="pol-header">
                          <h4 className="pol-title">Pólizas del Cliente</h4>
                          <span className="pol-count">{client.policies?.length || 0} póliza(s)</span>
                        </div>
                        {client.policies?.length ? (
                          <div className="pol-list">
                            {client.policies.map((policy) => {
                              // Debug: verificar si hay notas
                              if (policy.notas) {
                                console.log('Policy con notas:', policy.policy_number, policy.notas);
                              }
                              return (
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
                                    <span><strong>Inicio:</strong> {formatDate(policy.start_date)}</span>
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
                                  {policy.notas && (
                                    <div className="pol-notas">
                                      <span className="pol-notas-label"> Notas:</span>
                                      <span className="pol-notas-text">{policy.notas}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="pol-actions relative overflow-visible">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuPolicy(openMenuPolicy === policy.id ? null : policy.id);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                                    aria-label="Acciones de póliza"
                                  >
                                    <MoreVertical size={20} className="text-gray-600" />
                                  </button>
                                  {openMenuPolicy === policy.id && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-[100]" 
                                        onClick={() => setOpenMenuPolicy(null)}
                                      />
                                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[101]">
                                        <button
                                          onClick={() => {
                                            onViewPolicy(policy.id);
                                            setOpenMenuPolicy(null);
                                          }}
                                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700"
                                        >
                                          <Eye size={16} className="text-[#010139]" />
                                          Ver Detalles
                                        </button>
                                        <button
                                          onClick={() => {
                                            onEditPolicy(policy.id);
                                            setOpenMenuPolicy(null);
                                          }}
                                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700"
                                        >
                                          <Edit3 size={16} className="text-[#8AAA19]" />
                                          Editar Póliza
                                        </button>
                                        {role === 'master' && (
                                          <>
                                            <div className="border-t border-gray-100 my-1"></div>
                                            <button
                                              onClick={() => {
                                                onDeletePolicy(policy.id, policy.policy_number || 'Sin número');
                                                setOpenMenuPolicy(null);
                                              }}
                                              className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-3 text-sm text-red-600"
                                            >
                                              <Trash2 size={16} />
                                              Eliminar Póliza
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="no-policies">Este cliente no tiene pólizas registradas</p>
                        )}

                        {/* Expediente Section - Colapsable */}
                        <div className="expediente-section">
                          <button
                            onClick={() => {
                              setExpandedExpedientes(prev => {
                                const next = new Set(prev);
                                if (next.has(client.id)) {
                                  next.delete(client.id);
                                } else {
                                  next.add(client.id);
                                }
                                return next;
                              });
                            }}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg border border-gray-200 transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <FolderOpen size={18} className="text-[#8AAA19]" />
                              <span className="text-sm font-bold text-[#010139]">
                                Expediente del Cliente
                              </span>
                            </div>
                            {expandedExpedientes.has(client.id) ? (
                              <ChevronUp size={18} className="text-gray-600" />
                            ) : (
                              <ChevronDown size={18} className="text-gray-600" />
                            )}
                          </button>
                          
                          {expandedExpedientes.has(client.id) && (
                            <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200">
                              <ExpedienteManager
                                key={`expediente-${(client as any).id}`}
                                clientId={(client as any).id}
                                showClientDocs={true}
                                showPolicyDocs={false}
                                showOtros={true}
                                readOnly={role !== 'master'}
                                externalModalOpen={expedienteModalOpen[(client as any).id]}
                                onExternalModalChange={(open) => {
                                  setExpedienteModalOpen(prev => ({ ...prev, [(client as any).id]: open }));
                                }}
                              />
                            </div>
                          )}
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

      {/* Botón Ver Más - Desktop */}
      {hasMore && (
        <div className="hidden md:block mt-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full p-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg border-2 border-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#8AAA19]"></div>
                <span className="text-sm font-medium text-gray-600">Cargando más clientes...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <ChevronDown size={20} className="text-[#8AAA19]" />
                <span className="text-sm font-semibold text-[#010139]">Ver más clientes (50)</span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Vista Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {selectionMode && (
          <div className="bg-gray-50 p-3 rounded-lg flex items-center gap-3 mb-4">
            {isSelectingAll ? (
              <div className="w-5 h-5 flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#8AAA19]"></div>
              </div>
            ) : (
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] cursor-pointer"
              />
            )}
            <span className="text-sm font-medium text-gray-700">
              {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
              {selectedClients.size > clients.length && (
                <span className="text-gray-500 font-normal"> ({selectedClients.size} seleccionados)</span>
              )}
            </span>
          </div>
        )}
        {items.map(({ client, nationalId, email, phone, brokerName }) => {
          const isExpanded = expandedClients.has(client.id);
          const isSelected = selectedClients.has(client.id);
          return (
            <div key={client.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="p-4 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-start gap-3">
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleClient(client.id)}
                      className="w-5 h-5 mt-1 text-[#8AAA19] rounded focus:ring-[#8AAA19] cursor-pointer flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <button
                      className="w-full text-left group"
                      onClick={() => toggleClient(client.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-[#010139] truncate group-hover:text-[#8AAA19] transition-colors">
                          {capitalizeText(client.name)}
                        </h3>
                        {isExpanded ? (
                          <ChevronUp size={20} className="text-[#8AAA19] flex-shrink-0" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                    
                    {/* Info Grid */}
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs block">Cédula</span>
                        <span className="text-gray-900 font-medium">{nationalId}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block">Pólizas</span>
                        <span className="text-[#010139] font-semibold">{client.policies?.length || 0}</span>
                      </div>
                      {email !== '—' && (
                        <div className="col-span-2">
                          <span className="text-gray-500 text-xs block">Email</span>
                          <span className="text-gray-900 text-xs truncate block">{email}</span>
                        </div>
                      )}
                      {phone !== '—' && (
                        <div>
                          <span className="text-gray-500 text-xs block">Teléfono</span>
                          <span className="text-gray-900">{phone}</span>
                        </div>
                      )}
                      {role === 'master' && brokerName !== '—' && (
                        <div>
                          <span className="text-gray-500 text-xs block">Corredor</span>
                          <span className="text-gray-900 truncate block text-xs">{brokerName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Acciones */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                  <button
                    onClick={() => toggleClient(client.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {isExpanded ? (
                      <><ChevronUp size={16} /> Ocultar Pólizas</>
                    ) : (
                      <><ChevronDown size={16} /> Ver Pólizas</>
                    )}
                  </button>
                  <div>
                    <button
                      ref={(el) => {
                        if (el && openMenuClient === client.id) {
                          const rect = el.getBoundingClientRect();
                          const menu = document.getElementById(`menu-client-${client.id}`);
                          if (menu) {
                            menu.style.top = `${rect.bottom + 4}px`;
                            menu.style.right = `${window.innerWidth - rect.right}px`;
                          }
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuClient(openMenuClient === client.id ? null : client.id);
                      }}
                      className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <MoreVertical size={20} className="text-gray-600" />
                    </button>
                    {openMenuClient === client.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-[100]" 
                          onClick={() => setOpenMenuClient(null)}
                        />
                        <div id={`menu-client-${client.id}`} className="fixed w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[101]">
                          <button
                            onClick={() => {
                              onView(client.id);
                              setOpenMenuClient(null);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700"
                          >
                            <Eye size={16} className="text-[#010139]" />
                            Ver Detalles
                          </button>
                          <button
                            onClick={() => {
                              onEdit(client.id);
                              setOpenMenuClient(null);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700"
                          >
                            <Edit3 size={16} className="text-[#8AAA19]" />
                            Editar Cliente
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
                          <button
                            onClick={() => {
                              onDelete(client.id);
                              setOpenMenuClient(null);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-3 text-sm text-red-600"
                          >
                            <Trash2 size={16} />
                            Eliminar Cliente
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded: Pólizas */}
              {isExpanded && (
                <div className="p-4 bg-white border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Pólizas ({client.policies?.length || 0})</h4>
                  {client.policies?.length ? (
                    <div className="space-y-3">
                      {client.policies.map((policy) => (
                        <div key={policy.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[#010139] truncate">📋 {policy.policy_number || 'Sin número'}</div>
                              <div className="text-xs text-gray-600 mt-1">{policy.insurers?.name?.toUpperCase?.() || '—'}</div>
                            </div>
                            <div className="relative overflow-visible">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuPolicy(openMenuPolicy === policy.id ? null : policy.id);
                                }}
                                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                              >
                                <MoreVertical size={16} className="text-gray-600" />
                              </button>
                              {openMenuPolicy === policy.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-[100]" 
                                    onClick={() => setOpenMenuPolicy(null)}
                                  />
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[101]">
                                    <button
                                      onClick={() => {
                                        onViewPolicy(policy.id);
                                        setOpenMenuPolicy(null);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-xs text-gray-700"
                                    >
                                      <Eye size={14} />
                                      Ver Detalles
                                    </button>
                                    <button
                                      onClick={() => {
                                        onEditPolicy(policy.id);
                                        setOpenMenuPolicy(null);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-xs text-gray-700"
                                    >
                                      <Edit3 size={14} />
                                      Editar
                                    </button>
                                    {role === 'master' && (
                                      <>
                                        <div className="border-t border-gray-100 my-1"></div>
                                        <button
                                          onClick={() => {
                                            onDeletePolicy(policy.id, policy.policy_number || 'Sin número');
                                            setOpenMenuPolicy(null);
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-xs text-red-600"
                                        >
                                          <Trash2 size={14} />
                                          Eliminar
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            <div>
                              <span className="text-gray-500">Ramo:</span>
                              <span className="ml-1 text-gray-900">{policy.ramo || '—'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Estado:</span>
                              <span className={`ml-1 font-semibold ${
                                policy.status === 'ACTIVA' ? 'text-green-600' : 
                                policy.status === 'VENCIDA' ? 'text-red-600' : 
                                'text-gray-600'
                              }`}>
                                {policy.status || '—'}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-500">Renovación:</span>
                              <span className="ml-1 text-gray-900">{formatDate(policy.renewal_date)}</span>
                            </div>
                          </div>
                          {policy.notas && (
                            <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                              <span className="text-xs text-gray-500 block mb-1">💬 Notas:</span>
                              <span className="text-xs text-gray-700">{policy.notas}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Este cliente no tiene pólizas registradas</p>
                  )}

                  {/* Expediente Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setExpandedExpedientes(prev => {
                          const next = new Set(prev);
                          if (next.has(client.id)) {
                            next.delete(client.id);
                          } else {
                            next.add(client.id);
                          }
                          return next;
                        });
                      }}
                      className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg border border-gray-200 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <FolderOpen size={16} className="text-[#8AAA19]" />
                        <span className="text-sm font-semibold text-[#010139]">
                          Expediente
                        </span>
                      </div>
                      {expandedExpedientes.has(client.id) ? (
                        <ChevronUp size={16} className="text-gray-600" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-600" />
                      )}
                    </button>
                    
                    {expandedExpedientes.has(client.id) && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                        <ExpedienteManager
                          key={`expediente-grid-${(client as any).id}`}
                          clientId={(client as any).id}
                          showClientDocs={true}
                          showPolicyDocs={false}
                          showOtros={true}
                          readOnly={role !== 'master'}
                          externalModalOpen={expedienteModalOpen[(client as any).id]}
                          onExternalModalChange={(open) => {
                            setExpedienteModalOpen(prev => ({ ...prev, [(client as any).id]: open }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botón Ver Más - Mobile */}
      {hasMore && (
        <div className="md:hidden mt-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full p-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg border-2 border-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#8AAA19]"></div>
                <span className="text-sm font-medium text-gray-600">Cargando...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <ChevronDown size={20} className="text-[#8AAA19]" />
                <span className="text-sm font-semibold text-[#010139]">Ver más (50)</span>
              </div>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default function DatabaseTabs({
  activeTab, 
  clients: initialClients, 
  insurers,
  brokers,
  searchQuery,
  role,
  userEmail,
  initialLimit,
  totalCount,
}: DatabaseTabsProps) {
  // Estado para paginación
  const [clients, setClients] = useState<ClientWithPolicies[]>(initialClients);
  const [displayedCount, setDisplayedCount] = useState(initialLimit);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingFiltered, setIsLoadingFiltered] = useState(false);
  const [filteredTotalCount, setFilteredTotalCount] = useState<number | null>(null);
  const [filteredServerClients, setFilteredServerClients] = useState<ClientWithPolicies[] | null>(null);
  
  // Marcar como cargado después del primer render
  useEffect(() => {
    setIsInitialLoading(false);
  }, []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const modal = searchParams.get('modal');
  const view = searchParams.get('view') || 'clients';
  const clientId = searchParams.get('client');
  const policyId = searchParams.get('policy');
  const editClientId = searchParams.get('editClient');
  const editPolicyId = searchParams.get('editPolicy');
  const currentSearch = searchParams.get('search') || '';

  // Helper: build DB URL preserving the current search param
  const dbUrl = (params: string) => {
    const base = `/db?tab=clients${currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ''}`;
    return params ? `${base}&${params}` : base;
  };
  
  const [showExpedienteModal, setShowExpedienteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [expedienteUploadModalOpen, setExpedienteUploadModalOpen] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [preliminaryCount, setPreliminaryCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [filteredDisplayedCount, setFilteredDisplayedCount] = useState(50);

  // Sincronizar estado local cuando cambian los clientes desde el servidor (por búsqueda)
  useEffect(() => {
    setClients(initialClients);
    setDisplayedCount(initialClients.length);
    // Limpiar estado filtrado cuando cambia la búsqueda
    setFilteredServerClients(null);
    setFilteredTotalCount(null);
    setFilteredDisplayedCount(50);
  }, [initialClients, searchQuery]);
  
  // Función para cargar más clientes
  const handleLoadMore = async () => {
    const hasActiveFiltersNow = !!(filters.broker || filters.insurer || filters.ramo || filters.month !== undefined);
    
    if (hasActiveFiltersNow && filteredServerClients) {
      // Con filtros activos, simplemente mostrar más del set ya cargado
      setFilteredDisplayedCount(prev => prev + 50);
      return;
    }
    
    setIsLoadingMore(true);
    try {
      const response = await fetch('/api/db/load-more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset: displayedCount,
          limit: 50,
          searchQuery: searchQuery || ''
        })
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar más clientes');
      }
      
      const data = await response.json();
      
      if (data.ok && data.clients) {
        setClients(prev => [...prev, ...data.clients]);
        setDisplayedCount(prev => prev + data.clients.length);
        toast.success(`${data.clients.length} clientes más cargados`);
      }
    } catch (error) {
      console.error('Error loading more clients:', error);
      toast.error('Error al cargar más clientes');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Cargar clientes filtrados del servidor cuando cambian los filtros
  useEffect(() => {
    const hasActiveFiltersNow = !!(filters.broker || filters.insurer || filters.ramo || filters.month !== undefined);
    
    if (!hasActiveFiltersNow) {
      // Sin filtros → usar datos paginados normales
      setFilteredServerClients(null);
      setFilteredTotalCount(null);
      setFilteredDisplayedCount(50);
      return;
    }
    
    // Con filtros → cargar TODOS los clientes que coinciden desde el servidor
    const fetchFiltered = async () => {
      setIsLoadingFiltered(true);
      try {
        const response = await fetch('/api/db/load-more', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offset: 0,
            limit: 5000,
            searchQuery: searchQuery || '',
            filters
          })
        });
        
        if (!response.ok) throw new Error('Error al cargar clientes filtrados');
        
        const data = await response.json();
        
        if (data.ok && data.clients) {
          // Aplicar filtro de pólizas del lado del cliente para las sub-pólizas
          const clientsWithFilteredPolicies = data.clients.map((client: ClientWithPolicies) => {
            let filteredPolicies = [...(client.policies || [])];
            
            if (filters.insurer) {
              filteredPolicies = filteredPolicies.filter(p => p.insurer_id === filters.insurer);
            }
            if (filters.ramo) {
              filteredPolicies = filteredPolicies.filter(p => p.ramo?.toLowerCase() === filters.ramo?.toLowerCase());
            }
            if (filters.month !== undefined) {
              filteredPolicies = filteredPolicies.filter(p => {
                if (!p.renewal_date) return false;
                const parts = p.renewal_date.split('-');
                if (parts.length < 2 || !parts[1]) return false;
                const month = parseInt(parts[1]) - 1;
                return month === filters.month;
              });
            }
            
            return { ...client, policies: filteredPolicies };
          }).filter((client: ClientWithPolicies) => {
            // Mantener solo clientes con pólizas que coinciden (si hay filtros de póliza)
            if (filters.insurer || filters.ramo || filters.month !== undefined) {
              return client.policies && client.policies.length > 0;
            }
            return true;
          });
          
          setFilteredServerClients(clientsWithFilteredPolicies);
          setFilteredTotalCount(clientsWithFilteredPolicies.length);
          setFilteredDisplayedCount(50);
        }
      } catch (error) {
        console.error('Error loading filtered clients:', error);
        toast.error('Error al cargar clientes filtrados');
      } finally {
        setIsLoadingFiltered(false);
      }
    };
    
    fetchFiltered();
  }, [filters, searchQuery]);

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

  // Count policies renewing this month
  const renewalsThisMonth = useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    let count = 0;
    clients.forEach(client => {
      client.policies?.forEach(policy => {
        if (policy.renewal_date) {
          const renewalDate = new Date(policy.renewal_date);
          if (renewalDate.getMonth() === currentMonth && renewalDate.getFullYear() === currentYear) {
            count++;
          }
        }
      });
    });
    return count;
  }, [clients]);

  // Unificar todos los clientes disponibles (paginados + filtrados del servidor)
  // para que los lookups de modales funcionen sin importar de dónde vino el cliente
  const allAvailableClients = useMemo(() => {
    if (!filteredServerClients) return clients;
    const map = new Map<string, ClientWithPolicies>();
    clients.forEach(c => map.set(c.id, c));
    filteredServerClients.forEach(c => { if (!map.has(c.id)) map.set(c.id, c); });
    return Array.from(map.values());
  }, [clients, filteredServerClients]);

  const clientToEdit = editClientId ? allAvailableClients.find(c => c.id === editClientId) : null;

  const handleView = (id: string) => router.push(dbUrl(`modal=view-client&editClient=${id}`), { scroll: false });
  const handleEdit = (id: string) => router.push(dbUrl(`modal=edit-client&editClient=${id}`), { scroll: false });
  const handleDelete = async (id: string) => {
    const client = allAvailableClients.find(c => c.id === id);
    const clientName = client?.name || 'este cliente';
    const policiesCount = client?.policies?.length || 0;
    
    if (!confirm(`¿Estás seguro de eliminar a ${clientName}${policiesCount > 0 ? ` y sus ${policiesCount} póliza(s)` : ''}?`)) {
      return;
    }
    
    try {
      // Si tiene pólizas, eliminarlas primero
      if (policiesCount > 0) {
        for (const policy of client!.policies!) {
          const policyResponse = await fetch(`/api/db/policies/${policy.id}`, {
            method: 'DELETE',
          });
          
          if (!policyResponse.ok) {
            const error = await policyResponse.json();
            throw new Error(`Error al eliminar póliza ${policy.policy_number}: ${error.error}`);
          }
        }
      }
      
      // Ahora eliminar el cliente
      const response = await fetch(`/api/db/clients/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success(`Cliente ${clientName} eliminado correctamente`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar el cliente');
    }
  };

  const handleViewPolicy = (policyId: string) => {
    toast.info('Vista detallada de póliza en desarrollo');
  };

  const handleEditPolicy = (policyId: string) => {
    // Encontrar el cliente que tiene esta póliza
    const clientWithPolicy = allAvailableClients.find(c => 
      c.policies?.some(p => p.id === policyId)
    );
    
    if (clientWithPolicy) {
      router.push(dbUrl(`modal=edit-client&editClient=${clientWithPolicy.id}&editPolicy=${policyId}`), { scroll: false });
    } else {
      toast.error('No se encontró el cliente de esta póliza');
    }
  };

  const handleDeletePolicy = async (policyId: string, policyNumber: string) => {
    if (!confirm(`¿Eliminar la póliza ${policyNumber}?`)) return;
    
    try {
      const response = await fetch(`/api/db/policies/${policyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success('Póliza eliminada correctamente');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar la póliza');
    }
  };

  // Clientes filtrados: usar datos del servidor si hay filtros activos, sino filtrar localmente
  const filteredClients = useMemo(() => {
    const hasActiveFiltersNow = !!(filters.broker || filters.insurer || filters.ramo || filters.month !== undefined);
    
    if (hasActiveFiltersNow && filteredServerClients) {
      // Datos del servidor ya filtrados → paginar localmente
      return filteredServerClients.slice(0, filteredDisplayedCount);
    }
    
    // Sin filtros → usar datos paginados normales
    return clients;
  }, [clients, filters, filteredServerClients, filteredDisplayedCount]);

  // hasMore dinámico
  const hasMore = useMemo(() => {
    const hasActiveFiltersNow = !!(filters.broker || filters.insurer || filters.ramo || filters.month !== undefined);
    
    if (hasActiveFiltersNow && filteredServerClients) {
      return filteredDisplayedCount < filteredServerClients.length;
    }
    
    return displayedCount < totalCount;
  }, [filters, filteredServerClients, filteredDisplayedCount, displayedCount, totalCount]);

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

  // Seleccionar TODOS los clientes (no solo los visibles) RESPETANDO LOS FILTROS
  const handleSelectAll = async () => {
    const hasActiveFiltersNow = !!(filters.broker || filters.insurer || filters.ramo || filters.month !== undefined);
    
    // Si ya hay selección completa → deseleccionar
    if (hasActiveFiltersNow && filteredServerClients) {
      // Con filtros: comparar contra TODOS los filtrados del servidor
      if (selectedClients.size >= filteredServerClients.length) {
        setSelectedClients(new Set());
        return;
      }
      // Seleccionar todos los filtrados (ya están en memoria)
      setSelectedClients(new Set(filteredServerClients.map(c => c.id)));
      return;
    }
    
    // Sin filtros: necesitamos todos los IDs del servidor
    // Si ya están todos seleccionados → deseleccionar
    if (selectedClients.size >= totalCount) {
      setSelectedClients(new Set());
      return;
    }
    
    // Fetch todos los IDs desde el servidor
    setIsSelectingAll(true);
    try {
      const response = await fetch('/api/db/select-all-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: searchQuery || '',
          filters: hasActiveFiltersNow ? filters : undefined,
        })
      });
      
      if (!response.ok) throw new Error('Error al obtener IDs');
      
      const data = await response.json();
      if (data.ok && data.ids) {
        setSelectedClients(new Set(data.ids));
        toast.success(`${data.ids.length} clientes seleccionados`);
      }
    } catch (error) {
      console.error('Error en seleccionar todos:', error);
      toast.error('Error al seleccionar todos los clientes');
      // Fallback: seleccionar solo los visibles
      setSelectedClients(new Set(filteredClients.map(c => c.id)));
    } finally {
      setIsSelectingAll(false);
    }
  };

  // Exportar RESPETANDO LOS FILTROS Y LA SELECCIÓN
  // IMPORTANTE: Las exportaciones cargan TODOS los clientes sin límite de paginación
  const handleExportFormat = async (format: 'pdf' | 'excel') => {
    const loadingToast = toast.loading('Preparando datos para exportar...');
    
    try {
      // Si hay clientes seleccionados, exportar solo esos (ya están en memoria)
      if (selectedClients.size > 0) {
        const clientsToExport = filteredClients.filter(c => selectedClients.has(c.id));
        
        toast.dismiss(loadingToast);
        if (format === 'pdf') {
          await exportToPDF(clientsToExport, role);
        } else {
          await exportToExcel(clientsToExport, role);
        }
      } else {
        // Si NO hay selección, cargar TODOS los clientes filtrados (sin límite)
        // Esto garantiza que la exportación incluya todos los datos, no solo los paginados
        const response = await fetch('/api/db/export-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchQuery: searchQuery || '',
            filters: filters
          })
        });
        
        if (!response.ok) {
          throw new Error('Error al cargar datos para exportar');
        }
        
        const data = await response.json();
        
        if (!data.ok || !data.clients) {
          throw new Error('No se pudieron cargar los clientes');
        }
        
        // Aplicar filtros del lado del cliente (igual que filteredClients)
        let allClients = data.clients;
        
        // Aplicar filtros de aseguradora, ramo, mes, broker
        allClients = allClients.map((client: any) => {
          let filteredPolicies = [...(client.policies || [])];

          if (filters.insurer) {
            filteredPolicies = filteredPolicies.filter(p => p.insurer_id === filters.insurer);
          }

          if (filters.ramo) {
            filteredPolicies = filteredPolicies.filter(p => p.ramo?.toLowerCase() === filters.ramo?.toLowerCase());
          }

          if (filters.month !== undefined) {
            filteredPolicies = filteredPolicies.filter(p => {
              if (!p.renewal_date) return false;
              const parts = p.renewal_date.split('-');
              if (parts.length < 2 || !parts[1]) return false;
              const month = parseInt(parts[1]) - 1;
              return month === filters.month;
            });
          }

          return {
            ...client,
            policies: filteredPolicies
          };
        });

        allClients = allClients.filter((client: any) => {
          if (filters.broker && role === 'master') {
            if (client.brokers?.id !== filters.broker) {
              return false;
            }
          }

          if (filters.insurer || filters.ramo || filters.month !== undefined) {
            return client.policies && client.policies.length > 0;
          }

          return true;
        });
        
        toast.dismiss(loadingToast);
        if (format === 'pdf') {
          await exportToPDF(allClients, role);
        } else {
          await exportToExcel(allClients, role);
        }
      }
      
      setShowExportModal(false);
      setSelectedClients(new Set());
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error al exportar:', error);
      toast.error('Error al preparar la exportación');
    }
  };

  // Obtener opciones únicas para filtros
  // Usar las props completas (insurers, brokers) para que TODAS las opciones estén disponibles
  const filterOptions = useMemo(() => {
    // Ramos: extraer de los clientes cargados + filtrados del servidor
    const ramoSet = new Set<string>();
    const allClients = filteredServerClients || clients;
    allClients.forEach(client => {
      client.policies?.forEach(policy => {
        if (policy.ramo) {
          ramoSet.add(policy.ramo);
        }
      });
    });
    // También de los clientes iniciales
    clients.forEach(client => {
      client.policies?.forEach(policy => {
        if (policy.ramo) {
          ramoSet.add(policy.ramo);
        }
      });
    });

    return {
      insurers: insurers.map(ins => ({ id: ins.id, name: ins.name })).sort((a, b) => a.name.localeCompare(b.name)),
      ramos: Array.from(ramoSet).sort(),
      brokers: brokers.map((b: any) => ({ id: b.id, name: b.name })).sort((a: any, b: any) => a.name.localeCompare(b.name))
    };
  }, [clients, filteredServerClients, insurers, brokers]);

  const hasActiveFilters = Object.keys(filters).length > 0;

  const renderTabContent = () => {
    if (view === 'renewals') {
      return <ClientsByMonth clients={clients} />;
    }
    if (view === 'preliminary') {
      return <PreliminaryClientsTab insurers={insurers} brokers={brokers} userRole={role} />;
    }
    if (isLoadingFiltered) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8AAA19]"></div>
            <span className="text-sm text-gray-500 font-medium">Cargando clientes filtrados...</span>
          </div>
        </div>
      );
    }
    return (
      <ClientsListView 
        clients={filteredClients} 
        onView={handleView} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        role={role}
        selectedClients={selectedClients}
        onToggleClient={handleToggleClient}
        onSelectAll={handleSelectAll}
        selectionMode={selectionMode}
        onViewPolicy={handleViewPolicy}
        onEditPolicy={handleEditPolicy}
        onDeletePolicy={handleDeletePolicy}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
        totalSelectableCount={
          (filters.broker || filters.insurer || filters.ramo || filters.month !== undefined) && filteredServerClients
            ? filteredServerClients.length
            : totalCount
        }
        isSelectingAll={isSelectingAll}
      />
    );
  };

  // Mostrar skeleton durante carga inicial
  if (isInitialLoading) {
    return <DatabaseSkeleton />;
  }
  
  return (
    <>
      {modal === 'new-client' && (
        <ClientPolicyWizard
          onClose={() => router.push(dbUrl(''))}
          onSuccess={() => {
            // Navegar directamente - el cambio de URL refresca automáticamente
            router.push(dbUrl(''));
          }}
          role={role}
          userEmail={userEmail}
        />
      )}
      {modal === 'view-client' && clientToEdit && (
        <ClientDetailsModal
          client={clientToEdit}
          onClose={() => router.push(dbUrl(''), { scroll: false })}
          onEdit={() => router.push(dbUrl(`modal=edit-client&editClient=${clientToEdit.id}`), { scroll: false })}
          onOpenExpediente={() => setExpedienteUploadModalOpen(true)}
        />
      )}
      {modal === 'edit-client' && clientToEdit && (
        <ClientForm 
          client={clientToEdit} 
          onClose={() => router.push(dbUrl(''), { scroll: false })}
          expedienteModalOpen={expedienteUploadModalOpen}
          onExpedienteModalChange={setExpedienteUploadModalOpen}
        />
      )}

      {/* Modal de Expediente - Separado y completamente independiente */}
      {expedienteUploadModalOpen && clientToEdit && (
        <Modal title="Gestionar Expediente" onClose={() => setExpedienteUploadModalOpen(false)}>
          <ExpedienteManager
            clientId={(clientToEdit as any).id}
            showClientDocs={true}
            showPolicyDocs={false}
            showOtros={true}
            readOnly={false}
          />
        </Modal>
      )}

      {/* Integrated Toolbar: Tabs + Actions */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* View Tabs */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap lg:flex-shrink-0">
            <button
              className={`px-2 sm:px-4 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap ${
                view === 'clients'
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => router.push('/db?tab=clients&view=clients', { scroll: false })}
            >
              <span className="hidden sm:inline">Clientes</span>
              <span className="sm:hidden">👥</span>
            </button>
            <button
              className={`px-2 sm:px-4 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-200 relative whitespace-nowrap ${
                view === 'preliminary'
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => router.push('/db?tab=clients&view=preliminary', { scroll: false })}
            >
              <span className="hidden sm:inline">Preliminares</span>
              <span className="sm:hidden">📝</span>
              {preliminaryCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
                  {preliminaryCount}
                </span>
              )}
            </button>
            <button
              className={`px-2 sm:px-4 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-200 relative whitespace-nowrap ${
                view === 'renewals'
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => router.push('/db?tab=clients&view=renewals', { scroll: false })}
              title={renewalsThisMonth > 0 ? `Tienes ${renewalsThisMonth} póliza(s) que van a renovar este mes` : 'Ver renovaciones por mes'}
            >
              <span className="hidden sm:inline">📅 Por Mes</span>
              <span className="sm:hidden">📅</span>
              {renewalsThisMonth > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
                  {renewalsThisMonth}
                </span>
              )}
            </button>
          </div>

          {/* Search + Action Icons - Only for clients view */}
          {view === 'clients' && clients.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:flex-1 lg:justify-end">
              {/* Search Bar */}
              <div className="w-full sm:w-auto sm:min-w-[240px] lg:min-w-[280px]">
                <Suspense fallback={
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-gray-400 text-sm">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                    <span>Cargando...</span>
                  </div>
                }>
                  <InlineSearchBar initialQuery={searchQuery} />
                </Suspense>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-1 sm:flex-shrink-0">
                {/* Filtrar */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:p-2.5 rounded-lg transition-all duration-200 relative ${
                    showFilters || hasActiveFilters
                      ? 'bg-[#8AAA19] text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Filtrar clientes"
                >
                  <Filter size={18} />
                  <span className="text-xs font-semibold sm:hidden">Filtrar</span>
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {Object.keys(filters).length}
                    </span>
                  )}
                </button>

                {/* Seleccionar */}
                <button
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    if (selectionMode) {
                      setSelectedClients(new Set());
                    }
                  }}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:p-2.5 rounded-lg transition-all duration-200 relative ${
                    selectionMode
                      ? 'bg-[#8AAA19] text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Modo selección"
                >
                  <CheckSquare size={18} />
                  <span className="text-xs font-semibold sm:hidden">Seleccionar</span>
                  {selectedClients.size > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {selectedClients.size}
                    </span>
                  )}
                </button>

                {/* Separador - Solo visible en desktop */}
                <div className="hidden sm:block w-px h-6 bg-gray-300 mx-1"></div>

                {/* Importar CSV */}
                <a
                  href="/db/import"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 sm:p-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-600 transition-all duration-200"
                  title="Importar CSV"
                >
                  <Upload size={18} />
                  <span className="text-xs font-semibold sm:hidden">Importar</span>
                </a>

                {/* Descargar */}
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 sm:p-2.5 rounded-lg bg-[#010139] text-white hover:bg-[#020270] transition-all duration-200 shadow-md hover:shadow-lg"
                  title="Descargar clientes"
                >
                  <Download size={18} />
                  <span className="text-xs font-semibold sm:hidden">Exportar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filtros - Solo para vista de clientes */}
      {view === 'clients' && showFilters && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Filter size={16} className="text-[#8AAA19]" />
              Filtrar y Seleccionar Clientes
            </h3>
            {hasActiveFilters && (
              <button
                onClick={() => setFilters({})}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Filtro por Aseguradora */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Aseguradora</label>
                <select
                  value={filters.insurer || ''}
                  onChange={(e) => setFilters({ ...filters, insurer: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8AAA19] focus:border-transparent"
                >
                  <option value="">Todas</option>
                  {filterOptions.insurers.map((ins: any) => (
                    <option key={ins.id} value={ins.id}>{ins.name}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Ramo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ramo</label>
                <select
                  value={filters.ramo || ''}
                  onChange={(e) => setFilters({ ...filters, ramo: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8AAA19] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {filterOptions.ramos.map((ramo: string) => (
                    <option key={ramo} value={ramo}>{ramo}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Mes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mes de Renovación</label>
                <select
                  value={filters.month !== undefined ? filters.month : ''}
                  onChange={(e) => setFilters({ ...filters, month: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8AAA19] focus:border-transparent"
                >
                  <option value="">Todos</option>
                  <option value="0">Enero</option>
                  <option value="1">Febrero</option>
                  <option value="2">Marzo</option>
                  <option value="3">Abril</option>
                  <option value="4">Mayo</option>
                  <option value="5">Junio</option>
                  <option value="6">Julio</option>
                  <option value="7">Agosto</option>
                  <option value="8">Septiembre</option>
                  <option value="9">Octubre</option>
                  <option value="10">Noviembre</option>
                  <option value="11">Diciembre</option>
                </select>
              </div>

              {/* Filtro por Corredor - Solo Master */}
              {role === 'master' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Corredor</label>
                  <select
                    value={filters.broker || ''}
                    onChange={(e) => setFilters({ ...filters, broker: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8AAA19] focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {filterOptions.brokers.map((broker: any) => (
                      <option key={broker.id} value={broker.id}>{capitalizeText(broker.name)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Resumen de filtros activos */}
            {hasActiveFilters && (
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                {filters.insurer && (
                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    Aseguradora: {filterOptions.insurers.find((i: any) => i.id === filters.insurer)?.name}
                  </span>
                )}
                {filters.ramo && (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    Ramo: {filters.ramo}
                  </span>
                )}
                {filters.month !== undefined && (
                  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                    Mes: {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][filters.month]}
                  </span>
                )}
                {filters.broker && role === 'master' && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">
                    Corredor: {capitalizeText(filterOptions.brokers.find((b: any) => b.id === filters.broker)?.name)}
                  </span>
                )}
                <span className="text-xs text-gray-600">
                  {isLoadingFiltered ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full"></span>
                      Cargando...
                    </span>
                  ) : (
                    `${filteredServerClients ? filteredServerClients.length : filteredClients.length} de ${totalCount} clientes`
                  )}
                </span>
              </div>
            )}
        </div>
      )}

      <div className="tab-content">
        {renderTabContent()}
      </div>

      {/* Export Format Modal */}
      <ExportFormatModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSelectFormat={handleExportFormat}
        selectedCount={selectedClients.size}
        totalCount={filteredClients.length}
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
          overflow-x: hidden;
          position: relative;
        }
        
        /* Permitir que los dropdowns se muestren correctamente */
        :global(.clients-table tbody tr) {
          position: relative;
        }
        
        :global(.ct-td-acciones) {
          overflow: visible !important;
        }
        
        /* Permitir scroll solo en mobile si es necesario */
        @media (max-width: 768px) {
          :global(.clients-wrapper) {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
        }

        :global(.clients-table) {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        
        @media (max-width: 768px) {
          :global(.clients-table) {
            min-width: 700px;
            table-layout: auto;
          }
        }
        
        @media (max-width: 480px) {
          :global(.clients-table) {
            min-width: 600px;
            table-layout: auto;
          }
        }

        :global(.clients-table thead) {
          background: #f9fafb;
        }

        :global(.ct-th) {
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          font-size: 0.875rem;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          white-space: nowrap;
        }
        
        @media (min-width: 769px) {
          /* DISTRIBUCIÓN CON CLASES ESPECÍFICAS - No depende de nth-child */
          
          /* Checkbox (cuando existe) */
          :global(.ct-th:has(input[type="checkbox"])),
          :global(.ct-td:has(input[type="checkbox"])) { 
            width: 50px !important;
          }
          
          /* Cliente - Ajustado para dar espacio a corredor */
          :global(.ct-th-name),
          :global(.ct-td-name) {
            width: 28% !important;
            min-width: 240px !important;
          }
          
          :global(.with-selection .ct-th-name),
          :global(.with-selection .ct-td-name) {
            width: 26% !important;
            min-width: 220px !important;
          }
          
          /* Cédula - Más espacio */
          :global(.ct-th-cedula),
          :global(.ct-td-cedula) {
            width: 12% !important;
            min-width: 130px !important;
            max-width: 180px !important;
          }
          
          /* Correo */
          :global(.ct-th-correo),
          :global(.ct-td-correo) {
            width: 18% !important;
            min-width: 180px !important;
          }
          
          /* Celular */
          :global(.ct-th-celular),
          :global(.ct-td-celular) {
            width: 12% !important;
            min-width: 120px !important;
          }
          
          /* Pólizas */
          :global(.ct-th-polizas),
          :global(.ct-td-polizas) {
            width: 7% !important;
            min-width: 70px !important;
            text-align: center;
          }
          
          /* Corredor - Más espacio */
          :global(.ct-th-corredor),
          :global(.ct-td-corredor) {
            width: 15% !important;
            min-width: 180px !important;
            white-space: normal !important;
            word-wrap: break-word !important;
          }
        }

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
          padding: 12px 8px;
          font-size: 0.875rem;
          color: #111827;
          vertical-align: middle;
        }
        
        /* En PC, no hacer wrap del texto en celdas normales */
        @media (min-width: 769px) {
          :global(.ct-td) {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          /* Excepción: la columna del nombre y corredor pueden hacer wrap */
          :global(.ct-td-name),
          :global(.ct-td-corredor) {
            white-space: normal !important;
            word-wrap: break-word !important;
          }
        }
        
        /* En mobile, permitir wrap más natural */
        @media (max-width: 768px) {
          :global(.ct-td) {
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          
          /* Nombre del cliente: wrap sin partir palabras abruptamente */
          :global(.ct-td-name) {
            word-break: normal !important;
            hyphens: none !important;
            line-height: 1.3 !important;
          }
          
          :global(.ct-name) {
            display: block;
            line-height: 1.3;
          }
        }

        /* TRIGGER PARA DESPLEGAR */
        :global(.ct-trigger) {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          padding: 0;
          gap: 8px;
          text-align: left;
        }
        :global(.ct-name) {
          font-weight: 400;
          color: #111827;
          flex: 1 1 auto;
          overflow: hidden;
        }
        
        @media (min-width: 769px) {
          :global(.ct-name) {
            white-space: normal;
            word-wrap: break-word;
          }
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
          padding: 20px !important;
          background: #f9fafb !important;
        }
        :global(.pol-panel) {
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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
          font-size: 1.125rem;
          font-weight: 700;
          color: #010139;
          margin: 0;
        }
        :global(.pol-count) {
          font-size: 0.875rem;
          font-weight: 600;
          color: #8AAA19;
          background: #f0f9ff;
          padding: 4px 12px;
          border-radius: 12px;
        }

        :global(.pol-list) {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        :global(.pol-row) {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 18px 20px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          gap: 20px;
          transition: all 0.2s ease;
        }
        :global(.pol-row:hover) {
          background: #f9fafb;
          border-color: #8AAA19;
          box-shadow: 0 2px 8px rgba(138, 170, 25, 0.1);
        }
        
        @media (min-width: 769px) {
          :global(.pol-row) {
            align-items: center;
          }
        }

        :global(.pol-main) {
          flex: 1;
          min-width: 0;
          max-width: 100%;
        }
        :global(.pol-number) {
          font-weight: 700;
          color: #010139;
          font-size: 1rem;
          margin-bottom: 8px;
          word-break: break-word;
        }
        :global(.pol-meta) {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 0.9375rem;
          color: #374151;
          line-height: 1.6;
        }
        :global(.pol-meta strong) {
          color: #111827;
          font-weight: 600;
        }

        :global(.pol-notas) {
          margin-top: 12px;
          padding: 12px 16px;
          background: #f0f9ff;
          border-left: 4px solid #0ea5e9;
          border-radius: 6px;
          font-size: 0.875rem;
          line-height: 1.6;
        }
        :global(.pol-notas-label) {
          font-weight: 700;
          color: #0369a1;
          margin-right: 8px;
        }
        :global(.pol-notas-text) {
          color: #374151;
        }

        :global(.pol-actions) {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
          justify-content: flex-end;
          min-width: 44px;
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

        /* BOTONES DE ACCIÓN - Ya no se necesitan estilos individuales */
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

        /* RESPONSIVE */
        @media (max-width: 768px) {
          :global(.clients-wrapper) {
            margin: 0 -20px;
            padding: 0 20px;
          }
          
          :global(.ct-th),
          :global(.ct-td) {
            padding: 10px 6px;
            font-size: 0.8125rem;
          }
          
          /* Ocultar Correo, Celular, Pólizas y Corredor en tablet */
          :global(.ct-th-correo),
          :global(.ct-td-correo),
          :global(.ct-th-celular),
          :global(.ct-td-celular),
          :global(.ct-th-polizas),
          :global(.ct-td-polizas),
          :global(.ct-th-corredor),
          :global(.ct-td-corredor) {
            display: none;
          }
          
          :global(.ct-name) {
            font-size: 0.9375rem;
            font-weight: 400;
            line-height: 1.35;
            max-width: 200px;
          }
          /* Distribución en tablet: Nombre, Cédula, Acciones */
          :global(.ct-th-name),
          :global(.ct-td-name) {
            width: 60% !important;
            min-width: 0 !important;
            padding-right: 12px !important;
          }
          
          :global(.ct-th-cedula),
          :global(.ct-td-cedula) {
            width: 30% !important;
          }
          
          :global(.ct-th-acciones),
          :global(.ct-td-acciones) {
            width: 60px !important;
            min-width: 60px !important;
            max-width: 60px !important;
          }
          
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
          :global(.tab-content) {
            padding: 12px 0;
          }
          
          :global(.clients-wrapper) {
            margin: 0;
            padding: 0;
          }
          
          /* Solo mostrar: Checkbox (si activo), Cliente y Acciones */
          :global(.ct-th:nth-child(3)),
          :global(.ct-td:nth-child(3)) {
            display: none;
          }
          
          :global(.ct-th),
          :global(.ct-td) {
            padding: 10px 6px;
            font-size: 0.8125rem;
          }
          
          :global(.ct-name) {
            font-size: 0.875rem;
            font-weight: 400;
            line-height: 1.4;
            max-width: none;
          }
          /* Distribución optimizada en mobile */
          :global(.ct-th-name),
          :global(.ct-td-name) {
            width: auto !important;
            min-width: 0 !important;
            padding-right: 12px !important;
          }
          
          /* Acciones - Un solo botón */
          :global(.ct-th-acciones),
          :global(.ct-td-acciones) {
            width: 60px !important;
            min-width: 60px !important;
            max-width: 60px !important;
          }
          
          /* Checkbox si está activo */
          :global(.with-selection .ct-th:has(input[type="checkbox"])),
          :global(.with-selection .ct-td:has(input[type="checkbox"])) {
            width: 44px !important;
            padding: 8px 4px !important;
          }
          
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
            font-size: 0.8125rem;
            gap: 8px;
          }
          :global(.pol-meta span) {
            white-space: nowrap;
          }
          :global(.icon-btn) {
            width: 32px;
            height: 32px;
            padding: 6px;
          }
          :global(.ct-actions) {
            gap: 3px;
            flex-wrap: nowrap;
          }
        }
        
        /* Mobile First - Pantallas muy pequeñas */
        @media (max-width: 360px) {
          :global(.ct-name) {
            font-size: 0.8125rem;
            font-weight: 400;
            line-height: 1.3;
          }
          
          :global(.ct-th),
          :global(.ct-td) {
            padding: 8px 4px;
          }
          
          :global(.ct-actions) {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 3px;
          }
          
          :global(.pol-actions) {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
          }
          
          :global(.icon-btn) {
            width: 100%;
            min-height: 38px;
          }
          
          /* Acciones - Un solo botón */
          :global(.ct-th-acciones),
          :global(.ct-td-acciones) {
            width: 60px !important;
            min-width: 60px !important;
            max-width: 60px !important;
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
