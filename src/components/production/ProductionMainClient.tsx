'use client';

import { useState } from 'react';
import { FaChartLine, FaTrophy, FaChartBar, FaCalendarAlt } from 'react-icons/fa';
import ProductionMatrixMaster from './ProductionMatrixMaster';
import ProductionBrokerView from './ProductionBrokerView';
import ProductionAnalyticsView from './ProductionAnalyticsView';
import ContestsConfig from './ContestsConfig';

interface ProductionMainClientProps {
  userId: string;
  role: string;
  brokerId: string | null;
  brokers: { id: string; name: string | null }[];
}

export default function ProductionMainClient({ userId, role, brokerId, brokers }: ProductionMainClientProps) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'analytics' | 'contests'>('matrix');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const isMaster = role === 'master';
  
  // Generar lista de años (5 años hacia atrás)
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  // Tabs diferentes para Master y Broker
  const tabs = isMaster ? [
    { key: 'matrix' as const, label: 'Matriz de Ingreso', icon: FaChartLine },
    { key: 'analytics' as const, label: 'Analíticas', icon: FaChartBar },
    { key: 'contests' as const, label: 'Concursos', icon: FaTrophy },
  ] : [
    { key: 'matrix' as const, label: 'Mi Producción', icon: FaChartLine },
  ];

  return (
    <>
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] flex items-center gap-3">
              📊 Producción
            </h1>
            <p className="text-gray-600 mt-1">
              {isMaster ? 'Gestión de producción anual y concursos' : 'Tu producción anual'}
            </p>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-3">
            <FaCalendarAlt className="text-[#010139]" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-semibold text-[#010139]"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 border-b-2 border-gray-200">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    px-4 py-2 rounded-t-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2
                    ${activeTab === tab.key 
                      ? 'bg-[#010139] text-white border-b-4 border-[#8AAA19]' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <Icon />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'matrix' && (
          isMaster ? (
            <ProductionMatrixMaster year={selectedYear} />
          ) : (
            <ProductionBrokerView 
              year={selectedYear} 
              brokerId={brokerId!}
            />
          )
        )}
        {activeTab === 'analytics' && isMaster && (
          <ProductionAnalyticsView 
            year={selectedYear}
            brokers={brokers}
          />
        )}
        {activeTab === 'contests' && isMaster && (
          <ContestsConfig />
        )}
      </div>
    </>
  );
}
