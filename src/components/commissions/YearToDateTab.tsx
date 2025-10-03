"use client";

import { useState, useEffect } from 'react';
import { FaChartBar, FaCalendarAlt } from 'react-icons/fa';

interface Props {
  role: string;
  brokerId: string | null;
}

interface YearlyTotal {
  broker_id: string;
  broker_name: string;
  gross_total: number;
  discounts_total: number;
  net_total: number;
  months: {
    month: string;
    gross: number;
    discounts: number;
    net: number;
  }[];
}

export default function YearToDateTab({ role, brokerId }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [yearlyTotals, setYearlyTotals] = useState<YearlyTotal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadYearlyData();
  }, [selectedYear, brokerId]);

  const loadYearlyData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        ...(role === 'BROKER' && brokerId ? { broker_id: brokerId } : {})
      });
      
      const response = await fetch(`/api/commissions/year-to-date?${params}`);
      const data = await response.json();
      setYearlyTotals(data);
    } catch (error) {
      console.error('Error loading yearly data:', error);
    } finally {
      setLoading(false);
    }
  };

  const grandTotals = yearlyTotals.reduce(
    (acc, broker) => ({
      gross: acc.gross + broker.gross_total,
      discounts: acc.discounts + broker.discounts_total,
      net: acc.net + broker.net_total,
    }),
    { gross: 0, discounts: 0, net: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FaCalendarAlt className="text-gray-500" />
            Acumulado Anual
          </h3>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border rounded-lg"
          >
            {[2023, 2024, 2025].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bruto</p>
              <p className="text-2xl font-bold text-gray-800">
                ${grandTotals.gross.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FaChartBar className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Descuentos</p>
              <p className="text-2xl font-bold text-red-600">
                ${grandTotals.discounts.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FaChartBar className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Neto</p>
              <p className="text-2xl font-bold text-green-600">
                ${grandTotals.net.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <FaChartBar className="text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">
            {role === 'BROKER' ? 'Mi Resumen' : 'Resumen por Broker'}
          </h3>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando datos...</div>
          ) : yearlyTotals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No hay datos para el año {selectedYear}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {role === 'MASTER' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Broker
                    </th>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ene
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Feb
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mar
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abr
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    May
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jun
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jul
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ago
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sep
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Oct
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nov
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dic
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {yearlyTotals.map((broker) => (
                  <tr key={broker.broker_id} className="hover:bg-gray-50">
                    {role === 'MASTER' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {broker.broker_name}
                      </td>
                    )}
                    {/* Monthly columns */}
                    {Array.from({ length: 12 }, (_, i) => {
                      const monthData = broker.months.find(m => {
                        const monthParts = m.month.split('-');
                        if (monthParts.length < 2 || !monthParts[1]) return false;
                        const monthNum = parseInt(monthParts[1]);
                        return monthNum === i + 1;
                      });
                      
                      return (
                        <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {monthData ? `$${monthData.net.toLocaleString()}` : '-'}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-gray-50">
                      ${broker.net_total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              
              {/* Grand Total Row */}
              {role === 'MASTER' && yearlyTotals.length > 1 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-6 py-3 text-sm">TOTAL GENERAL</td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const monthTotal = yearlyTotals.reduce((sum, broker) => {
                        const monthData = broker.months.find(m => {
                          const monthParts = m.month.split('-');
                          if (monthParts.length < 2 || !monthParts[1]) return false;
                          const monthNum = parseInt(monthParts[1]);
                          return monthNum === i + 1;
                        });
                        return sum + (monthData?.net || 0);
                      }, 0);
                      
                      return (
                        <td key={i} className="px-6 py-3 text-sm text-right">
                          {monthTotal > 0 ? `$${monthTotal.toLocaleString()}` : '-'}
                        </td>
                      );
                    })}
                    <td className="px-6 py-3 text-sm text-right bg-gray-200">
                      ${grandTotals.net.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {/* Simple Chart (optional - placeholder) */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Tendencia Mensual</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          {/* TODO: Implement chart with Chart.js or similar */}
          <p>Gráfico disponible próximamente</p>
        </div>
      </div>
    </div>
  );
}
