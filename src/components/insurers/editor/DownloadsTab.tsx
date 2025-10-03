'use client';

import Link from 'next/link';

// This is a placeholder component.

interface DownloadsTabProps {
  downloads: any[]; // Replace with actual type
  insurerId: string;
}

export default function DownloadsTab({ downloads, insurerId }: DownloadsTabProps) {
  return (
    <div className="tab-pane">
      <h2 className="tab-title">Vínculos de Descargas</h2>
      <p className="mb-4">Esta sección muestra las descargas asociadas a la aseguradora. Para editarlas, vaya a la página de Descargas.</p>
      <Link href={`/downloads?insurer=${insurerId}`} className="btn-primary">
        Editar en Descargas
      </Link>
      
      {/* You can add a read-only list of downloads here if needed */}

      <style>{`
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; font-weight: 500; text-decoration: none; background: #010139; color: white; border: none; cursor: pointer; }
      `}</style>
    </div>
  );
}
