'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FaTrophy, FaSave, FaCalendarAlt, FaUndo } from 'react-icons/fa';

interface Contest {
  name: string;
  start_month: number;
  end_month: number;
  goal: number;
  goal_double?: number; // Meta para cupo doble
  enable_double_goal?: boolean; // Solo para ASSA
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function ContestsConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

  const [assa, setAssa] = useState<Contest>({
    name: 'Concurso ASSA',
    start_month: 1,
    end_month: 12,
    goal: 250000,
    goal_double: 400000,
    enable_double_goal: false, // Checkbox para habilitar
  });

  const [convivio, setConvivio] = useState<Contest>({
    name: 'Convivio LISSA',
    start_month: 1,
    end_month: 6,
    goal: 150000,
    goal_double: 250000, // Siempre activo
  });

  useEffect(() => {
    loadContests();
  }, []);

  const loadContests = async () => {
    try {
      const response = await fetch('/api/production/contests');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          if (data.data.assa) {
            setAssa({ 
              name: 'Concurso ASSA', 
              ...data.data.assa,
              enable_double_goal: data.data.assa.enable_double_goal || false,
              goal_double: data.data.assa.goal_double || 400000,
            });
          }
          if (data.data.convivio) {
            setConvivio({ 
              name: 'Convivio LISSA', 
              ...data.data.convivio,
              goal_double: data.data.convivio.goal_double || 250000,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading contests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/production/contests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assa: {
            start_month: assa.start_month,
            end_month: assa.end_month,
            goal: assa.goal,
            goal_double: assa.enable_double_goal ? assa.goal_double : null,
            enable_double_goal: assa.enable_double_goal,
          },
          convivio: {
            start_month: convivio.start_month,
            end_month: convivio.end_month,
            goal: convivio.goal,
            goal_double: convivio.goal_double,
          },
        }),
      });

      if (response.ok) {
        toast.success('Concursos actualizados exitosamente');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al actualizar concursos');
      }
    } catch (error) {
      toast.error('Error al guardar concursos');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (contest: 'assa' | 'convivio' | 'both') => {
    const confirmMessage = contest === 'both' 
      ? '¿Resetear ambos concursos? Esto iniciará un nuevo ciclo desde el mes de inicio configurado.'
      : `¿Resetear ${contest === 'assa' ? 'Concurso ASSA' : 'Convivio LISSA'}? Esto iniciará un nuevo ciclo desde el mes de inicio configurado.`;

    if (!confirm(confirmMessage)) return;

    setResetting(contest);
    try {
      const response = await fetch('/api/production/contests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contest }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Concurso(s) reseteado(s) exitosamente');
        loadContests(); // Recargar configuración
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al resetear concurso');
      }
    } catch (error) {
      toast.error('Error al resetear concurso');
    } finally {
      setResetting(null);
    }
  };

