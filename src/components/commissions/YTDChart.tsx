'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface ChartData {
  month: string;
  [key: string]: number | string; // To accommodate dynamic year keys
}

interface Props {
  data: ChartData[];
  currentYear: number;
  previousYear: number;
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function YTDChart({ data, currentYear, previousYear }: Props) {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
          <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
          <Legend />
          <Bar dataKey={String(previousYear)} fill="#cccccc" name={`${previousYear}`} />
          <Bar dataKey={String(currentYear)} fill="#010139" name={`${currentYear}`} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
