'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaChevronDown, FaChevronRight, FaInfoCircle, FaLayerGroup } from 'react-icons/fa';
import { actionGetBankGroups } from '@/app/(app)/commissions/banco-actions';
import type { GroupTemplate, GroupStatus } from '@/app/(app)/commissions/banco-actions';
import CreateGroupModal from './CreateGroupModal';
import { toast } from 'sonner';

interface GroupsPanelProps {
  insurers: { id: string; name: string }[];
  onRefresh: () => void;
}

export default function GroupsPanel({ insurers, onRefresh }: GroupsPanelProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: 'all',
    insurerId: '',
  });

  useEffect(() => {
    loadGroups();
  }, [filters]);

  const loadGroups = async () => {
    setLoading(true);
    const result = await actionGetBankGroups({
      status: filters.status !== 'all' ? filters.status : undefined,
      insurerId: filters.insurerId || undefined,
    });

    if (result.ok) {
      setGroups(result.data || []);
    } else {
      toast.error('Error al cargar grupos');
    }
    setLoading(false);
  };

  const handleCreateGroup = () => {
    setShowCreateModal(true);
  };

  const handleGroupCreated = () => {
    setShowCreateModal(false);
    loadGroups();
    onRefresh();
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getStatusBadge = (status: GroupStatus) => {
    const badges = {
      EN_PROCESO: { label: 'En proceso', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      OK_CONCILIADO: { label: 'OK Conciliado', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-800 border-green-300' },
    };
    const badge = badges[status] || badges.EN_PROCESO;
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold border ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const getTemplateBadge = (template: GroupTemplate) => {
    const labels: Record<GroupTemplate, string> = {
      NORMAL: 'Normal',
      ASSA_CODIGOS: 'Códigos ASSA',
    };
    return (
      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
        {labels[template]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Instructivo */}
      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-green-600 mt-1 flex-shrink-0" size={18} />
          <div className="text-sm text-green-900">
            <p className="font-semibold mb-1">💡 ¿Qué son los grupos bancarios?</p>
            <ul className="space-y-1 text-green-800">
              <li>• <strong>Agrupa</strong> varias transferencias del mismo reporte</li>
              <li>• <strong>Vincula</strong> grupos con imports en "Nueva Quincena"</li>
              <li>• <strong>Marca OK_CONCILIADO</strong> cuando estén listos para vincular</li>
              <li>• Al cerrar quincena, se marcan como PAGADO automáticamente</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Header con botón crear */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-[#010139]">Grupos Bancarios</h2>
          <p className="text-sm sm:text-base text-gray-600">Agrupa transferencias para vincular con reportes</p>
        </div>
        
        <button
          onClick={handleCreateGroup}
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium text-sm sm:text-base"
        >
          <FaPlus />
          Crear Grupo
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-2 border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="w-full">
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
            >
              <option value="all">TODOS</option>
              <option value="EN_PROCESO">EN PROCESO</option>
              <option value="OK_CONCILIADO">OK CONCILIADO</option>
              <option value="PAGADO">PAGADO</option>
            </select>
          </div>

          <div className="w-full">
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Aseguradora</label>
            <select
              value={filters.insurerId}
              onChange={(e) => setFilters(prev => ({ ...prev, insurerId: e.target.value }))}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors text-sm sm:text-base"
            >
              <option value="">Todas</option>
              {insurers.map(ins => (
                <option key={ins.id} value={ins.id}>{ins.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de grupos */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin w-8 h-8 border-4 border-[#8AAA19] border-t-transparent rounded-full mx-auto mb-4"></div>
            Cargando grupos...
          </div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FaLayerGroup className="text-gray-300 text-6xl mx-auto mb-4" />
            <p className="text-lg mb-2">No hay grupos bancarios</p>
            <p className="text-sm">Crea tu primer grupo para comenzar a organizar transferencias</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {groups.map(group => (
              <div key={group.id} className="transition-all">
                {/* Header del grupo */}
                <div 
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-4 sm:p-5 transition-colors"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {expandedGroups.has(group.id) ? (
                        <FaChevronDown className="text-gray-400" size={14} />
                      ) : (
                        <FaChevronRight className="text-gray-400" size={14} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm sm:text-base text-gray-900 mb-1 truncate">{group.name}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        {getTemplateBadge(group.group_template)}
                        {group.is_life_insurance !== null && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${group.is_life_insurance ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                            {group.is_life_insurance ? 'VIDA' : 'NO VIDA'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="font-bold text-base sm:text-lg text-[#8AAA19] font-mono mb-1">
                      ${group.total_amount?.toFixed(2) || '0.00'}
                    </div>
                    <div>{getStatusBadge(group.status)}</div>
                  </div>
                </div>

                {/* Detalles expandidos */}
                {expandedGroups.has(group.id) && (
                  <div className="px-4 sm:px-5 pb-4 bg-gray-50 border-t">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-500 mb-1 uppercase">Aseguradora</div>
                        <div className="text-sm font-semibold text-gray-900">{group.insurers?.name || 'Sin asignar'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="text-xs text-gray-500 mb-1 uppercase">Transferencias</div>
                        <div className="text-sm font-semibold text-gray-900">{group.transfers?.length || 0} incluidas</div>
                      </div>
                      {group.fortnight_paid_id && (
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200 sm:col-span-2">
                          <div className="text-xs text-green-700 mb-1 uppercase">Quincena Pagada</div>
                          <div className="text-sm font-semibold text-green-900">
                            {group.fortnights ? (
                              <>
                                {new Date(group.fortnights.period_start).toLocaleDateString('es-PA')} -{' '}
                                {new Date(group.fortnights.period_end).toLocaleDateString('es-PA')}
                              </>
                            ) : (
                              'ID: ' + group.fortnight_paid_id
                            )}
                          </div>
                          {group.paid_at && (
                            <div className="text-xs text-green-600 mt-1">
                              Marcado el: {new Date(group.paid_at).toLocaleDateString('es-PA')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Lista de transferencias del grupo */}
                    {group.transfers && group.transfers.length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs font-semibold text-gray-700 mb-3 uppercase">Transferencias en este grupo</div>
                        <div className="grid grid-cols-1 gap-2">
                          {group.transfers.map((gt: any) => (
                            <div key={gt.transfer_id} className="bg-white p-3 rounded-lg border border-gray-200 hover:border-[#8AAA19] transition-colors">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0 pr-3">
                                  <div className="font-mono text-xs text-gray-600 mb-1">{gt.bank_transfers_comm?.reference_number}</div>
                                  <div className="text-xs text-gray-800 truncate">
                                    {gt.bank_transfers_comm?.description_raw}
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-1">
                                    {new Date(gt.bank_transfers_comm?.date).toLocaleDateString('es-PA')}
                                  </div>
                                </div>
                                <div className="font-bold text-sm text-[#8AAA19] font-mono flex-shrink-0">
                                  ${gt.bank_transfers_comm?.amount?.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de crear grupo */}
      {showCreateModal && (
        <CreateGroupModal
          insurers={insurers}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleGroupCreated}
        />
      )}
    </div>
  );
}
