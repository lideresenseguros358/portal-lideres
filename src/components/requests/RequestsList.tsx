'use client';

import { FaUser, FaEnvelope, FaCalendar, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

interface RequestsListProps {
  requests: any[];
  loading: boolean;
  onApprove: (request: any) => void;
  onReject: (requestId: string) => void;
  onRefresh: () => void;
}

export default function RequestsList({
  requests,
  loading,
  onApprove,
  onReject
}: RequestsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
        <p className="ml-4 text-gray-600">Cargando solicitudes...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-12 text-center">
        <div className="text-gray-400 text-6xl mb-4">📭</div>
        <h3 className="text-xl font-bold text-gray-600 mb-2">No hay solicitudes pendientes</h3>
        <p className="text-gray-500">Cuando lleguen nuevas solicitudes aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#010139] mb-4">
        Solicitudes Pendientes ({requests.length})
      </h2>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#010139] text-white">
            <tr>
              <th className="px-6 py-4 text-left font-semibold">Usuario</th>
              <th className="px-6 py-4 text-left font-semibold">Email</th>
              <th className="px-6 py-4 text-left font-semibold">Datos Personales</th>
              <th className="px-6 py-4 text-left font-semibold">Datos Bancarios</th>
              <th className="px-6 py-4 text-left font-semibold">Fecha</th>
              <th className="px-6 py-4 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request, index) => (
              <tr 
                key={request.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#010139] rounded-full flex items-center justify-center text-white font-bold">
                      {request.nombre_completo?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{request.nombre_completo}</p>
                      <p className="text-xs text-gray-500">Cédula: {request.cedula}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <FaEnvelope className="text-gray-400" />
                    <span className="text-sm">{request.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm space-y-1">
                    <p className="text-gray-700">
                      <span className="font-semibold">Tel:</span> {request.telefono}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">F. Nac:</span>{' '}
                      {new Date(request.fecha_nacimiento).toLocaleDateString('es-PA')}
                    </p>
                    {request.licencia && (
                      <p className="text-gray-700">
                        <span className="font-semibold">Lic:</span> {request.licencia}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs space-y-1">
                    <p className="text-gray-700">
                      <span className="font-semibold">🏦 Banco:</span> {request.bank_route || 'N/A'}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-semibold">Tipo:</span> {request.tipo_cuenta === '03' ? 'Corriente' : request.tipo_cuenta === '04' ? 'Ahorro' : 'N/A'}
                    </p>
                    <p className="text-gray-700 font-mono">
                      <span className="font-semibold">Cuenta:</span> {request.bank_account_no || 'N/A'}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FaCalendar className="text-gray-400" />
                    <span>
                      {new Date(request.created_at).toLocaleDateString('es-PA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onApprove(request)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold text-xs shadow-md hover:shadow-lg"
                      title="Aprobar solicitud"
                    >
                      <FaCheckCircle />
                      <span>Aprobar</span>
                    </button>
                    <button
                      onClick={() => onReject(request.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold text-xs shadow-md hover:shadow-lg"
                      title="Rechazar y eliminar solicitud"
                    >
                      <FaTimesCircle />
                      <span>Rechazar</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
              <div className="w-12 h-12 bg-[#010139] rounded-full flex items-center justify-center text-white font-bold text-lg">
                {request.nombre_completo?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">{request.nombre_completo}</h3>
                <p className="text-sm text-gray-500">Cédula: {request.cedula}</p>
              </div>
            </div>

            {/* Datos */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <FaEnvelope className="text-gray-400" />
                <span className="text-gray-700">{request.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FaUser className="text-gray-400" />
                <span className="text-gray-700">{request.telefono}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FaCalendar className="text-gray-400" />
                <span className="text-gray-700">
                  {new Date(request.created_at).toLocaleDateString('es-PA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {/* Datos Bancarios */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <h5 className="text-xs font-semibold text-blue-900 mb-2">🏦 Cuenta para Comisiones</h5>
              <div className="space-y-1 text-xs">
                <p className="text-blue-800">
                  <span className="font-semibold">Banco:</span> {request.bank_route || 'N/A'}
                </p>
                <p className="text-blue-800">
                  <span className="font-semibold">Tipo:</span> {request.tipo_cuenta === '03' ? 'Corriente' : request.tipo_cuenta === '04' ? 'Ahorro' : 'N/A'}
                </p>
                <p className="text-blue-800 font-mono">
                  <span className="font-semibold">Cuenta:</span> {request.bank_account_no || 'N/A'}
                </p>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-3">
              <button
                onClick={() => onApprove(request)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-all font-semibold text-sm shadow-lg"
              >
                <FaCheckCircle className="text-base" />
                <span>Aprobar</span>
              </button>
              <button
                onClick={() => onReject(request.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-all font-semibold text-sm shadow-lg"
              >
                <FaTimesCircle className="text-base" />
                <span>Rechazar</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
