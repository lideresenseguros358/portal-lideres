'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaMapMarkerAlt, FaVideo, FaUsers, FaCalendarPlus, FaEdit, FaTrash, FaCheck, FaTimes as FaTimesCircle } from 'react-icons/fa';
import { AgendaEvent } from '@/app/(app)/agenda/actions';
import { actionRSVP, actionGetAttendees, actionDeleteEvent } from '@/app/(app)/agenda/actions';
import { toast } from 'sonner';
import { supabaseClient } from '@/lib/supabase/client';

interface EventDetailPanelProps {
  event: AgendaEvent | null;
  day: number | null;
  month: number;
  year: number;
  events: AgendaEvent[];
  userRole: 'master' | 'broker';
  userId: string;
  onClose: () => void;
  onEventUpdated: () => void;
  onEventClick: (event: AgendaEvent) => void;
  onEditEvent: (event: AgendaEvent) => void;
  onDuplicateEvent: (event: AgendaEvent) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function EventDetailPanel({ 
  event, 
  day, 
  month, 
  year, 
  events, 
  userRole, 
  userId,
  onClose, 
  onEventUpdated,
  onEventClick,
  onEditEvent,
  onDuplicateEvent
}: EventDetailPanelProps) {
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [showAttendees, setShowAttendees] = useState(false);
  const [loadingRSVP, setLoadingRSVP] = useState(false);

  // Get broker_id for broker role
  useEffect(() => {
    const loadBrokerId = async () => {
      if (userRole === 'broker') {
        const client = supabaseClient();
        const { data: profile } = await client
          .from('profiles')
          .select('broker_id')
          .eq('id', userId)
          .single();
        
        if (profile) {
          setBrokerId(profile.broker_id);
        }
      }
    };

    loadBrokerId();
  }, [userId, userRole]);

  // Load attendees if event is selected
  useEffect(() => {
    if (event && userRole === 'master') {
      loadAttendees();
    }
  }, [event, userRole]);

  const loadAttendees = async () => {
    if (!event) return;
    
    const result = await actionGetAttendees(event.id);
    if (result.ok) {
      setAttendees(result.data || []);
    }
  };

  const handleRSVP = async (status: 'going' | 'declined') => {
    if (!event || !brokerId) return;

    setLoadingRSVP(true);
    try {
      const result = await actionRSVP({
        eventId: event.id,
        brokerId,
        status,
      });

      if (result.ok) {
        toast.success(result.message);
        onEventUpdated();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Error al actualizar asistencia');
    } finally {
      setLoadingRSVP(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;

    if (!confirm('¿Estás seguro de cancelar este evento? Esta acción no se puede deshacer.')) {
      return;
    }

    const result = await actionDeleteEvent(event.id, userId);
    if (result.ok) {
      toast.success(result.message);
      onClose();
      onEventUpdated();
    } else {
      toast.error(result.error);
    }
  };

  const downloadICS = () => {
    if (!event) return;
    
    // Generate ICS content
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Portal Líderes//Agenda//ES
BEGIN:VEVENT
UID:${event.id}@lissa.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${new Date(event.start_at).toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${new Date(event.end_at).toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${event.title}
DESCRIPTION:${event.details || ''}
${event.modality === 'virtual' || event.modality === 'hibrida' ? `URL:${event.zoom_url}` : ''}
${event.location_name ? `LOCATION:${event.location_name}` : ''}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, '-')}.ics`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Evento descargado');
  };

  const formatDateTime = (dateString: string, isAllDay: boolean) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('es-PA', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    
    if (isAllDay) {
      return `${dateStr} - Todo el día`;
    }

    const timeStr = date.toLocaleTimeString('es-PA', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `${dateStr} a las ${timeStr}`;
  };

  // Get events for the selected day
  const dayEvents = events.filter(e => {
    if (!day) return false;
    const eventDate = new Date(e.start_at);
    return eventDate.getDate() === day && 
           eventDate.getMonth() + 1 === month &&
           eventDate.getFullYear() === year;
  });

  // If viewing a day (not a specific event)
  if (!event && day) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-[#010139]">
            Eventos del {day} de {MONTH_NAMES[month - 1]}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            <FaTimes />
          </button>
        </div>

        {dayEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No hay eventos programados para este día
          </p>
        ) : (
          <div className="space-y-3">
            {dayEvents.map(e => (
              <button
                key={e.id}
                onClick={() => onEventClick(e)}
                className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-transparent hover:border-[#8AAA19] transition-all"
              >
                <h4 className="font-bold text-[#010139] mb-1">{e.title}</h4>
                <p className="text-sm text-gray-600">
                  {formatDateTime(e.start_at, e.is_all_day)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {e.modality === 'virtual' && <FaVideo className="text-blue-500" />}
                  {e.modality === 'presencial' && <FaMapMarkerAlt className="text-red-500" />}
                  {e.modality === 'hibrida' && (
                    <>
                      <FaVideo className="text-blue-500" />
                      <FaMapMarkerAlt className="text-red-500" />
                    </>
                  )}
                  <span className="text-xs text-gray-500 capitalize">{e.modality}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If viewing a specific event
  if (event) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <h3 className="text-2xl font-bold text-[#010139] flex-1 pr-4">
            {event.title}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 p-2 flex-shrink-0"
          >
            <FaTimes />
          </button>
        </div>

        {/* Date/Time */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 font-semibold mb-1">📅 Fecha y Hora</p>
          <p className="text-gray-900">{formatDateTime(event.start_at, event.is_all_day)}</p>
          {!event.is_all_day && (
            <p className="text-sm text-gray-600 mt-1">
              Hasta: {formatDateTime(event.end_at, false)}
            </p>
          )}
        </div>

        {/* Description */}
        {event.details && (
          <div>
            <p className="text-sm text-gray-600 font-semibold mb-2">📝 Descripción</p>
            <p className="text-gray-700 whitespace-pre-wrap">{event.details}</p>
          </div>
        )}

        {/* Modality */}
        <div>
          <p className="text-sm text-gray-600 font-semibold mb-2">🎯 Modalidad</p>
          <div className="flex items-center gap-2">
            {event.modality === 'virtual' && <FaVideo className="text-blue-500" />}
            {event.modality === 'presencial' && <FaMapMarkerAlt className="text-red-500" />}
            {event.modality === 'hibrida' && (
              <>
                <FaVideo className="text-blue-500" />
                <FaMapMarkerAlt className="text-red-500" />
              </>
            )}
            <span className="capitalize font-medium">{event.modality}</span>
          </div>
        </div>

        {/* Zoom Link (Virtual/Híbrida) */}
        {(event.modality === 'virtual' || event.modality === 'hibrida') && event.zoom_url && (
          <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg">
            <p className="text-sm text-blue-800 font-semibold mb-2">📹 Reunión Virtual</p>
            <a
              href={event.zoom_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
            >
              <FaVideo />
              Unirme por Zoom
            </a>
            {event.zoom_code && (
              <p className="text-sm text-blue-700 mt-2">
                Código: <span className="font-mono font-bold">{event.zoom_code}</span>
              </p>
            )}
          </div>
        )}

        {/* Location (Presencial/Híbrida) */}
        {(event.modality === 'presencial' || event.modality === 'hibrida') && event.location_name && (
          <div className="bg-red-50 border-2 border-red-300 p-4 rounded-lg">
            <p className="text-sm text-red-800 font-semibold mb-2">📍 Ubicación</p>
            <p className="text-gray-900 mb-2">{event.location_name}</p>
            {event.maps_url && (
              <a
                href={event.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                <FaMapMarkerAlt />
                Ver en Google Maps
              </a>
            )}
          </div>
        )}

        {/* RSVP (Broker) */}
        {event.allow_rsvp && userRole === 'broker' && (
          <div className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] p-4 rounded-lg">
            <p className="text-white font-semibold mb-3">👥 Asistencia</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleRSVP('going')}
                disabled={loadingRSVP || event.user_rsvp_status === 'going'}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  event.user_rsvp_status === 'going'
                    ? 'bg-white text-[#8AAA19] shadow-lg'
                    : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                }`}
              >
                <FaCheck />
                {event.user_rsvp_status === 'going' ? 'Asistiré' : 'Asistir'}
              </button>
              <button
                onClick={() => handleRSVP('declined')}
                disabled={loadingRSVP || event.user_rsvp_status === 'declined'}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  event.user_rsvp_status === 'declined'
                    ? 'bg-white text-red-600 shadow-lg'
                    : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                }`}
              >
                <FaTimesCircle />
                {event.user_rsvp_status === 'declined' ? 'No asistiré' : 'Cancelar'}
              </button>
            </div>
          </div>
        )}

        {/* Attendee Count */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaUsers className="text-[#010139]" />
              <span className="font-semibold text-[#010139]">
                {event.attendee_count || 0} {event.attendee_count === 1 ? 'asistente' : 'asistentes'} confirmados
              </span>
            </div>
            {userRole === 'master' && event.attendee_count && event.attendee_count > 0 && (
              <button
                onClick={() => setShowAttendees(!showAttendees)}
                className="text-sm text-[#8AAA19] hover:text-[#6d8814] font-medium"
              >
                {showAttendees ? 'Ocultar' : 'Ver lista'}
              </button>
            )}
          </div>

          {/* Attendees List (Master Only) */}
          {userRole === 'master' && showAttendees && (
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
              {attendees.map((attendee: any) => (
                <div key={attendee.broker_id} className="flex items-center gap-2 text-sm">
                  <FaCheck className="text-green-500" />
                  <span className="text-gray-700">{attendee.brokers?.name || 'Broker'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
          {/* Download ICS */}
          <button
            onClick={downloadICS}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all font-medium"
          >
            <FaCalendarPlus />
            Añadir a mi calendario
          </button>

          {/* Master Actions */}
          {userRole === 'master' && (
            <>
              <div className="flex gap-3">
                <button
                  onClick={() => onEditEvent(event)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-all font-medium"
                >
                  <FaEdit />
                  Editar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all font-medium"
                >
                  <FaTrash />
                  Cancelar
                </button>
              </div>
              <button
                onClick={() => onDuplicateEvent(event)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-all font-medium"
              >
                <FaCalendarPlus />
                Duplicar Evento
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
