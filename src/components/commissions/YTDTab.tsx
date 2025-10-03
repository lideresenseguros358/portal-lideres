'use client';

import { useState, useEffect, useMemo } from 'react';
import { actionGetYTDCommissions } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FaChevronDown, FaChevronRight, FaDollarSign, FaChartBar, FaChartLine } from 'react-icons/fa';
import { YTDChart } from './YTDChart';

// Types
interface YTDData {
  broker_id: string;
  broker_name: string;
  insurer_name: string;
  year: number;
  created_at: string; // Keep created_at for month calculation
  total_gross: number;
}

interface GroupedByBroker {
  [brokerId: string]: {
    broker_name: string;
    total_gross: number;
    insurers: { name: string; total_gross: number }[];
  };
}

interface OfficeData {
  totalRevenue: number;
  totalBrokerCommissions: number;
  officeProfit: number;
  profitPercentage: number;
  totalVida: number;
  totalRamosGenerales: number;
  monthlyData: Array<{
    month: string;
    revenue: number;
    profit: number;
  }>;
}

interface Props {
  role: string;
  brokerId: string | null;
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function YTDTab({ role, brokerId }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<YTDData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadYTDData = async () => {
      setLoading(true);
      const result = await actionGetYTDCommissions(year, role === 'broker' ? brokerId : undefined, true);
      if (result.ok) {
        setData(result.data as YTDData[] || []);
      } else {
        toast.error('Error al cargar el acumulado anual', { description: result.error });
      }
      setLoading(false);
    };
    loadYTDData();
  }, [year, role, brokerId]);

  const { tableData, chartData, officeData } = useMemo(() => {
    const currentYearData = data.filter(d => d.year === year);
    
    const processTableData = (dataset: YTDData[]) => dataset.reduce<GroupedByBroker>((acc, item) => {
      const brokerId = item.broker_id;
      if (!acc[brokerId]) {
        acc[brokerId] = { broker_name: item.broker_name, total_gross: 0, insurers: [] };
      }
      acc[brokerId]!.total_gross += item.total_gross;
      acc[brokerId]!.insurers.push({ name: item.insurer_name, total_gross: item.total_gross });
      return acc;
    }, {});

    const processChartData = () => {
      const monthlyTotals: Record<string, Record<number, number>> = {};
      data.forEach(item => {
        const month = new Date(item.created_at).getMonth();
        if (!monthlyTotals[month]) monthlyTotals[month] = {};
        monthlyTotals[month][item.year] = (monthlyTotals[month][item.year] || 0) + item.total_gross;
      });

      return monthNames.map((name, index) => ({
        month: name,
        [year]: monthlyTotals[index]?.[year] || 0,
        [year - 1]: monthlyTotals[index]?.[year - 1] || 0,
      }));
    };

    // Calculate office data for Master view
    const processOfficeData = (): OfficeData => {
      const totalRevenue = currentYearData.reduce((sum, item) => sum + item.total_gross, 0) * 1.3; // Mock: assume 30% markup
      const totalBrokerCommissions = currentYearData.reduce((sum, item) => sum + item.total_gross, 0);
      const officeProfit = totalRevenue - totalBrokerCommissions;
      const profitPercentage = totalRevenue > 0 ? (officeProfit / totalRevenue) * 100 : 0;
      
      // Mock data for Vida and Ramos Generales
      const totalVida = totalRevenue * 0.35; // Mock: 35% is life insurance
      const totalRamosGenerales = totalRevenue * 0.65; // Mock: 65% is general insurance
      
      // Monthly office data
      const monthlyData = monthNames.map((month, index) => {
        const monthRevenue = (chartData[index]?.[year] || 0) * 1.3; // Mock markup
        const monthCommissions = chartData[index]?.[year] || 0;
        return {
          month,
          revenue: monthRevenue,
          profit: monthRevenue - monthCommissions
        };
      });
      
      return {
        totalRevenue,
        totalBrokerCommissions,
        officeProfit,
        profitPercentage,
        totalVida,
        totalRamosGenerales,
        monthlyData
      };
    };

    const chartData = processChartData();
    return { tableData: processTableData(currentYearData), chartData, officeData: processOfficeData() };
  }, [data, year]);

  const toggleBroker = (brokerId: string) => {
    const newSet = new Set(expandedBrokers);
    newSet.has(brokerId) ? newSet.delete(brokerId) : newSet.add(brokerId);
    setExpandedBrokers(newSet);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando datos...</div>;
  }

  const renderHeader = (title: string) => (
    <CardHeader className="flex-row items-center justify-between">
      <CardTitle className="text-[#010139]">{title}</CardTitle>
      <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Año" /></SelectTrigger>
        <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
      </Select>
    </CardHeader>
  );

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (role === 'broker') {
    const totalYearGross = Object.values(tableData).reduce((sum, broker) => sum + broker.total_gross, 0);
    const allInsurers = Object.values(tableData).flatMap(b => b.insurers);

    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          {renderHeader('Mi Acumulado Anual (Bruto)')}
          <CardContent className="space-y-4">
            <Card className="shadow-inner"><CardContent className="p-4"><YTDChart data={chartData} currentYear={year} previousYear={year - 1} /></CardContent></Card>
            <p className="text-2xl font-bold text-center text-[#010139]">Total {year}: {formatCurrency(totalYearGross)}</p>
            <Card className="shadow-inner"><CardContent className="p-2">
            <Table>
              <TableHeader><TableRow><TableHead>Aseguradora</TableHead><TableHead className="text-right">Monto Bruto</TableHead></TableRow></TableHeader>
              <TableBody>
                {allInsurers.map((insurer, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{insurer.name}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(insurer.total_gross)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </CardContent></Card>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Office Total Section for Master */}
      {role === 'master' && (
        <Card className="shadow-lg border-l-4 border-l-[#010139]">
          <CardHeader>
            <CardTitle className="text-[#010139] flex items-center gap-2">
              <FaChartBar />
              Total Oficina {year}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="shadow-inner">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Anual</p>
                      <p className="text-2xl font-bold text-[#010139]">
                        {formatCurrency(officeData.totalRevenue)}
                      </p>
                    </div>
                    <FaDollarSign className="text-3xl text-[#010139]/20" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-inner">
                <CardContent className="p-4">
                  <div>
                    <p className="text-sm text-gray-600">Ganancia Oficina</p>
                    <p className="text-2xl font-bold text-[#8AAA19]">
                      {formatCurrency(officeData.officeProfit)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {officeData.profitPercentage.toFixed(1)}% del total
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-inner">
                <CardContent className="p-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Vida</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(officeData.totalVida)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="shadow-inner">
                <CardContent className="p-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Ramos Gen.</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(officeData.totalRamosGenerales)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Office Chart */}
            <Card className="shadow-inner">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-4">Ganancia Oficina por Mes</h4>
                <YTDChart 
                  data={officeData.monthlyData.map(m => ({
                    month: m.month,
                    [year]: m.profit,
                    [year - 1]: 0 // TODO: Calculate previous year office profit
                  }))}
                  currentYear={year} 
                  previousYear={year - 1} 
                />
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}
      
      <Card className="shadow-lg">
        {renderHeader('Acumulado Anual por Corredor (Bruto)')}
        <CardContent className="space-y-4">
          <Card className="shadow-inner"><CardContent className="p-4"><YTDChart data={chartData} currentYear={year} previousYear={year - 1} /></CardContent></Card>
          <Card className="shadow-inner"><CardContent className="p-2">
            <Table>
              <TableHeader><TableRow><TableHead className="w-[50px]"></TableHead><TableHead>Corredor</TableHead><TableHead className="text-right">Monto Bruto Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(tableData).map(([brokerId, brokerData]) => (
                  <>
                    <TableRow key={brokerId} onClick={() => toggleBroker(brokerId)} className="cursor-pointer hover:bg-gray-50">
                      <TableCell>{expandedBrokers.has(brokerId) ? <FaChevronDown className="text-[#010139]" /> : <FaChevronRight className="text-gray-400" />}</TableCell>
                      <TableCell className="font-medium">{brokerData.broker_name}</TableCell>
                      <TableCell className="text-right font-semibold font-mono text-[#010139]">{formatCurrency(brokerData.total_gross)}</TableCell>
                    </TableRow>
                    {expandedBrokers.has(brokerId) && (
                      <TableRow className="bg-gray-50">
                        <TableCell colSpan={3} className="p-0">
                          <div className="p-4 pl-16">
                            <Table>
                              <TableHeader><TableRow><TableHead>Aseguradora</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {brokerData.insurers.map((insurer, index) => (
                                  <TableRow key={`${brokerId}-${index}`} className="border-0">
                                    <TableCell className="text-gray-600">{insurer.name}</TableCell>
                                    <TableCell className="text-right text-gray-600 font-mono">{formatCurrency(insurer.total_gross)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </CardContent>
      </Card>
    </div>
  );
}
