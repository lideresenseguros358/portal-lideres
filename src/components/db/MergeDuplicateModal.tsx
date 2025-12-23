'use client';

import { FaExclamationTriangle, FaTimes, FaUser, FaIdCard, FaFileAlt } from 'react-icons/fa';
import { ClientWithPolicies } from '@/types/db';

interface MergeDuplicateModalProps {
  currentClient: {
    id: string;
    name: string;
    national_id: string;
    policies_count: number;
  };
  duplicateClient: ClientWithPolicies;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function MergeDuplicateModal({ 
  currentClient, 
  duplicateClient, 
  onConfirm, 
  onCancel,
  loading = false
}: MergeDuplicateModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaExclamationTriangle className="text-3xl" />
              <div>
                <h2 className="text-2xl font-bold">Cliente Duplicado Detectado</h2>
                <p className="text-sm text-orange-100 mt-1">
                  Se encontró un cliente con la misma cédula
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={loading}
              className="p-2 hover:bg-white/20 rounded-lg transition disabled:opacity-50"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Warning Message */}
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-900 font-semibold">
              ⚠️ Ya existe un cliente con la cédula <span className="font-mono font-bold">{duplicateClient.national_id}</span>
            </p>
            <p className="text-xs text-orange-700 mt-2">
              Para evitar duplicados, puedes fusionar ambos clientes. Todas las pólizas del cliente actual se moverán al cliente existente.
            </p>
          </div>

          {/* Cliente Actual */}
          <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FaUser className="text-gray-600" />
              Cliente Actual (Se eliminará)
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <FaUser className="text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">Nombre</p>
                  <p className="font-semibold text-gray-900">{currentClient.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FaIdCard className="text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">Cédula</p>
                  <p className="font-semibold text-gray-900">{currentClient.national_id}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FaFileAlt className="text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">Pólizas</p>
                  <p className="font-semibold text-gray-900">{currentClient.policies_count} pólizas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cliente Existente */}
          <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50">
            <h3 className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2">
              <FaUser className="text-green-600" />
              Cliente Existente (Se conservará)
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <FaUser className="text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-green-700">Nombre</p>
                  <p className="font-semibold text-green-900">{duplicateClient.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FaIdCard className="text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-green-700">Cédula</p>
                  <p className="font-semibold text-green-900">{duplicateClient.national_id}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FaFileAlt className="text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-green-700">Pólizas actuales</p>
                  <p className="font-semibold text-green-900">{duplicateClient.policies?.length || 0} pólizas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Resultado */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-bold text-blue-900 mb-2">📊 Resultado de la fusión:</h3>
            <p className="text-sm text-blue-800">
              El cliente <span className="font-bold">{duplicateClient.name}</span> tendrá un total de{' '}
              <span className="font-bold">{(duplicateClient.policies?.length || 0) + currentClient.policies_count} pólizas</span>
              {' '}después de la fusión.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-xl flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Fusionando...' : 'Sí, Fusionar Clientes'}
          </button>
        </div>
      </div>
    </div>
  );
}
