'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaIdCard, FaFileAlt, FaDownload, FaRedo, FaTools } from 'react-icons/fa';
import CedulaDocScanner from '@/components/cotizadores/CedulaDocScanner';
import type { FileAttachment } from '@/components/cotizadores/broker/BrokerExtraStep';

// ── Types ─────────────────────────────────────────────────────────────────────

type ToolView = null | 'scanner' | 'salario';

interface Props {
  onClose: () => void;
}

// ── Download helper ────────────────────────────────────────────────────────────

function downloadAttachment(file: FileAttachment) {
  const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
  const blob  = new Blob([bytes], { type: file.mimeType });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function HerramientasModal({ onClose }: Props) {
  const [mounted, setMounted]         = useState(false);
  const [toolView, setToolView]       = useState<ToolView>(null);
  const [scannedFile, setScannedFile] = useState<FileAttachment | null>(null);
  const [downloaded, setDownloaded]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Intercept scan completion — show download UI instead of wizard inject
  function handleScanComplete(f: FileAttachment | null) {
    if (f) setScannedFile(f);
  }

  function handleDownload() {
    if (!scannedFile) return;
    downloadAttachment(scannedFile);
    setDownloaded(true);
  }

  function resetScanner() {
    setScannedFile(null);
    setDownloaded(false);
  }

  function goBack() {
    setToolView(null);
    resetScanner();
  }

  // ── Inner content ─────────────────────────────────────────────────────────

  const toolGrid = (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide px-1">Selecciona una herramienta</p>
      <div className="grid grid-cols-2 gap-3">
        {/* Scanner Cédula */}
        <button
          type="button"
          onClick={() => setToolView('scanner')}
          className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-[#010139]/15 bg-[#010139]/[0.03] hover:border-[#010139]/30 hover:bg-[#010139]/[0.06] transition-all text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-[#010139] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <FaIdCard className="text-white" size={22} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#010139]">Scanner Cédula</p>
            <p className="text-xs text-gray-400 mt-0.5">Escanear y descargar</p>
          </div>
        </button>

        {/* Llenar Desc. de Salario — en desarrollo */}
        <button
          type="button"
          onClick={() => setToolView('salario')}
          className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 bg-gray-50 transition-all text-center relative overflow-hidden"
        >
          {/* "Próximamente" badge */}
          <span className="absolute top-2 right-2 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            Pronto
          </span>
          <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center shadow-sm">
            <FaFileAlt className="text-gray-400" size={22} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400">Desc. de Salario</p>
            <p className="text-xs text-gray-300 mt-0.5">Llenar formulario</p>
          </div>
        </button>
      </div>
    </div>
  );

  const scannerView = (
    <div className="space-y-3">
      {/* Back */}
      <button
        type="button"
        onClick={goBack}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
      >
        ← Volver a herramientas
      </button>

      {/* Download state — shown after scan approved */}
      {scannedFile ? (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-[#8AAA19]/30 bg-[#8AAA19]/5 p-5 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#8AAA19] mx-auto flex items-center justify-center">
              <FaIdCard className="text-white" size={24} />
            </div>
            <div>
              <p className="font-bold text-gray-800">¡Cédula escaneada!</p>
              <p className="text-sm text-gray-500 mt-1">{scannedFile.name}</p>
            </div>
            {downloaded && (
              <p className="text-xs text-[#8AAA19] font-semibold">Descargada correctamente</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetScanner}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <FaRedo size={12} /> Escanear otra
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold bg-[#010139] text-white rounded-xl hover:bg-[#020270] transition-colors"
            >
              <FaDownload size={13} /> Descargar PDF
            </button>
          </div>
        </div>
      ) : (
        /* CedulaDocScanner with skipChoice — opens scanner overlay immediately */
        <CedulaDocScanner
          value={null}
          onChange={handleScanComplete}
          skipChoice
          onClose={() => setToolView(null)}
        />
      )}
    </div>
  );

  const salarioView = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={goBack}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
      >
        ← Volver a herramientas
      </button>
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-amber-100 mx-auto flex items-center justify-center">
          <FaFileAlt className="text-amber-500" size={24} />
        </div>
        <p className="font-bold text-amber-800 text-base">En desarrollo</p>
        <p className="text-sm text-amber-700 leading-relaxed">
          Esta herramienta aún está en desarrollo.<br />
          Vuelva pronto o espere a su lanzamiento.
        </p>
        <p className="text-xs text-amber-500">Llenar Descuento de Salario — próximamente</p>
      </div>
    </div>
  );

  // ── Portal markup ─────────────────────────────────────────────────────────

  const overlay = (
    <div
      className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center"
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full sm:w-auto sm:min-w-[400px] sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FaTools className="text-[#010139]" size={14} />
            <p className="font-bold text-sm text-[#010139]">
              {toolView === 'scanner' ? 'Scanner de Cédula'
                : toolView === 'salario' ? 'Desc. de Salario'
                : 'Herramientas'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {toolView === null    && toolGrid}
          {toolView === 'scanner' && scannerView}
          {toolView === 'salario' && salarioView}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}
