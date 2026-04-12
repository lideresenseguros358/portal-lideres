'use client';

/**
 * CedulaDocScanner
 * Smart document scanner for cédula capture in the Vida broker wizard.
 *
 * Flow: choice → instructions → confirm → scanning (auto) → processing → preview → done
 *
 * Edge detection: canvas brightness threshold — no OpenCV, no external libs.
 * Image processing: backend Sharp (B&W photocopy effect + perspective warp).
 * Output: FileAttachment (PDF) injected directly into the wizard.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaCamera, FaCheck, FaRedo, FaFileUpload, FaCheckCircle } from 'react-icons/fa';
import { PDFDocument } from 'pdf-lib';
import type { FileAttachment } from './broker/BrokerExtraStep';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Corner { x: number; y: number; }

type ScanState =
  | 'choice'
  | 'instructions'
  | 'confirm'
  | 'scanning'
  | 'processing'
  | 'preview'
  | 'done';

interface Props {
  value: FileAttachment | null;
  onChange: (f: FileAttachment | null) => void;
  error?: string;
  /** Fallback to standard upload (no scanner) */
  fallbackFileInput?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CAPTURE_W = 1280;
const CAPTURE_H = 960;
const SAMPLE_STEP = 10;         // sample every Nth pixel for speed
const WHITE_THRESHOLD = 195;    // R,G,B must all exceed this to be "white"
const STABLE_MS = 1500;         // ms corners must stay stable before auto-capture
const STABLE_PX = 12;           // max pixel drift still considered "stable"
const SCAN_INTERVAL_MS = 200;   // edge detection runs every 200ms

// ── Helper: convert base64 PNG → PDF → FileAttachment ─────────────────────────

async function pngBase64ToPdfAttachment(pngBase64: string): Promise<FileAttachment> {
  const base64Data = pngBase64.replace(/^data:image\/png;base64,/, '');
  const pngBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  // A4 portrait in PDF points (72dpi): 595.28 × 841.89
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([595.28, 841.89]);
  const img    = await pdfDoc.embedPng(pngBytes);

  const { width: imgW, height: imgH } = img.scale(1);
  const scaleW = 595.28 / imgW;
  const scaleH = 841.89 / imgH;
  const scale  = Math.min(scaleW, scaleH);

  page.drawImage(img, {
    x: (595.28 - imgW * scale) / 2,
    y: (841.89 - imgH * scale) / 2,
    width:  imgW * scale,
    height: imgH * scale,
  });

  const pdfBytes = await pdfDoc.save();
  const base64   = btoa(String.fromCharCode(...pdfBytes));
  return { base64, name: 'cedula_escaneada.pdf', mimeType: 'application/pdf' };
}

// ── Helper: detect white-sheet bounding box in a video frame ──────────────────

interface SheetBounds {
  minX: number; minY: number;
  maxX: number; maxY: number;
  coverage: number; // fraction of canvas that is "white"
}

