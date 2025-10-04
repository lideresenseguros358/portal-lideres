'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaChevronLeft, FaChevronRight, FaPlus, FaTimes } from 'react-icons/fa';
import { supabaseClient } from '@/lib/supabase/client';
import { actionGetEvents, type AgendaEvent } from '@/app/(app)/agenda/actions';
import { toast } from 'sonner';
import CalendarGrid from './CalendarGrid';
import EventDetailPanel from './EventDetailPanel';
import EventFormModal from './EventFormModal';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function AgendaMainClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'master' | 'broker' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  
  // Calendar state
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  
  // Selected day/event state
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<AgendaEvent | null>(null);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const client = supabaseClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await client
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserRole(profile.role as 'master' | 'broker');
          setUserId(user.id);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [router]);

  // Parse URL params (y, m, d)
  useEffect(() => {
    const year = searchParams?.get('y');
    const month = searchParams?.get('m');
    const day = searchParams?.get('d');

    if (year) setCurrentYear(parseInt(year));
    if (month) setCurrentMonth(parseInt(month));
    if (day) setSelectedDay(parseInt(day));
  }, [searchParams]);

  // Load events when month/year changes
  useEffect(() => {
    if (!userId || !userRole) return;
    loadEvents();
  }, [currentYear, currentMonth, userId, userRole]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPreviousMonth();
      } else if (e.key === 'ArrowRight') {
        goToNextMonth();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentYear, currentMonth]);

  const loadEvents = async () => {
    if (!userId || !userRole) return;
    
    setLoading(true);
    try {
      const result = await actionGetEvents({
        year: currentYear,
        month: currentMonth,
        userId,
        role: userRole,
      });

      if (result.ok) {
        setEvents(result.data || []);
      } else {
        toast.error('Error al cargar eventos');
      }
    } catch (error) {
      toast.error('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setSelectedEvent(null);
  };

  const handleEventClick = (event: AgendaEvent) => {
    setSelectedEvent(event);
  };

  const handleCloseDetail = () => {
    setSelectedDay(null);
    setSelectedEvent(null);
  };

  const handleEventCreated = () => {
    setShowEventForm(false);
    setEventToEdit(null);
    loadEvents();
  };

  const handleEventUpdated = () => {
    setSelectedEvent(null);
    loadEvents();
  };

  const handleEditEvent = (event: AgendaEvent) => {
    setEventToEdit(event);
    setShowEventForm(true);
  };

  const handleDuplicateEvent = (event: AgendaEvent) => {
    // Create a copy without the ID
    const duplicated = {
      ...event,
      id: undefined,
      title: `${event.title} (Copia)`,
    } as any;
    setEventToEdit(duplicated);
    setShowEventForm(true);
  };

  if (!userRole || !userId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
            📅 Agenda
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Calendario corporativo de eventos y actividades
          </p>
        </div>

        {userRole === 'master' && (
          <button
            onClick={() => setShowEventForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium"
          >
            <FaPlus />
            <span>Nuevo Evento</span>
          </button>
        )}
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-gray-100">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousMonth}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Mes anterior"
          >
            <FaChevronLeft className="text-[#010139] text-xl" />
          </button>

          <h2 className="text-xl md:text-2xl font-bold text-[#010139] text-center">
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </h2>

          <button
            onClick={goToNextMonth}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Mes siguiente"
          >
            <FaChevronRight className="text-[#010139] text-xl" />
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-2">
          Usa las flechas ← → del teclado para navegar
        </p>
      </div>

      {/* Calendar Grid - Full Width */}
      <div>
        <CalendarGrid
          year={currentYear}
          month={currentMonth}
          events={events}
          selectedDay={selectedDay}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
          loading={loading}
        />
      </div>

      {/* Event Detail Modal (All screens) */}
      {(selectedDay || selectedEvent) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white p-4 sm:p-6 border-b border-gray-200 rounded-t-2xl">
              <button
                onClick={handleCloseDetail}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaTimes className="text-gray-600" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <EventDetailPanel
                event={selectedEvent}
                day={selectedDay}
                month={currentMonth}
                year={currentYear}
                events={events}
                userRole={userRole}
                userId={userId}
                onClose={handleCloseDetail}
                onEventUpdated={handleEventUpdated}
                onEventClick={handleEventClick}
                onEditEvent={handleEditEvent}
                onDuplicateEvent={handleDuplicateEvent}
              />
            </div>
          </div>
        </div>
      )}

      {/* Event Form Modal (Master Only) */}
      {showEventForm && userRole === 'master' && (
        <EventFormModal
          userId={userId}
          onClose={() => {
            setShowEventForm(false);
            setEventToEdit(null);
          }}
          onSuccess={handleEventCreated}
          eventToEdit={eventToEdit}
        />
      )}
    </div>
  );
}
