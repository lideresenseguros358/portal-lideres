'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FaEdit, FaSave, FaCheck, FaSpinner } from 'react-icons/fa';
import Link from 'next/link';

interface ProductionMatrixProps {
  year: number;
  role: string;
  brokerId: string | null;
  brokers: { id: string; name: string | null }[];
}

interface MonthData {
  bruto: number;
}

interface BrokerProduction {
  broker_id: string;
  broker_name: string;
  assa_code: string; // Código ASSA
  months: {
    jan: MonthData;
    feb: MonthData;
    mar: MonthData;
    apr: MonthData;
    may: MonthData;
    jun: MonthData;
    jul: MonthData;
    aug: MonthData;
    sep: MonthData;
    oct: MonthData;
    nov: MonthData;
    dec: MonthData;
  };
  canceladas_ytd: number; // Total anual de canceladas
  previous_year?: {
    bruto_ytd: number;
    neto_ytd: number;
  };
}

const MONTHS = [
  { key: 'jan', label: 'Ene' },
  { key: 'feb', label: 'Feb' },
  { key: 'mar', label: 'Mar' },
  { key: 'apr', label: 'Abr' },
  { key: 'may', label: 'May' },
  { key: 'jun', label: 'Jun' },
  { key: 'jul', label: 'Jul' },
  { key: 'aug', label: 'Ago' },
  { key: 'sep', label: 'Sep' },
  { key: 'oct', label: 'Oct' },
  { key: 'nov', label: 'Nov' },
  { key: 'dec', label: 'Dic' },
];

type SortOption = 'name' | 'month' | 'ytd';

