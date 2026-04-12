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
import { FaTimes, FaCamera, FaCheck, FaRedo, FaFileUpload, FaCheckCircle, FaLightbulb } from 'react-icons/fa';
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
  /** Skip the "¿Ya tienes copia?" choice and open the scanner directly on mount */
  skipChoice?: boolean;
  /** Called when the user closes the scanner (used in standalone/Herramientas mode) */
  onClose?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CAPTURE_W = 1280;
const CAPTURE_H = 960;
const SAMPLE_STEP = 8;          // sample every Nth pixel (finer = more accurate corners)
const WHITE_LUM = 175;          // luminance threshold to classify a pixel as "white sheet"
const MIN_WHITE_COUNT = 60;     // minimum sampled white pixels to consider sheet present
const STABLE_MS = 1500;         // ms corners must stay stable before auto-capture
const STABLE_PX = 14;           // max pixel drift still considered "stable"
const SCAN_INTERVAL_MS = 180;   // edge detection runs every 180ms

// ── Helper: convert base64 image (JPEG or PNG) → PDF → FileAttachment ──────────

async function imgBase64ToPdfAttachment(imgBase64: string): Promise<FileAttachment> {
  const isJpeg = imgBase64.startsWith('data:image/jpeg');
  const base64Data = imgBase64.replace(/^data:image\/\w+;base64,/, '');
  const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  // A4 portrait in PDF points (72dpi): 595.28 × 841.89
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([595.28, 841.89]);
  const img    = isJpeg
    ? await pdfDoc.embedJpg(imgBytes)
    : await pdfDoc.embedPng(imgBytes);

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

// ── Helper: detect 4 corners of the white sheet via diagonal scoring ──────────
//
// For each "white" pixel we keep track of 4 extreme points:
//   TL = min(x+y)  → closest to top-left
//   TR = max(x-y)  → closest to top-right
//   BL = max(y-x)  → closest to bottom-left
//   BR = max(x+y)  → closest to bottom-right
//
// This produces the actual quadrilateral corners of the sheet even when tilted,
// unlike a simple bounding box which always gives an axis-aligned rectangle.

function detectCorners(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
): { corners: Corner[]; coverage: number } | null {
  const imgData = ctx.getImageData(0, 0, W, H);
  const pix = imgData.data;

  let tlScore =  Infinity, tlX = 0,   tlY = 0;
  let trScore = -Infinity, trX = W,   trY = 0;
  let blScore = -Infinity, blX = 0,   blY = H;
  let brScore = -Infinity, brX = W,   brY = H;
  let whiteCount = 0;
  const total = Math.floor(W / SAMPLE_STEP) * Math.floor(H / SAMPLE_STEP);

  for (let y = 0; y < H; y += SAMPLE_STEP) {
    for (let x = 0; x < W; x += SAMPLE_STEP) {
      const i = (y * W + x) * 4;
      // luminance (perceived brightness)
      const lum = 0.299 * (pix[i] ?? 0) + 0.587 * (pix[i + 1] ?? 0) + 0.114 * (pix[i + 2] ?? 0);
      if (lum > WHITE_LUM) {
        whiteCount++;
        if (x + y < tlScore) { tlScore = x + y; tlX = x; tlY = y; }
        if (x - y > trScore) { trScore = x - y; trX = x; trY = y; }
        if (y - x > blScore) { blScore = y - x; blX = x; blY = y; }
        if (x + y > brScore) { brScore = x + y; brX = x; brY = y; }
      }
    }
  }

  if (whiteCount < MIN_WHITE_COUNT) return null;

  // Sanity check: sheet must occupy a reasonable area
  const spanW = Math.max(trX, brX) - Math.min(tlX, blX);
  const spanH = Math.max(blY, brY) - Math.min(tlY, trY);
  if (spanW < W * 0.15 || spanH < H * 0.12) return null;

  return {
    corners: [
      { x: tlX, y: tlY }, // TL
      { x: trX, y: trY }, // TR
      { x: brX, y: brY }, // BR
      { x: blX, y: blY }, // BL
    ],
    coverage: whiteCount / total,
  };
}

function cornersAreSimilar(a: Corner[] | null, b: Corner[] | null): boolean {
  if (!a || !b) return false;
  return a.every((pa, i) => {
    const pb = b[i];
    return pb !== undefined && Math.abs(pa.x - pb.x) < STABLE_PX && Math.abs(pa.y - pb.y) < STABLE_PX;
  });
}

// Map a video-space point to canvas display-space, accounting for object-fit:cover
function videoToDisplay(
  x: number, y: number,
  vW: number, vH: number,
  eW: number, eH: number,
): Corner {
  const scale = Math.max(eW / vW, eH / vH);
  const offX  = (vW * scale - eW) / 2;
  const offY  = (vH * scale - eH) / 2;
  return { x: x * scale - offX, y: y * scale - offY };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CedulaDocScanner({ value, onChange, error, skipChoice, onClose }: Props) {
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
  const [torchOn, setTorchOn]             = useState(false);
  const [stableProgress, setStableProgress] = useState(0); // 0-1 countdown to auto-capture

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
    setTorchOn(false);
    setStableProgress(0);
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
      // Display dimensions (CSS pixels) — used for the overlay canvas
      const eW = video.clientWidth  || vW;
      const eH = video.clientHeight || vH;

      // Detection canvas: full video resolution for accuracy
      detect.width  = vW;
      detect.height = vH;
      // Overlay canvas: matches display size so coordinates are pixel-perfect
      overlay.width  = eW;
      overlay.height = eH;

      const dCtx = detect.getContext('2d', { willReadFrequently: true });
      const oCtx = overlay.getContext('2d');
      if (!dCtx || !oCtx) return;

      // Draw current frame into offscreen detection canvas (full res)
      dCtx.drawImage(video, 0, 0, vW, vH);

      // Detect corners of the white sheet
      const result = detectCorners(dCtx, vW, vH);
      setSheetCoverage(result?.coverage ?? 0);
      oCtx.clearRect(0, 0, eW, eH);

      if (!result) {
        setDetectedCorners(null);
        stableRef.current = null;
        setStableProgress(0);
        return;
      }

      const { corners } = result;
      setDetectedCorners(corners);

      // Convert video-space corners → display-space corners
      const dCorners = corners.map(c => videoToDisplay(c.x, c.y, vW, vH, eW, eH));

      // ── Draw guide polygon (display coords) ─────────────────────────────
      const c0 = dCorners[0]!;
      oCtx.beginPath();
      oCtx.moveTo(c0.x, c0.y);
      dCorners.slice(1).forEach(c => oCtx.lineTo(c.x, c.y));
      oCtx.closePath();

      // Semi-transparent fill
      oCtx.fillStyle = 'rgba(138, 170, 25, 0.12)';
      oCtx.fill();

      // Stroke
      oCtx.strokeStyle = '#8AAA19';
      oCtx.lineWidth   = 3;
      oCtx.stroke();

      // Corner brackets (L-shapes, 20px arms)
      const ARM = 22;
      dCorners.forEach((c, idx) => {
        // Direction vectors toward the center of the polygon
        const cx = dCorners.reduce((s, p) => s + p.x, 0) / 4;
        const cy = dCorners.reduce((s, p) => s + p.y, 0) / 4;
        const dx = Math.sign(cx - c.x);
        const dy = Math.sign(cy - c.y);
        oCtx.beginPath();
        oCtx.moveTo(c.x + dx * ARM, c.y);
        oCtx.lineTo(c.x, c.y);
        oCtx.lineTo(c.x, c.y + dy * ARM);
        oCtx.strokeStyle = '#8AAA19';
        oCtx.lineWidth   = 4;
        oCtx.lineCap     = 'round';
        oCtx.stroke();
        void idx;
      });

      // Stability check
      const now = Date.now();
      if (stableRef.current && cornersAreSimilar(corners, stableRef.current.corners)) {
        const elapsed  = now - stableRef.current.since;
        const progress = Math.min(elapsed / STABLE_MS, 1);
        setStableProgress(progress);

        if (elapsed >= STABLE_MS) {
          // ── AUTO-CAPTURE ────────────────────────────────────────────────
          capturedRef.current = true;
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

          // Capture full-resolution frame
          const capCanvas = document.createElement('canvas');
          capCanvas.width  = vW;
          capCanvas.height = vH;
          capCanvas.getContext('2d')!.drawImage(video, 0, 0, vW, vH);
          const imageBase64 = capCanvas.toDataURL('image/jpeg', 0.95);

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
        setStableProgress(0);
      }
    }, SCAN_INTERVAL_MS);
  }, [stopCamera]);

  // ── Torch toggle (mobile flash) ───────────────────────────────────────────
  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch { /* torch not supported on this device — fail silently */ }
  }, [torchOn]);

  // ── Transition handlers ────────────────────────────────────────────────────
  const openScanner = useCallback(() => {
    setProcessingErr(null);
    setPreviewSrc(null);
    setDetectedCorners(null);
    setScanState('instructions');
  }, []);

  const closeScanner = useCallback(() => {
    stopCamera();
    if (skipChoice && onClose) {
      // Standalone mode: let the parent unmount us — don't render choice UI
      onClose();
    } else {
      setScanState(null);
    }
  }, [stopCamera, skipChoice, onClose]);

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
      const attachment = await imgBase64ToPdfAttachment(previewSrc);
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

  // ── skipChoice: open scanner directly on mount ────────────────────────────
  useEffect(() => {
    if (skipChoice && mounted && !scanState) {
      setProcessingErr(null);
      setPreviewSrc(null);
      setDetectedCorners(null);
      setScanState('instructions');
    }
  // openScanner deps — replicated inline to avoid stale closure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipChoice, mounted]);

  // ── Overlay UI ────────────────────────────────────────────────────────────
  const scannerOverlay = scanState && scanState !== 'done' ? (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" style={{ touchAction: 'none' }}>
      {/* Scan-line keyframe — injected once inside the overlay */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanLine {
          0%   { top: 5%; }
          50%  { top: 90%; }
          100% { top: 5%; }
        }
      ` }} />

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
        <div className="flex items-center gap-1">
          {/* Torch / flash — only while camera is active */}
          {scanState === 'scanning' && (
            <button
              onClick={toggleTorch}
              title={torchOn ? 'Apagar flash' : 'Encender flash'}
              className={`p-2 rounded-lg transition-all ${
                torchOn
                  ? 'text-amber-400 bg-amber-400/20 hover:bg-amber-400/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
              }`}
            >
              <FaLightbulb size={18} />
            </button>
          )}
          <button onClick={closeScanner} className="text-white p-2 hover:text-gray-300 transition-colors">
            <FaTimes size={20} />
          </button>
        </div>
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
            {/* Video + overlay wrapper */}
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ maxHeight: '62vh' }}>
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover block"
              />

              {/* Overlay canvas — pixel-matched to display size for accurate alignment */}
              <canvas
                ref={overlayRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {/* CamScanner-style animated scan line — visible while searching */}
              {!detectedCorners && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div
                    className="absolute left-0 right-0 h-0.5"
                    style={{
                      background: 'linear-gradient(to right, transparent, #8AAA19, transparent)',
                      boxShadow: '0 0 8px 2px rgba(138,170,25,0.5)',
                      animation: 'scanLine 2s ease-in-out infinite',
                    }}
                  />
                </div>
              )}

              {/* "Manténgase quieto" overlay — visible during stability countdown */}
              {detectedCorners && stableProgress > 0 && (
                <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
                  <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2">
                    <span className="text-white text-xs font-bold tracking-wide">¡Manténgase quieto!</span>
                    {/* Mini progress bar */}
                    <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#8AAA19] rounded-full transition-all duration-100"
                        style={{ width: `${stableProgress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden offscreen detection canvas */}
            <canvas ref={detectRef} className="hidden" />

            {/* Status bar below camera */}
            <div className={`w-full max-w-sm rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-all duration-300 ${
              detectedCorners
                ? 'bg-[#8AAA19]/20 text-[#8AAA19] border border-[#8AAA19]/40'
                : 'bg-white/10 text-gray-400'
            }`}>
              {detectedCorners
                ? `Hoja detectada (${Math.round(sheetCoverage * 100)}%)`
                : 'Apunta a la hoja blanca sobre fondo oscuro'}
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
