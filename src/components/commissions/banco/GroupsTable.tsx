'use client';

import { useState } from 'react';
import { FaChevronDown, FaChevronRight, FaLayerGroup, FaCheckCircle, FaClock, FaLock } from 'react-icons/fa';
import type { BankTransferStatus } from '@/app/(app)/commissions/banco-actions';

interface GroupsTableProps {
  groups: any[];
  loading: boolean;
}

export default function GroupsTable({ groups, loading }: GroupsTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getStatusBadge = (status: BankTransferStatus | string) => {
    const badges = {
      SIN_CLASIFICAR: { label: 'Sin clasificar', color: 'bg-gray-100 text-gray-800', icon: FaClock },
      PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: FaClock },
      OK_CONCILIADO: { label: 'OK', color: 'bg-blue-100 text-blue-800', icon: FaCheckCircle },
      PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-800', icon: FaLock },
      EN_PROCESO: { label: 'En Proceso', color: 'bg-yellow-100 text-yellow-800', icon: FaClock },
    };
    const badge = badges[status as keyof typeof badges] || badges.PENDIENTE;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        <Icon size={10} />
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
        <p className="text-center text-gray-500">Cargando grupos...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return null; // No mostrar si no hay grupos
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 mb-6">
      <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
        <div className="flex items-center gap-3">
          <FaLayerGroup className="text-purple-600" size={24} />
          <div>
            <h3 className="font-bold text-purple-900 text-lg">
              Grupos de Transferencias ({groups.length})
            </h3>
            <p className="text-sm text-purple-700">
              Click para expandir y ver transferencias agrupadas
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          const transfers = group.bank_group_transfers?.map((gt: any) => gt.bank_transfers_comm) || [];
          const totalAmount = transfers.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

          return (
            <div key={group.id} className="hover:bg-gray-50">
              {/* Header del grupo - clickeable */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Icono expandir */}
                  <div className="text-purple-600">
                    {isExpanded ? <FaChevronDown size={16} /> : <FaChevronRight size={16} />}
                  </div>

                  {/* Info del grupo */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <FaLayerGroup className="text-purple-500" size={16} />
                      <span className="font-bold text-gray-900">{group.name}</span>
                      {getStatusBadge(group.status)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {group.insurers?.name && (
                        <span className="mr-4">🏢 {group.insurers.name}</span>
                      )}
                      <span className="text-gray-500">{transfers.length} transferencia(s)</span>
                    </div>
                  </div>

                  {/* Monto total */}
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Total Grupo</p>
                    <p className="text-xl font-bold text-purple-900">
                      ${totalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </button>

              {/* Transferencias del grupo - expandible */}
              {isExpanded && (
                <div className="px-6 pb-4 bg-purple-50/30">
                  <div className="bg-white rounded-lg border border-purple-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-purple-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-purple-900 uppercase">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-purple-900 uppercase">Referencia</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-purple-900 uppercase">Descripción</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-purple-900 uppercase">Estado</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-purple-900 uppercase">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfers.map((transfer: any) => (
                          <tr key={transfer.id} className="border-t border-purple-100 hover:bg-purple-50">
                            <td className="px-4 py-2 text-gray-700">
                              {new Date(transfer.date).toLocaleDateString('es-PA')}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-600">
                              {transfer.reference_number}
                            </td>
                            <td className="px-4 py-2 text-gray-900">
                              {transfer.description_raw?.substring(0, 50) || 'Sin descripción'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {getStatusBadge(transfer.status)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">
                              ${transfer.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-purple-50 border-t-2 border-purple-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-right font-semibold text-purple-900">
                            Total:
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-purple-900 text-lg">
                            ${totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
