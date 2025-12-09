'use client';

import { useState, useEffect } from 'react';
import { FaUserPlus, FaEnvelope, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import RequestsList from './RequestsList';
import ApproveModal from './ApproveModal';
import InviteModal from './InviteModal';

export default function RequestsMainClient() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests?status=pending');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };


  const handleApprove = (request: any) => {
    setSelectedRequest(request);
    setShowApproveModal(true);
  };

  const handleReject = async (requestId: string) => {
    if (!confirm('¿Estás seguro de rechazar y ELIMINAR esta solicitud? Se borrará permanentemente de la base de datos.')) {
      return;
    }

    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Solicitud rechazada y eliminada');
        loadRequests();
      } else {
        toast.error(data.error || 'Error al rechazar solicitud');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Error al rechazar solicitud');
    }
  };

  const handleApproveSuccess = () => {
    setShowApproveModal(false);
    setSelectedRequest(null);
    loadRequests();
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-1">
                📋 Solicitudes de Usuarios
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Aprueba o rechaza nuevas solicitudes de acceso
              </p>
            </div>

            <button
              onClick={() => setShowInviteModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm sm:text-base"
            >
              <FaEnvelope />
              <span>Invitar Usuarios</span>
            </button>
          </div>

          {/* Status message */}
          {!loading && (
            <div className="bg-blue-50 border-l-4 border-blue-500 px-4 py-3 rounded-r-lg">
              <p className="text-sm sm:text-base text-blue-900">
                {requests.length === 0 ? (
                  <span>✅ No hay solicitudes pendientes</span>
                ) : (
                  <span>
                    📌 <strong>{requests.length}</strong> {requests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} de aprobación
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Lista de Solicitudes */}
        <RequestsList
          requests={requests}
          loading={loading}
          onApprove={handleApprove}
          onReject={handleReject}
          onRefresh={loadRequests}
        />

        {/* Modales */}
        {showApproveModal && selectedRequest && (
          <ApproveModal
            request={selectedRequest}
            onClose={() => {
              setShowApproveModal(false);
              setSelectedRequest(null);
            }}
            onSuccess={handleApproveSuccess}
          />
        )}

        {showInviteModal && (
          <InviteModal
            onClose={() => setShowInviteModal(false)}
          />
        )}
      </div>
    </div>
  );
}
