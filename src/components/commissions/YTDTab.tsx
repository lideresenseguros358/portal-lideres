'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FaChartLine, FaArrowUp, FaArrowDown, FaDollarSign, FaTrophy } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { actionGetYTDCommissions, actionGetAvailableYears, actionGetTop5BrokersByInsurer } from '@/app/(app)/commissions/actions';
import { InsurersDetailModal } from './InsurersDetailModal';

interface Props {
  role: string;
  brokerId: string | null;
  brokers?: { id: string; name: string }[];
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const COLORS = ['#010139', '#8AAA19', '#4B5563', '#EF4444', '#3B82F6', '#F59E0B'];

export function YTDTab({ role, brokerId, brokers = [] }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(role === 'broker' ? brokerId : null);
  const [ytdData, setYtdData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [insurersModalOpen, setInsurersModalOpen] = useState(false);
  const [top5Data, setTop5Data] = useState<any[]>([]);

  useEffect(() => {
    const loadAvailableYears = async () => {
      const result = await actionGetAvailableYears();
      if (result.ok && result.years) {
        setAvailableYears(result.years);
      }
    };
    loadAvailableYears();
  }, []);

  useEffect(() => {
    const loadYTD = async () => {
      setLoading(true);
      try {
        const result = await actionGetYTDCommissions(year, selectedBrokerId || undefined, true);
        if (result.ok) {
          setYtdData(result.data);
        }
        
        // Cargar Top 5 solo si es master y no hay broker seleccionado
        if (role === 'master' && !selectedBrokerId) {
          const top5Result = await actionGetTop5BrokersByInsurer(year);
          if (top5Result.ok) {
            setTop5Data(top5Result.data || []);
          }
        } else {
          setTop5Data([]);
        }
      } catch (error) {
        console.error('Error loading YTD data:', error);
      }
      setLoading(false);
    };
    loadYTD();
  }, [year, selectedBrokerId, role]);

  // Preparar datos mensuales reales
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  const monthlyData = monthNames.map((month, index) => {
    const monthNum = index + 1;
    const currentMonth = ytdData?.currentYear?.byMonth?.[monthNum] || 0;
    const previousMonth = ytdData?.previousYear?.byMonth?.[monthNum] || 0;
    return {
      month,
      current: currentMonth,
      previous: previousMonth
    };
  });

  // Preparar datos por aseguradora reales - TODAS para el modal
  const allInsurersData = ytdData?.currentYear?.byInsurer ? 
    Object.entries(ytdData.currentYear.byInsurer)
      .map(([name, value]: [string, any]) => {
        const currentValue = Number(value) || 0;
        const previousValue = Number(ytdData?.previousYear?.byInsurer?.[name]) || 0;
        const growth = previousValue > 0 ? ((currentValue - previousValue) / previousValue * 100) : 0;
        return {
          name,
          current: currentValue,
          previous: previousValue,
          growth: Number(growth.toFixed(1))
        };
      })
      .sort((a, b) => b.current - a.current)
    : [];

  // Top 5 para mostrar en el card
  const insurerData = allInsurersData.slice(0, 5).map(i => ({
    name: i.name,
    value: i.current,
    growth: i.growth
  }));

  const totalCurrent = monthlyData.reduce((sum, m) => sum + m.current, 0);
  const totalPrevious = monthlyData.reduce((sum, m) => sum + m.previous, 0);
  const growthPercentage = totalPrevious > 0 
    ? ((totalCurrent - totalPrevious) / totalPrevious * 100).toFixed(1)
    : totalCurrent > 0 ? '100.0' : '0.0';

  // Prepare data for pie chart
  const pieData = insurerData.map(insurer => ({
    name: insurer.name,
    value: insurer.value
  }));

  return (
    <div className="space-y-6">
      {/* Header Card - Mejorado */}
      <Card className="shadow-xl border-t-4 border-t-[#8AAA19] overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-[#010139] via-[#020270] to-[#010139] text-white relative">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-r from-[#8AAA19]/20 to-transparent" />
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-white/20 rounded-xl shadow-lg">
                  <FaChartLine className="text-white text-2xl" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">ACUMULADO ANUAL</h2>
                  <p className="text-sm text-white/80">Análisis detallado de comisiones y tendencias</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {role === 'master' && brokers.length > 0 && (
                <Select value={selectedBrokerId || 'all'} onValueChange={(v) => setSelectedBrokerId(v === 'all' ? null : v)}>
                  <SelectTrigger className="w-full sm:w-48 border-2 border-white/30 bg-white/10 text-white hover:bg-white/20 transition-all">
                    <SelectValue placeholder="Broker" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Brokers</SelectItem>
                    {brokers.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-full sm:w-32 border-2 border-white/30 bg-white/10 text-white hover:bg-white/20 transition-all">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards - Mejorados */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-xl border-l-4 border-l-[#010139] hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FaDollarSign className="text-[#010139]" />
              Total Comisión Bruta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#010139] font-mono">
              {formatCurrency(ytdData?.currentYear?.totalBruto || totalCurrent)}
            </p>
            <p className="text-xs text-gray-600 mt-2 font-semibold">Antes de adelantos/descuentos</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-xl border-l-4 border-l-[#8AAA19] hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-green-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FaArrowUp className="text-[#8AAA19]" />
              Crecimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                Number(growthPercentage) > 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {Number(growthPercentage) > 0 ? (
                  <FaArrowUp className="text-green-600 text-xl" />
                ) : (
                  <FaArrowDown className="text-red-600 text-xl" />
                )}
              </div>
              <p className={`text-3xl font-bold ${
                Number(growthPercentage) > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.abs(Number(growthPercentage))}%
              </p>
            </div>
            <p className="text-xs text-gray-600 mt-2 font-semibold">vs Año {year - 1}</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-xl border-l-4 border-l-blue-500 hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FaChartLine className="text-blue-500" />
              Promedio Mensual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const monthsWithData = monthlyData.filter(m => m.current > 0).length;
              const average = monthsWithData > 0 ? totalCurrent / monthsWithData : 0;
              return (
                <>
                  <p className="text-3xl font-bold text-blue-600 font-mono">
                    {formatCurrency(average)}
                  </p>
                  <p className="text-xs text-gray-600 mt-2 font-semibold">
                    {monthsWithData} mes(es) con datos
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>
        
        <Card className="shadow-xl border-l-4 border-l-purple-500 hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-purple-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FaDollarSign className="text-purple-500" />
              Mejor Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const maxValue = Math.max(...monthlyData.map(m => m.current), 0);
              const bestMonth = monthlyData.find(m => m.current === maxValue);
              return (
                <>
                  <p className="text-3xl font-bold text-purple-600 font-mono">
                    {formatCurrency(maxValue)}
                  </p>
                  <p className="text-xs text-gray-600 mt-2 font-semibold">
                    {maxValue > 0 ? `${bestMonth?.month} ${year}` : 'Sin datos'}
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison Chart - Mejorado */}
      <Card className="shadow-xl border-2 border-[#010139]/20 overflow-hidden bg-white">
        <CardHeader className="bg-gradient-to-r from-[#010139] via-[#020270] to-[#010139] border-b-4 border-[#8AAA19]">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <FaChartLine className="text-[#8AAA19]" />
            Comparación Mensual (Bruto)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 bg-gradient-to-br from-white to-gray-50">
          {/* Desktop */}
          <div className="hidden md:block">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `$${value / 1000}k`} tick={{ fontSize: 12 }} width={60} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="previous" fill="#9CA3AF" name={`${year - 1}`} radius={[4, 4, 0, 0]} />
                <Bar dataKey="current" fill="#010139" name={`${year}`} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Mobile */}
          <div className="md:hidden overflow-x-auto">
            <div style={{ minWidth: '600px', width: '100%' }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `$${value / 1000}k`} tick={{ fontSize: 12 }} width={60} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="previous" fill="#9CA3AF" name={`${year - 1}`} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="current" fill="#010139" name={`${year}`} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insurers Distribution - Mejorado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="shadow-xl border-2 border-[#8AAA19]/30 overflow-hidden bg-white">
          <CardHeader className="bg-gradient-to-r from-[#8AAA19] to-[#6a8a14] border-b-2 border-[#010139]/10">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <FaChartLine className="text-white" />
              Distribución por Aseguradora
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-white to-green-50/20">
            <div className="w-full">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={{
                      stroke: '#94a3b8',
                      strokeWidth: 1.5,
                    }}
                    label={(entry: any) => {
                      const percentage = (Number(entry.value) / totalCurrent * 100).toFixed(1);
                      // Versión mobile: solo porcentaje
                      if (window.innerWidth < 640) {
                        return `${percentage}%`;
                      }
                      // Versión desktop: nombre truncado + porcentaje
                      const name = entry.name.length > 10 ? entry.name.substring(0, 10) + '...' : entry.name;
                      return `${name}\n${percentage}%`;
                    }}
                    outerRadius={window.innerWidth < 640 ? 65 : 85}
                    innerRadius={window.innerWidth < 640 ? 25 : 35}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        stroke="#fff"
                        strokeWidth={2}
                        style={{
                          filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1))',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '2px solid #8AAA19',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      padding: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.98)'
                    }}
                    itemStyle={{
                      color: '#010139',
                      fontWeight: 600
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Leyenda personalizada para mobile */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:hidden">
              {pieData.slice(0, 6).map((entry, index) => (
                <div key={`legend-${index}`} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-sm flex-shrink-0" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate font-medium text-gray-700">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Growth by Insurer */}
        <Card className="shadow-xl border-2 border-[#010139]/30 overflow-hidden bg-white cursor-pointer hover:shadow-2xl transition-all" onClick={() => setInsurersModalOpen(true)}>
          <CardHeader className="bg-gradient-to-r from-[#010139] via-[#020270] to-[#010139] border-b-2 border-[#8AAA19]">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <FaArrowUp className="text-[#8AAA19]" />
              Crecimiento por Aseguradora
              <span className="text-xs ml-auto bg-white/20 px-2 py-1 rounded">Click para ver todas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 bg-gradient-to-br from-white to-blue-50/20">
            <div className="space-y-3">
              {insurerData.map((insurer, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-white rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all shadow-sm hover:shadow-md border-l-4 ${
                  insurer.growth > 0 ? 'border-l-[#8AAA19]' : 'border-l-red-500'
                }">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 truncate">{insurer.name}</p>
                    <p className="text-base font-mono text-gray-700 font-semibold">{formatCurrency(insurer.value)}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className={`p-2 rounded-lg ${
                      insurer.growth > 0 ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {insurer.growth > 0 ? (
                        <FaArrowUp className="text-[#8AAA19] text-sm" />
                      ) : (
                        <FaArrowDown className="text-red-500 text-sm" />
                      )}
                    </div>
                    <span className={`text-xl font-bold ${
                      insurer.growth > 0 ? 'text-[#8AAA19]' : 'text-red-600'
                    }`}>
                      {Math.abs(insurer.growth)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Trend Chart - Mejorado */}
      <Card className="shadow-xl border-2 border-[#8AAA19]/30 overflow-hidden bg-white">
        <CardHeader className="bg-gradient-to-r from-[#8AAA19] to-[#6a8a14] border-b-2 border-[#010139]/10">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <FaChartLine className="text-white" />
            Tendencia de Crecimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 bg-gradient-to-br from-white to-green-50/20">
          <div className="overflow-x-auto md:overflow-visible">
            <div style={{ minWidth: '300px' }}>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `$${value / 1000}k`} tick={{ fontSize: 12 }} width={60} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="previous" 
                    stroke="#9CA3AF" 
                    name={`${year - 1}`}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="current" 
                    stroke="#010139" 
                    name={`${year}`}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 5 por Aseguradora - Solo vista completa */}
      {role === 'master' && !selectedBrokerId && top5Data.length > 0 && (
        <Card className="shadow-xl border-2 border-[#8AAA19]/30 overflow-hidden bg-white">
          <CardHeader className="bg-gradient-to-r from-[#8AAA19] to-[#6a8a14] border-b-2 border-[#010139]/10">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <FaTrophy className="text-yellow-300" />
              Top 5 Brokers por Aseguradora
              <span className="text-xs ml-auto bg-white/20 px-2 py-1 rounded">Incluye ajustes pagados</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 bg-gradient-to-br from-white to-green-50/20">
            <div className="space-y-6">
              {top5Data.map((insurer, idx) => (
                <div key={idx} className="border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all bg-white">
                  {/* Header de aseguradora */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-[#8AAA19]/20">
                    <div>
                      <h3 className="text-xl font-bold text-[#010139]">{insurer.insurerName}</h3>
                      <p className="text-sm text-gray-600">Top 5 Brokers</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 font-semibold">Total</p>
                      <p className="text-2xl font-bold text-[#8AAA19] font-mono">{formatCurrency(insurer.totalInsurer)}</p>
                    </div>
                  </div>
                  
                  {/* Lista de top brokers */}
                  <div className="space-y-2">
                    {insurer.topBrokers.map((broker: any, brokerIdx: number) => {
                      const percentage = insurer.totalInsurer > 0 
                        ? ((broker.total / insurer.totalInsurer) * 100).toFixed(1)
                        : '0.0';
                      
                      return (
                        <div 
                          key={brokerIdx}
                          className="flex items-center gap-4 p-3 rounded-lg bg-gradient-to-r from-gray-50 to-white hover:from-[#8AAA19]/5 hover:to-white transition-all border border-gray-200"
                        >
                          {/* Posición */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                            brokerIdx === 0 ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400' :
                            brokerIdx === 1 ? 'bg-gray-100 text-gray-700 border-2 border-gray-400' :
                            brokerIdx === 2 ? 'bg-orange-100 text-orange-700 border-2 border-orange-400' :
                            'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {brokerIdx + 1}
                          </div>
                          
                          {/* Nombre del broker */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 truncate">{broker.brokerName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-[#8AAA19] h-full rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 font-semibold">{percentage}%</span>
                            </div>
                          </div>
                          
                          {/* Monto */}
                          <div className="text-right">
                            <p className="text-lg font-bold text-[#010139] font-mono">{formatCurrency(broker.total)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Aseguradoras */}
      <InsurersDetailModal
        isOpen={insurersModalOpen}
        onClose={() => setInsurersModalOpen(false)}
        insurers={allInsurersData}
        year={year}
        brokerName={selectedBrokerId ? brokers.find(b => b.id === selectedBrokerId)?.name : undefined}
      />
    </div>
  );
}
