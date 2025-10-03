"use client";

import { useMemo } from "react";
import clsx from "clsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export interface BarYtdSeriesPoint {
  month: number;
  total: number;
}

interface BarYtdProps {
  current: BarYtdSeriesPoint[];
  last: BarYtdSeriesPoint[];
  onClick?: () => void;
}

const BarYtd = ({ current, last, onClick }: BarYtdProps) => {
  const data = useMemo(() => {
    const map = new Map<number, { month: string; actual: number; previous: number }>();

    for (const monthIndex of Array.from({ length: 12 }, (_, idx) => idx + 1)) {
      map.set(monthIndex, {
        month: MONTH_LABELS[monthIndex - 1] ?? '',
        actual: 0,
        previous: 0,
      });
    }

    current.forEach((item) => {
      const safe = map.get(item.month);
      if (safe) safe.actual = item.total;
    });
    last.forEach((item) => {
      const safe = map.get(item.month);
      if (safe) safe.previous = item.total;
    });

    return Array.from(map.values());
  }, [current, last]);

  const Element = onClick ? "button" : "div";

  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "flex w-full flex-col gap-4 rounded-2xl bg-white p-5 text-left shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform hover:-translate-y-0.5",
        onClick ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8aaa19]" : undefined,
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">Comparativo YTD</p>
          <p className="text-lg font-semibold text-[#010139]">Año actual vs año pasado</p>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#edf0f2" />
            <XAxis dataKey="month" stroke="#8a8a8a" tickLine={false} axisLine={{ stroke: "#edf0f2" }} />
            <YAxis stroke="#8a8a8a" tickLine={false} axisLine={{ stroke: "#edf0f2" }} tickFormatter={(val) => val.toLocaleString("es-PA")} />
            <Tooltip
              cursor={{ fill: "rgba(1,1,57,0.04)" }}
              formatter={(value: number) => value.toLocaleString("es-PA", { minimumFractionDigits: 2 })}
            />
            <Legend wrapperStyle={{ paddingTop: 12 }} iconType="circle" />
            <Bar dataKey="actual" name="Año actual" fill="#010139" radius={[6, 6, 0, 0]} />
            <Bar dataKey="previous" name="Año pasado" fill="#b5b5b5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Element>
  );
};

export default BarYtd;
