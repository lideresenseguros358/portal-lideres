"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { 
  addDays, 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  isSameMonth,
  isToday
} from "date-fns";
import { es } from "date-fns/locale";

interface MiniCalendarProps {
  events: {
    date: string;
    title: string;
  }[];
  onClick?: () => void;
}

const DAYS_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

const normalize = (value: string) => format(new Date(value), "yyyy-MM-dd");

const MiniCalendar = ({ events, onClick }: MiniCalendarProps) => {
  const [referenceDate] = useState(() => new Date());

  const eventMap = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach((item) => {
      const key = normalize(item.date);
      map.set(key, item.title);
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

  const Element = onClick ? "button" : "div";

  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "flex w-full flex-col gap-4 rounded-2xl bg-white p-5 text-left shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform",
        onClick ? "cursor-pointer hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8aaa19]" : undefined
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">Agenda</p>
          <p className="text-lg font-semibold text-[#010139]">
            {format(referenceDate, "MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DAYS_LABELS.map((label) => (
          <span key={label} className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">
            {label}
          </span>
        ))}
        {days.map((day) => {
          const key = normalize(day.toISOString());
          const hasEvent = eventMap.has(key);
          const eventTitle = eventMap.get(key);
          const isCurrentMonth = isSameMonth(day, referenceDate);
          const isTodayDate = isToday(day);

          return (
            <div
              key={key}
              className={clsx(
                "flex h-10 flex-col items-center justify-center gap-1 rounded-lg border border-transparent text-sm transition-colors",
                isCurrentMonth ? "bg-[#f6f6ff] text-[#010139]" : "bg-gray-50 text-gray-400",
                hasEvent && isCurrentMonth ? "border-[#8aaa19] bg-white shadow-sm" : "",
                isTodayDate ? "ring-2 ring-[#010139]" : ""
              )}
              title={eventTitle ?? undefined}
            >
              <span className={clsx("font-medium", isCurrentMonth ? "" : "opacity-50")}>{format(day, "d")}</span>
              {hasEvent && isCurrentMonth ? <span className="h-1.5 w-1.5 rounded-full bg-[#8aaa19]" /> : null}
            </div>
          );
        })}
      </div>
    </Element>
  );
};

export default MiniCalendar;
