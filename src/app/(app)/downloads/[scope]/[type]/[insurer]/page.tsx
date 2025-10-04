'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';
import SectionsList from '@/components/downloads/SectionsList';
import { getPolicyTypeLabel } from '@/lib/downloads/constants';
import { toast } from 'sonner';

export default function DownloadsInsurerPage() {
  const params = useParams();
  const router = useRouter();
  const scope = params.scope as string;
  const policyType = params.type as string;
  const insurerId = params.insurer as string;

  const [insurer, setInsurer] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [scope, policyType, insurerId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar aseguradora
      const insurerRes = await fetch(`/api/insurers/${insurerId}`);
      const insurerData = await insurerRes.json();
      if (insurerData.success) {
        setInsurer(insurerData.insurer);
      }

      // Cargar secciones
      const sectionsRes = await fetch(`/api/downloads/sections?scope=${scope}&policy_type=${policyType}&insurer_id=${insurerId}`);
      const sectionsData = await sectionsRes.json();
      if (sectionsData.success) {
        setSections(sectionsData.sections);
      }

      // Verificar rol
      const profileRes = await fetch('/api/profile');
      const profileData = await profileRes.json();
      setIsMaster(profileData.role === 'master');
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const title = getPolicyTypeLabel(scope, policyType);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push(`/downloads/${scope}/${policyType}`)}
          className="
            flex items-center gap-2 mb-6
            text-[#010139] hover:text-[#8AAA19]
            font-semibold transition-colors
          "
        >
          <FaArrowLeft />
          <span>Volver a {title}</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#010139] mb-2">
            {insurer?.name || 'Cargando...'}
          </h1>
          <p className="text-gray-600">
            Selecciona una sección
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        ) : (
          <SectionsList
            scope={scope}
            policyType={policyType}
            insurerId={insurerId}
            sections={sections}
            isMaster={isMaster}
          />
        )}
      </div>
    </div>
  );
}
