"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import Link from "next/link";
import { actionCreateInsurer } from "../../insurers/actions";

export default function NewInsurerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert("El nombre es requerido");
      return;
    }
    
    setSaving(true);
    const result = await actionCreateInsurer({ name: name.trim(), active });
    setSaving(false);
    
    if (result.ok && result.data) {
      router.push(`/insurers/${(result.data as any).id}/edit`);
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen flex flex-col items-center">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/insurers" 
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <FaArrowLeft className="mr-2" />
          Volver a Aseguradoras
        </Link>
        
        <h1 className="text-3xl font-bold text-[#010139]">Nueva Aseguradora</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="Ej: ASSA Compañía de Seguros"
              required
            />
          </div>
          
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                Activa
              </span>
            </label>
            <p className="text-sm text-gray-500 mt-1">
              Las aseguradoras inactivas no aparecerán en los listados de selección
            </p>
          </div>
          
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#8aaa19] disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              <FaSave /> {saving ? "Creando..." : "Crear Aseguradora"}
            </button>
            
            <Link
              href="/insurers"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancelar
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
