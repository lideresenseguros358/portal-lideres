'use client';

import { DownloadFile } from '@/lib/downloads/types';
import FileActions from '@/components/shared/FileActions';
import BadgeNuevo from '@/components/shared/BadgeNuevo';
import { FaFilePdf } from 'react-icons/fa';

interface FilesListProps {
  files: DownloadFile[];
  isMaster: boolean;
  onUpdate: () => void;
}

export default function FilesList({ files, isMaster, onUpdate }: FilesListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <FaFilePdf className="text-6xl text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No hay archivos en esta sección</p>
        {isMaster && (
          <p className="text-sm text-gray-400 mt-2">
            Haz click en &quot;Subir Documento&quot; para agregar archivos
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <div
          key={file.id}
          className="
            bg-white rounded-lg shadow-md
            border border-gray-200
            hover:border-[#8AAA19] hover:shadow-lg
            transition-all duration-200
            p-4
          "
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <FaFilePdf className="text-3xl text-red-600 flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-[#010139] truncate">
                    {file.name}
                  </h3>
                  <BadgeNuevo show={file.show_new_badge || false} />
                </div>
                <p className="text-sm text-gray-500">
                  Subido por {file.created_by_name} • {new Date(file.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <FileActions
              fileId={file.id}
              fileName={file.name}
              fileUrl={file.file_url}
              isMaster={isMaster}
              onUpdate={onUpdate}
              deleteEndpoint="/api/downloads/files"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
