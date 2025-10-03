import { Suspense } from 'react';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { getSupabaseServer } from '@/lib/supabase/server';
import InsurerEditor from '@/components/insurers/InsurerEditor';
import { getInsurerById, getInsurerContacts, getInsurerMappingRules, getInsurerDownloads, getInsurerAssaCodes } from '@/lib/db/insurers';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getInitialData(insurerId: string) {
  const [insurer, contacts, mappingRules, downloads, assaCodes] = await Promise.all([
    getInsurerById(insurerId),
    getInsurerContacts(insurerId),
    getInsurerMappingRules(insurerId),
    getInsurerDownloads(insurerId),
    getInsurerAssaCodes(insurerId),
  ]);

  return {
    insurer,
    contacts,
    mappingRules,
    downloads,
    assaCodes,
  };
}

export default async function EditInsurerPage({ params }: PageProps) {
  const { id } = await params;
  const initialData = await getInitialData(id);

  if (!initialData.insurer) {
    return (
      <div className="p-6 text-center text-red-600">
        Aseguradora no encontrada.
      </div>
    );
  }

  return (
    <div className="insurers-editor-page">
      <div className="page-header">
        <Link href="/insurers" className="back-link">
          <FaArrowLeft /> Volver a Aseguradoras
        </Link>
        <h1 className="page-title">Editar Aseguradora</h1>
        <p className="page-subtitle">{(initialData.insurer as any)?.name}</p>
      </div>

      <Suspense fallback={<div>Cargando editor...</div>}>
        <InsurerEditor initialData={initialData} insurerId={id} insurer={initialData.insurer as any} />
      </Suspense>

      <style>{`
        .insurers-editor-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }
        .page-header {
          margin-bottom: 32px;
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #010139;
          text-decoration: none;
          font-weight: 500;
          margin-bottom: 16px;
        }
        .page-title {
          font-size: 32px;
          font-weight: 700;
          color: #010139;
        }
        .page-subtitle {
          color: #666;
          font-size: 18px;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}
