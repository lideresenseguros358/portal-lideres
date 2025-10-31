'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { ClientWithPolicies } from '@/types/db';

interface ClientsByMonthProps {
  clients: ClientWithPolicies[];
}

interface PolicyWithClient {
  policy: any;
  client: ClientWithPolicies;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function ClientsByMonth({ clients }: ClientsByMonthProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set([new Date().getMonth()]));
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Generar lista de años (actual + 2 años futuros)
  const availableYears = [currentYear, currentYear + 1, currentYear + 2];

  // Agrupar pólizas por mes de renovación
  const policiesByMonth = MONTHS.map((monthName, monthIndex) => {
    const policiesInMonth: PolicyWithClient[] = [];
    
    clients.forEach(client => {
      client.policies?.forEach(policy => {
        if (policy.renewal_date) {
          const renewalDate = new Date(policy.renewal_date);
          const policyMonth = renewalDate.getMonth();
          const policyYear = renewalDate.getFullYear();
          
          // Incluir pólizas del año seleccionado
          if (policyMonth === monthIndex && policyYear === selectedYear) {
            policiesInMonth.push({ policy, client });
          }
        }
      });
    });

    return {
      monthIndex,
      monthName,
      policies: policiesInMonth,
      count: policiesInMonth.length
    };
  });

  const toggleMonth = (monthIndex: number) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthIndex)) {
        next.delete(monthIndex);
      } else {
        next.add(monthIndex);
      }
      return next;
    });
  };

  const getMonthStatus = (monthIndex: number) => {
    // Solo aplicar estado si es el año actual
    if (selectedYear !== currentYear) return 'future';
    if (monthIndex < currentMonth) return 'past';
    if (monthIndex === currentMonth) return 'current';
    return 'future';
  };

  const totalPolicies = policiesByMonth.reduce((sum, m) => sum + m.count, 0);

  return (
    <div className="space-y-4">
      {/* Header con estadística y selector de año */}
      <div className="bg-gradient-to-r from-[#010139] to-[#020270] rounded-xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-1">Renovaciones por Mes</h3>
            <p className="text-white/80 text-sm">Vista agrupada por mes de renovación</p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-white/80 mb-1">Año</label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setExpandedMonths(new Set()); // Colapsar todos al cambiar año
                }}
                className="px-4 py-2 bg-white/10 border-2 border-white/30 rounded-lg text-white font-bold text-lg focus:outline-none focus:border-white/60 hover:bg-white/20 transition-all cursor-pointer"
              >
                {availableYears.map(year => (
                  <option key={year} value={year} className="bg-[#010139] text-white">
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black">{totalPolicies}</div>
              <div className="text-sm text-white/80">Pólizas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de meses */}
      <div className="space-y-3">
        {policiesByMonth.map(({ monthIndex, monthName, policies, count }) => {
          const isExpanded = expandedMonths.has(monthIndex);
          const status = getMonthStatus(monthIndex);
          
          let statusClass = '';
          let statusLabel = '';
          
          if (status === 'past') {
            statusClass = 'bg-gray-100 border-gray-300';
            statusLabel = 'Pasado';
          } else if (status === 'current') {
            statusClass = 'bg-green-50 border-green-400';
            statusLabel = 'Mes Actual';
          } else {
            statusClass = 'bg-blue-50 border-blue-300';
            statusLabel = 'Próximo';
          }

          return (
            <div key={monthIndex} className={`rounded-xl border-2 ${statusClass} overflow-hidden transition-all`}>
              <button
                onClick={() => toggleMonth(monthIndex)}
                className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white ${
                    status === 'past' ? 'bg-gray-400' :
                    status === 'current' ? 'bg-green-500' :
                    'bg-blue-500'
                  }`}>
                    {monthIndex + 1}
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-900 text-base sm:text-lg">{monthName}</h4>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {count} {count === 1 ? 'póliza' : 'pólizas'}
                      {status === 'current' && ' • ' + statusLabel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {count > 0 && (
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      status === 'past' ? 'bg-gray-200 text-gray-700' :
                      status === 'current' ? 'bg-green-200 text-green-800' :
                      'bg-blue-200 text-blue-800'
                    }`}>
                      {count}
                    </span>
                  )}
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              {isExpanded && count > 0 && (
                <div className="border-t bg-white p-4">
                  <div className="space-y-2">
                    {policies.map(({ policy, client }, idx) => (
                      <Link
                        key={`${client.id}-${policy.id}`}
                        href={`/db?tab=clients&modal=edit-client&editClient=${client.id}`}
                        className="block p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-[#8AAA19] hover:bg-gray-50 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{client.name}</p>
                            <p className="text-sm text-gray-600 truncate">
                              📋 {policy.policy_number || 'Sin número'}
                            </p>
                          </div>
                          <div className="flex flex-col sm:items-end gap-1">
                            <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {policy.insurers?.name || 'Sin aseguradora'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {policy.ramo || 'Sin ramo'}
                            </span>
                            <span className="text-xs font-semibold text-blue-600">
                              <Calendar size={12} className="inline mr-1" />
                              {new Date(policy.renewal_date).toLocaleDateString('es-PA')}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && count === 0 && (
                <div className="border-t bg-white p-6 text-center text-gray-500">
                  <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay pólizas para renovar en {monthName}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
