'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';
import InsurersList from '@/components/downloads/InsurersList';
import RequirementsGuide from '@/components/downloads/RequirementsGuide';
import { getPolicyTypeLabel } from '@/lib/downloads/constants';
import { toast } from 'sonner';

export default function DownloadsTypePage() {
  const params = useParams();
  const router = useRouter();
  const scope = params.scope as string;
  const policyType = params.type as string;

  const [insurers, setInsurers] = useState<any[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [scope, policyType]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar aseguradoras activas con secciones para este tipo
      const insurersRes = await fetch('/api/insurers');
      const insurersData = await insurersRes.json();
      
      console.log('📥 Respuesta de /api/insurers:', insurersData);
      
      if (insurersData.success) {
        // No filtrar aquí - el endpoint ya retorna solo las activas
        console.log('✅ Aseguradoras encontradas:', insurersData.insurers.length, insurersData.insurers);
        setInsurers(insurersData.insurers || []);
      } else {
        console.error('❌ Error en respuesta:', insurersData);
      }

      // Verificar rol
      const profileRes = await fetch('/api/profile');
      const profileData = await profileRes.json();
      setIsMaster(profileData.role === 'master');
      console.log('👤 Rol del usuario:', profileData.role);
    } catch (error) {
      console.error('❌ Error loading data:', error);
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
          onClick={() => router.push(`/downloads/${scope}`)}
          className="
            flex items-center gap-2 mb-6
            text-[#010139] hover:text-[#8AAA19]
            font-semibold transition-colors
          "
        >
          <FaArrowLeft />
          <span>Volver a {scope === 'generales' ? 'Ramos Generales' : 'Ramo Personas'}</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#010139] mb-2">
            {title}
          </h1>
          <p className="text-gray-600">
            Selecciona una aseguradora
          </p>
        </div>

        {/* Guía de Requisitos */}
        <RequirementsGuide policyType={policyType} />

        {/* Lista de Aseguradoras */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        ) : insurers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              No hay aseguradoras disponibles
            </h3>
            <p className="text-gray-500 mb-6">
              {isMaster 
                ? 'Agrega aseguradoras para este ramo haciendo click en el botón "+"'
                : 'Aún no se han configurado aseguradoras para este ramo'}
            </p>
            {isMaster && (
              <p className="text-sm text-gray-400">
                💡 Las aseguradoras se cargan desde /api/insurers y se filtran por is_active=true
              </p>
            )}
          </div>
        ) : (
          <InsurersList
            scope={scope}
            policyType={policyType}
            insurers={insurers}
            isMaster={isMaster}
            onUpdate={loadData}
          />
        )}
      </div>
    </div>
  );
}
