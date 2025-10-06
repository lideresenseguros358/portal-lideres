"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaTimes, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import { actionCreateClientWithPolicy } from '@/app/(app)/db/actions';
import type { Tables } from "@/lib/supabase/client";
import { toUppercasePayload, createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';

import { ClientWithPolicies } from '@/types/db';

type PolicyRow = Tables<'policies'>;

// The shape of the policy object when it's part of ClientWithPolicies
type PolicyWithInsurer = ClientWithPolicies['policies'][0];

interface ClientFormProps {
  client: ClientWithPolicies | null;
  onClose: () => void;
}

export default function ClientForm({ client, onClose }: ClientFormProps) {
  const router = useRouter();
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
        const payload = toUppercasePayload({
          name: formData.name,
          national_id: formData.national_id || null,
          email: formData.email || null,
          phone: formData.phone || null,
          active: formData.active,
        });

        const response = await fetch(`/api/db/clients/${client.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorJson = await response.json().catch(() => null);
          throw new Error(errorJson?.error || "Error actualizando cliente");
        }
      } else {
        const rawClientData = {
          name: formData.name,
          national_id: formData.national_id,
          email: formData.email,
          phone: formData.phone,
          active: formData.active,
        };
        const clientData = toUppercasePayload(rawClientData);
        const policyData = { policy_number: formData.policy_number.toUpperCase() };
        const result = await actionCreateClientWithPolicy(clientData, policyData);
        if (!result.ok) {
          throw new Error(result.error);
        }
      }
      router.refresh();
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
                onChange={createUppercaseHandler((e) => setFormData({ ...formData, name: e.target.value }))}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${uppercaseInputClass}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cédula/RUC
              </label>
              <input
                type="text"
                value={formData.national_id}
                onChange={createUppercaseHandler((e) => setFormData({ ...formData, national_id: e.target.value }))}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${uppercaseInputClass}`}
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
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, policy_number: e.target.value }))}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${uppercaseInputClass}`}
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

type PolicyFormState = {
  policy_number: string;
  ramo: string;
  insurer_id: string;
  start_date: string;
  renewal_date: string;
  status: "ACTIVA" | "CANCELADA" | "VENCIDA";
  percent_override: string;
};

function PolicyForm({ clientId, policy, onClose, onSave }: PolicyFormProps) {
  const [formData, setFormData] = useState<PolicyFormState>({
    policy_number: policy?.policy_number || "",
    ramo: policy?.ramo || "",
    insurer_id: policy?.insurer_id || "all",
    start_date: policy?.start_date || "",
    renewal_date: policy?.renewal_date || "",
    status: (policy?.status as PolicyFormState['status']) || "ACTIVA",
    percent_override: policy?.percent_override !== null && policy?.percent_override !== undefined
      ? String(policy.percent_override)
      : "",
  });
  const [loading, setLoading] = useState(false);
  const [insurers, setInsurers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/insurers', { cache: 'no-store' });
        if (!response.ok) throw new Error('Error cargando aseguradoras');
        const data = await response.json();
        if (mounted) {
          setInsurers(data || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error cargando aseguradoras');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (formData.insurer_id === 'all') {
        setError('Selecciona una aseguradora.');
        setLoading(false);
        return;
      }

      if (!formData.ramo.trim()) {
        setError('Ingresa el ramo de la póliza.');
        setLoading(false);
        return;
      }

      const url = policy 
        ? `/api/db/policies/${policy.id}`
        : "/api/db/policies";
      
      const method = policy ? "PUT" : "POST";

      const payload = {
        client_id: clientId,
        insurer_id: formData.insurer_id,
        policy_number: formData.policy_number.trim().toUpperCase(),
        ramo: formData.ramo.trim().toUpperCase(),
        start_date: formData.start_date || null,
        renewal_date: formData.renewal_date || null,
        status: formData.status,
        percent_override:
          formData.percent_override === ""
            ? null
            : Number(formData.percent_override),
      };

      if (payload.percent_override !== null && Number.isNaN(payload.percent_override)) {
        setError('El porcentaje debe ser un número válido.');
        setLoading(false);
        return;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Error guardando póliza");
      
      const savedPolicy = await response.json();
      onSave(savedPolicy);
    } catch {
      setError("Error al guardar la póliza");
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
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aseguradora *
            </label>
            <select
              required
              value={formData.insurer_id}
              onChange={(e) => setFormData({ ...formData, insurer_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all" disabled>
                Selecciona aseguradora
              </option>
              {insurers.map((insurer) => (
                <option key={insurer.id} value={insurer.id}>
                  {insurer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ramo *
            </label>
            <input
              type="text"
              required
              value={formData.ramo}
              onChange={(e) => setFormData({ ...formData, ramo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as PolicyFormState['status'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ACTIVA">ACTIVA</option>
              <option value="VENCIDA">VENCIDA</option>
              <option value="CANCELADA">CANCELADA</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha inicio
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha renovación
              </label>
              <input
                type="date"
                value={formData.renewal_date}
                onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              % override (opcional)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.percent_override}
              onChange={(e) => setFormData({ ...formData, percent_override: e.target.value })}
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
