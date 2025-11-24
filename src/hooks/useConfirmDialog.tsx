'use client';

import { useState, useCallback } from 'react';

type DialogType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
}

interface DialogState extends DialogOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showDialog = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        ...options,
        isOpen: true,
        resolve,
      });
    });
  }, []);

  const closeDialog = useCallback((confirmed: boolean = false) => {
    if (dialogState.resolve) {
      dialogState.resolve(confirmed);
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, [dialogState]);

  // Helpers específicos
  const confirm = useCallback(
    (message: string, title?: string) =>
      showDialog({ message, title, type: 'confirm' }),
    [showDialog]
  );

  const alert = useCallback(
    (message: string, title?: string, type: DialogType = 'info') =>
      showDialog({ message, title, type, confirmText: 'Aceptar' }),
    [showDialog]
  );

  const success = useCallback(
    (message: string, title?: string) =>
      showDialog({ message, title, type: 'success', confirmText: 'Aceptar' }),
    [showDialog]
  );

  const error = useCallback(
    (message: string, title?: string) =>
      showDialog({ message, title, type: 'error', confirmText: 'Aceptar' }),
    [showDialog]
  );

  const warning = useCallback(
    (message: string, title?: string) =>
      showDialog({ message, title, type: 'warning', confirmText: 'Aceptar' }),
    [showDialog]
  );

  return {
    dialogState,
    closeDialog,
    showDialog,
    confirm,
    alert,
    success,
    error,
    warning,
  };
}
