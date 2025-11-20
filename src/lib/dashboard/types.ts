import type { Tables } from "@/lib/supabase/server";

export type DashboardRole = "master" | "broker";

export type FortnightRow = Tables<"fortnights">;

export interface FortnightStatus {
  paid?: {
    fortnight: FortnightRow;
    total: number;
  };
  open?: {
    fortnight: FortnightRow;
    total: number;
  };
}

export interface NetCommissions {
  lastPaid: number;
  open: number;
}

export interface AnnualNet {
  value: number;
}

export interface PendingCases {
  faltaDoc: number;
  sinClasificar: number;
}

export interface MonthlyTotal {
  month: number;
  total: number;
}

export interface YtdComparison {
  current: MonthlyTotal[];
  previous: MonthlyTotal[];
}

export interface RankingEntry {
  brokerId: string;
  brokerName: string;
  position: number;
  total?: number;
  positionChange?: 'up' | 'down' | 'same' | 'new';
  positionDiff?: number;
}

export interface RankingResult {
  entries: RankingEntry[];
  currentBrokerId?: string;
  currentPosition?: number;
  currentTotal?: number;
}

export interface ContestProgress {
  label: string;
  value: number;
  target: number;
  percent: number;
  tooltip?: string;
  contestStatus?: 'active' | 'closed' | 'won' | 'lost';
  quotaType?: 'single' | 'double';
  targetDouble?: number; // Meta doble
  enableDoubleGoal?: boolean; // Si el doble está habilitado
  periodLabel?: string;
  startMonth?: number;
  endMonth?: number;
}

export interface CalendarEvent {
  date: string;
  title: string;
}
