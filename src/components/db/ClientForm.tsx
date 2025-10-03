"use client";

import { useState } from "react";
import { FaTimes, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { actionCreateClientWithPolicy } from '@/app/(app)/db/actions';
import type { Tables } from "@/lib/supabase/client";

import { ClientWithPolicies } from '@/types/db';

type PolicyRow = Tables<'policies'>;

// The shape of the policy object when it's part of ClientWithPolicies
type PolicyWithInsurer = ClientWithPolicies['policies'][0];

interface ClientFormProps {
  client: ClientWithPolicies | null;
  onClose: () => void;
}

export default function ClientForm({ client, onClose }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: client?.name || "",
    national_id: client?.national_id || "",
    email: client?.email || "",
    phone: client?.phone || "",
    active: client?.active ?? true,
    policy_number: '', // Add policy number
  });

  const [policies, setPolicies] = useState<PolicyWithInsurer[]>(client?.policies || []);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (client) {
        // Update logic remains the same for now
        console.log('Update logic not implemented yet');
      } else {
        const clientData = {
          name: formData.name,
          national_id: formData.national_id,
          email: formData.email,
          phone: formData.phone,
          active: formData.active,
        };
        const policyData = { policy_number: formData.policy_number };
        const result = await actionCreateClientWithPolicy(clientData, policyData);
        if (!result.ok) {
          throw new Error(result.error);
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm("¿Está seguro de eliminar esta póliza?")) return;

    try {
      const response = await fetch(`/api/db/policies/${policyId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Error eliminando póliza");

      setPolicies(policies.filter(p => p.id !== policyId));
    } catch {
      alert("Error al eliminar la póliza");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            {client ? "Editar Cliente" : "Nuevo Cliente"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cédula/RUC
              </label>
              <input
                type="text"
                value={formData.national_id}
                onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Cliente Activo</span>
              </label>
            </div>
          </div>

          {/* Policies Section */}
          {!client && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Póliza Inicial</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Póliza *
                </label>
                <input
                  type="text"
                  required
                  value={formData.policy_number}
                  onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {client && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800">Pólizas</h3>
                <button
                  type="button"
                  onClick={() => setShowPolicyForm(true)}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1"
                >
                  <FaPlus size={12} /> Nueva Póliza
                </button>
              </div>

              {policies.length === 0 ? (
                <p className="text-gray-500 text-sm">No hay pólizas registradas</p>
              ) : (
                <div className="space-y-2">
                  {policies.map((policy) => (
                    <div key={policy.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium text-sm">{policy.policy_number}</div>
                        <div className="text-xs text-gray-500">{policy.ramo}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            // Find the original policy data to pass to the form, which expects a simple PolicyRow
                            const policyToEdit = client?.policies?.find(p => p.id === policy.id) || null;
                            setEditingPolicy(policyToEdit as PolicyRow | null);
                            setShowPolicyForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePolicy(policy.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="mt-6 pt-6 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#010139] text-white rounded-md hover:bg-[#8aaa19] disabled:opacity-50 transition-colors"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>

        {/* Policy Form Modal */}
        {showPolicyForm && client && (
          <PolicyForm
            clientId={client.id}
            policy={editingPolicy}
            onClose={() => {
              setShowPolicyForm(false);
              setEditingPolicy(null);
            }}
            onSave={(savedPolicy) => {
              const newPolicyForState: PolicyWithInsurer = {
                ...savedPolicy,
                insurers: null, // We don't have this info from the form
              };

              if (editingPolicy) {
                setPolicies(policies.map(p => (p.id === savedPolicy.id ? newPolicyForState : p)));
              } else {
                setPolicies([...policies, newPolicyForState]);
              }
              setShowPolicyForm(false);
              setEditingPolicy(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Sub-component for Policy Form
interface PolicyFormProps {
  clientId: string;
  policy: PolicyRow | null;
  onClose: () => void;
  onSave: (policy: PolicyRow) => void;
}

function PolicyForm({ clientId, policy, onClose, onSave }: PolicyFormProps) {
  const [formData, setFormData] = useState({
    policy_number: policy?.policy_number || "",
    ramo: policy?.ramo || "",
    insurer_id: policy?.insurer_id || "",
    start_date: policy?.start_date || "",
    renewal_date: policy?.renewal_date || "",
    status: policy?.status || "ACTIVA",
    percent_override: policy?.percent_override || null,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = policy 
        ? `/api/db/policies/${policy.id}`
        : "/api/db/policies";
      
      const method = policy ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          client_id: clientId,
        }),
      });

      if (!response.ok) throw new Error("Error guardando póliza");
      
      const savedPolicy = await response.json();
      onSave(savedPolicy);
    } catch {
      alert("Error al guardar la póliza");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-white rounded-lg">
      <div className="flex items-center justify-between p-6 border-b">
        <h3 className="text-lg font-semibold text-gray-800">
          {policy ? "Editar Póliza" : "Nueva Póliza"}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <FaTimes size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de Póliza *
            </label>
            <input
              type="text"
              required
              value={formData.policy_number}
              onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Add more fields as needed */}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-[#010139] text-white rounded-md hover:bg-[#8aaa19] disabled:opacity-50 transition-colors"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
