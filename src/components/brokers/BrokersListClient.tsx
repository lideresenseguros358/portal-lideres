'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaFileExport, FaUserPlus, FaEye, FaClipboardList, FaTable, FaBell } from 'react-icons/fa';
import { toast } from 'sonner';
import Link from 'next/link';
import { actionGetBrokers, actionExportBrokers, actionBulkUpdateBrokers, actionToggleBrokerRenewalNotifications } from '@/app/(app)/brokers/actions';
import { OFICINA_EMAIL } from '@/lib/constants/brokers';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import BrokersBulkEditModal from './BrokersBulkEditModal';
import { supabaseClient } from '@/lib/supabase/client';

export default function BrokersListClient() {
  const [loading, setLoading] = useState(true);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [userRole, setUserRole] = useState<'master' | 'broker' | null>(null);

  const loadBrokers = useCallback(async () => {
    setLoading(true);
    const result = await actionGetBrokers(search || undefined);
    
    if (result.ok) {
      setBrokers(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    loadBrokers();
  }, [loadBrokers]);

  useEffect(() => {
    // Obtener rol del usuario
    const getUserRole = async () => {
      const { data: { user } } = await supabaseClient().auth.getUser();
      if (user) {
        const { data: profile } = await supabaseClient()
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setUserRole(profile?.role as 'master' | 'broker' || null);
      }
    };
    getUserRole();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadBrokers();
  };

  const handleSelectBroker = (brokerId: string) => {
    setSelectedBrokers(prev =>
      prev.includes(brokerId)
        ? prev.filter(id => id !== brokerId)
        : [...prev, brokerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedBrokers.length === brokers.length) {
      setSelectedBrokers([]);
    } else {
      setSelectedBrokers(brokers.map(b => b.id));
    }
  };

  const handleExport = async () => {
    const result = await actionExportBrokers(selectedBrokers.length > 0 ? selectedBrokers : undefined);

    if (result.ok) {
      // Convert to CSV
      const headers = Object.keys(result.data[0] || {});
      const csvContent = [
        headers.join(','),
        ...result.data.map((row: any) => headers.map(h => `"${row[h] || ''}"`).join(','))
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `corredores_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Archivo exportado correctamente');
    } else {
      toast.error(result.error);
    }
  };

  const handleOpenBulkEdit = () => {
    if (brokers.length === 0) {
      toast.error('No hay corredores para editar');
      return;
    }
    setShowBulkEdit(true);
  };

  const handleBulkSave = async (updates: any[]) => {
    const result = await actionBulkUpdateBrokers(updates);
    
    if (result.ok) {
      toast.success(result.message || 'Corredores actualizados correctamente');
      await loadBrokers();
      setShowBulkEdit(false);
    } else {
      toast.error(result.error);
      throw new Error(result.error);
    }
  };

  const handleToggleNotifications = async (brokerId: string, currentValue: boolean) => {
    const result = await actionToggleBrokerRenewalNotifications(brokerId, !currentValue);
    
    if (result.ok) {
      toast.success(result.message);
      await loadBrokers();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#010139]">
              Corredores
            </h1>
            <p className="text-gray-600 mt-1">
              {brokers.length} corredores registrados
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/requests"
              className="px-4 py-2.5 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
            >
              <FaClipboardList className="text-white" />
              <span className="hidden sm:inline text-white">Solicitudes</span>
            </Link>

            <button
              onClick={handleOpenBulkEdit}
              className="px-4 py-2.5 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
            >
              <FaTable />
              <span className="hidden sm:inline">Edición Masiva</span>
              <span className="sm:hidden">Excel</span>
            </button>

            <button
              onClick={handleExport}
              className="px-4 py-2.5 bg-[#010139] hover:bg-[#020270] text-white rounded-lg transition-all flex items-center gap-2 font-semibold"
            >
              <FaFileExport />
              <span className="hidden sm:inline">
                {selectedBrokers.length > 0 ? `Exportar (${selectedBrokers.length})` : 'Exportar'}
              </span>
              <span className="sm:hidden">Exportar</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 border-2 border-gray-300 rounded-lg focus-within:border-[#8AAA19] bg-white px-3 py-2.5">
            <div className="flex-shrink-0 text-gray-400">
              <FaSearch />
            </div>
            <input
              type="text"
              value={search}
              onChange={createUppercaseHandler((e) => setSearch(e.target.value))}
              placeholder="BUSCAR POR NOMBRE, EMAIL, CÉDULA O CÓDIGO..."
              className={`flex-1 min-w-0 border-0 focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 text-sm bg-transparent p-0 ${uppercaseInputClass}`}
              style={{ WebkitTextSizeAdjust: '100%', WebkitAppearance: 'none' }}
            />
          </div>
          <button
            type="submit"
            className="px-4 sm:px-6 py-2.5 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all font-semibold text-sm"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Brokers List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 mt-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
        </div>
      ) : brokers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-12 text-center mt-4">
          <div className="text-gray-400 text-6xl mb-4">👥</div>
          <h3 className="text-xl font-bold text-gray-600 mb-2">No hay corredores</h3>
          <p className="text-gray-500">No se encontraron corredores con ese criterio de búsqueda.</p>
        </div>
      ) : (
        <>
          {/* Select All (Desktop) */}
          <div className="hidden md:flex items-center gap-2 bg-white rounded-lg shadow p-3 border-2 border-gray-100 mb-3 mt-4">
            <input
              type="checkbox"
              checked={selectedBrokers.length === brokers.length}
              onChange={handleSelectAll}
              className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
            />
            <label className="text-sm font-semibold text-gray-700">
              Seleccionar todos ({brokers.length})
            </label>
          </div>

          {/* Brokers Cards */}
          <div className="space-y-3 mt-4 md:mt-0">
            {brokers.map((broker) => {
              const isSelected = selectedBrokers.includes(broker.id);
              const isOficina = (broker.profiles as any)?.email === OFICINA_EMAIL;
              const brokerName = broker.name || (broker.profiles as any)?.full_name || (broker.profiles as any)?.name || 'Sin nombre';

              return (
                <div
                  key={broker.id}
                  className={`
                    bg-white rounded-xl shadow-lg border-2 transition-all p-4 sm:p-6
                    ${isSelected ? 'border-[#8AAA19] ring-2 ring-[#8AAA19] ring-opacity-50' : 'border-gray-100'}
                    hover:shadow-xl
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectBroker(broker.id)}
                      className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[#010139] text-lg">
                            {brokerName}
                          </h3>
                          {isOficina && (
                            <span className="px-2 py-0.5 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-full text-xs font-semibold">
                              OFICINA
                            </span>
                          )}
                          {(broker.profiles as any)?.role === 'master' && !isOficina && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-300 rounded-full text-xs font-semibold">
                              MASTER
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {/* Status Badge */}
                          <span className={`
                            px-3 py-1 rounded-full text-xs font-semibold border-2
                            ${broker.active 
                              ? 'bg-green-100 text-green-800 border-green-300' 
                              : 'bg-red-100 text-red-800 border-red-300'
                            }
                          `}>
                            {broker.active ? 'Activo' : 'Inactivo'}
                          </span>

                          {/* View Button */}
                          <Link
                            href={`/brokers/${broker.id}`}
                            className="px-4 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all flex items-center gap-2 text-sm font-semibold"
                          >
                            <FaEye className="text-white" />
                            <span className="hidden sm:inline text-white">Ver detalle</span>
                          </Link>
                        </div>
                      </div>

                      {/* Quick Info */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                        <span>{(broker.profiles as any)?.email || broker.email}</span>
                        {broker.phone && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span>{broker.phone}</span>
                          </>
                        )}
                        {broker.percent_default && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="font-semibold text-[#8AAA19]">
                              {(broker.percent_default * 100).toFixed(0)}% default
                            </span>
                          </>
                        )}
                        
                        {/* Toggle Notificaciones (Solo para Master) */}
                        {userRole === 'master' && (
                          <>
                            <span className="text-gray-400">•</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleNotifications(broker.id, (broker.profiles as any)?.notify_broker_renewals || false);
                              }}
                              className={`
                                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all
                                ${(broker.profiles as any)?.notify_broker_renewals
                                  ? 'bg-[#8AAA19] text-white hover:bg-[#7a9917]'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }
                              `}
                              title={
                                (broker.profiles as any)?.notify_broker_renewals
                                  ? 'Master recibe notificaciones de renovación de este broker'
                                  : 'Click para recibir notificaciones de renovación de este broker'
                              }
                            >
                              <FaBell className={
                                (broker.profiles as any)?.notify_broker_renewals
                                  ? 'text-white'
                                  : 'text-gray-700'
                              } />
                              <span>
                                {(broker.profiles as any)?.notify_broker_renewals ? 'Notif ON' : 'Notif OFF'}
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bulk Edit Modal */}
      <BrokersBulkEditModal
        isOpen={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        brokers={brokers}
        onSave={handleBulkSave}
      />
    </>
  );
}
