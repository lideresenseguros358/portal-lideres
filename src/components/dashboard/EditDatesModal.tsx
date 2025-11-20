'use client';

import { useState } from 'react';
import { FaTimes, FaSave, FaCalendarAlt, FaNewspaper } from 'react-icons/fa';
import type { ImportantDatesData } from '@/lib/important-dates';

interface EditDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDates: ImportantDatesData;
  onSave: (dates: ImportantDatesData) => Promise<void>;
}

export default function EditDatesModal({ isOpen, onClose, currentDates, onSave }: EditDatesModalProps) {
  const [dates, setDates] = useState<ImportantDatesData>(currentDates);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(dates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const monthName = new Date(dates.year, dates.month - 1).toLocaleString('es', { month: 'long' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] my-4 sm:my-8 animate-fade-in overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#010139] to-[#020250] flex-shrink-0">
          <div className="flex items-center gap-3 text-white">
            <FaCalendarAlt className="text-2xl" />
            <div>
              <h2 className="text-xl font-bold">Configuración de Fechas</h2>
              <p className="text-sm text-gray-300 mt-0.5">Mes de {monthName} {dates.year}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors p-1"
            disabled={isSaving}
          >
            <FaTimes className="text-2xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Sección de Fechas */}
          <div>
            <h4 className="text-base font-semibold text-[#010139] mb-4 flex items-center gap-2">
              <FaCalendarAlt className="text-[#8AAA19]" />
              Fechas Importantes del Mes
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="vidaConCancelacion" className="block text-sm font-semibold text-[#010139] mb-2">
                  📋 Último día trámites vida con cancelación
                </label>
                <input
                  type="number"
                  id="vidaConCancelacion"
                  min="1"
                  max="31"
                  value={dates.vidaConCancelacionDay || ''}
                  onChange={(e) => setDates({ ...dates, vidaConCancelacionDay: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="viaRegular" className="block text-sm font-semibold text-[#010139] mb-2">
                  📄 Último día trámites vía regular
                </label>
                <input
                  type="number"
                  id="viaRegular"
                  min="1"
                  max="31"
                  value={dates.viaRegularDay || ''}
                  onChange={(e) => setDates({ ...dates, viaRegularDay: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="apadea1" className="block text-sm font-semibold text-[#010139] mb-2">
                  📅 Primera fecha APADEA
                </label>
                <input
                  type="number"
                  id="apadea1"
                  min="1"
                  max="31"
                  value={dates.apadeaDate1 || ''}
                  onChange={(e) => setDates({ ...dates, apadeaDate1: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="apadea2" className="block text-sm font-semibold text-[#010139] mb-2">
                  📅 Segunda fecha APADEA
                </label>
                <input
                  type="number"
                  id="apadea2"
                  min="1"
                  max="31"
                  value={dates.apadeaDate2 || ''}
                  onChange={(e) => setDates({ ...dates, apadeaDate2: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label htmlFor="cierre" className="block text-sm font-semibold text-[#010139] mb-2">
                  Día de cierre de mes
                </label>
                <input
                  type="number"
                  id="cierre"
                  min="1"
                  max="31"
                  value={dates.cierreMesDay || ''}
                  onChange={(e) => setDates({ ...dates, cierreMesDay: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          {/* Sección de Noticias */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-base font-semibold text-[#010139] mb-4 flex items-center gap-2">
              <FaNewspaper className="text-[#8AAA19]" />
              Noticias y Anuncios
            </h4>
            <div>
              <label htmlFor="news" className="block text-sm font-semibold text-[#010139] mb-2">
                Mensaje para los brokers
              </label>
              <textarea
                id="news"
                rows={4}
                value={dates.newsText}
                onChange={(e) => setDates({ ...dates, newsText: e.target.value })}
                placeholder="Escribe las noticias o anuncios importantes del mes..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none resize-none"
                disabled={isSaving}
              />
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="newsActive"
                  checked={dates.newsActive}
                  onChange={(e) => setDates({ ...dates, newsActive: e.target.checked })}
                  className="w-5 h-5 cursor-pointer"
                  disabled={isSaving}
                />
                <span className="text-sm font-medium text-gray-700">
                  Mostrar noticias en el dashboard
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none px-6 py-3 rounded-lg bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white font-bold hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <FaSave />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
