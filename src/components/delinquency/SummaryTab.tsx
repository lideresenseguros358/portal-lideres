'use client';

import { useState, useEffect } from 'react';
import { FaCalendarAlt, FaFilter } from 'react-icons/fa';
import { actionGetDelinquencySummary, actionGetActiveInsurers, actionGetBrokers } from '@/app/(app)/delinquency/actions';
import { toast } from 'sonner';

interface SummaryTabProps {
  userRole: 'master' | 'broker';
  brokerId: string | null;
}

export default function SummaryTab({ userRole, brokerId }: SummaryTabProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [selectedInsurer, setSelectedInsurer] = useState<string>('');
  const [selectedBroker, setSelectedBroker] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (userRole === 'broker' && brokerId) {
      setSelectedBroker(brokerId);
    }
  }, [userRole, brokerId]);

  useEffect(() => {
    loadSummary();
  }, [selectedInsurer, selectedBroker]);

  const loadData = async () => {
    try {
      const [insurersRes, brokersRes] = await Promise.all([
        actionGetActiveInsurers(),
        userRole === 'master' ? actionGetBrokers() : Promise.resolve({ ok: true, data: [] }),
      ]);

      if (insurersRes.ok) setInsurers(insurersRes.data || []);
      if (brokersRes.ok) setBrokers(brokersRes.data || []);
    } catch (error) {
      toast.error('Error al cargar filtros');
    }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (selectedInsurer) filters.insurerId = selectedInsurer;
      if (selectedBroker) filters.brokerId = selectedBroker;
      else if (userRole === 'broker' && brokerId) filters.brokerId = brokerId;

      const result = await actionGetDelinquencySummary(filters);
      if (result.ok) {
        setSummary(result.data);
      } else {
        toast.error('Error al cargar resumen');
      }
    } catch (error) {
      toast.error('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-PA', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);

  const buckets = [
    { label: 'Por Vencer', key: 'due_soon', color: 'blue' },
    { label: 'Corriente', key: 'current', color: 'green' },
    { label: '1-30 días', key: 'bucket_1_30', color: 'yellow' },
    { label: '31-60 días', key: 'bucket_31_60', color: 'orange' },
    { label: '61-90 días', key: 'bucket_61_90', color: 'red' },
    { label: '+90 días', key: 'bucket_90_plus', color: 'red-dark' },
  ];

  const getColorClasses = (color: string) => {
    const colors: any = {
      blue: 'bg-blue-100 border-blue-300 text-blue-800',
      green: 'bg-green-100 border-green-300 text-green-800',
      yellow: 'bg-yellow-100 border-yellow-300 text-yellow-800',
      orange: 'bg-orange-100 border-orange-300 text-orange-800',
      red: 'bg-red-100 border-red-300 text-red-800',
      'red-dark': 'bg-red-200 border-red-500 text-red-900',
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <FaFilter className="text-[#010139]" />
          <h3 className="text-lg font-bold text-[#010139]">Filtros</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aseguradora
            </label>
            <select
              value={selectedInsurer}
              onChange={(e) => setSelectedInsurer(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
            >
              <option value="">Todas</option>
              {insurers.map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {ins.name}
                </option>
              ))}
            </select>
          </div>

          {userRole === 'master' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Corredor
              </label>
              <select
                value={selectedBroker}
                onChange={(e) => setSelectedBroker(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
              >
                <option value="">Todos</option>
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Last Import Date */}
      {summary?.last_import_date && (
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-full shadow-lg">
            <FaCalendarAlt />
            <span className="text-sm font-semibold">
              Fecha de corte: {new Date(summary.last_import_date).toLocaleDateString('es-PA')}
            </span>
          </div>
        </div>
      )}

      {/* Buckets Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {buckets.map((bucket) => (
            <div
              key={bucket.key}
              className={`rounded-xl shadow-lg p-6 border-2 ${getColorClasses(bucket.color)} transition-transform hover:scale-105`}
            >
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-wide mb-2">
                  {bucket.label}
                </p>
                <p className="text-3xl font-bold font-mono">
                  {formatCurrency(summary[bucket.key] || 0)}
                </p>
              </div>
            </div>
          ))}

          {/* Total Card */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-3 rounded-xl shadow-lg p-6 bg-gradient-to-r from-[#010139] to-[#020270] text-white border-2 border-[#010139]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-sm font-semibold uppercase tracking-wide mb-2">
                  Total General
                </p>
                <p className="text-4xl font-bold font-mono">
                  {formatCurrency(summary.total || 0)}
                </p>
              </div>
              <div className="text-center md:text-right">
                <p className="text-sm opacity-90 mb-1">Pólizas con deuda</p>
                <p className="text-2xl font-bold">{summary.count || 0}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-gray-100">
          <p className="text-gray-500 text-lg">No hay datos de morosidad disponibles</p>
          <p className="text-gray-400 text-sm mt-2">
            {userRole === 'master' 
              ? 'Importa datos desde la pestaña "Importar"'
              : 'Contacta al administrador para importar datos'}
          </p>
        </div>
      )}
    </div>
  );
}
