'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheck } from 'react-icons/fa';
import { actionCreateEvent, actionUpdateEvent, actionGetBrokers, actionGetLissaConfig } from '@/app/(app)/agenda/actions';
import { toast } from 'sonner';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { toZonedTime, fromZonedTime, format as formatTZ } from 'date-fns-tz';
import { parseISO, format } from 'date-fns';

interface EventFormModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
  eventToEdit?: any;
  preselectedDate?: string; // Format: YYYY-MM-DD
}

export default function EventFormModal({ 
  userId, 
  onClose, 
  onSuccess, 
  eventToEdit,
  preselectedDate
}: EventFormModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [modality, setModality] = useState<'virtual' | 'presencial' | 'hibrida'>('virtual');
  const [zoomUrl, setZoomUrl] = useState('');
  const [zoomCode, setZoomCode] = useState('');
  const [useLissaLink, setUseLissaLink] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [allowRsvp, setAllowRsvp] = useState(true);
  const [audience, setAudience] = useState<'ALL' | 'SELECTED'>('ALL');
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
  const [multipleDates, setMultipleDates] = useState<string[]>([]);
  const [showMultipleDates, setShowMultipleDates] = useState(false);
  const [newDate, setNewDate] = useState('');
  
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!eventToEdit?.id;

  useEffect(() => {
    loadBrokers();
    if (eventToEdit) {
      loadEventData();
    } else {
      setDefaultDates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventToEdit]);

  const loadBrokers = async () => {
    setLoading(true);
    const result = await actionGetBrokers();
    if (result.ok) {
      setBrokers(result.data || []);
    }
    setLoading(false);
  };

  const setDefaultDates = () => {
    const now = new Date();
    let defaultDate: Date;
    
    // Use preselected date if provided, otherwise tomorrow
    if (preselectedDate) {
      defaultDate = new Date(preselectedDate + 'T12:00:00');
    } else {
      defaultDate = new Date(now);
      defaultDate.setDate(defaultDate.getDate() + 1);
    }
    
    const dateStr = defaultDate.toISOString().split('T')[0] || '';
    const timeStr = '14:00'; // 2 PM default
    
    setStartDate(dateStr);
    setStartTime(timeStr);
    setEndDate(dateStr);
    setEndTime('15:00'); // 3 PM default
  };

  const loadEventData = () => {
    if (!eventToEdit) return;
    
    setTitle(eventToEdit.title || '');
    setDetails(eventToEdit.details || '');
    
    // Convertir de UTC a timezone local
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Panama';
    const startDateUTC = parseISO(eventToEdit.start_at);
    const endDateUTC = parseISO(eventToEdit.end_at);
    
    const startLocal = toZonedTime(startDateUTC, userTimezone);
    const endLocal = toZonedTime(endDateUTC, userTimezone);
    
    setStartDate(format(startLocal, 'yyyy-MM-dd'));
    setStartTime(format(startLocal, 'HH:mm'));
    setEndDate(format(endLocal, 'yyyy-MM-dd'));
    setEndTime(format(endLocal, 'HH:mm'));
    setIsAllDay(eventToEdit.is_all_day || false);
    setModality(eventToEdit.modality || 'virtual');
    setZoomUrl(eventToEdit.zoom_url || '');
    setZoomCode(eventToEdit.zoom_code || '');
    setLocationName(eventToEdit.location_name || '');
    setMapsUrl(eventToEdit.maps_url || '');
    setAllowRsvp(eventToEdit.allow_rsvp ?? true);
    setAudience(eventToEdit.audience || 'ALL');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    if (!startDate) {
      toast.error('La fecha de inicio es requerida');
      return;
    }

    // Build datetime strings con timezone handling
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Panama';
    
    // Crear fechas en timezone local
    const startLocal = isAllDay 
      ? parseISO(`${startDate}T00:00:00`) 
      : parseISO(`${startDate}T${startTime}:00`);
    
    const endLocal = isAllDay
      ? parseISO(`${endDate}T23:59:59`)
      : parseISO(`${endDate}T${endTime}:00`);

    // Validar que fin > inicio
    if (endLocal <= startLocal) {
      toast.error('La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }

    // Convertir a UTC para guardar en BD
    const start_at = fromZonedTime(startLocal, userTimezone).toISOString();
    const end_at = fromZonedTime(endLocal, userTimezone).toISOString();

    // Validate Zoom URL for virtual/hibrida
    if ((modality === 'virtual' || modality === 'hibrida') && !zoomUrl.trim()) {
      toast.error('El link de Zoom es requerido para eventos virtuales o híbridos');
      return;
    }

    // Validate selected brokers if SELECTED audience
    if (audience === 'SELECTED' && selectedBrokers.length === 0) {
      toast.error('Debes seleccionar al menos un corredor para audiencia específica');
      return;
    }

    setSubmitting(true);

    try {
      let result;
      
      if (isEditing && eventToEdit?.id) {
        // Update existing event
        result = await actionUpdateEvent({
          id: eventToEdit.id,
          payload: {
            title: title.trim(),
            details: details.trim(),
            start_at,
            end_at,
            is_all_day: isAllDay,
            modality,
            zoom_url: (modality === 'virtual' || modality === 'hibrida') ? zoomUrl.trim() : null,
            zoom_code: zoomCode.trim() || null,
            location_name: (modality === 'presencial' || modality === 'hibrida') ? locationName.trim() : null,
            maps_url: mapsUrl.trim() || null,
            allow_rsvp: allowRsvp,
            audience,
            selected_brokers: audience === 'SELECTED' ? selectedBrokers : undefined,
          },
          userId,
        });
      } else if (showMultipleDates && multipleDates.length > 0) {
        // Create multiple events
        const results = await Promise.all(
          multipleDates.map(date => 
            actionCreateEvent({
              title: title.trim(),
              details: details.trim(),
              start_at: isAllDay ? `${date}T00:00:00` : `${date}T${startTime}:00`,
              end_at: isAllDay ? `${date}T23:59:59` : `${date}T${endTime}:00`,
              is_all_day: isAllDay,
              modality,
              zoom_url: (modality === 'virtual' || modality === 'hibrida') ? zoomUrl.trim() : undefined,
              zoom_code: zoomCode.trim() || undefined,
              location_name: (modality === 'presencial' || modality === 'hibrida') ? locationName.trim() : undefined,
              maps_url: mapsUrl.trim() || undefined,
              allow_rsvp: allowRsvp,
              audience,
              selected_brokers: audience === 'SELECTED' ? selectedBrokers : undefined,
              userId,
            })
          )
        );
        
        const successCount = results.filter(r => r.ok).length;
        result = {
          ok: successCount > 0,
          message: `${successCount} de ${multipleDates.length} eventos creados exitosamente`,
        };
      } else {
        // Create single event
        result = await actionCreateEvent({
          title: title.trim(),
          details: details.trim(),
          start_at,
          end_at,
          is_all_day: isAllDay,
          modality,
          zoom_url: (modality === 'virtual' || modality === 'hibrida') ? zoomUrl.trim() : undefined,
          zoom_code: zoomCode.trim() || undefined,
          location_name: (modality === 'presencial' || modality === 'hibrida') ? locationName.trim() : undefined,
          maps_url: mapsUrl.trim() || undefined,
          allow_rsvp: allowRsvp,
          audience,
          selected_brokers: audience === 'SELECTED' ? selectedBrokers : undefined,
          userId,
        });
      }

      if (result.ok) {
        toast.success(result.message || (isEditing ? 'Evento actualizado exitosamente' : 'Evento creado exitosamente'));
        onSuccess();
      } else {
        toast.error(result.error || (isEditing ? 'Error al actualizar evento' : 'Error al crear evento'));
      }
    } catch (error) {
      toast.error('Error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBroker = (brokerId: string) => {
    if (selectedBrokers.includes(brokerId)) {
      setSelectedBrokers(selectedBrokers.filter(id => id !== brokerId));
    } else {
      setSelectedBrokers([...selectedBrokers, brokerId]);
    }
  };

  // Auto-complete end date when start date changes
  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    // Auto-fill end date with same date if end date is empty or before start date
    if (!endDate || endDate < newStartDate) {
      setEndDate(newStartDate);
    }
  };

  // Auto-complete end time (1 hour later) when start time changes
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    
    if (!newStartTime) return;
    
    // Calculate end time (1 hour later)
    const timeParts = newStartTime.split(':');
    if (timeParts.length < 2) return;
    
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    
    if (isNaN(hours) || isNaN(minutes)) return;
    
    const endHour = hours + 1;
    const endMinutes = minutes;
    
    // Handle 24-hour wrap
    const finalEndHour = endHour >= 24 ? 23 : endHour;
    const finalEndMinutes = endHour >= 24 ? 59 : endMinutes;
    
    const autoEndTime = `${String(finalEndHour).padStart(2, '0')}:${String(finalEndMinutes).padStart(2, '0')}`;
    setEndTime(autoEndTime);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">
              {isEditing ? '✏️ Editar Evento' : '➕ Nuevo Evento'}
            </h2>
            <p className="text-white/80 text-sm mt-1">Configura la fecha, hora y participantes</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition" disabled={submitting} type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <form id="event-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
              Título del Evento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={createUppercaseHandler((e) => setTitle(e.target.value))}
              className={`w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors ${uppercaseInputClass}`}
              placeholder="JUNTA DE AGENCIA MENSUAL"
              required
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="w-full max-w-full overflow-hidden">
              <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
                Fecha de Inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full max-w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
                style={{ WebkitAppearance: 'none' }}
                required
              />
            </div>
            <div className="w-full max-w-full overflow-hidden">
              <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
                Hora de Inicio
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                disabled={isAllDay}
                className="w-full max-w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors disabled:bg-gray-100"
                style={{ WebkitAppearance: 'none' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="w-full max-w-full overflow-hidden">
              <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
                Fecha de Fin <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full max-w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
                style={{ WebkitAppearance: 'none' }}
                required
              />
            </div>
            <div className="w-full max-w-full overflow-hidden">
              <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
                Hora de Fin
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isAllDay}
                className="w-full max-w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors disabled:bg-gray-100"
                style={{ WebkitAppearance: 'none' }}
              />
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
            />
            <label htmlFor="allDay" className="text-sm font-medium text-gray-700">
              Evento de todo el día
            </label>
          </div>

          {/* Multiple Dates (Only for new events) */}
          {!isEditing && (
            <div className="bg-purple-50 border-2 border-purple-300 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="multipleDates"
                  checked={showMultipleDates}
                  onChange={(e) => {
                    setShowMultipleDates(e.target.checked);
                    if (!e.target.checked) setMultipleDates([]);
                  }}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-600"
                />
                <label htmlFor="multipleDates" className="text-sm font-medium text-purple-900">
                  📅 Crear evento en múltiples fechas
                </label>
              </div>
              
              {showMultipleDates && (
                <div className="space-y-3">
                  <p className="text-xs text-purple-700">
                    Agrega las fechas en las que quieres crear este evento.
                  </p>
                  
                  {/* Input + Botón Agregar */}
                  <div className="flex gap-2">
                    <div className="flex-1 w-full max-w-full overflow-hidden">
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full max-w-full px-4 py-2.5 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                        style={{ WebkitAppearance: 'none' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (newDate && !multipleDates.includes(newDate)) {
                          const updatedDates = [...multipleDates, newDate].sort();
                          setMultipleDates(updatedDates);
                          setNewDate('');
                        } else if (multipleDates.includes(newDate)) {
                          toast.error('Esta fecha ya fue agregada');
                        }
                      }}
                      disabled={!newDate}
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                    >
                      + Agregar
                    </button>
                  </div>

                  {/* Lista de fechas agregadas */}
                  {multipleDates.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-purple-700 font-semibold">
                        ✅ Se crearán {multipleDates.length} eventos independientes:
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-3 rounded-lg border-2 border-purple-200">
                        {multipleDates.map((date) => (
                          <div
                            key={date}
                            className="flex items-center justify-between p-2 bg-purple-50 rounded hover:bg-purple-100 transition-colors"
                          >
                            <span className="text-sm font-medium text-purple-900">
                              {new Date(date + 'T00:00:00').toLocaleDateString('es-PA', { 
                                weekday: 'short', 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => setMultipleDates(multipleDates.filter(d => d !== date))}
                              className="text-red-600 hover:text-red-800 hover:bg-red-100 rounded p-1 transition-colors"
                              title="Eliminar fecha"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
              Descripción
            </label>
            <textarea
              value={details}
              onChange={createUppercaseHandler((e) => setDetails(e.target.value))}
              rows={4}
              className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors resize-none ${uppercaseInputClass}`}
              placeholder="DETALLES ADICIONALES DEL EVENTO..."
            />
          </div>

          {/* Modality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Modalidad <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['virtual', 'presencial', 'hibrida'] as const).map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => setModality(mod)}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    modality === mod
                      ? 'bg-[#8AAA19] text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {mod === 'virtual' && '📹'} {mod === 'presencial' && '📍'} {mod === 'hibrida' && '🔀'}
                  {' '}
                  <span className="capitalize">{mod}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Zoom Fields (Virtual/Híbrida) */}
          {(modality === 'virtual' || modality === 'hibrida') && (
            <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg space-y-4">
              <h4 className="font-semibold text-blue-900">📹 Información de Reunión Virtual</h4>
              
              {/* Checkbox LINK LISSA */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-blue-200">
                <input
                  type="checkbox"
                  id="useLissaLink"
                  checked={useLissaLink}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    setUseLissaLink(checked);
                    if (checked) {
                      // Cargar desde configuración guardada
                      const result = await actionGetLissaConfig();
                      if (result.ok && result.data) {
                        setZoomUrl(result.data.lissa_recurring_link || '');
                        setZoomCode(result.data.lissa_meeting_code || '');
                        if (!result.data.lissa_recurring_link) {
                          toast.info('No hay configuración LISSA guardada. Confígurala en Configuración > Agenda');
                        }
                      }
                    } else {
                      setZoomUrl('');
                      setZoomCode('');
                    }
                  }}
                  className="w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
                />
                <label htmlFor="useLissaLink" className="text-sm font-semibold text-blue-900 cursor-pointer">
                  🎯 Usar LINK LISSA Recurrente
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Link de Reunión Virtual <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={zoomUrl}
                  onChange={(e) => {
                    setZoomUrl(e.target.value);
                    if (useLissaLink) setUseLissaLink(false); // Desmarcar si edita manualmente
                  }}
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="https://zoom.us/j/123456789 o https://meet.lissa.pa/..."
                  required={modality === 'virtual' || modality === 'hibrida'}
                />
                {useLissaLink && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    ✅ Link LISSA autocompletado desde configuración
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Código de Reunión (opcional)
                </label>
                <input
                  type="text"
                  value={zoomCode}
                  onChange={createUppercaseHandler((e) => {
                    setZoomCode(e.target.value);
                    if (useLissaLink) setUseLissaLink(false); // Desmarcar si edita manualmente
                  })}
                  className={`w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors ${uppercaseInputClass}`}
                  placeholder="SALA-123 o 123 456 789"
                />
              </div>
            </div>
          )}

          {/* Location Fields (Presencial/Híbrida) */}
          {(modality === 'presencial' || modality === 'hibrida') && (
            <div className="bg-red-50 border-2 border-red-300 p-4 rounded-lg space-y-4">
              <h4 className="font-semibold text-red-900">📍 Información de Ubicación</h4>
              
              <div>
                <label className="block text-sm font-medium text-red-900 mb-2">
                  Nombre del Lugar
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={createUppercaseHandler((e) => setLocationName(e.target.value))}
                  className={`w-full px-4 py-3 border-2 border-red-300 rounded-lg focus:border-red-500 focus:outline-none transition-colors ${uppercaseInputClass}`}
                  placeholder="OFICINA PRINCIPAL, SALA DE CONFERENCIAS"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-red-900 mb-2">
                  Link de Google Maps (opcional)
                </label>
                <input
                  type="url"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-red-300 rounded-lg focus:border-red-500 focus:outline-none transition-colors"
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>
          )}

          {/* Allow RSVP */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allowRsvp"
              checked={allowRsvp}
              onChange={(e) => setAllowRsvp(e.target.checked)}
              className="w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
            />
            <label htmlFor="allowRsvp" className="text-sm font-medium text-gray-700">
              Permitir que los corredores confirmen asistencia
            </label>
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Audiencia <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAudience('ALL')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  audience === 'ALL'
                    ? 'bg-[#8AAA19] text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                👥 Todos los Corredores
              </button>
              <button
                type="button"
                onClick={() => setAudience('SELECTED')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  audience === 'SELECTED'
                    ? 'bg-[#8AAA19] text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🎯 Corredores Específicos
              </button>
            </div>
          </div>

          {/* Broker Selection (if SELECTED) */}
          {audience === 'SELECTED' && (
            <div className="bg-gray-50 border-2 border-gray-300 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">
                Seleccionar Corredores ({selectedBrokers.length} seleccionados)
              </h4>
              
              {loading ? (
                <p className="text-gray-500 text-center py-4">Cargando corredores...</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {brokers.map((broker) => (
                    <label
                      key={broker.id}
                      className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBrokers.includes(broker.id)}
                        onChange={() => toggleBroker(broker.id)}
                        className="w-5 h-5 text-[#8AAA19] border-gray-300 rounded focus:ring-[#8AAA19]"
                      />
                      <span className="text-sm font-medium text-gray-700">{broker.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="event-form"
            disabled={submitting}
            className="px-4 py-2 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                <span>{isEditing ? 'Actualizando...' : 'Creando...'}</span>
              </>
            ) : (
              <>
                <FaCheck />
                <span>{isEditing ? 'Actualizar' : 'Crear'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
