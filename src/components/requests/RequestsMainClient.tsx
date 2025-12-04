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
  const [stats, setStats] = useState({ pending: 0, approved: 0 });

  useEffect(() => {
    loadRequests();
    loadStats();
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

  const loadStats = async () => {
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        fetch('/api/requests?status=pending'),
        fetch('/api/requests?status=approved')
      ]);

      const [pending, approved] = await Promise.all([
        pendingRes.json(),
        approvedRes.json()
      ]);

      setStats({
        pending: pending.requests?.length || 0,
        approved: approved.requests?.length || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
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
        loadStats();
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
    loadStats();
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-2">
              📋 Solicitudes de Usuarios
            </h1>
            <p className="text-gray-600">
              Aprueba o rechaza nuevas solicitudes de acceso
            </p>
          </div>

          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            <FaEnvelope />
            <span>Invitar Usuarios</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-[#8AAA19] to-[#6d8814] rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90 mb-1">Pendientes</p>
                <p className="text-4xl font-bold">{stats.pending}</p>
              </div>
              <FaUserPlus className="text-4xl opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90 mb-1">Aprobadas</p>
                <p className="text-4xl font-bold">{stats.approved}</p>
              </div>
              <FaCheckCircle className="text-4xl opacity-80" />
            </div>
          </div>
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
