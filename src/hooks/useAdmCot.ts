/**
 * ADM COT — Client-side hooks for state management
 */
'use client';

import { useState, useCallback } from 'react';
import type { AdmCotFilters, AdmCotPagination } from '@/types/adm-cot.types';

/** Reusable filter + pagination state */
export function useAdmCotFilters(defaultPageSize = 25) {
  const [filters, setFilters] = useState<AdmCotFilters>({});
  const [pagination, setPagination] = useState<AdmCotPagination>({
    page: 1,
    pageSize: defaultPageSize,
    total: 0,
  });

  const updateFilter = useCallback((key: keyof AdmCotFilters, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const setTotal = useCallback((total: number) => {
    setPagination(prev => ({ ...prev, total }));
  }, []);

  return { filters, pagination, updateFilter, resetFilters, setPage, setTotal, setFilters };
}

/** Environment indicator hook */
export function useEnvironment() {
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development';
  const isDev = env !== 'production';
  return { env, isDev, label: isDev ? 'DEV' : 'PROD' };
}

/** Date range quick-select presets */
export type DatePreset = 'today' | 'week' | 'month' | '3months' | 'year' | 'custom';

export function useDateRange() {
  const [preset, setPreset] = useState<DatePreset>('month');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const applyPreset = useCallback((p: DatePreset) => {
    setPreset(p);
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    switch (p) {
      case 'today':
        setDateFrom(fmt(now));
        setDateTo(fmt(now));
        break;
      case 'week': {
        const w = new Date(now.getTime() - 7 * 86400000);
        setDateFrom(fmt(w));
        setDateTo(fmt(now));
        break;
      }
      case 'month': {
        const m = new Date(now.getTime() - 30 * 86400000);
        setDateFrom(fmt(m));
        setDateTo(fmt(now));
        break;
      }
      case '3months': {
        const m3 = new Date(now.getTime() - 90 * 86400000);
        setDateFrom(fmt(m3));
        setDateTo(fmt(now));
        break;
      }
      case 'year': {
        const y = new Date(now.getTime() - 365 * 86400000);
        setDateFrom(fmt(y));
        setDateTo(fmt(now));
        break;
      }
      case 'custom':
        break;
    }
  }, []);

  return { preset, dateFrom, dateTo, setDateFrom, setDateTo, applyPreset };
}
