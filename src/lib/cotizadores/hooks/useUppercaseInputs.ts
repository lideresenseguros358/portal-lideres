/**
 * Hook para transformar inputs a MAYÚSCULAS automáticamente
 */

import { useCallback } from 'react';

export function useUppercaseInputs() {
  const toUppercase = useCallback((value: string): string => {
    return value.toUpperCase();
  }, []);

  const createUppercaseHandler = useCallback(
    <T extends HTMLInputElement | HTMLTextAreaElement>(
      onChange: (e: React.ChangeEvent<T>) => void
    ) => {
      return (e: React.ChangeEvent<T>) => {
        const originalValue = e.target.value;
        e.target.value = originalValue.toUpperCase();
        onChange(e);
      };
    },
    []
  );

  return {
    toUppercase,
    createUppercaseHandler
  };
}