  const getIntervalPreview = (contest: Contest): string => {
    const start = MONTH_NAMES[contest.start_month - 1];
    const end = MONTH_NAMES[contest.end_month - 1];
    return `${start}–${end}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando concursos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Concurso ASSA */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaTrophy className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">{assa.name}</h2>
            <p className="text-sm text-gray-600">Período: {getIntervalPreview(assa)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Mes Inicio
            </label>
            <select
              value={assa.start_month}
              onChange={(e) => setAssa({ ...assa, start_month: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              {MONTH_NAMES.map((month, idx) => (
                <option key={idx} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Mes Fin
            </label>
            <select
              value={assa.end_month}
              onChange={(e) => setAssa({ ...assa, end_month: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              {MONTH_NAMES.map((month, idx) => (
                <option key={idx} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Meta Cupo Sencillo ($)
            </label>
            <input
              type="number"
              value={assa.goal === 0 ? '' : assa.goal}
              onChange={(e) => setAssa({ ...assa, goal: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-mono"
              min="0"
              step="1000"
              placeholder="0"
            />
          </div>
        </div>

        {/* Checkbox para habilitar doble meta */}
        <div className="mt-4 flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <input
            type="checkbox"
            id="assa-double"
            checked={assa.enable_double_goal}
            onChange={(e) => setAssa({ ...assa, enable_double_goal: e.target.checked })}
            className="w-5 h-5 text-[#8AAA19] focus:ring-[#8AAA19] rounded"
          />
          <label htmlFor="assa-double" className="font-semibold text-gray-700">
            Habilitar meta para Cupo Doble
          </label>
        </div>

        {/* Campo de meta doble (solo si está habilitado) */}
        {assa.enable_double_goal && (
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Meta Cupo Doble ($)
            </label>
            <input
              type="number"
              value={(assa.goal_double || 0) === 0 ? '' : (assa.goal_double || 0)}
              onChange={(e) => setAssa({ ...assa, goal_double: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-[#8AAA19] rounded-lg focus:border-[#6d8814] focus:outline-none font-mono"
              min="0"
              step="1000"
              placeholder="0"
            />
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <FaCalendarAlt className="inline mr-2" />
            Cuenta producción de <strong>{getIntervalPreview(assa)}</strong> con meta de <strong>${assa.goal.toLocaleString()}</strong>
            {assa.enable_double_goal && assa.goal_double && (
              <span> y meta doble de <strong>${assa.goal_double.toLocaleString()}</strong></span>
            )}
          </p>
        </div>

        <div className="mt-4">
          <button
            onClick={() => handleReset('assa')}
            disabled={resetting === 'assa'}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetting === 'assa' ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Reseteando...</span>
              </>
            ) : (
              <>
                <FaUndo />
                <span>Resetear Concurso ASSA</span>
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Inicia un nuevo ciclo sin borrar las cifras de producción
          </p>
        </div>
      </div>

      {/* Convivio LISSA */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaTrophy className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">{convivio.name}</h2>
            <p className="text-sm text-gray-600">Período: {getIntervalPreview(convivio)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Mes Inicio
            </label>
            <select
              value={convivio.start_month}
              onChange={(e) => setConvivio({ ...convivio, start_month: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              {MONTH_NAMES.map((month, idx) => (
                <option key={idx} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Mes Fin
            </label>
            <select
              value={convivio.end_month}
              onChange={(e) => setConvivio({ ...convivio, end_month: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            >
              {MONTH_NAMES.map((month, idx) => (
                <option key={idx} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Doble Meta (siempre activo) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Meta Cupo Sencillo ($)
            </label>
            <input
              type="number"
              value={convivio.goal === 0 ? '' : convivio.goal}
              onChange={(e) => setConvivio({ ...convivio, goal: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-mono"
              min="0"
              step="1000"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Meta Cupo Doble ($)
            </label>
            <input
              type="number"
              value={(convivio.goal_double || 0) === 0 ? '' : (convivio.goal_double || 0)}
              onChange={(e) => setConvivio({ ...convivio, goal_double: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border-2 border-[#8AAA19] rounded-lg focus:border-[#6d8814] focus:outline-none font-mono"
              min="0"
              step="1000"
              placeholder="0"
            />
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <FaCalendarAlt className="inline mr-2" />
            Cuenta producción de <strong>{getIntervalPreview(convivio)}</strong> con meta sencillo de <strong>${convivio.goal.toLocaleString()}</strong> y meta doble de <strong>${(convivio.goal_double || 0).toLocaleString()}</strong>
          </p>
        </div>

        <div className="mt-4">
          <button
            onClick={() => handleReset('convivio')}
            disabled={resetting === 'convivio'}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetting === 'convivio' ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Reseteando...</span>
              </>
            ) : (
              <>
                <FaUndo />
                <span>Resetear Convivio LISSA</span>
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Inicia un nuevo ciclo sin borrar las cifras de producción
          </p>
        </div>
      </div>

      {/* Botón Guardar */}
      <div className="sticky bottom-4 bg-white rounded-2xl shadow-2xl p-4 border-2 border-[#8AAA19]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <FaSave />
              <span>Guardar Concursos</span>
            </>
          )}
        </button>
      </div>

      {/* Nota importante */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Importante:</strong> Al guardar, las donas de los dashboards se actualizarán automáticamente con los nuevos períodos y metas.
        </p>
      </div>
    </div>
  );
}
