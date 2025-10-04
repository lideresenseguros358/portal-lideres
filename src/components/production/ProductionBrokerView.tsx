'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FaBullseye, FaArrowUp, FaTrophy, FaChartLine, FaCalendarAlt } from 'react-icons/fa';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface MonthData {
  bruto: number;
  num_polizas: number;
}

interface BrokerData {
  broker_id: string;
  broker_name: string;
  meta_personal: number;
  months: {
    jan: MonthData; feb: MonthData; mar: MonthData; apr: MonthData;
    may: MonthData; jun: MonthData; jul: MonthData; aug: MonthData;
    sep: MonthData; oct: MonthData; nov: MonthData; dec: MonthData;
  };
  canceladas_ytd: number;
  previous_year?: {
    bruto_ytd: number;
    neto_ytd: number;
    num_polizas_ytd: number;
  };
}

interface ProductionBrokerViewProps {
  year: number;
  brokerId: string;
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export default function ProductionBrokerView({ year, brokerId }: ProductionBrokerViewProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BrokerData | null>(null);
  const [previousYearData, setPreviousYearData] = useState<BrokerData | null>(null);

  useEffect(() => {
    loadData();
  }, [year, brokerId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar año actual
      const currentParams = new URLSearchParams({ 
        year: year.toString(),
        broker: brokerId 
      });
      const currentResponse = await fetch(`/api/production?${currentParams}`);
      
      // Cargar año anterior
      const previousParams = new URLSearchParams({ 
        year: (year - 1).toString(),
        broker: brokerId 
      });
      const previousResponse = await fetch(`/api/production?${previousParams}`);

      if (currentResponse.ok) {
        const result = await currentResponse.json();
        if (result.success && result.data?.brokers?.[0]) {
          setData(result.data.brokers[0]);
        }
      }

      if (previousResponse.ok) {
        const result = await previousResponse.json();
        if (result.success && result.data?.brokers?.[0]) {
          setPreviousYearData(result.data.brokers[0]);
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

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-lg text-gray-600">No hay datos disponibles para este año</p>
      </div>
    );
  }

  // Calcular métricas
  const monthlyData = MONTH_KEYS.map((key, index) => {
    const currentMonth = data.months[key as keyof typeof data.months];
    const previousMonth = previousYearData?.months[key as keyof typeof previousYearData.months];

    return {
      name: MONTH_NAMES[index],
      actual: currentMonth.bruto,
      anterior: previousMonth?.bruto || 0,
      polizas: currentMonth.num_polizas,
      polizas_anterior: previousMonth?.num_polizas || 0,
    };
  });

  const brutoYTD = Object.values(data.months).reduce((sum, m) => sum + m.bruto, 0);
  const netoYTD = brutoYTD - data.canceladas_ytd;
  const numPolizasYTD = Object.values(data.months).reduce((sum, m) => sum + m.num_polizas, 0);

  const metaPersonal = data.meta_personal || 0;
  const porcentajeCumplido = metaPersonal > 0 ? (netoYTD / metaPersonal) * 100 : 0;
  const mesesRestantes = 12 - new Date().getMonth();
  const promedioNecesario = mesesRestantes > 0 ? Math.max(0, (metaPersonal - netoYTD) / mesesRestantes) : 0;

  // Mejor mes año actual
  const mejorMesActual = monthlyData.length > 0 
    ? monthlyData.reduce((max, m) => m.actual > (max?.actual || 0) ? m : max)
    : undefined;
  
  // Mejor mes año anterior
  const mejorMesAnterior = monthlyData.length > 0
    ? monthlyData.reduce((max, m) => m.anterior > (max?.anterior || 0) ? m : max)
    : undefined;

  // Tendencia (promedio móvil simple de 3 meses)
  const tendencia = monthlyData.map((m, i) => {
    if (i < 2) return { ...m, tendencia: m.actual };
    const avg = ((monthlyData[i]?.actual || 0) + (monthlyData[i-1]?.actual || 0) + (monthlyData[i-2]?.actual || 0)) / 3;
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

  const previousYTD = previousYearData ? 
    Object.values(previousYearData.months).reduce((sum, m) => sum + m.bruto, 0) - (previousYearData.canceladas_ytd || 0) : 0;
  const crecimiento = previousYTD > 0 ? ((netoYTD - previousYTD) / previousYTD) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Meta Personal */}
        <div className="bg-gradient-to-br from-[#010139] to-[#020252] rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <FaBullseye className="text-3xl text-[#8AAA19]" />
            <div>
              <p className="text-sm text-gray-300">Meta Personal {year}</p>
              <p className="text-2xl font-bold font-mono">{formatCurrency(metaPersonal)}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progreso</span>
              <span className="font-bold">{porcentajeCumplido.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all ${porcentajeCumplido >= 100 ? 'bg-green-500' : 'bg-[#8AAA19]'}`}
                style={{ width: `${Math.min(porcentajeCumplido, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Neto YTD */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#8AAA19]">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <FaChartLine className="text-2xl text-[#8AAA19]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Neto Acumulado</p>
              <p className="text-2xl font-bold text-[#8AAA19] font-mono">{formatCurrency(netoYTD)}</p>
              <p className="text-xs text-gray-500">{numPolizasYTD} pólizas vendidas</p>
            </div>
          </div>
        </div>

        {/* Crecimiento vs Año Anterior */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FaArrowUp className="text-2xl text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">vs {year - 1}</p>
              <p className={`text-2xl font-bold font-mono ${crecimiento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {crecimiento >= 0 ? '+' : ''}{crecimiento.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">{formatCurrency(previousYTD)} año anterior</p>
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

      {/* Proyección y Alerta */}
      {porcentajeCumplido < 100 && mesesRestantes > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <FaCalendarAlt className="text-3xl text-orange-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-orange-900 mb-2">
                📊 Proyección para Cumplir Meta
              </h3>
              <p className="text-orange-800 mb-3">
                Quedan <strong>{mesesRestantes} meses</strong> en el año. 
                Necesitas un promedio de <strong className="text-xl font-mono">{formatCurrency(promedioNecesario)}</strong> por mes para alcanzar tu meta personal.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-600">Falta para meta</p>
                  <p className="text-lg font-bold text-orange-600 font-mono">{formatCurrency(metaPersonal - netoYTD)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-600">Promedio actual/mes</p>
                  <p className="text-lg font-bold text-gray-700 font-mono">{formatCurrency(brutoYTD / (12 - mesesRestantes || 1))}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-gray-600">Necesitas mejorar</p>
                  <p className="text-lg font-bold text-red-600 font-mono">
                    {((promedioNecesario / (brutoYTD / (12 - mesesRestantes || 1)) - 1) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfica: Comparativa Año Actual vs Anterior */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-[#010139] mb-6">
          📈 Comparativa {year} vs {year - 1}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={monthlyData}>
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
        {/* Mejor Mes Comparativo */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-[#010139] mb-6">
            🏆 Mejores Meses
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

        {/* Número de Pólizas por Mes */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-[#010139] mb-6">
            📋 Pólizas Vendidas por Mes
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
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

      {/* Tendencia con Línea Suavizada */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-[#010139] mb-6">
          📊 Tendencia de Producción (Promedio Móvil 3 Meses)
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

      {/* Tabla Detallada Mes a Mes */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-[#010139] to-[#020252] p-6">
          <h3 className="text-xl font-bold text-white">
            📅 Detalle Mes a Mes
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
              {monthlyData.map((month, index) => {
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
                <td className="px-6 py-4 text-sm text-right font-mono text-[#010139]">{formatCurrency(brutoYTD)}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-900">{numPolizasYTD}</td>
                <td className="px-6 py-4 text-sm text-right font-mono text-gray-700">
                  {formatCurrency(previousYearData ? Object.values(previousYearData.months).reduce((sum, m) => sum + m.bruto, 0) : 0)}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-700">
                  {previousYearData ? Object.values(previousYearData.months).reduce((sum, m) => sum + m.num_polizas, 0) : 0}
                </td>
                <td className={`px-6 py-4 text-sm text-right ${crecimiento >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {crecimiento >= 0 ? '+' : ''}{crecimiento.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