function detectSheet(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
): SheetBounds | null {
  const imgData = ctx.getImageData(0, 0, W, H);
  const pix = imgData.data;

  let minX = W, minY = H, maxX = 0, maxY = 0, whiteCount = 0;
  const total = (W / SAMPLE_STEP) * (H / SAMPLE_STEP);

  for (let y = 0; y < H; y += SAMPLE_STEP) {
    for (let x = 0; x < W; x += SAMPLE_STEP) {
      const i = (y * W + x) * 4;
      if ((pix[i] ?? 0) > WHITE_THRESHOLD && (pix[i + 1] ?? 0) > WHITE_THRESHOLD && (pix[i + 2] ?? 0) > WHITE_THRESHOLD) {
        whiteCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const coverage = whiteCount / total;
  if (coverage < 0.10 || (maxX - minX) < 80 || (maxY - minY) < 80) return null;

  return { minX, minY, maxX, maxY, coverage };
}

function boundsToCorners(b: SheetBounds): Corner[] {
  // pad slightly inward so sheet edge is inside polygon
  const pad = 4;
  return [
    { x: b.minX + pad, y: b.minY + pad }, // TL
    { x: b.maxX - pad, y: b.minY + pad }, // TR
    { x: b.maxX - pad, y: b.maxY - pad }, // BR
    { x: b.minX + pad, y: b.maxY - pad }, // BL
  ];
}

function cornersAreSimilar(a: Corner[] | null, b: Corner[] | null): boolean {
  if (!a || !b) return false;
  return a.every((pa, i) => {
    const pb = b[i];
    return pb !== undefined && Math.abs(pa.x - pb.x) < STABLE_PX && Math.abs(pa.y - pb.y) < STABLE_PX;
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CedulaDocScanner({ value, onChange, error }: Props) {
  // ── Static file upload ref (for "Sí, ya tengo copia") ──────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Portal mount ───────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Scanner state ──────────────────────────────────────────────────────────
  const [scanState, setScanState]         = useState<ScanState | null>(null);
  const [previewSrc, setPreviewSrc]       = useState<string | null>(null);
  const [processingErr, setProcessingErr] = useState<string | null>(null);
  const [detectedCorners, setDetectedCorners] = useState<Corner[] | null>(null);
  const [sheetCoverage, setSheetCoverage] = useState(0);

  // ── Camera refs ────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const overlayRef  = useRef<HTMLCanvasElement>(null);  // drawing overlay
  const detectRef   = useRef<HTMLCanvasElement>(null);  // offscreen detection
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableRef   = useRef<{ corners: Corner[]; since: number } | null>(null);
  const capturedRef = useRef(false);

  // ── File upload handler (classic) ──────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      onChange({ base64, name: file.name, mimeType: file.type || 'application/octet-stream' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [onChange]);

  // ── Stop camera ────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    stableRef.current = null;
    capturedRef.current = false;
  }, []);

  // ── Start camera ───────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: CAPTURE_W },
          height: { ideal: CAPTURE_H },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setProcessingErr('No se pudo acceder a la cámara. Permite el acceso e intenta de nuevo.');
      setScanState('instructions');
    }
  }, []);

  // ── Edge detection loop ────────────────────────────────────────────────────
  const startDetection = useCallback(() => {
    capturedRef.current = false;

    intervalRef.current = setInterval(() => {
      if (capturedRef.current) return;
      const video   = videoRef.current;
      const detect  = detectRef.current;
      const overlay = overlayRef.current;
      if (!video || !detect || !overlay || video.readyState < 2) return;

      const vW = video.videoWidth  || CAPTURE_W;
      const vH = video.videoHeight || CAPTURE_H;

      detect.width  = vW;
      detect.height = vH;
      overlay.width  = vW;
      overlay.height = vH;

      const dCtx = detect.getContext('2d', { willReadFrequently: true });
      const oCtx = overlay.getContext('2d');
      if (!dCtx || !oCtx) return;

      // Draw current frame into offscreen canvas
      dCtx.drawImage(video, 0, 0, vW, vH);

      // Detect white region
      const bounds = detectSheet(dCtx, vW, vH);
      setSheetCoverage(bounds?.coverage ?? 0);
      oCtx.clearRect(0, 0, vW, vH);

      if (!bounds) {
        setDetectedCorners(null);
        stableRef.current = null;
        return;
      }

      const corners = boundsToCorners(bounds);
      setDetectedCorners(corners);

      // Draw guide polygon
      oCtx.beginPath();
      oCtx.moveTo(corners[0]!.x, corners[0]!.y);
      corners.slice(1).forEach(c => oCtx.lineTo(c.x, c.y));
      oCtx.closePath();
      oCtx.strokeStyle = '#8AAA19';
      oCtx.lineWidth   = 4;
      oCtx.stroke();

      // Draw corner dots
      corners.forEach(c => {
        oCtx.beginPath();
        oCtx.arc(c.x, c.y, 8, 0, Math.PI * 2);
        oCtx.fillStyle = '#8AAA19';
        oCtx.fill();
      });

      // Stability check
      const now = Date.now();
      if (stableRef.current && cornersAreSimilar(corners, stableRef.current.corners)) {
        if (now - stableRef.current.since >= STABLE_MS) {
          // ── AUTO-CAPTURE ──────────────────────────────────────────────────
          capturedRef.current = true;
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

          // Capture full-resolution frame
          const capCanvas = document.createElement('canvas');
          capCanvas.width  = vW;
          capCanvas.height = vH;
          capCanvas.getContext('2d')!.drawImage(video, 0, 0, vW, vH);
          const imageBase64 = capCanvas.toDataURL('image/jpeg', 0.92);

          stopCamera();
          setScanState('processing');

          // Send to backend
          fetch('/api/cedula-scanner/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, corners, srcW: vW, srcH: vH }),
          })
            .then(r => r.json())
            .then(async (res: { processedBase64?: string; error?: string }) => {
              if (res.processedBase64) {
                setPreviewSrc(res.processedBase64);
                setScanState('preview');
              } else {
                setProcessingErr(res.error || 'Error al procesar la imagen.');
                setScanState('instructions');
              }
            })
            .catch(() => {
              setProcessingErr('Error de conexión. Intenta de nuevo.');
              setScanState('instructions');
            });
        }
      } else {
        stableRef.current = { corners, since: now };
      }
    }, SCAN_INTERVAL_MS);
  }, [stopCamera]);

  // ── Transition handlers ────────────────────────────────────────────────────
  const openScanner = useCallback(() => {
    setProcessingErr(null);
    setPreviewSrc(null);
    setDetectedCorners(null);
    setScanState('instructions');
  }, []);

  const closeScanner = useCallback(() => {
    stopCamera();
    setScanState(null);
  }, [stopCamera]);

  const goToConfirm = useCallback(() => setScanState('confirm'), []);

  const startScan = useCallback(async () => {
    setScanState('scanning');
    await startCamera();
    startDetection();
  }, [startCamera, startDetection]);

  const retake = useCallback(() => {
    setPreviewSrc(null);
    setProcessingErr(null);
    setScanState('instructions');
  }, []);

  const approve = useCallback(async () => {
    if (!previewSrc) return;
    setScanState('processing');
    try {
      const attachment = await pngBase64ToPdfAttachment(previewSrc);
      onChange(attachment);
      setScanState('done');
      setTimeout(() => setScanState(null), 800);
    } catch {
      setProcessingErr('Error al generar el PDF. Intenta de nuevo.');
      setScanState('preview');
    }
  }, [previewSrc, onChange]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Overlay UI ────────────────────────────────────────────────────────────
  const scannerOverlay = scanState && scanState !== 'done' ? (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" style={{ touchAction: 'none' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
        <div>
          <p className="text-white font-bold text-sm">Escanear cédula</p>
          <p className="text-[#8AAA19] text-xs">
            {scanState === 'scanning'
              ? (detectedCorners
                ? `Hoja detectada (${Math.round(sheetCoverage * 100)}%) — mantén firme…`
                : 'Buscando hoja en blanco…')
              : scanState === 'processing' ? 'Procesando…'
              : scanState === 'preview' ? 'Vista previa — aprueba o vuelve a tomar'
              : ''}
          </p>
        </div>
        <button onClick={closeScanner} className="text-white p-2 hover:text-gray-300 transition-colors">
          <FaTimes size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-4 gap-4">

        {/* ── CHOICE ────────────────────────────────────────────── */}
        {scanState === 'choice' && null /* rendered below the portal trigger, not here */}

        {/* ── INSTRUCTIONS ─────────────────────────────────────── */}
        {scanState === 'instructions' && (
          <div className="w-full max-w-sm space-y-5">
            <div className="rounded-2xl border-2 border-[#8AAA19]/40 bg-[#8AAA19]/5 p-5 space-y-3">
              <p className="font-bold text-white text-center text-base">Instrucciones para el escáner</p>
              <ul className="space-y-2 text-sm text-gray-200">
                {[
                  'Coloca la cédula en el centro de una hoja en blanco',
                  'Pon la hoja sobre una superficie oscura y plana',
                  'Asegúrate de tener buena iluminación (sin sombras)',
                  'Apunta la cámara perpendicularmente a la hoja',
                ].map((txt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#8AAA19] text-white text-xs flex items-center justify-center font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {txt}
                  </li>
                ))}
              </ul>
            </div>

            {processingErr && (
              <p className="text-red-400 text-sm text-center">{processingErr}</p>
            )}

            <button
              onClick={goToConfirm}
              className="w-full py-3 text-sm font-bold bg-[#8AAA19] text-white rounded-xl hover:bg-[#6d8814] transition-colors"
            >
              Continuar
            </button>
          </div>
        )}

        {/* ── CONFIRM (gatekeeper) ──────────────────────────────── */}
        {scanState === 'confirm' && (
          <div className="w-full max-w-sm space-y-5">
            <div className="rounded-2xl border-2 border-white/20 bg-white/5 p-6 text-center space-y-3">
              <FaCamera size={36} className="mx-auto text-[#8AAA19]" />
              <p className="text-white font-bold text-lg">¿Estás listo para escanear?</p>
              <p className="text-gray-300 text-sm">
                La cámara se activará y detectará automáticamente la hoja en blanco con la cédula.
                Cuando los bordes estén estables, la foto se tomará sola.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setScanState('instructions')}
                className="flex-1 py-3 text-sm font-semibold border-2 border-white/20 text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={startScan}
                className="flex-1 py-3 text-sm font-bold bg-[#8AAA19] text-white rounded-xl hover:bg-[#6d8814] transition-colors flex items-center justify-center gap-2"
              >
                <FaCamera size={14} /> Activar cámara
              </button>
            </div>
          </div>
        )}

        {/* ── SCANNING ─────────────────────────────────────────── */}
        {scanState === 'scanning' && (
          <div className="relative w-full flex flex-col items-center gap-3">
            {/* Video feed */}
            <div className="relative w-full max-h-[60vh] overflow-hidden rounded-xl">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover block"
              />
              {/* Overlay canvas for detected polygon */}
              <canvas
                ref={overlayRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ objectFit: 'cover' }}
              />
            </div>
            {/* Hidden offscreen canvas */}
            <canvas ref={detectRef} className="hidden" />

            {/* Status bar */}
            <div className={`w-full max-w-sm rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors ${
              detectedCorners ? 'bg-[#8AAA19]/20 text-[#8AAA19] border border-[#8AAA19]/40' : 'bg-white/10 text-gray-300'
            }`}>
              {detectedCorners
                ? `Hoja detectada — mantén la cámara firme ${STABLE_MS / 1000}s`
                : 'Apunta la cámara a la hoja blanca sobre fondo oscuro'}
            </div>
          </div>
        )}

        {/* ── PROCESSING ───────────────────────────────────────── */}
        {scanState === 'processing' && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-14 h-14 border-4 border-[#8AAA19] border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-semibold text-center">Procesando imagen…<br /><span className="text-gray-400 text-sm font-normal">Aplicando corrección de perspectiva y efecto fotocopia</span></p>
          </div>
        )}

        {/* ── PREVIEW ──────────────────────────────────────────── */}
        {scanState === 'preview' && previewSrc && (
          <div className="w-full max-w-sm space-y-4">
            <div className="rounded-xl overflow-hidden border-2 border-[#8AAA19]/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSrc} alt="Vista previa de la cédula escaneada" className="w-full block" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={retake}
                className="flex-1 py-3 text-sm font-semibold border-2 border-white/20 text-white rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <FaRedo size={12} /> Volver a tomar
              </button>
              <button
                onClick={approve}
                className="flex-1 py-3 text-sm font-bold bg-[#8AAA19] text-white rounded-xl hover:bg-[#6d8814] transition-colors flex items-center justify-center gap-2"
              >
                <FaCheck size={12} /> Aprobar
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      {(scanState === 'scanning' || scanState === 'instructions' || scanState === 'confirm') && (
        <div className="flex-shrink-0 px-4 py-3 bg-black/80 text-center">
          <p className="text-xs text-gray-500">La imagen se procesa en el servidor y se adjunta como PDF al formulario</p>
        </div>
      )}
    </div>
  ) : null;

  // ── Trigger UI (shown inside the form) ────────────────────────────────────

  // Already has a file attached → show it (same as FileUploadField done state)
  if (value) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 py-3 border-2 rounded-xl border-[#8AAA19] bg-green-50">
          <FaCheckCircle className="text-[#8AAA19] flex-shrink-0" size={16} />
          <span className="text-sm text-gray-700 truncate flex-1">{value.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-red-500 hover:underline flex-shrink-0"
          >
            Quitar
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
      </div>
    );
  }

  // No file yet → show choice
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-700">¿Ya tienes la copia de la cédula?</p>
      <div className="grid grid-cols-2 gap-3">
        {/* Sí → standard file upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-2 px-3 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-[#8AAA19] bg-gray-50 hover:bg-[#8AAA19]/5 transition-all text-center"
        >
          <FaFileUpload className="text-gray-400" size={20} />
          <span className="text-xs font-semibold text-gray-600">Sí, tengo copia</span>
          <span className="text-xs text-gray-400">Subir foto o PDF</span>
        </button>

        {/* No → open scanner */}
        <button
          type="button"
          onClick={openScanner}
          className="flex flex-col items-center gap-2 px-3 py-4 border-2 border-[#010139]/20 rounded-xl hover:border-[#010139] bg-[#010139]/5 hover:bg-[#010139]/10 transition-all text-center"
        >
          <FaCamera className="text-[#010139]" size={20} />
          <span className="text-xs font-semibold text-[#010139]">No, escanear</span>
          <span className="text-xs text-gray-400">Usar cámara</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

      {/* Scanner portal */}
      {mounted && scannerOverlay && createPortal(scannerOverlay, document.body)}
    </div>
  );
}
