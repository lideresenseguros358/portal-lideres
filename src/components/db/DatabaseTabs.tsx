'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, Edit3, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '@/components/Modal';
import ClientForm from './ClientForm';
import SearchModal from './SearchModal';
import ClientsByInsurer from './ClientsByInsurer';
import ClientPolicyWizard from './ClientPolicyWizard';
import PreliminaryClientsTab from './PreliminaryClientsTab';
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
}

const ClientsListView = ({ clients, onView, onEdit, onDelete, role }: ClientsListViewProps) => {
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

  return (
    <div className="clients-wrapper">
      <table className="clients-table">
        <thead>
          <tr className="ct-head">
            <th className="ct-th">Cliente</th>
            <th className="ct-th">Cédula</th>
            <th className="ct-th">Celular</th>
            <th className="ct-th">Correo</th>
            {role === 'master' && <th className="ct-th">Corredor</th>}
            <th className="ct-th text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ client, nationalId, email, phone, brokerName }) => {
            const isExpanded = expandedClients.has(client.id);
            return (
              <React.Fragment key={client.id}>
                <tr className="ct-item">
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
                  <td className="ct-td">{email}</td>
                  {role === 'master' && <td className="ct-td">{brokerName}</td>}
                  <td className="ct-td">
                    <div className="ct-actions">
                      <button 
                        className="icon-btn view" 
                        onClick={() => onView(client.id)}
                        aria-label="Ver cliente"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        className="icon-btn edit" 
                        onClick={() => onEdit(client.id)}
                        aria-label="Editar cliente"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        className="icon-btn delete" 
                        onClick={() => onDelete(client.id)}
                        aria-label="Eliminar cliente"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan={role === 'master' ? 6 : 5} className="ct-detail">
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
                                  <div className="pol-number">{policy.policy_number || 'Sin número'}</div>
                                  <div className="pol-meta">
                                    <span>{policy.insurers?.name?.toUpperCase?.() || '—'}</span>
                                    <span>•</span>
                                    <span>{policy.ramo?.toUpperCase?.() || '—'}</span>
                                    <span>•</span>
                                    <span>Renovación: {formatDate(policy.renewal_date)}</span>
                                  </div>
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

  const renderTabContent = () => {
    if (view === 'insurers') {
      return <ClientsByInsurer clients={clients} insurers={insurers} />;
    }
    if (view === 'preliminary') {
      return <PreliminaryClientsTab insurers={insurers} brokers={brokers} userRole={role} />;
    }
    return <ClientsListView clients={clients} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} role={role} />;
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
      {modal === 'search' && <SearchModal />}

      <div className="group-switch">
        <button
          className={`gs-btn ${view === 'clients' ? 'is-active' : ''}`}
          data-group="clientes"
          onClick={() => router.push('/db?tab=clients&view=clients', { scroll: false })}
        >
          CLIENTES
        </button>
        <button
          className={`gs-btn ${view === 'preliminary' ? 'is-active' : ''} relative`}
          data-group="preliminares"
          onClick={() => router.push('/db?tab=clients&view=preliminary', { scroll: false })}
        >
          PRELIMINARES
          {preliminaryCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg border-2 border-white">
              {preliminaryCount}
            </span>
          )}
        </button>
        <button
          className={`gs-btn ${view === 'insurers' ? 'is-active' : ''}`}
          data-group="aseguradoras"
          onClick={() => router.push('/db?tab=clients&view=insurers', { scroll: false })}
        >
          ASEGURADORAS
        </button>
      </div>

      <div className="tab-content">
        {renderTabContent()}
      </div>

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

        /* Group Switch */
        .group-switch {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .gs-btn {
          padding: 8px 14px;
          border-radius: 10px;
          border: 0;
          font-weight: 600;
          color: #fff;
          background: var(--brand-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .gs-btn:is(:hover, :focus-visible) {
          filter: brightness(0.95);
          outline: 2px solid var(--brand-primary);
          outline-offset: 2px;
        }
        .gs-btn.is-active {
          box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.55);
        }

        /* Container */
        .tab-content {
          background: var(--brand-surface);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          margin-top: 24px;
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
        :global(.ct-th:nth-child(1)) { width: 20%; }
        :global(.ct-th:nth-child(2)) { width: 12%; }
        :global(.ct-th:nth-child(3)) { width: 12%; }
        :global(.ct-th:nth-child(4)) { width: 20%; }
        :global(.ct-th:nth-child(5)) { width: 18%; }
        :global(.ct-th:nth-child(6)) { width: 18%; }

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

        /* RESPONSIVE */
        @media (max-width: 768px) {
          :global(.ct-th:nth-child(3)),
          :global(.ct-th:nth-child(4)),
          :global(.ct-th:nth-child(5)),
          :global(.ct-td:nth-child(3)),
          :global(.ct-td:nth-child(4)),
          :global(.ct-td:nth-child(5)) {
            display: none;
          }
          :global(.ct-th:nth-child(1)) { width: 35%; }
          :global(.ct-th:nth-child(2)) { width: 25%; }
          :global(.ct-th:nth-child(6)) { width: 40%; }
          
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
          :global(.ct-th:nth-child(2)),
          :global(.ct-td:nth-child(2)) {
            display: none;
          }
          :global(.ct-th:nth-child(1)) { width: 60%; }
          :global(.ct-th:nth-child(6)) { width: 40%; }
          
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
            width: 36px;
            height: 36px;
          }
        }
        
        /* Mobile First - Pantallas muy pequeñas */
        @media (max-width: 360px) {
          :global(.ct-actions) {
            flex-direction: column;
            gap: 2px;
          }
          :global(.pol-actions) {
            gap: 2px;
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
