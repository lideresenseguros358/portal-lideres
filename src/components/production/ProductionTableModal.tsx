'use client';

import { useState, useMemo } from 'react';
import { FaTimes, FaChevronDown, FaChevronUp } from 'react-icons/fa';

interface MonthData {
  bruto: number;
  num_polizas: number;
  canceladas: number;
  persistencia: number | null;
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

interface ProductionTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  production: BrokerProduction[];
  year: number;
}

const MONTHS_S1 = [
  { key: 'jan', label: 'E' },
  { key: 'feb', label: 'F' },
  { key: 'mar', label: 'M' },
  { key: 'apr', label: 'A' },
  { key: 'may', label: 'M' },
  { key: 'jun', label: 'J' },
];

const MONTHS_S2 = [
  { key: 'jul', label: 'J' },
  { key: 'aug', label: 'A' },
  { key: 'sep', label: 'S' },
  { key: 'oct', label: 'O' },
  { key: 'nov', label: 'N' },
  { key: 'dec', label: 'D' },
];

export default function ProductionTableModal({
  isOpen,
  onClose,
  production,
  year,
}: ProductionTableModalProps) {
  const [semester, setSemester] = useState<1 | 2>(1);
  const [showAll, setShowAll] = useState(false);

  const sortedProduction = useMemo(() => {
    return [...production]
      .map(broker => {
        const brutoYTD = Object.values(broker.months).reduce((sum, m) => sum + (m?.bruto || 0), 0);
        const netoYTD = brutoYTD - broker.canceladas_ytd;
        return { ...broker, brutoYTD, netoYTD };
      })
      .sort((a, b) => b.netoYTD - a.netoYTD);
  }, [production]);

  const displayedProduction = showAll ? sortedProduction : sortedProduction.slice(0, 10);
  const currentMonths = semester === 1 ? MONTHS_S1 : MONTHS_S2;

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `${value < 0 ? '-' : ''}$${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(0)}K`;
    }
    return `${value < 0 ? '-' : ''}$${absValue.toFixed(0)}`;
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getMedalEmoji = (position: number) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] sm:max-h-[85vh] my-4 sm:my-8 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020252] text-white px-3 sm:px-6 py-3 sm:py-4 rounded-t-xl flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm sm:text-lg font-bold">Cuadro Completo de Producción {year}</h3>
            <p className="text-[10px] sm:text-xs text-gray-300 mt-0.5">Top Brokers - Ordenado por Neto Anual</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors p-1"
          >
            <FaTimes className="text-base sm:text-xl" />
          </button>
        </div>

        {/* Semester Toggle - Sutil */}
        <div className="bg-gray-50 px-3 sm:px-6 py-2 border-b border-gray-200 flex items-center justify-center gap-1 flex-shrink-0">
          <button
            onClick={() => setSemester(1)}
            className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-medium transition-all ${
              semester === 1
                ? 'bg-[#010139] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Ene-Jun
          </button>
          <button
            onClick={() => setSemester(2)}
            className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-medium transition-all ${
              semester === 2
                ? 'bg-[#010139] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Jul-Dic
          </button>
        </div>

        {/* Table Container */}
        <div className={`flex-1 ${showAll ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          <div className="min-w-full">
            <table className="w-full text-[9px] sm:text-xs">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-[#010139] font-bold whitespace-nowrap">#</th>
                  <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-[#010139] font-bold whitespace-nowrap">Broker</th>
                  <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-[#010139] font-bold whitespace-nowrap hidden sm:table-cell">ASSA</th>
                  {currentMonths.map(m => (
                    <th key={m.key} className="px-0.5 sm:px-1 py-1 sm:py-2 text-center text-[#010139] font-bold">{m.label}</th>
                  ))}
                  <th className="px-1 sm:px-2 py-1 sm:py-2 text-right text-[#010139] font-bold whitespace-nowrap">Bruto</th>
                  <th className="px-1 sm:px-2 py-1 sm:py-2 text-right text-red-600 font-bold whitespace-nowrap hidden sm:table-cell">Canc.</th>
                  <th className="px-1 sm:px-2 py-1 sm:py-2 text-right text-[#8AAA19] font-bold whitespace-nowrap">Neto</th>
                  <th className="px-1 sm:px-2 py-1 sm:py-2 text-right text-gray-600 font-bold whitespace-nowrap hidden sm:table-cell">Meta</th>
                </tr>
              </thead>
              <tbody>
                {displayedProduction.map((broker, index) => {
                  const medal = getMedalEmoji(index + 1);
                  const isTop3 = index < 3;
                  const metaPercent = broker.meta_personal > 0 
                    ? ((broker.netoYTD / broker.meta_personal) * 100).toFixed(0) 
                    : '-';
                  
                  return (
                    <tr 
                      key={broker.broker_id}
                      className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                        isTop3 ? 'bg-gradient-to-r from-yellow-50 to-amber-50' : ''
                      }`}
                    >
                      <td className="px-1 sm:px-2 py-1 sm:py-2 font-bold text-gray-700">
                        {medal || `${index + 1}`}
                      </td>
                      <td className="px-1 sm:px-2 py-1 sm:py-2 font-medium text-[#010139] truncate max-w-[80px] sm:max-w-none">
                        {broker.broker_name}
                      </td>
                      <td className="px-1 sm:px-2 py-1 sm:py-2 text-gray-600 hidden sm:table-cell">
                        {broker.assa_code || '-'}
                      </td>
                      {currentMonths.map(m => {
                        const monthKey = m.key as keyof typeof broker.months;
                        const monthData = broker.months[monthKey];
                        const value = monthData?.bruto || 0;
                        return (
                          <td 
                            key={m.key} 
                            className={`px-0.5 sm:px-1 py-1 sm:py-2 text-center font-mono relative group ${
                              value > 0 ? 'text-gray-700 cursor-help' : 'text-gray-300'
                            }`}
                            title={value > 0 ? formatCurrencyFull(value) : undefined}
                          >
                            {value > 0 ? formatCurrency(value) : '-'}
                            {value > 0 && (
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 hidden sm:block">
                                {formatCurrencyFull(value)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td 
                        className="px-1 sm:px-2 py-1 sm:py-2 text-right font-mono font-bold text-[#010139] relative group cursor-help"
                        title={formatCurrencyFull(broker.brutoYTD)}
                      >
                        {formatCurrency(broker.brutoYTD)}
                        <span className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 hidden sm:block">
                          {formatCurrencyFull(broker.brutoYTD)}
                        </span>
                      </td>
                      <td 
                        className="px-1 sm:px-2 py-1 sm:py-2 text-right font-mono text-red-600 hidden sm:table-cell relative group cursor-help"
                        title={formatCurrencyFull(broker.canceladas_ytd)}
                      >
                        {formatCurrency(broker.canceladas_ytd)}
                        <span className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
                          {formatCurrencyFull(broker.canceladas_ytd)}
                        </span>
                      </td>
                      <td 
                        className="px-1 sm:px-2 py-1 sm:py-2 text-right font-mono font-bold text-[#8AAA19] relative group cursor-help"
                        title={formatCurrencyFull(broker.netoYTD)}
                      >
                        {formatCurrency(broker.netoYTD)}
                        <span className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 hidden sm:block">
                          {formatCurrencyFull(broker.netoYTD)}
                        </span>
                      </td>
                      <td className="px-1 sm:px-2 py-1 sm:py-2 text-right text-gray-600 hidden sm:table-cell">
                        <span className={`font-medium ${
                          parseFloat(metaPercent) >= 100 ? 'text-green-600' : 
                          parseFloat(metaPercent) >= 80 ? 'text-yellow-600' : 
                          'text-red-600'
                        }`}>
                          {metaPercent !== '-' ? `${metaPercent}%` : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer - Ver más */}
        {!showAll && sortedProduction.length > 10 && (
          <div className="bg-gray-50 px-3 sm:px-6 py-3 border-t border-gray-200 flex justify-center flex-shrink-0">
            <button
              onClick={() => setShowAll(true)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#8AAA19] text-white rounded-lg text-[10px] sm:text-xs font-semibold hover:bg-[#6d8814] transition-all flex items-center gap-1 sm:gap-2"
            >
              <span>Ver todos ({sortedProduction.length} brokers)</span>
              <FaChevronDown className="text-[10px] sm:text-xs" />
            </button>
          </div>
        )}

        {showAll && (
          <div className="bg-gray-50 px-3 sm:px-6 py-3 border-t border-gray-200 flex justify-center flex-shrink-0">
            <button
              onClick={() => setShowAll(false)}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-300 text-gray-700 rounded-lg text-[10px] sm:text-xs font-semibold hover:bg-gray-400 transition-all flex items-center gap-1 sm:gap-2"
            >
              <span>Mostrar Top 10</span>
              <FaChevronUp className="text-[10px] sm:text-xs" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
