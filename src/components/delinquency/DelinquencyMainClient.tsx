'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaChartPie, FaFileImport, FaList } from 'react-icons/fa';
import SummaryTab from './SummaryTab';
import ImportTab from './ImportTab';
import DetailTab from './DetailTab';
import { getSupabaseServer } from '@/lib/supabase/server';
import { supabaseClient } from '@/lib/supabase/client';

export default function DelinquencyMainClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'summary' | 'import' | 'detail'>('summary');
  const [userRole, setUserRole] = useState<'master' | 'broker' | null>(null);
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const client = supabaseClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await client
          .from('profiles')
          .select('role, broker_id')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserRole(profile.role as 'master' | 'broker');
          setBrokerId(profile.broker_id);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!userRole) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
          ⚠️ Morosidad
        </h1>
        <p className="text-gray-600 text-sm md:text-base">
          Gestión de deudas y saldos vencidos por aseguradora
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-lg p-2 flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all text-sm md:text-base ${
            activeTab === 'summary'
              ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-lg'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FaChartPie className="text-base md:text-lg" />
          <span>Resumen</span>
        </button>
        
        {userRole === 'master' && (
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all text-sm md:text-base ${
              activeTab === 'import'
                ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FaFileImport className="text-base md:text-lg" />
            <span>Importar</span>
          </button>
        )}
        
        <button
          onClick={() => setActiveTab('detail')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all text-sm md:text-base ${
            activeTab === 'detail'
              ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white shadow-lg'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FaList className="text-base md:text-lg" />
          <span>Detalle</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-300">
        {activeTab === 'summary' && (
          <SummaryTab userRole={userRole} brokerId={brokerId} />
        )}
        {activeTab === 'import' && userRole === 'master' && (
          <ImportTab />
        )}
        {activeTab === 'detail' && (
          <DetailTab userRole={userRole} brokerId={brokerId} />
        )}
      </div>
    </div>
  );
}
