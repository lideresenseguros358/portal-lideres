'use client';

import { useState, useEffect } from 'react';
import { FaSearch, FaFilter, FaChevronDown, FaChevronUp, FaExternalLinkAlt } from 'react-icons/fa';
import { actionGetDelinquencyRecords, actionGetActiveInsurers, actionGetBrokers } from '@/app/(app)/delinquency/actions';
import { toast } from 'sonner';
import Link from 'next/link';

interface DetailTabProps {
  userRole: 'master' | 'broker';
  brokerId: string | null;
}

export default function DetailTab({ userRole, brokerId }: DetailTabProps) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [selectedInsurer, setSelectedInsurer] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    if (userRole === 'broker' && brokerId) {
      setSelectedBroker(brokerId);
    }
  }, [userRole, brokerId]);

  useEffect(() => {
    loadRecords();
  }, [selectedInsurer, selectedBroker, searchTerm]);

  const loadFilters = async () => {
    try {
      const [insurersRes, brokersRes] = await Promise.all([
        actionGetActiveInsurers(),
        userRole === 'master' ? actionGetBrokers() : Promise.resolve({ ok: true, data: [] }),
      ]);

      if (insurersRes.ok) setInsurers(insurersRes.data || []);
      if (brokersRes.ok) setBrokers(brokersRes.data || []);
    } catch (error) {
      toast.error('Error al cargar filtros');
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (selectedInsurer) filters.insurerId = selectedInsurer;
      if (selectedBroker) filters.brokerId = selectedBroker;
      else if (userRole === 'broker' && brokerId) filters.brokerId = brokerId;
      if (searchTerm) filters.search = searchTerm;

      const result = await actionGetDelinquencyRecords(filters);
      if (result.ok) {
        // Get insurer and broker names separately
        const recordsData = result.data || [];
        const insurerIds = [...new Set(recordsData.map((r: any) => r.insurer_id))].filter(Boolean);
        const brokerIds = [...new Set(recordsData.map((r: any) => r.broker_id))].filter(Boolean);

        const [insurersRes, brokersRes] = await Promise.all([
          insurerIds.length > 0 ? actionGetActiveInsurers() : Promise.resolve({ ok: true, data: [] }),
          brokerIds.length > 0 ? actionGetBrokers() : Promise.resolve({ ok: true, data: [] }),
        ]);

        const insurerMap = new Map((insurersRes.data || []).map(i => [i.id, i.name]));
        const brokerMap = new Map((brokersRes.data || []).map(b => [b.id, b.name]));

        const enrichedRecords = recordsData.map((record: any) => ({
          ...record,
          insurers: { name: insurerMap.get(record.insurer_id) || '-' },
          brokers: { name: brokerMap.get(record.broker_id) || 'Sin asignar' },
        }));

        setRecords(enrichedRecords);
      } else {
        toast.error('Error al cargar registros');
      }
    } catch (error) {
      toast.error('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <FaFilter className="text-[#010139]" />
            <h3 className="text-lg font-bold text-[#010139]">Filtros y Búsqueda</h3>
          </div>
          
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-2 px-4 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all"
          >
            <FaSearch />
            <span className="text-sm">Buscar</span>
          </button>
        </div>

        {/* Search Modal */}
        {showSearch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xl font-bold text-[#010139]">Buscar</h4>
                <button
                  onClick={() => setShowSearch(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <input
                type="text"
                placeholder="N° Póliza o Cliente"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
                autoFocus
              />
              
              <button
                onClick={() => {
                  setShowSearch(false);
                  loadRecords();
                }}
                className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-medium"
              >
                Buscar
              </button>
              
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowSearch(false);
                  }}
                  className="w-full mt-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter Selects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aseguradora
            </label>
            <select
              value={selectedInsurer}
              onChange={(e) => setSelectedInsurer(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
            >
              <option value="">Todas</option>
              {insurers.map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {ins.name}
                </option>
              ))}
            </select>
          </div>

          {userRole === 'master' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Corredor
              </label>
              <select
                value={selectedBroker}
                onChange={(e) => setSelectedBroker(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
              >
                <option value="">Todos</option>
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {searchTerm && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Buscando:</strong> {searchTerm}
              <button
                onClick={() => setSearchTerm('')}
                className="ml-2 text-blue-600 hover:text-blue-800 underline"
              >
                Limpiar
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Records Table/Cards */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px] bg-white rounded-xl shadow-lg">
          <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-gray-100">
          <p className="text-gray-500 text-lg">No se encontraron registros</p>
          <p className="text-gray-400 text-sm mt-2">
            Intenta ajustar los filtros o importar nuevos datos
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">N° Póliza</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Aseguradora</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Corredor</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Por Vencer</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Corriente</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">1-30</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">31-60</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">61-90</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase bg-red-100">+90</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-[#010139]">
                        {record.policy_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{record.client_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {record.insurers?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {record.brokers?.name || 'Sin asignar'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-blue-600">
                        {formatCurrency(record.due_soon)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-green-600">
                        {formatCurrency(record.current)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-yellow-600">
                        {formatCurrency(record.bucket_1_30)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-orange-600">
                        {formatCurrency(record.bucket_31_60)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-red-600">
                        {formatCurrency(record.bucket_61_90)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-bold text-red-900 bg-red-50">
                        {formatCurrency(record.bucket_90_plus)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-bold text-[#010139]">
                        {formatCurrency(record.total_debt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/db?search=${record.policy_number}`}
                          className="text-[#8AAA19] hover:text-[#6d8814] transition-colors"
                        >
                          <FaExternalLinkAlt />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {records.map((record) => {
              const isExpanded = expandedRows.has(record.id);
              
              return (
                <div
                  key={record.id}
                  className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden"
                >
                  <div
                    onClick={() => toggleRow(record.id)}
                    className="p-4 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">N° Póliza</p>
                        <p className="text-sm font-mono font-bold text-[#010139]">
                          {record.policy_number}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-lg font-bold text-[#010139]">
                          {formatCurrency(record.total_debt)}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-900 font-medium mb-2">{record.client_name}</p>
                    
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>{record.insurers?.name || '-'}</span>
                      <span className="flex items-center gap-1">
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                        Ver {isExpanded ? 'menos' : 'más'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Corredor:</span>
                        <span className="font-medium">{record.brokers?.name || 'Sin asignar'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Por Vencer:</span>
                        <span className="font-mono font-semibold text-blue-600">
                          {formatCurrency(record.due_soon)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Corriente:</span>
                        <span className="font-mono font-semibold text-green-600">
                          {formatCurrency(record.current)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-yellow-600">1-30 días:</span>
                        <span className="font-mono font-semibold text-yellow-600">
                          {formatCurrency(record.bucket_1_30)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-600">31-60 días:</span>
                        <span className="font-mono font-semibold text-orange-600">
                          {formatCurrency(record.bucket_31_60)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">61-90 días:</span>
                        <span className="font-mono font-semibold text-red-600">
                          {formatCurrency(record.bucket_61_90)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm bg-red-50 -mx-4 px-4 py-2">
                        <span className="text-red-900 font-bold">+90 días:</span>
                        <span className="font-mono font-bold text-red-900">
                          {formatCurrency(record.bucket_90_plus)}
                        </span>
                      </div>
                      
                      <div className="pt-2">
                        <Link
                          href={`/db?search=${record.policy_number}`}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6d8814] transition-all"
                        >
                          <FaExternalLinkAlt />
                          <span className="text-sm">Ver en Base de Datos</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total Records Count */}
          <div className="bg-gradient-to-r from-[#010139] to-[#020270] rounded-xl shadow-lg p-4 text-center">
            <p className="text-white font-semibold">
              Total de registros: <span className="text-2xl font-bold">{records.length}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
