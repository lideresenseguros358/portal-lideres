'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { 
  addDays, 
  addMonths,
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  isSameMonth,
  isToday
} from 'date-fns';
import { es } from 'date-fns/locale';
import { FaChevronLeft, FaChevronRight, FaExternalLinkAlt } from 'react-icons/fa';

interface MiniCalendarAgendaProps {
  events: {
    date: string;
    title: string;
    event_type: string;
    end_at: string;
  }[];
}

const DAYS_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const normalize = (value: string) => format(new Date(value), 'yyyy-MM-dd');

export default function MiniCalendarAgenda({ events }: MiniCalendarAgendaProps) {
  const router = useRouter();
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Get next upcoming event
  const nextEvent = useMemo(() => {
    const now = new Date();
    const futureEvents = events
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return futureEvents[0] || null;
  }, [events]);

  // Crear mapa de eventos considerando rangos multi-día
  const eventMap = useMemo(() => {
    const map = new Map<string, { title: string; isCerrada: boolean; isVirtual: boolean }[]>();
    
    events.forEach((item) => {
      const startDate = new Date(item.date);
      const endDate = new Date(item.end_at);
      const isCerrada = item.event_type === 'oficina_cerrada';
      const isVirtual = item.event_type === 'oficina_virtual';
      
      // Iterar sobre todos los días del rango del evento
      let currentDate = new Date(startDate);
      currentDate.setHours(0, 0, 0, 0);
      const normalizedEnd = new Date(endDate);
      normalizedEnd.setHours(0, 0, 0, 0);
      
      while (currentDate <= normalizedEnd) {
        const key = format(currentDate, 'yyyy-MM-dd');
        const existing = map.get(key) || [];
        existing.push({ title: item.title, isCerrada, isVirtual });
        map.set(key, existing);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return map;
  }, [events]);

  // Get full month view including partial weeks
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const days = [];
  let currentDay = calendarStart;
  while (currentDay <= calendarEnd) {
    days.push(currentDay);
    currentDay = addDays(currentDay, 1);
  }

  // Handle month navigation
  const goToPreviousMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReferenceDate(prev => addMonths(prev, -1));
  };

  const goToNextMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReferenceDate(prev => addMonths(prev, 1));
  };

  // Handle touch swipe for mobile
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]?.clientX ?? null);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientX ?? null);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNextMonth();
    } else if (isRightSwipe) {
      goToPreviousMonth();
    }
  };

  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSameMonth(day, referenceDate)) return;
    
    const year = day.getFullYear();
    const month = day.getMonth() + 1;
    const dayNum = day.getDate();
    router.push(`/agenda?y=${year}&m=${month}&d=${dayNum}`);
  };

  const handleViewMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth() + 1;
    router.push(`/agenda?y=${year}&m=${month}`);
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="flex w-full flex-col rounded-2xl bg-white shadow-[0_18px_40px_rgba(1,1,57,0.12)] h-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
          aria-label="Mes anterior"
        >
          <FaChevronLeft className="text-[#010139] text-sm" />
        </button>
        <div className="text-center flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">Agenda</p>
          <p className="text-base sm:text-lg font-semibold text-[#010139] capitalize">
            {format(referenceDate, 'MMMM yyyy', { locale: es })}
          </p>
        </div>
        <button
          type="button"
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
          aria-label="Mes siguiente"
        >
          <FaChevronRight className="text-[#010139] text-sm" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 px-5 pb-2 flex-1 overflow-hidden">
        {DAYS_LABELS.map((label) => (
          <span key={label} className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#8a8a8a] pb-1">
            {label}
          </span>
        ))}
        {days.map((day) => {
          const key = normalize(day.toISOString());
          const dayEventsData = eventMap.get(key) || [];
          const hasEvent = dayEventsData.length > 0;
          const isCerrada = dayEventsData.some(e => e.isCerrada);
          const isVirtual = dayEventsData.some(e => e.isVirtual);
          const isCurrentMonth = isSameMonth(day, referenceDate);
          const isTodayDate = isToday(day);
          
          const tooltipText = isCerrada 
            ? 'OFICINA CERRADA' 
            : isVirtual
            ? 'OFICINA VIRTUAL'
            : hasEvent 
            ? dayEventsData.map(e => e.title).join(', ')
            : (isCurrentMonth ? 'No hay eventos programados' : undefined);

          return (
            <button
              key={key}
              type="button"
              onClick={(e) => isCurrentMonth && !isCerrada && handleDayClick(day, e)}
              disabled={!isCurrentMonth || isCerrada}
              className={clsx(
                'flex h-8 sm:h-9 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent text-xs sm:text-sm transition-all duration-200 touch-manipulation group relative',
                isCurrentMonth 
                  ? isCerrada
                    ? 'bg-gray-400 text-white cursor-not-allowed opacity-70'
                    : isVirtual
                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white cursor-pointer hover:from-yellow-500 hover:to-yellow-600 active:scale-95 shadow-sm'
                    : 'bg-[#f6f6ff] text-[#010139] hover:bg-[#8aaa19] hover:text-white cursor-pointer active:scale-95'
                  : 'bg-gray-50 text-gray-400 cursor-default',
                hasEvent && isCurrentMonth && !isCerrada && !isVirtual ? 'border-[#8aaa19] bg-white shadow-sm' : '',
                isTodayDate && !isCerrada && !isVirtual ? 'ring-2 ring-[#010139] ring-offset-1' : ''
              )}
              title={tooltipText}
            >
              <span className={clsx('font-medium leading-none', isCurrentMonth ? '' : 'opacity-50')}>
                {format(day, 'd')}
              </span>
              {hasEvent && isCurrentMonth && (
                <span className="h-1 w-1 rounded-full bg-[#8aaa19]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Next Event + View More */}
      <div className="px-5 pb-4 pt-3 mt-auto border-t border-gray-100 flex-shrink-0">
        {nextEvent ? (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1.5 font-semibold">Próximo evento:</p>
            <div className="flex items-start gap-2 bg-gradient-to-r from-[#f6f6ff] to-white p-2.5 rounded-lg">
              <span className="text-lg">📅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#010139] line-clamp-2">{nextEvent.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {format(new Date(nextEvent.date), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic mb-3">No hay eventos próximos</p>
        )}
        <button
          type="button"
          onClick={handleViewMore}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-[#8AAA19] hover:text-[#6d8814] transition-colors py-2 rounded-lg hover:bg-[#f6f6ff] touch-manipulation"
        >
          <span>Ver más</span>
          <FaExternalLinkAlt className="text-[9px]" />
        </button>
      </div>
    </div>
  );
}
