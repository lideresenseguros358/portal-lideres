'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FaChevronRight, FaChevronLeft, FaEdit, FaBullseye } from 'react-icons/fa';
import Link from 'next/link';
import MonthInputModal from './MonthInputModal';
import MetaPersonalModal from './MetaPersonalModal';

interface MonthData {
  bruto: number;
  num_polizas: number;
}

interface BrokerProduction {
  broker_id: string;
  broker_name: string;
  assa_code: string;
  meta_personal: number;
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
  canceladas_ytd: number;
  previous_year?: {
    bruto_ytd: number;
    neto_ytd: number;
    num_polizas_ytd: number;
  };
}

interface ProductionMatrixMasterProps {
  year: number;
}

const MONTHS_SEMESTER_1 = [
  { key: 'jan', label: 'Ene', num: 1 },
  { key: 'feb', label: 'Feb', num: 2 },
  { key: 'mar', label: 'Mar', num: 3 },
  { key: 'apr', label: 'Abr', num: 4 },
  { key: 'may', label: 'May', num: 5 },
  { key: 'jun', label: 'Jun', num: 6 },
];

const MONTHS_SEMESTER_2 = [
  { key: 'jul', label: 'Jul', num: 7 },
  { key: 'aug', label: 'Ago', num: 8 },
  { key: 'sep', label: 'Sep', num: 9 },
  { key: 'oct', label: 'Oct', num: 10 },
  { key: 'nov', label: 'Nov', num: 11 },
  { key: 'dec', label: 'Dic', num: 12 },
];

