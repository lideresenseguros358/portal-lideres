/**
 * Storage local para quotes (hasta tener DB)
 * Simula persistencia con localStorage
 */

import type { StoredQuote } from './types';

const STORAGE_KEY = 'cotizadores_quotes';

export function saveQuote(quote: StoredQuote): void {
  if (typeof window === 'undefined') return;
  
  const quotes = getAllQuotes();
  const existingIndex = quotes.findIndex(q => q.quoteId === quote.quoteId);
  
  if (existingIndex >= 0) {
    quotes[existingIndex] = quote;
  } else {
    quotes.push(quote);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  
  // Analytics log
  console.log('[Analytics] Quote saved:', {
    quoteId: quote.quoteId,
    policyType: quote.policyType,
    status: quote.status,
    optionsCount: quote.optionsCount
  });
}

export function getQuote(quoteId: string): StoredQuote | null {
  if (typeof window === 'undefined') return null;
  
  const quotes = getAllQuotes();
  return quotes.find(q => q.quoteId === quoteId) || null;
}

export function getAllQuotes(): StoredQuote[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading quotes from storage:', error);
    return [];
  }
}

export function updateQuoteStatus(quoteId: string, status: StoredQuote['status']): void {
  const quote = getQuote(quoteId);
  if (quote) {
    saveQuote({ ...quote, status });
  }
}

export function clearQuotes(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
