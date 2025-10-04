'use client';

import { FaDownload, FaExternalLinkAlt, FaCar, FaHeartbeat, FaStar } from 'react-icons/fa';
import Link from 'next/link';

interface DownloadsTabProps {
  userId: string;
}

export default function DownloadsTab({ userId }: DownloadsTabProps) {
  return (
    <div className="space-y-6">
      {/* Downloads Management */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaDownload className="text-[#8AAA19] text-2xl" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#010139]">Gestión de Descargas</h2>
            <p className="text-sm text-gray-600">Repositorio por Ramo, Tipo y Aseguradora</p>
          </div>
          <Link
            href="/downloads"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            <FaExternalLinkAlt />
            <span className="text-sm">Ver Descargas</span>
          </Link>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="font-semibold text-blue-800 mb-2">Características del Sistema:</p>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Navegación jerárquica: Ramo → Tipo → Aseguradora → Sección → Archivos</li>
              <li>• Badge &quot;Nuevo&quot; automático (24-48h desde creación)</li>
              <li>• Duplicado sincronizado entre secciones</li>
              <li>• Búsqueda global con tags</li>
              <li>• Requisitos no descargables como guía visual</li>
            </ul>
          </div>

          {/* Ramos */}
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/downloads/generales"
              className="group p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#8AAA19] hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                <FaCar className="text-3xl text-[#010139] group-hover:text-[#8AAA19] transition-colors" />
                <div>
                  <p className="font-bold text-gray-800 group-hover:text-[#8AAA19] transition-colors">Ramos Generales</p>
                  <p className="text-sm text-gray-600">Auto, Incendio, RC, Fianzas...</p>
                </div>
              </div>
            </Link>

            <Link
              href="/downloads/personas"
              className="group p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#8AAA19] hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                <FaHeartbeat className="text-3xl text-[#010139] group-hover:text-[#8AAA19] transition-colors" />
                <div>
                  <p className="font-bold text-gray-800 group-hover:text-[#8AAA19] transition-colors">Ramo Personas</p>
                  <p className="text-sm text-gray-600">Vida, Salud, AP, Colectivos</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Nota:</strong> Para gestionar secciones y archivos, navega a <Link href="/downloads" className="underline font-semibold">Descargas</Link> y accede como Master para ver las opciones de edición.
        </p>
      </div>
    </div>
  );
}
