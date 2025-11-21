'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FaChartLine, FaArrowUp, FaArrowDown, FaDollarSign } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { actionGetYTDCommissions, actionGetAvailableYears } from '@/app/(app)/commissions/actions';

interface Props {
  role: string;
  brokerId: string | null;
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const COLORS = ['#010139', '#8AAA19', '#4B5563', '#EF4444', '#3B82F6', '#F59E0B'];

export function YTDTab({ role, brokerId }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [ytdData, setYtdData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

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
        const result = await actionGetYTDCommissions(year, role === 'broker' ? brokerId : undefined, true);
        if (result.ok) {
          setYtdData(result.data);
        }
      } catch (error) {
        console.error('Error loading YTD data:', error);
      }
      setLoading(false);
    };
    loadYTD();
  }, [year, role, brokerId]);

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

  // Preparar datos por aseguradora reales
  const insurerData = ytdData?.currentYear?.byInsurer ? 
    Object.entries(ytdData.currentYear.byInsurer)
      .map(([name, value]: [string, any]) => {
        const currentValue = Number(value) || 0;
        const previousValue = Number(ytdData?.previousYear?.byInsurer?.[name]) || 0;
        const growth = previousValue > 0 ? ((currentValue - previousValue) / previousValue * 100) : 0;
        return {
          name,
          value: currentValue,
          growth: Number(growth.toFixed(1))
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    : [];

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
        </CardHeader>
      </Card>

      {/* Summary Cards - Mejorados */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-xl border-l-4 border-l-[#010139] hover:shadow-2xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FaDollarSign className="text-[#010139]" />
              Total Anual (Bruto)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#010139] font-mono">
              {formatCurrency(totalCurrent)}
            </p>
            <p className="text-xs text-gray-600 mt-2 font-semibold">Año {year}</p>
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
            <p className="text-3xl font-bold text-blue-600 font-mono">
              {formatCurrency(totalCurrent / monthlyData.length)}
            </p>
            <p className="text-xs text-gray-600 mt-2 font-semibold">Basado en {monthlyData.length} meses</p>
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
            <p className="text-3xl font-bold text-purple-600 font-mono">
              {formatCurrency(Math.max(...monthlyData.map(m => m.current)))}
            </p>
            <p className="text-xs text-gray-600 mt-2 font-semibold">
              {monthlyData.find(m => m.current === Math.max(...monthlyData.map(m => m.current)))?.month} {year}
            </p>
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
        <Card className="shadow-xl border-2 border-[#010139]/30 overflow-hidden bg-white">
          <CardHeader className="bg-gradient-to-r from-[#010139] via-[#020270] to-[#010139] border-b-2 border-[#8AAA19]">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <FaArrowUp className="text-[#8AAA19]" />
              Crecimiento por Aseguradora
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
    </div>
  );
}
