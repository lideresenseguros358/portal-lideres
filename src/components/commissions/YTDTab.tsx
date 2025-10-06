'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FaChartLine, FaArrowUp, FaArrowDown, FaDollarSign } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { actionGetYTDCommissions } from '@/app/(app)/commissions/actions';

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

  // Mock data for demonstration
  const monthlyData = [
    { month: 'Ene', current: 5000, previous: 4500 },
    { month: 'Feb', current: 5500, previous: 4800 },
    { month: 'Mar', current: 6000, previous: 5200 },
    { month: 'Abr', current: 5800, previous: 5500 },
    { month: 'May', current: 6500, previous: 5800 },
    { month: 'Jun', current: 7000, previous: 6200 },
    { month: 'Jul', current: 6800, previous: 6500 },
    { month: 'Ago', current: 7200, previous: 6800 },
    { month: 'Sep', current: 7500, previous: 7000 },
    { month: 'Oct', current: 3800, previous: 3500 },
  ];

  const insurerData = [
    { name: 'ASSA', value: 35000, growth: 15 },
    { name: 'ANCON', value: 28000, growth: 8 },
    { name: 'IS Internacional', value: 22000, growth: 12 },
    { name: 'Aseguradora General', value: 18000, growth: -5 },
    { name: 'MAPFRE', value: 15000, growth: 10 },
  ];

  const totalCurrent = monthlyData.reduce((sum, m) => sum + m.current, 0);
  const totalPrevious = monthlyData.reduce((sum, m) => sum + m.previous, 0);
  const growthPercentage = ((totalCurrent - totalPrevious) / totalPrevious * 100).toFixed(1);

  // Prepare data for pie chart
  const pieData = insurerData.map(insurer => ({
    name: insurer.name,
    value: insurer.value
  }));

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="shadow-lg border-2 border-gray-100">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaChartLine className="text-[#010139] text-xl" />
                <h2 className="text-xl sm:text-2xl font-bold text-[#010139]">ACUMULADO ANUAL</h2>
              </div>
              <p className="text-sm text-gray-600">Análisis de comisiones por aseguradora y tendencias mensuales</p>
            </div>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-full sm:w-28 border-[#010139]/20 bg-white">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2023, 2022].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-lg border-l-4 border-l-[#010139]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total Anual (Bruto)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#010139] font-mono">
              {formatCurrency(totalCurrent)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Año {year}</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg border-l-4 border-l-[#8AAA19]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Crecimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {Number(growthPercentage) > 0 ? (
                <FaArrowUp className="text-green-500" />
              ) : (
                <FaArrowDown className="text-red-500" />
              )}
              <p className={`text-2xl font-bold ${Number(growthPercentage) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(Number(growthPercentage))}%
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-1">vs Año {year - 1}</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Promedio Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600 font-mono">
              {formatCurrency(totalCurrent / monthlyData.length)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Basado en {monthlyData.length} meses</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Mejor Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600 font-mono">
              {formatCurrency(Math.max(...monthlyData.map(m => m.current)))}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {monthlyData.find(m => m.current === Math.max(...monthlyData.map(m => m.current)))?.month} {year}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison Chart */}
      <Card className="shadow-lg border-2 border-gray-100">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
          <CardTitle className="text-lg font-bold text-[#010139]">Comparación Mensual (Bruto)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
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

      {/* Insurers Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="shadow-lg border-2 border-gray-100">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
            <CardTitle className="text-lg font-bold text-[#010139]">Distribución por Aseguradora</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="overflow-hidden">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => {
                      const percentage = (Number(entry.value) / totalCurrent * 100).toFixed(1);
                      const name = entry.name.length > 12 ? entry.name.substring(0, 12) + '...' : entry.name;
                      return `${name}: ${percentage}%`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Growth by Insurer */}
        <Card className="shadow-lg border-2 border-gray-100">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
            <CardTitle className="text-lg font-bold text-[#010139]">Crecimiento por Aseguradora</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3">
              {insurerData.map((insurer, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 truncate">{insurer.name}</p>
                    <p className="text-sm font-mono text-gray-600">{formatCurrency(insurer.value)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {insurer.growth > 0 ? (
                      <FaArrowUp className="text-[#8AAA19] text-xs" />
                    ) : (
                      <FaArrowDown className="text-red-500 text-xs" />
                    )}
                    <span className={`font-bold ${insurer.growth > 0 ? 'text-[#8AAA19]' : 'text-red-600'}`}>
                      {Math.abs(insurer.growth)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Trend Chart */}
      <Card className="shadow-lg border-2 border-gray-100">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
          <CardTitle className="text-lg font-bold text-[#010139]">Tendencia de Crecimiento</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
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
