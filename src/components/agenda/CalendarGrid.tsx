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
      const hasEvents = events.some(event => {
        const eventDate = new Date(event.start_at);
        return eventDate.getDate() === day &&
               eventDate.getMonth() === month - 1 &&
               eventDate.getFullYear() === year;
      });
      
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

          const dayEvents = item.isCurrentMonth ? getEventsForDay(item.day) : [];
          const tooltipContent = dayEvents.length > 0 
            ? dayEvents.map(e => e.title).join('\n')
            : 'No hay eventos programados';

          return (
            <Tooltip.Provider key={index} delayDuration={200}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => item.isCurrentMonth && onDayClick(item.day)}
                    disabled={!item.isCurrentMonth}
                    className={`
                      relative aspect-square flex flex-col items-center justify-center
                      rounded-lg transition-all duration-200
                      ${item.isCurrentMonth 
                        ? 'bg-gray-50 hover:bg-gray-100 cursor-pointer text-gray-900' 
                        : 'bg-transparent text-gray-300 cursor-default'
                      }
                      ${isSelected ? 'ring-2 ring-[#8AAA19] bg-[#8AAA19] bg-opacity-10' : ''}
                      ${isTodayDate ? 'ring-2 ring-[#010139] font-bold' : ''}
                    `}
                  >
                    <span className={`text-sm md:text-base ${!item.isCurrentMonth ? 'opacity-40' : ''}`}>
                      {item.day}
                    </span>
                    
                    {item.hasEvents && item.isCurrentMonth && (
                      <div className="absolute bottom-1 flex gap-0.5">
                        <div className="w-1.5 h-1.5 bg-[#8AAA19] rounded-full"></div>
                      </div>
                    )}
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
