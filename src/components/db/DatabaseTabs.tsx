'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { FaEdit, FaTrash, FaPlus, FaFileAlt, FaDownload, FaExclamationTriangle, FaCheckCircle, FaUser, FaBuilding } from 'react-icons/fa';
import type { Tables } from '@/lib/supabase/server';
import Modal from '@/components/Modal';
import ClientForm from './ClientForm';
import SearchModal from './SearchModal';
import ViewSwitcher from './ViewSwitcher';
import ClientsByInsurer from './ClientsByInsurer';
import ClientPolicyWizard from './ClientPolicyWizard';
import { ClientWithPolicies, InsurerWithCount } from '@/types/db';

interface DatabaseTabsProps {
  activeTab: string;
  clients: ClientWithPolicies[];
  insurers: InsurerWithCount[];
  searchQuery?: string;
  role: string;
  userEmail: string;
}

const getRenewalStatus = (renewalDate: string | null) => {
  if (!renewalDate) return null;
  const today = new Date();
  const renewal = new Date(renewalDate);
  const daysUntil = Math.floor((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) {
    return { type: 'expired', text: 'Vencida', color: 'red' };
  } else if (daysUntil <= 30) {
    return { type: 'soon', text: `Renueva en ${daysUntil} días`, color: 'blue' };
  }
  return null;
};

const ClientsListView = ({ clients }: { clients: ClientWithPolicies[] }) => {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const toggleClient = (clientId: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  if (clients.length === 0) {
    return (
      <div className="empty-state">
        <p>No se encontraron clientes</p>
        <Link href="/db?modal=new-client" className="btn-primary">
          <FaPlus /> Crear primer cliente
        </Link>
      </div>
    );
  }

  return (
    <div className="clients-list">
      {clients.map((client) => {
        const isExpanded = expandedClients.has(client.id);
        return (
          <div key={client.id} className="client-card">
            <div className="client-header" onClick={() => toggleClient(client.id)}>
              <div className="client-info">
                <h3 className="client-name">{client.name}</h3>
                <div className="client-details">
                  <span className="client-id">{client.national_id}</span>
                  {client.email && <span className="client-email">{client.email}</span>}
                  {client.phone && <span className="client-phone">{client.phone}</span>}
                </div>
                <div className="client-meta">
                  <span className="broker-badge">{client.brokers?.name || 'Sin corredor'}</span>
                </div>
              </div>
              <div className="client-actions">
                <Link href={`/db?tab=clients&modal=edit-client&editClient=${client.id}`} scroll={false} className="btn-icon" title="Editar cliente">
                  <FaEdit />
                </Link>
                <Link href={`/db?tab=clients&modal=delete-client&deleteClient=${client.id}`} scroll={false} className="btn-icon danger" title="Eliminar cliente">
                  <FaTrash />
                </Link>
              </div>
            </div>

            {isExpanded && (
              <div className="client-policies">
                <div className="policies-header">
                  <h4>Pólizas del cliente</h4>
                  <button className="btn-add-policy">
                    <FaPlus /> Agregar póliza
                  </button>
                </div>
                
                {client.policies?.length === 0 ? (
                  <p className="no-policies">Sin pólizas registradas</p>
                ) : (
                  <div className="policies-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Nº Póliza</th>
                          <th>Ramo</th>
                          <th>Aseguradora</th>
                          <th>Renovación</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {client.policies?.map((policy) => {
                          const renewalStatus = getRenewalStatus(policy.renewal_date);
                          return (
                            <tr key={policy.id}>
                              <td className="policy-number">{policy.policy_number}</td>
                              <td>{policy.ramo || '-'}</td>
                              <td>{policy.insurers?.name || '-'}</td>
                              <td>
                                {policy.renewal_date ? 
                                  new Date(policy.renewal_date).toLocaleDateString('es-PA') : 
                                  '-'
                                }
                              </td>
                              <td>
                                {renewalStatus && (
                                  <span className={`status-chip ${renewalStatus.color}`}>
                                    {renewalStatus.text}
                                  </span>
                                )}
                              </td>
                              <td className="policy-actions">
                                <button className="btn-icon-sm" title="Editar"><FaEdit /></button>
                                <button className="btn-icon-sm danger" title="Eliminar"><FaTrash /></button>
                                <button className="btn-icon-sm" title="Trámite"><FaFileAlt /></button>
                                <button className="btn-icon-sm" title="Descargas"><FaDownload /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function DatabaseTabs({ 
  activeTab, 
  clients, 
  insurers,
  role,
  userEmail,
}: DatabaseTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modal = searchParams.get('modal');
  const clientToEditId = searchParams.get('editClient');
  const view = searchParams.get('view') || 'clients';

  const clientToEdit = clientToEditId ? clients.find(c => c.id === clientToEditId) : null;

  const renderTabContent = () => {
    // Vista por aseguradora
    if (view === 'insurers') {
      return <ClientsByInsurer clients={clients} insurers={insurers} />;
    }
    // Vista por cliente (default)
    return <ClientsListView clients={clients} />;
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

      <div className="flex justify-between items-center mb-6">
        <div className="filter-section">
          <span className="filter-label">Filtrar por:</span>
          <div className="view-toggle-container">
            <Link 
              href="/db?tab=clients&view=clients" 
              className={`view-toggle-btn ${activeTab === 'clients' && view === 'clients' ? 'active' : ''}`}
            >
              <FaUser className="icon" />
              <span>Por Cliente</span>
            </Link>
            <Link 
              href="/db?tab=clients&view=insurers" 
              className={`view-toggle-btn ${view === 'insurers' ? 'active' : ''}`}
            >
              <FaBuilding className="icon" />
              <span>Por Aseguradora</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="tab-content">
        {renderTabContent()}
      </div>

      <style jsx>{`
        .filter-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .filter-label {
          font-size: 16px;
          font-weight: 600;
          color: #010139;
          white-space: nowrap;
        }
        .view-toggle-container {
          display: flex;
          gap: 12px;
          background: white;
          padding: 6px;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(1, 1, 57, 0.1);
        }
        .view-toggle-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          color: #666;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          white-space: nowrap;
        }
        .view-toggle-btn .icon {
          font-size: 16px;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }
        .view-toggle-btn:hover {
          color: #010139;
          background: linear-gradient(135deg, #f6f6ff 0%, #e8e8ff 100%);
          transform: translateY(-2px);
        }
        .view-toggle-btn:hover .icon {
          transform: scale(1.2) rotate(5deg);
        }
        .view-toggle-btn.active {
          background: linear-gradient(135deg, #010139 0%, #020270 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(1, 1, 57, 0.3);
        }
        .view-toggle-btn.active .icon {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .tab-content {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          margin-top: 24px;
        }
        .client-card {
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .client-header {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: background 0.2s;
        }
        .client-header:hover {
          background: #f9f9f9;
        }
        .client-info { flex: 1; }
        .client-name { font-size: 17px; font-weight: 600; color: #010139; margin-bottom: 8px; }
        .client-details { display: flex; gap: 16px; margin-bottom: 8px; }
        .client-details span { font-size: 13px; color: #666; }
        .client-meta { display: flex; gap: 12px; align-items: center; }
        .broker-badge { background: #f6f6ff; color: #010139; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; }
        .policy-count { font-size: 14px; color: #8aaa19; font-weight: 500; }
        .client-actions { display: flex; gap: 8px; }
        .btn-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: none; background: #f6f6ff; color: #010139; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
        .btn-icon:hover { background: #010139; color: white; transform: translateY(-1px); }
        .btn-icon.danger:hover { background: #d32f2f; }
        .client-policies { padding: 20px; background: #f9f9f9; border-top: 1px solid #e0e0e0; }
        .policies-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .policies-header h4 { font-size: 16px; font-weight: 600; color: #010139; }
        .btn-add-policy { display: flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 13px; background: #8aaa19; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-add-policy:hover { background: #6f8815; transform: translateY(-1px); }
        .policies-table { overflow-x: auto; }
        .policies-table table { width: 100%; border-collapse: collapse; }
        .policies-table th, .policies-table td { padding: 10px; font-size: 13px; white-space: nowrap; }
        .policies-table th { text-align: left; background: white; font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .policies-table td { border-top: 1px solid #e0e0e0; }
        .policy-number { font-weight: 600; color: #010139; }
        .status-chip { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        .status-chip.red { background: #ffebee; color: #d32f2f; }
        .status-chip.blue { background: #e3f2fd; color: #1976d2; }
        .policy-actions { display: flex; gap: 4px; }
        .btn-icon-sm { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: #666; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
        .btn-icon-sm:hover { background: #010139; color: white; }
        .btn-icon-sm.danger:hover { background: #d32f2f; }
        .insurers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .insurer-card { padding: 24px; border: 2px solid #f0f0f0; border-radius: 12px; text-decoration: none; color: inherit; transition: all 0.2s; }
        .insurer-card:hover { border-color: #010139; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(1, 1, 57, 0.1); }
        .insurer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .insurer-name { font-size: 18px; font-weight: 600; color: #010139; }
        .status-icon { font-size: 20px; }
        .status-icon.active { color: #4caf50; }
        .status-icon.inactive { color: #ff9800; }
        .insurer-stats { margin-bottom: 16px; }
        .view-policies { color: #8aaa19; font-weight: 500; }
        .empty-state { text-align: center; padding: 60px 20px; color: #666; }
        .empty-state .btn-primary { display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; padding: 12px 24px; background: #010139; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; transition: all 0.2s; }
        .empty-state .btn-primary:hover { background: #8aaa19; transform: translateY(-1px); }
      `}</style>
    </>
  );
}