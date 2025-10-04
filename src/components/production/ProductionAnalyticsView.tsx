'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FaBullseye, FaArrowUp, FaTrophy, FaChartLine, FaUsers } from 'react-icons/fa';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import ProductionBrokerView from './ProductionBrokerView';
import { uppercaseInputClass } from '@/lib/utils/uppercase';

interface ProductionAnalyticsViewProps {
  year: number;
  brokers: { id: string; name: string | null }[];
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export default function ProductionAnalyticsView({ year, brokers }: ProductionAnalyticsViewProps) {
  const [selectedBroker, setSelectedBroker] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [allBrokersData, setAllBrokersData] = useState<any[]>([]);
  const [previousYearData, setPreviousYearData] = useState<any[]>([]);

  useEffect(() => {
    loadAllData();
  }, [year]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Cargar datos del año actual (todos los brokers)
      const currentParams = new URLSearchParams({ year: year.toString() });
      const currentResponse = await fetch(`/api/production?${currentParams}`);

      // Cargar datos del año anterior
      const previousParams = new URLSearchParams({ year: (year - 1).toString() });
      const previousResponse = await fetch(`/api/production?${previousParams}`);

      if (currentResponse.ok) {
        const result = await currentResponse.json();
        if (result.success && result.data?.brokers) {
          setAllBrokersData(result.data.brokers);
        }
      }

      if (previousResponse.ok) {
        const result = await previousResponse.json();
        if (result.success && result.data?.brokers) {
          setPreviousYearData(result.data.brokers);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Si se selecciona un broker específico, usar el componente ProductionBrokerView
  if (selectedBroker !== 'all') {
    return (
      <div className="space-y-6">
        {/* Header con selector */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[#010139]">
              Analíticas de Producción
            </h2>
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              className={`px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-semibold ${uppercaseInputClass}`}
            >
              <option value="all">📊 TODOS LOS BROKERS (AGREGADO)</option>
              {brokers.map(broker => (
                <option key={broker.id} value={broker.id}>
                  👤 {broker.name?.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Vista individual del broker */}
        <ProductionBrokerView year={year} brokerId={selectedBroker} />
      </div>
    );
  }

  // VISTA AGREGADA DE TODOS LOS BROKERS
  // Calcular métricas agregadas
  const aggregateMonthlyData = MONTH_KEYS.map((key, index) => {
    let actualTotal = 0;
    let anteriorTotal = 0;
    let polizasTotal = 0;
    let polizasAnteriorTotal = 0;

    allBrokersData.forEach(broker => {
      const month = broker.months[key];
      if (month) {
        actualTotal += month.bruto || 0;
        polizasTotal += month.num_polizas || 0;
      }
    });

    previousYearData.forEach(broker => {
      const month = broker.months[key];
      if (month) {
        anteriorTotal += month.bruto || 0;
        polizasAnteriorTotal += month.num_polizas || 0;
      }
    });

    return {
      name: MONTH_NAMES[index],
      actual: actualTotal,
      anterior: anteriorTotal,
      polizas: polizasTotal,
      polizas_anterior: polizasAnteriorTotal,
    };
  });

  const totalBrutoYTD = allBrokersData.reduce((sum, b) => {
    return sum + Object.values(b.months).reduce((mSum: number, m: any) => mSum + (m.bruto || 0), 0);
  }, 0);

  const totalCanceladasYTD = allBrokersData.reduce((sum, b) => sum + (b.canceladas_ytd || 0), 0);
  const totalNetoYTD = totalBrutoYTD - totalCanceladasYTD;

  const totalNumPolizasYTD = allBrokersData.reduce((sum, b) => {
    return sum + Object.values(b.months).reduce((mSum: number, m: any) => mSum + (m.num_polizas || 0), 0);
  }, 0);

  // Meta global = suma de todas las metas personales
  const metaGlobal = allBrokersData.reduce((sum, b) => sum + (b.meta_personal || 0), 0);
  const porcentajeCumplidoGlobal = metaGlobal > 0 ? (totalNetoYTD / metaGlobal) * 100 : 0;

  // Año anterior
  const totalPreviousYTD = previousYearData.reduce((sum, b) => {
    return sum + Object.values(b.months).reduce((mSum: number, m: any) => mSum + (m.bruto || 0), 0) - (b.canceladas_ytd || 0);
  }, 0);

  const crecimientoGlobal = totalPreviousYTD > 0 ? ((totalNetoYTD - totalPreviousYTD) / totalPreviousYTD) * 100 : 0;

  // Mejor mes agregado
  const mejorMesActual = aggregateMonthlyData.length > 0
    ? aggregateMonthlyData.reduce((max, m) => m.actual > (max?.actual || 0) ? m : max)
    : undefined;

  const mejorMesAnterior = aggregateMonthlyData.length > 0
    ? aggregateMonthlyData.reduce((max, m) => m.anterior > (max?.anterior || 0) ? m : max)
    : undefined;

  // Tendencia
  const tendencia = aggregateMonthlyData.map((m, i) => {
    if (i < 2) return { ...m, tendencia: m.actual };
    const avg = ((aggregateMonthlyData[i]?.actual || 0) + (aggregateMonthlyData[i-1]?.actual || 0) + (aggregateMonthlyData[i-2]?.actual || 0)) / 3;
    return { ...m, tendencia: avg };
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const mesesRestantes = 12 - new Date().getMonth();
  const promedioNecesarioGlobal = mesesRestantes > 0 ? Math.max(0, (metaGlobal - totalNetoYTD) / mesesRestantes) : 0;

  return (
    <div className="space-y-6">
      {/* Header con selector */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#010139] flex items-center gap-2">
              <FaUsers className="text-[#8AAA19]" />
              Vista Agregada - Todos los Brokers
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {allBrokersData.length} brokers activos
            </p>
          </div>
          <select
            value={selectedBroker}
            onChange={(e) => setSelectedBroker(e.target.value)}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-semibold"
          >
            <option value="all">📊 Todos los Brokers (Agregado)</option>
            {brokers.map(broker => (
              <option key={broker.id} value={broker.id}>
                👤 {broker.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Agregados */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Meta Global */}
        <div className="bg-gradient-to-br from-[#010139] to-[#020252] rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <FaBullseye className="text-3xl text-[#8AAA19]" />
            <div>
              <p className="text-sm text-gray-300">Meta Global {year}</p>
              <p className="text-2xl font-bold font-mono">{formatCurrency(metaGlobal)}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progreso</span>
              <span className="font-bold">{porcentajeCumplidoGlobal.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all ${porcentajeCumplidoGlobal >= 100 ? 'bg-green-500' : 'bg-[#8AAA19]'}`}
                style={{ width: `${Math.min(porcentajeCumplidoGlobal, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Neto Total */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#8AAA19]">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <FaChartLine className="text-2xl text-[#8AAA19]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Neto Total</p>
              <p className="text-2xl font-bold text-[#8AAA19] font-mono">{formatCurrency(totalNetoYTD)}</p>
              <p className="text-xs text-gray-500">{totalNumPolizasYTD} pólizas</p>
            </div>
          </div>
        </div>

        {/* Crecimiento */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FaArrowUp className="text-2xl text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">vs {year - 1}</p>
              <p className={`text-2xl font-bold font-mono ${crecimientoGlobal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {crecimientoGlobal >= 0 ? '+' : ''}{crecimientoGlobal.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">{formatCurrency(totalPreviousYTD)} anterior</p>
            </div>
          </div>
        </div>

        {/* Mejor Mes */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <FaTrophy className="text-2xl text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Mejor Mes {year}</p>
              <p className="text-xl font-bold text-yellow-600">{mejorMesActual?.name || '-'}</p>
              <p className="text-sm font-mono text-gray-700">{formatCurrency(mejorMesActual?.actual || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Proyección Global */}
      {porcentajeCumplidoGlobal < 100 && mesesRestantes > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <FaUsers className="text-3xl text-orange-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-orange-900 mb-2">
                📊 Proyección Global para Cumplir Meta
              </h3>
              <p className="text-orange-800 mb-3">
                La oficina necesita un promedio de <strong className="text-xl font-mono">{formatCurrency(promedioNecesarioGlobal)}</strong> por mes 
                en los próximos <strong>{mesesRestantes} meses</strong> para alcanzar la meta global.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-600">Falta para meta global</p>
                  <p className="text-lg font-bold text-orange-600 font-mono">{formatCurrency(metaGlobal - totalNetoYTD)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-600">Promedio actual/mes</p>
                  <p className="text-lg font-bold text-gray-700 font-mono">{formatCurrency(totalBrutoYTD / (12 - mesesRestantes || 1))}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-600">Brokers activos</p>
                  <p className="text-lg font-bold text-[#010139] font-mono">{allBrokersData.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfica Comparativa */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-[#010139] mb-6">
          📈 Producción Agregada {year} vs {year - 1}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={aggregateMonthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Area type="monotone" dataKey="actual" stroke="#010139" fill="#010139" fillOpacity={0.3} name={`${year}`} />
            <Area type="monotone" dataKey="anterior" stroke="#8AAA19" fill="#8AAA19" fillOpacity={0.2} name={`${year - 1}`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gráficas lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mejores Meses */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-[#010139] mb-6">
            🏆 Mejores Meses Agregados
          </h3>
          <div className="space-y-4">
            <div className="border-l-4 border-[#010139] pl-4 py-2 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">Mejor Mes {year}</p>
              <p className="text-2xl font-bold text-[#010139]">{mejorMesActual?.name || '-'}</p>
              <p className="text-lg font-mono text-gray-700">{formatCurrency(mejorMesActual?.actual || 0)}</p>
              <p className="text-sm text-gray-500">{mejorMesActual?.polizas || 0} pólizas</p>
            </div>
            <div className="border-l-4 border-[#8AAA19] pl-4 py-2 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">Mejor Mes {year - 1}</p>
              <p className="text-2xl font-bold text-[#8AAA19]">{mejorMesAnterior?.name || '-'}</p>
              <p className="text-lg font-mono text-gray-700">{formatCurrency(mejorMesAnterior?.anterior || 0)}</p>
              <p className="text-sm text-gray-500">{mejorMesAnterior?.polizas_anterior || 0} pólizas</p>
            </div>
          </div>
        </div>

        {/* Pólizas por Mes */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-[#010139] mb-6">
            📋 Total Pólizas por Mes
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={aggregateMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="polizas" fill="#010139" name={`${year}`} />
              <Bar dataKey="polizas_anterior" fill="#8AAA19" name={`${year - 1}`} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tendencia */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-[#010139] mb-6">
          📊 Tendencia Agregada (Promedio Móvil 3 Meses)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={tendencia}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="actual" stroke="#010139" strokeWidth={2} dot={{ r: 4 }} name="Real" />
            <Line type="monotone" dataKey="tendencia" stroke="#8AAA19" strokeWidth={2} strokeDasharray="5 5" name="Tendencia" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla Detallada */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#010139] to-[#020252] p-6">
          <h3 className="text-xl font-bold text-white">
            📅 Detalle Mensual Agregado
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mes</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">{year}</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Pól {year}</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">{year - 1}</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Pól {year - 1}</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Variación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {aggregateMonthlyData.map((month, index) => {
                const variacion = month.anterior > 0 ? ((month.actual - month.anterior) / month.anterior) * 100 : 0;
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{month.name}</td>
                    <td className="px-6 py-4 text-sm text-right font-mono font-semibold text-[#010139]">
                      {formatCurrency(month.actual)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{month.polizas}</td>
                    <td className="px-6 py-4 text-sm text-right font-mono text-gray-600">
                      {formatCurrency(month.anterior)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-600">{month.polizas_anterior}</td>
                    <td className={`px-6 py-4 text-sm text-right font-bold ${variacion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {variacion >= 0 ? '+' : ''}{variacion.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr className="font-bold">
                <td className="px-6 py-4 text-sm text-gray-900">TOTAL</td>
                <td className="px-6 py-4 text-sm text-right font-mono text-[#010139]">{formatCurrency(totalBrutoYTD)}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-900">{totalNumPolizasYTD}</td>
                <td className="px-6 py-4 text-sm text-right font-mono text-gray-700">
                  {formatCurrency(previousYearData.reduce((sum, b) => {
                    return sum + Object.values(b.months).reduce((mSum: number, m: any) => mSum + (m.bruto || 0), 0);
                  }, 0))}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-700">
                  {previousYearData.reduce((sum, b) => {
                    return sum + Object.values(b.months).reduce((mSum: number, m: any) => mSum + (m.num_polizas || 0), 0);
                  }, 0)}
                </td>
                <td className={`px-6 py-4 text-sm text-right ${crecimientoGlobal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {crecimientoGlobal >= 0 ? '+' : ''}{crecimientoGlobal.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