export default function ProductionMatrixMaster({ year }: ProductionMatrixMasterProps) {
  const [loading, setLoading] = useState(true);
  const [production, setProduction] = useState<BrokerProduction[]>([]);
  const [semester, setSemester] = useState<1 | 2>(1); // 1 = Ene-Jun, 2 = Jul-Dic
  const [searchTerm, setSearchTerm] = useState(''); // Buscador
  
  // Modal states
  const [monthModal, setMonthModal] = useState<{
    isOpen: boolean;
    broker?: BrokerProduction;
    monthKey?: string;
    monthName?: string;
  }>({ isOpen: false });

  const [metaModal, setMetaModal] = useState<{
    isOpen: boolean;
    broker?: BrokerProduction;
  }>({ isOpen: false });

  useEffect(() => {
    loadProduction();
  }, [year]);

  const loadProduction = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: year.toString() });
      const response = await fetch(`/api/production?${params}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setProduction(result.data.brokers || []);
        } else {
          setProduction([]);
        }
      } else {
        toast.error('Error al cargar producción');
        setProduction([]);
      }
    } catch (error) {
      console.error('Error loading production:', error);
      toast.error('Error al cargar producción');
      setProduction([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthClick = (broker: BrokerProduction, monthKey: string, monthName: string) => {
    setMonthModal({
      isOpen: true,
      broker,
      monthKey,
      monthName,
    });
  };

  const handleMonthSave = async (bruto: number, numPolizas: number) => {
    if (!monthModal.broker || !monthModal.monthKey) return;

    try {
      const response = await fetch('/api/production', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker_id: monthModal.broker.broker_id,
          year,
          month: monthModal.monthKey,
          bruto,
          num_polizas: numPolizas,
        }),
      });

      if (response.ok) {
        // Actualizar estado local
        setProduction(prev => prev.map(b => {
          if (b.broker_id === monthModal.broker!.broker_id) {
            return {
              ...b,
              months: {
                ...b.months,
                [monthModal.monthKey!]: { bruto, num_polizas: numPolizas }
              }
            };
          }
          return b;
        }));
        toast.success('Cifras guardadas');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error saving month:', error);
      toast.error('Error al guardar');
    }
  };

  const handleMetaClick = (broker: BrokerProduction) => {
    setMetaModal({
      isOpen: true,
      broker,
    });
  };

  const handleMetaSave = async (meta: number) => {
    if (!metaModal.broker) return;

    try {
      const response = await fetch('/api/production', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker_id: metaModal.broker.broker_id,
          meta_personal: meta,
        }),
      });

      if (response.ok) {
        // Actualizar estado local
        setProduction(prev => prev.map(b => {
          if (b.broker_id === metaModal.broker!.broker_id) {
            return { ...b, meta_personal: meta };
          }
          return b;
        }));
        toast.success('Meta personal actualizada');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error saving meta:', error);
      toast.error('Error al guardar');
    }
  };

  const calculateYTD = (months: any, canceladas_ytd: number) => {
    const brutoYTD = Object.values(months).reduce((sum: number, m: any) => sum + (m.bruto || 0), 0);
    const netoYTD = brutoYTD - canceladas_ytd;
    const numPolizasYTD = Object.values(months).reduce((sum: number, m: any) => sum + (m.num_polizas || 0), 0);
    return { brutoYTD, netoYTD, numPolizasYTD };
  };

  const calculatePercentage = (neto: number, meta: number) => {
    if (meta === 0) return '-';
    const pct = (neto / meta) * 100;
    return `${pct.toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const currentMonths = semester === 1 ? MONTHS_SEMESTER_1 : MONTHS_SEMESTER_2;

  // Filtrar brokers por búsqueda
  const filteredProduction = production.filter(broker => 
    broker.broker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    broker.assa_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <>
      {/* Buscador */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
        <input
          type="text"
          placeholder="🔍 Buscar corredor por nombre o código ASSA..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-base"
        />
      </div>

      {/* Selector de Semestre */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6 flex items-center justify-between">
        <button
          onClick={() => setSemester(1)}
          disabled={semester === 1}
          className="px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-30"
        >
          <FaChevronLeft className="inline mr-2" />
          Anterior
        </button>

        <div className="flex items-center gap-4">
          <div className={`px-6 py-3 rounded-lg font-bold transition-all ${semester === 1 ? 'bg-[#010139] text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}>
            Enero - Junio
          </div>
          <div className={`px-6 py-3 rounded-lg font-bold transition-all ${semester === 2 ? 'bg-[#010139] text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}>
            Julio - Diciembre
          </div>
        </div>

        <button
          onClick={() => setSemester(2)}
          disabled={semester === 2}
          className="px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-30"
        >
          Siguiente
          <FaChevronRight className="inline ml-2" />
        </button>
      </div>

      {/* Tabla de Producción */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            {/* Header */}
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                <th className="sticky left-0 z-20 bg-gradient-to-r from-gray-50 to-gray-100 px-2 py-3 text-left text-xs font-semibold text-[#010139] border-b-2 border-gray-200 w-[140px]">
                  Corredor
                </th>
                {currentMonths.map(month => (
                  <th key={month.key} className="px-2 py-3 text-center text-xs font-semibold text-[#010139] border-b-2 border-gray-200 w-[100px]">
                    {month.label}
                    <div className="text-[10px] text-gray-500 font-normal">$ / Pól</div>
                  </th>
                ))}
                <th className="px-2 py-3 text-center text-xs font-semibold text-[#010139] border-b-2 border-gray-200 w-[100px]">
                  Total Bruto
                </th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-red-600 border-b-2 border-gray-200 w-[100px]">
                  Canceladas
                </th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-[#8AAA19] border-b-2 border-gray-200 w-[100px]">
                  Neto Total
                </th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-[#010139] border-b-2 border-gray-200 w-[110px]">
                  Meta Personal
                </th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-[#010139] border-b-2 border-gray-200 w-[90px]">
                  % Cumplido
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-gray-200">
              {filteredProduction.length === 0 ? (
                <tr>
                  <td colSpan={currentMonths.length + 5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-6xl text-gray-300">{searchTerm ? '🔍' : '📊'}</div>
                      <p className="text-lg font-semibold text-gray-600">
                        {searchTerm ? 'No se encontraron corredores' : 'No hay brokers registrados'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProduction.map((broker) => {
                  const { brutoYTD, netoYTD, numPolizasYTD } = calculateYTD(broker.months, broker.canceladas_ytd);
                  const percentage = calculatePercentage(netoYTD, broker.meta_personal);

                  return (
                    <tr key={broker.broker_id} className="hover:bg-gray-50">
                      {/* Nombre del Broker */}
                      <td className="sticky left-0 z-10 bg-white hover:bg-gray-50 px-2 py-2 border-b border-gray-200">
                        <Link
                          href={`/brokers/${broker.broker_id}`}
                          className="font-semibold text-[#010139] hover:text-[#8AAA19] hover:underline block text-sm"
                        >
                          {broker.broker_name}
                        </Link>
                        {broker.assa_code && (
                          <span className="text-[10px] text-gray-500 font-mono">{broker.assa_code}</span>
                        )}
                      </td>

                      {/* Meses del semestre actual */}
                      {currentMonths.map(month => {
                        const monthKey = month.key as keyof typeof broker.months;
                        const monthData = broker.months[monthKey];

                        return (
                          <td key={month.key} className="px-1 py-1 text-center text-xs border-b border-gray-200">
                            <button
                              onClick={() => handleMonthClick(broker, month.key, month.label)}
                              className="w-full px-1 py-1 rounded hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-300 group"
                            >
                              <div className="font-mono text-xs">
                                ${(monthData.bruto / 1000).toFixed(0)}k
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {monthData.num_polizas}p
                              </div>
                              <FaEdit className="text-gray-400 group-hover:text-blue-600 mx-auto mt-1" style={{ fontSize: '10px' }} />
                            </button>
                          </td>
                        );
                      })}

                      {/* Total Bruto */}
                      <td className="px-2 py-2 text-center text-xs font-bold border-b border-gray-200 bg-gray-50">
                        <div className="font-mono">${(brutoYTD / 1000).toFixed(0)}k</div>
                        <div className="text-[10px] text-gray-600">{numPolizasYTD}p</div>
                      </td>

                      {/* Canceladas */}
                      <td className="px-2 py-2 text-center text-xs font-semibold border-b border-gray-200 bg-red-50">
                        <span className="font-mono text-red-600">${(broker.canceladas_ytd / 1000).toFixed(0)}k</span>
                      </td>

                      {/* Neto Total */}
                      <td className="px-2 py-2 text-center text-xs font-bold border-b border-gray-200 bg-green-50">
                        <span className="font-mono text-[#8AAA19]">${(netoYTD / 1000).toFixed(0)}k</span>
                      </td>

                      {/* Meta Personal */}
                      <td className="px-2 py-2 text-center text-xs border-b border-gray-200">
                        <button
                          onClick={() => handleMetaClick(broker)}
                          className="w-full px-1 py-1 rounded hover:bg-yellow-50 transition-colors border border-transparent hover:border-yellow-300 group"
                        >
                          <div className="font-mono font-bold text-[#010139] text-xs">
                            ${(broker.meta_personal / 1000).toFixed(0)}k
                          </div>
                          <FaBullseye className="text-gray-400 group-hover:text-yellow-600 mx-auto mt-1" style={{ fontSize: '10px' }} />
                        </button>
                      </td>
                      {/* % Cumplido */}
                      <td className="px-2 py-2 text-center text-xs font-bold border-b border-gray-200">
                        <span className={`font-mono ${
                          percentage === '-' ? 'text-gray-400' :
                          parseFloat(percentage) >= 100 ? 'text-green-600' :
                          parseFloat(percentage) >= 75 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {percentage}
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
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>📝 Instrucciones:</strong> Click en cualquier mes para ingresar cifras ($) y número de pólizas. 
          Click en Meta Personal para establecer la meta anual del corredor.
        </p>
      </div>

      {/* Modales */}
      <MonthInputModal
        isOpen={monthModal.isOpen}
        onClose={() => setMonthModal({ isOpen: false })}
        onSave={handleMonthSave}
        brokerName={monthModal.broker?.broker_name || ''}
        monthName={monthModal.monthName || ''}
        initialBruto={monthModal.broker && monthModal.monthKey ? monthModal.broker.months[monthModal.monthKey as keyof typeof monthModal.broker.months].bruto : 0}
        initialNumPolizas={monthModal.broker && monthModal.monthKey ? monthModal.broker.months[monthModal.monthKey as keyof typeof monthModal.broker.months].num_polizas : 0}
      />

      <MetaPersonalModal
        isOpen={metaModal.isOpen}
        onClose={() => setMetaModal({ isOpen: false })}
        onSave={handleMetaSave}
        brokerName={metaModal.broker?.broker_name || ''}
        currentMeta={metaModal.broker?.meta_personal || 0}
      />
    </>
  );
}
