'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FaChartLine, FaArrowUp, FaArrowDown, FaDollarSign } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { actionGetYTDCommissions } from '@/app/(app)/commissions/actions';

interface Props {
  brokerId: string;
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const COLORS = ['#010139', '#8AAA19', '#4B5563', '#EF4444', '#3B82F6', '#F59E0B'];

export default function BrokerYTDTab({ brokerId }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [ytdData, setYtdData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadYTD = async () => {
      setLoading(true);
      try {
        const result = await actionGetYTDCommissions(year, brokerId, true);
        if (result.ok) {
          setYtdData(result.data);
        }
      } catch (error) {
        console.error('Error loading YTD data:', error);
      }
      setLoading(false);
    };
    loadYTD();
  }, [year, brokerId]);

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
      {/* Year Selector and Title */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#010139]">Mi Acumulado Anual</h2>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-20 sm:w-28">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2023, 2022].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-[#010139]">Comparación Mensual (Bruto)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value / 1000}k`} />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="previous" fill="#9CA3AF" name={`${year - 1}`} />
              <Bar dataKey="current" fill="#010139" name={`${year}`} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Insurers Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg text-[#010139]">Distribución por Aseguradora</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name}: ${(Number(entry.value) / totalCurrent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Growth by Insurer */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg text-[#010139]">Crecimiento por Aseguradora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insurerData.map((insurer, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-700">{insurer.name}</p>
                    <p className="text-sm font-mono text-gray-600">{formatCurrency(insurer.value)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {insurer.growth > 0 ? (
                      <FaArrowUp className="text-green-500 text-xs" />
                    ) : (
                      <FaArrowDown className="text-red-500 text-xs" />
                    )}
                    <span className={`font-bold ${insurer.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
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
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-[#010139]">Tendencia de Crecimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value / 1000}k`} />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="previous" 
                stroke="#9CA3AF" 
                name={`${year - 1}`}
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="current" 
                stroke="#010139" 
                name={`${year}`}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
