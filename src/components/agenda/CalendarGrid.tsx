'use client';

import { AgendaEvent } from '@/app/(app)/agenda/actions';
import { useMemo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useSwipeable } from 'react-swipeable';

interface CalendarGridProps {
  year: number;
  month: number;
  events: AgendaEvent[];
  selectedDay: number | null;
  onDayClick: (day: number) => void;
  onEventClick: (event: AgendaEvent) => void;
  loading: boolean;
  onSwipeLeft?: () => void;  // Mes siguiente
  onSwipeRight?: () => void; // Mes anterior
}

export default function CalendarGrid({ 
  year, 
  month, 
  events, 
  selectedDay, 
  onDayClick, 
  loading,
  onSwipeLeft,
  onSwipeRight
}: CalendarGridProps) {
  // Swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => onSwipeLeft?.(),
    onSwipedRight: () => onSwipeRight?.(),
    preventScrollOnSwipe: false,
    trackMouse: false, // Solo touch, no mouse drag
    trackTouch: true,
    delta: 50, // Mínimo 50px para considerar un swipe
  });
  const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  // Get events for a specific day
  const getEventsForDay = (day: number) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_at);
      return eventDate.getDate() === day &&
             eventDate.getMonth() === month - 1 &&
             eventDate.getFullYear() === year;
    });
  };

  // Check if a day is within a multi-day event range
  const isDateInEventRange = (date: Date, event: AgendaEvent) => {
    const eventStart = new Date(event.start_at);
    const eventEnd = new Date(event.end_at);
    
    // Normalizar fechas a medianoche para comparación
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const normalizedStart = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
    const normalizedEnd = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
    
    return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
  };

  // Get all events that span across a specific day (including multi-day events)
  const getEventsSpanningDay = (date: Date) => {
    return events.filter(event => isDateInEventRange(date, event));
  };

  // Check if there's an "oficina_cerrada" event on this day
  const isOficinaCerrada = (date: Date) => {
    return events.some(event => 
      event.event_type === 'oficina_cerrada' && isDateInEventRange(date, event)
    );
  };

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    
    // Get day of week (0 = Sunday, 1 = Monday, etc)
    let firstDayOfWeek = firstDayOfMonth.getDay();
    // Convert to Monday = 0, Sunday = 6
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const days: Array<{
      day: number;
      isCurrentMonth: boolean;
      hasEvents: boolean;
      date: Date;
    }> = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(year, month - 2, day);
      days.push({ 
        day, 
        isCurrentMonth: false, 
        hasEvents: false,
        date 
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      // Verificar si tiene eventos (incluyendo multi-día)
      const hasEvents = getEventsSpanningDay(date).length > 0;
      
      days.push({ 
        day, 
        isCurrentMonth: true, 
        hasEvents,
        date 
      });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month, day);
      days.push({ 
        day, 
        isCurrentMonth: false, 
        hasEvents: false,
        date 
      });
    }

    return days;
  }, [year, month, events]);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-gray-100">
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      {...swipeHandlers}
      className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-gray-100 touch-pan-y"
    >
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 md:gap-2 mb-3">
        {DAYS.map(day => (
          <div 
            key={day} 
            className="text-center text-xs md:text-sm font-bold text-gray-600 uppercase tracking-wide py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {calendarDays.map((item, index) => {
          const isSelected = item.isCurrentMonth && item.day === selectedDay;
          const isTodayDate = isToday(item.date);

          // Obtener eventos del día (incluyendo multi-día)
          const dayEvents = item.isCurrentMonth ? getEventsSpanningDay(item.date) : [];
          const isCerrada = item.isCurrentMonth && isOficinaCerrada(item.date);
          
          const tooltipContent = isCerrada
            ? 'OFICINA CERRADA'
            : dayEvents.length > 0 
            ? dayEvents.map(e => e.title).join('\n')
            : 'No hay eventos programados';

          return (
            <Tooltip.Provider key={index} delayDuration={200}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => item.isCurrentMonth && !isCerrada && onDayClick(item.day)}
                    disabled={!item.isCurrentMonth || isCerrada}
                    className={`
                      relative aspect-square flex flex-col items-center justify-center
                      rounded-xl transition-all duration-300 transform
                      ${!item.isCurrentMonth 
                        ? 'bg-transparent text-gray-300 cursor-default' 
                        : isCerrada
                        ? 'bg-gray-400 text-white font-bold shadow-md cursor-not-allowed opacity-70'
                        : isTodayDate
                        ? 'bg-gradient-to-br from-[#010139] via-[#020270] to-[#010139] text-white font-bold shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer animate-pulse'
                        : item.hasEvents
                        ? 'bg-gradient-to-br from-[#8AAA19] via-[#7a9916] to-[#6d8814] text-white font-semibold shadow-md hover:shadow-lg hover:scale-105 cursor-pointer'
                        : 'bg-gray-50 hover:bg-gradient-to-br hover:from-gray-100 hover:to-gray-200 hover:shadow-md hover:scale-105 cursor-pointer text-gray-900'
                      }
                      ${isSelected && !isTodayDate && !item.hasEvents && !isCerrada ? 'ring-4 ring-[#8AAA19] ring-opacity-50 bg-[#8AAA19] bg-opacity-20 scale-105' : ''}
                      ${isSelected && item.hasEvents && !isCerrada ? 'ring-4 ring-yellow-400 ring-opacity-70 scale-110 shadow-xl' : ''}
                      ${isSelected && isTodayDate ? 'ring-4 ring-yellow-400 ring-opacity-70 scale-110' : ''}
                    `}
                  >
                    {/* Día del mes */}
                    <span className={`text-sm md:text-base font-bold relative z-10 ${!item.isCurrentMonth ? 'opacity-40' : ''}`}>
                      {item.day}
                    </span>
                    
                    {/* Títulos de eventos (SOLO en Desktop - hidden en mobile) */}
                    {item.hasEvents && item.isCurrentMonth && dayEvents.length > 0 && (
                      <div className="hidden lg:flex flex-col gap-0.5 mt-1 w-full px-1 max-h-16 overflow-hidden">
                        {dayEvents.slice(0, 2).map((evt) => (
                          <div
                            key={evt.id}
                            className={`text-[9px] leading-tight font-medium truncate rounded px-1 py-0.5 ${
                              isTodayDate 
                                ? 'bg-yellow-400 bg-opacity-30 text-[#010139]' 
                                : 'bg-white bg-opacity-40 text-gray-900'
                            }`}
                            title={evt.title}
                          >
                            {evt.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className={`text-[8px] font-bold text-center ${
                            isTodayDate ? 'text-yellow-200' : 'text-white'
                          }`}>
                            +{dayEvents.length - 2} más
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Badge de cantidad de eventos */}
                    {item.hasEvents && item.isCurrentMonth && dayEvents.length > 0 && (
                      <div className="absolute top-0.5 right-0.5 flex items-center justify-center">
                        <div className={`
                          w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md
                          ${isTodayDate 
                            ? 'bg-yellow-400 text-[#010139]' 
                            : 'bg-white text-[#8AAA19]'
                          }
                        `}>
                          {dayEvents.length}
                        </div>
                      </div>
                    )}
                    
                    {/* Emoji decorativo para día actual */}
                    {isTodayDate && (
                      <div className="absolute -top-1 -left-1 text-xl animate-bounce">
                        ⭐
                      </div>
                    )}
                    
                    {/* Indicador de eventos para mobile (SOLO en Mobile - hidden en desktop) */}
                    {item.hasEvents && item.isCurrentMonth && !isTodayDate && (
                      <div className="absolute -bottom-0.5 -right-0.5 lg:hidden">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 border border-white shadow-sm"></div>
                      </div>
                    )}
                    
                    {/* Efecto de brillo en hover */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/0 to-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </button>
                </Tooltip.Trigger>
                {item.isCurrentMonth && (
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-[#010139] text-white px-3 py-2 rounded-lg text-sm max-w-xs z-50 shadow-xl"
                      sideOffset={5}
                    >
                      <div className="whitespace-pre-line">{tooltipContent}</div>
                      <Tooltip.Arrow className="fill-[#010139]" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                )}
              </Tooltip.Root>
            </Tooltip.Provider>
          );
        })}
      </div>

    </div>
  );
}