export default function ProductionMatrix({ year, role, brokerId, brokers }: ProductionMatrixProps) {
  const [production, setProduction] = useState<BrokerProduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ brokerId: string; field: string } | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortMonth, setSortMonth] = useState<string>('jan');

  const isMaster = role === 'master';

  useEffect(() => {
    loadProduction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, brokerId]);

  const loadProduction = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: year.toString() });
      if (brokerId) params.append('broker', brokerId);

      console.log('🔍 Fetching production with params:', params.toString());
      const response = await fetch(`/api/production?${params}`);
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Production API response:', result);
        console.log('📊 Brokers data:', result.data?.brokers);
        console.log('📊 Brokers count:', result.data?.brokers?.length);
        if (result.success && result.data) {
          setProduction(result.data.brokers || []);
        } else {
          console.warn('⚠️ No data in response');
          setProduction([]);
        }
      } else {
        console.error('❌ API response not OK:', response.status);
        toast.error('Error al cargar producción');
        setProduction([]);
      }
    } catch (error) {
      console.error('❌ Error loading production:', error);
      toast.error('Error al cargar producción');
      setProduction([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateYTD = (months: any, canceladasYTD: number) => {
    const brutoYTD = MONTHS.reduce((sum, m) => sum + (months[m.key]?.bruto || 0), 0);
    const netoYTD = brutoYTD - canceladasYTD;
    return { brutoYTD, netoYTD };
  };

  const calculateVariation = (current: number, previous: number): string => {
    if (previous === 0) return 'N/A';
    const variation = ((current - previous) / Math.abs(previous)) * 100;
    return `${variation > 0 ? '+' : ''}${variation.toFixed(2)}%`;
  };

  const handleMonthEdit = async (brokerId: string, month: string, value: number) => {
    const cellKey = `${brokerId}-${month}-bruto`;
    setSavingCell(cellKey);

    try {
      const response = await fetch('/api/production', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker_id: brokerId,
          year,
          month,
          field: 'bruto',
          value,
        }),
      });

      if (response.ok) {
        setProduction(prev => prev.map(b => {
          if (b.broker_id === brokerId) {
            return {
              ...b,
              months: {
                ...b.months,
                [month]: { bruto: value }
              }
            };
          }
          return b;
        }));
        toast.success('Guardado');
      } else {
        toast.error('Error al guardar');
      }
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSavingCell(null);
      setEditingCell(null);
    }
  };

  const handleCanceladasEdit = async (brokerId: string, value: number) => {
    const cellKey = `${brokerId}-canceladas`;
    setSavingCell(cellKey);

    try {
      const response = await fetch('/api/production', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker_id: brokerId,
          year,
          field: 'canceladas_ytd',
          value,
        }),
      });

      if (response.ok) {
        setProduction(prev => prev.map(b => {
          if (b.broker_id === brokerId) {
            return { ...b, canceladas_ytd: value };
          }
          return b;
        }));
        toast.success('Guardado');
      } else {
        toast.error('Error al guardar');
      }
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSavingCell(null);
      setEditingCell(null);
    }
  };

  // Ordenamiento
  const sortedProduction = [...production].sort((a, b) => {
    if (sortBy === 'name') {
      return a.broker_name.localeCompare(b.broker_name);
    } else if (sortBy === 'month') {
      const monthKey = sortMonth as keyof typeof a.months;
      return (b.months[monthKey]?.bruto || 0) - (a.months[monthKey]?.bruto || 0);
    } else if (sortBy === 'ytd') {
      const aYTD = calculateYTD(a.months, a.canceladas_ytd).netoYTD;
      const bYTD = calculateYTD(b.months, b.canceladas_ytd).netoYTD;
      return bYTD - aYTD;
    }
    return 0;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando producción...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      {/* Título */}
      <div className="mb-6">
        <div className="text-center mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-[#010139]">PRODUCCIÓN ANUAL</h2>
          <p className="text-sm text-gray-600 mt-1">Comparativo PMA - Año {year} VS Año {year - 1}</p>
        </div>

        {/* Controles de Ordenamiento */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setSortBy('name')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              sortBy === 'name' 
                ? 'bg-[#010139] text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📊 Por Nombre
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy('month')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                sortBy === 'month' 
                  ? 'bg-[#010139] text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Por Mes
            </button>
            {sortBy === 'month' && (
              <select
                value={sortMonth}
                onChange={(e) => setSortMonth(e.target.value)}
                className="px-3 py-2 border-2 border-[#8AAA19] rounded-lg focus:outline-none font-semibold"
              >
                {MONTHS.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => setSortBy('ytd')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              sortBy === 'ytd' 
                ? 'bg-[#8AAA19] text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            💰 Por Acumulado
          </button>
        </div>
      </div>

      {/* Tabla con scroll horizontal */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse">
            {/* Header */}
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                <th className="sticky left-0 z-20 bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-3 text-left text-xs font-semibold text-[#010139] border-b-2 border-gray-200 min-w-[150px]">
                  Corredor
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-[#010139] border-b-2 border-gray-200 min-w-[100px]">
                  Código ASSA
                </th>
                {MONTHS.map(month => (
                  <th key={month.key} className="px-3 py-3 text-center text-xs font-semibold text-[#010139] border-b-2 border-gray-200 min-w-[100px]">
                    {month.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-xs font-semibold text-[#010139] border-b-2 border-gray-200 min-w-[120px]">
                  Bruto Año en curso
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-red-600 border-b-2 border-gray-200 min-w-[120px]">
                  Cancel. Anual
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-[#8AAA19] border-b-2 border-gray-200 min-w-[120px]">
                  Neto Año en curso
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-[#010139] border-b-2 border-gray-200 min-w-[100px]">
                  Var %
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-gray-200">
              {sortedProduction.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-6xl text-gray-300">📊</div>
                      <p className="text-lg font-semibold text-gray-600">No hay datos de producción</p>
                      <p className="text-sm text-gray-400">
                        {isMaster 
                          ? 'Los brokers aún no tienen producción registrada para este año'
                          : 'Aún no tienes producción registrada para este año'
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedProduction.map((broker) => {
                  const { brutoYTD, netoYTD } = calculateYTD(broker.months, broker.canceladas_ytd);
                  const variation = broker.previous_year 
                    ? calculateVariation(netoYTD, broker.previous_year.neto_ytd)
                    : 'N/A';

                  return (
                    <tr key={broker.broker_id} className="hover:bg-gray-50">
                    {/* Broker Name con deeplink */}
                    <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-3 py-3 border-b border-gray-200">
                      <Link
                        href={`/brokers/${broker.broker_id}`}
                        className="font-semibold text-[#010139] hover:text-[#8AAA19] hover:underline"
                      >
                        {broker.broker_name}
                      </Link>
                    </td>

                    {/* Código ASSA */}
                    <td className="px-3 py-3 text-center text-sm border-b border-gray-200">
                      <span className="font-mono text-gray-600">{broker.assa_code || '-'}</span>
                    </td>

                    {/* Meses (solo Bruto) */}
                    {MONTHS.map(month => {
                      const monthKey = month.key as keyof typeof broker.months;
                      const monthData = broker.months[monthKey];

                      return (
                        <td key={month.key} className="px-2 py-2 text-center text-sm border-b border-gray-200">
                          {isMaster ? (
                            <input
                              type="number"
                              value={monthData.bruto === 0 ? '' : monthData.bruto}
                              onChange={(e) => handleMonthEdit(broker.broker_id, month.key, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                              className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none font-mono"
                              placeholder="0"
                            />
                          ) : (
                            <span className="font-mono">{formatCurrency(monthData.bruto)}</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Bruto YTD */}
                    <td className="px-3 py-3 text-center text-sm font-semibold border-b border-gray-200 bg-gray-50">
                      <span className="font-mono">{formatCurrency(brutoYTD)}</span>
                    </td>

                    {/* Canceladas Anual */}
                    <td className="px-3 py-3 text-center text-sm font-semibold border-b border-gray-200 bg-red-50">
                      {isMaster ? (
                        <input
                          type="number"
                          defaultValue={broker.canceladas_ytd === 0 ? '' : broker.canceladas_ytd}
                          onBlur={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            if (value !== broker.canceladas_ytd) {
                              handleCanceladasEdit(broker.broker_id, value);
                            }
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full px-2 py-1 text-center border border-red-300 rounded focus:border-red-500 focus:outline-none font-mono text-red-600"
                          placeholder="0"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="font-mono text-red-600">{formatCurrency(broker.canceladas_ytd)}</span>
                      )}
                    </td>

                    {/* Neto YTD */}
                    <td className="px-3 py-3 text-center text-sm font-bold border-b border-gray-200 bg-green-50">
                      <span className="font-mono text-[#8AAA19]">{formatCurrency(netoYTD)}</span>
                    </td>

                    {/* Variación % */}
                    <td className="px-3 py-3 text-center text-sm font-semibold border-b border-gray-200">
                      <span className={`font-mono ${variation.startsWith('+') ? 'text-green-600' : variation === 'N/A' ? 'text-gray-400' : 'text-red-600'}`}>
                        {variation}
                      </span>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      {isMaster && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Edición:</strong> Click en cualquier celda para editar. Los cambios se guardan automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}
