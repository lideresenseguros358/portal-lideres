'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FaChevronRight, FaChevronLeft, FaEdit, FaBullseye } from 'react-icons/fa';
import Link from 'next/link';
import MonthInputModal from './MonthInputModal';
import MetaPersonalModal from './MetaPersonalModal';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';

interface MonthData {
  bruto: number;
  num_polizas: number;
  canceladas: number;
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
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const brokersPerPage = 10;
  
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleMonthSave = async (bruto: number, numPolizas: number, canceladas: number) => {
    if (!monthModal.broker || !monthModal.monthKey) return;

    // Validar que canceladas no sea mayor que bruto
    if (canceladas > bruto) {
      toast.error('Las canceladas no pueden ser mayores que la cifra bruta');
      return;
    }

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
          canceladas,
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
                [monthModal.monthKey!]: { bruto, num_polizas: numPolizas, canceladas }
              }
            };
          }
          return b;
        }));
        toast.success('Cifras guardadas exitosamente');
        loadProduction(); // Recargar para actualizar YTD
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

  // Paginación
  const totalPages = Math.ceil(filteredProduction.length / brokersPerPage);
  const startIndex = (currentPage - 1) * brokersPerPage;
  const endIndex = startIndex + brokersPerPage;
  const paginatedProduction = filteredProduction.slice(startIndex, endIndex);

  // Resetear página al buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
          placeholder="🔍 BUSCAR CORREDOR POR NOMBRE O CÓDIGO ASSA..."
          value={searchTerm}
          onChange={createUppercaseHandler((e) => setSearchTerm(e.target.value))}
          className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-base ${uppercaseInputClass}`}
        />
      </div>

      {/* Selector de Semestre - Rediseñado Responsive */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
        {/* Version Desktop */}
        <div className="hidden md:flex items-center justify-center gap-3">
          <button
            onClick={() => setSemester(1)}
            disabled={semester === 1}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
              semester === 1 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-[#010139] to-[#020270] text-white hover:shadow-lg hover:scale-105'
            }`}
          >
            <FaChevronLeft size={16} />
            <span>Ene-Jun</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSemester(1)}
              className={`px-6 py-3 rounded-lg font-bold transition-all ${
                semester === 1 
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-lg ring-2 ring-[#8AAA19] ring-offset-2' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="text-sm font-semibold">1er Semestre</div>
              <div className="text-xs font-normal opacity-90">Enero - Junio</div>
            </button>
            
            <div className="w-px h-12 bg-gray-300"></div>
            
            <button
              onClick={() => setSemester(2)}
              className={`px-6 py-3 rounded-lg font-bold transition-all ${
                semester === 2 
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-lg ring-2 ring-[#8AAA19] ring-offset-2' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="text-sm font-semibold">2do Semestre</div>
              <div className="text-xs font-normal opacity-90">Julio - Diciembre</div>
            </button>
          </div>

          <button
            onClick={() => setSemester(2)}
            disabled={semester === 2}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
              semester === 2 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-[#010139] to-[#020270] text-white hover:shadow-lg hover:scale-105'
            }`}
          >
            <span>Jul-Dic</span>
            <FaChevronRight size={16} />
          </button>
        </div>

        {/* Version Mobile/Tablet */}
        <div className="md:hidden space-y-3">
          {/* Indicador visual */}
          <div className="flex items-center justify-center gap-2">
            <div className={`h-2 flex-1 rounded-full transition-all ${
              semester === 1 ? 'bg-[#8AAA19]' : 'bg-gray-200'
            }`}></div>
            <div className={`h-2 flex-1 rounded-full transition-all ${
              semester === 2 ? 'bg-[#8AAA19]' : 'bg-gray-200'
            }`}></div>
          </div>

          {/* Botones grandes para mobile */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSemester(1)}
              className={`p-4 rounded-xl font-bold transition-all ${
                semester === 1 
                  ? 'bg-gradient-to-br from-[#010139] to-[#020270] text-white shadow-lg border-2 border-[#8AAA19]' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
              }`}
            >
              <div className="text-base mb-1">🌱 1er Semestre</div>
              <div className="text-xs opacity-80">Ene - Jun</div>
              {semester === 1 && (
                <div className="text-[10px] mt-1 text-[#8AAA19] font-normal">✅ Activo</div>
              )}
            </button>

            <button
              onClick={() => setSemester(2)}
              className={`p-4 rounded-xl font-bold transition-all ${
                semester === 2 
                  ? 'bg-gradient-to-br from-[#010139] to-[#020270] text-white shadow-lg border-2 border-[#8AAA19]' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
              }`}
            >
              <div className="text-base mb-1">☀️ 2do Semestre</div>
              <div className="text-xs opacity-80">Jul - Dic</div>
              {semester === 2 && (
                <div className="text-[10px] mt-1 text-[#8AAA19] font-normal">✅ Activo</div>
              )}
            </button>
          </div>

          {/* Navegación rápida mobile */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setSemester(1)}
              disabled={semester === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                semester === 1 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-[#010139] text-white active:scale-95'
              }`}
            >
              <FaChevronLeft size={12} />
              Anterior
            </button>
            <button
              onClick={() => setSemester(2)}
              disabled={semester === 2}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                semester === 2 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-[#010139] text-white active:scale-95'
              }`}
            >
              Siguiente
              <FaChevronRight size={12} />
            </button>
          </div>
        </div>
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
                <th className="px-2 py-3 text-center text-xs font-semibold text-[#010139] border-b-2 border-gray-200 w-[90px]">
                  Código ASSA
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
              {paginatedProduction.length === 0 ? (
                <tr>
                  <td colSpan={currentMonths.length + 6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-6xl text-gray-300">{searchTerm ? '🔍' : '📊'}</div>
                      <p className="text-lg font-semibold text-gray-600">
                        {searchTerm ? 'No se encontraron corredores' : 'No hay brokers registrados'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProduction.map((broker) => {
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
                      </td>

                      {/* Código ASSA */}
                      <td className="px-1 py-2 text-center border-b border-gray-200">
                        <div className="text-xs font-mono text-gray-700">
                          {broker.assa_code || '-'}
                        </div>
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

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                setCurrentPage(prev => Math.max(1, prev - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === 1}
              className="w-full sm:w-auto px-6 py-3 bg-[#010139] text-white rounded-lg font-semibold hover:bg-[#020270] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FaChevronLeft />
              Anterior
            </button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Página <span className="font-bold text-[#010139]">{currentPage}</span> de <span className="font-bold">{totalPages}</span>
              </span>
              <span className="text-xs text-gray-500">
                ({filteredProduction.length} corredor{filteredProduction.length !== 1 ? 'es' : ''})
              </span>
            </div>
            
            <button
              onClick={() => {
                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === totalPages}
              className="w-full sm:w-auto px-6 py-3 bg-[#010139] text-white rounded-lg font-semibold hover:bg-[#020270] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Siguiente
              <FaChevronRight />
            </button>
          </div>
        )}
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
        initialCanceladas={monthModal.broker && monthModal.monthKey ? monthModal.broker.months[monthModal.monthKey as keyof typeof monthModal.broker.months].canceladas : 0}
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
