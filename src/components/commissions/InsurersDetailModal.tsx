'use client';

import { FaTimes, FaChartLine, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InsurerDetail {
  name: string;
  current: number;
  previous: number;
  growth: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  insurers: InsurerDetail[];
  year: number;
  brokerName?: string;
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export function InsurersDetailModal({ isOpen, onClose, insurers, year, brokerName }: Props) {
  if (!isOpen) return null;

  const totalCurrent = insurers.reduce((sum, i) => sum + i.current, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#010139] px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FaChartLine />
              Detalle por Aseguradora
            </h2>
            <p className="text-sm text-white/80 mt-1">
              {brokerName ? `${brokerName} • ` : 'Todas las aseguradoras • '}Año {year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-white/80 transition-colors"
          >
            <FaTimes size={24} />
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#8AAA19]/10 to-transparent border-b">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold">Total Comisiones</p>
              <p className="text-2xl font-bold text-[#010139] font-mono">{formatCurrency(totalCurrent)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 font-semibold">{insurers.length} Aseguradoras</p>
            </div>
          </div>
        </div>

        {/* Body - Lista de aseguradoras */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {insurers.map((insurer, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-4 bg-white rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all shadow-sm hover:shadow-md border-l-4 ${
                  insurer.growth > 0 ? 'border-l-[#8AAA19]' : insurer.growth < 0 ? 'border-l-red-500' : 'border-l-gray-300'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate text-lg">{insurer.name}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <div>
                      <p className="text-xs text-gray-500">Año {year}</p>
                      <p className="text-base font-mono text-gray-700 font-semibold">{formatCurrency(insurer.current)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Año {year - 1}</p>
                      <p className="text-base font-mono text-gray-500">{formatCurrency(insurer.previous)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className={`p-3 rounded-lg ${
                    insurer.growth > 0 ? 'bg-green-100' : insurer.growth < 0 ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    {insurer.growth > 0 ? (
                      <FaArrowUp className="text-[#8AAA19] text-lg" />
                    ) : insurer.growth < 0 ? (
                      <FaArrowDown className="text-red-500 text-lg" />
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </div>
                  <span className={`text-2xl font-bold ${
                    insurer.growth > 0 ? 'text-[#8AAA19]' : insurer.growth < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {insurer.growth !== 0 ? `${insurer.growth > 0 ? '+' : ''}${insurer.growth.toFixed(1)}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-colors font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
