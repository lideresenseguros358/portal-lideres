'use client';

import { createContext, useContext, useState } from 'react';

interface PDFDownloadContextType {
  onDownloadPDF: (() => void) | null;
  isDownloading: boolean;
  setDownloadHandler: (handler: (() => void) | null) => void;
  setIsDownloading: (loading: boolean) => void;
}

const PDFDownloadContext = createContext<PDFDownloadContextType | undefined>(undefined);

export function PDFDownloadProvider({ children }: { children: React.ReactNode }) {
  const [onDownloadPDF, setDownloadHandler] = useState<(() => void) | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  return (
    <PDFDownloadContext.Provider value={{ onDownloadPDF, isDownloading, setDownloadHandler, setIsDownloading }}>
      {children}
    </PDFDownloadContext.Provider>
  );
}

export function usePDFDownload() {
  const context = useContext(PDFDownloadContext);
  if (!context) {
    throw new Error('usePDFDownload must be used within PDFDownloadProvider');
  }
  return context;
}
