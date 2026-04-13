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
  | 'camera-permission'
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
const SAMPLE_STEP = 6;          // sample every Nth pixel (finer = more accurate corners, was 8)
const WHITE_LUM = 205;          // luminance threshold to classify a pixel as "white sheet" (was 175, stricter for external objects)
const MIN_WHITE_COUNT = 120;    // minimum sampled white pixels to consider sheet present (was 60, stricter)
const STABLE_MS = 800;          // ms corners must stay stable before auto-capture
const STABLE_PX = 25;           // max pixel drift still considered "stable" (was 18, more tolerant)
const SCAN_INTERVAL_MS = 80;    // edge detection runs every 80ms
const MIN_ASPECT_RATIO = 1.1;   // min aspect ratio for detected sheet (letter is ~1.3, portrait oriented)
const MAX_ASPECT_RATIO = 1.5;   // max aspect ratio for detected sheet
const AUTO_TORCH_LOW = 75;      // luminance threshold to ENABLE torch (low light detected)
const AUTO_TORCH_HIGH = 110;    // luminance threshold to DISABLE torch (high light detected, hysteresis)

// ── Helper: convert base64 image (JPEG or PNG) → PDF → FileAttachment ──────────

async function imgBase64ToPdfAttachment(imgBase64: string): Promise<FileAttachment> {
  const isJpeg = imgBase64.startsWith('data:image/jpeg');
  const base64Data = imgBase64.replace(/^data:image\/\w+;base64,/, '');
  const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  // Letter portrait in PDF points (72dpi): 612 × 792  (8.5" × 11")
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([612, 792]);
  const img    = isJpeg
    ? await pdfDoc.embedJpg(imgBytes)
    : await pdfDoc.embedPng(imgBytes);

  const { width: imgW, height: imgH } = img.scale(1);
  const scaleW = 612 / imgW;
  const scaleH = 792 / imgH;
  const scale  = Math.min(scaleW, scaleH);

  page.drawImage(img, {
    x: (612 - imgW * scale) / 2,
    y: (792 - imgH * scale) / 2,
    width:  imgW * scale,
    height: imgH * scale,
  });

  const pdfBytes = await pdfDoc.save();
  // Chunked conversion — avoids "Maximum call stack size exceeded" on large PDFs
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < pdfBytes.length; i += CHUNK) {
    binary += String.fromCharCode(...Array.from(pdfBytes.subarray(i, i + CHUNK)));
  }
  const base64 = btoa(binary);
  return { base64, name: 'cedula_escaneada.pdf', mimeType: 'application/pdf' };
}

// ── Helper: detect 4 corners of the white sheet ───────────────────────────────
//
// Approach: standard diagonal scoring over ALL white pixels, guarded by a
// frame-corner brightness check to reject bright backgrounds.
//
//   Frame-corner check (runs first):
//     Sample the 4 corners of the video frame.  If ≥ 2 are bright (≥ WHITE_LUM),
//     the ambient background is too light to reliably distinguish paper edges
//     → return null.  When the paper is on a DARK surface, the frame corners are
//     always dark even when the paper fills 90 %+ of the frame.
//
//   Diagonal scoring (all white pixels):
//     TL = min(x+y)  → closest to top-left corner
//     TR = max(x-y)  → closest to top-right corner
//     BL = max(y-x)  → closest to bottom-left corner
//     BR = max(x+y)  → closest to bottom-right corner
//
//   Why NOT boundary-only scoring (previous attempt):
//     When the paper fills the top portion of the frame, only its BOTTOM EDGE
//     touches a dark region — the top/left/right paper edges are at the frame
//     boundary with no contrast.  Boundary-only scoring then finds zero boundary
//     pixels at the top, and all 4 corners collapse to the bottom edge, drawing
//     the polygon on the desk instead of the paper.

function detectCorners(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
): { corners: Corner[]; coverage: number } | null {
  const imgData = ctx.getImageData(0, 0, W, H);
  const pix = imgData.data;

  // Inline luminance helper
  const lum = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return 0.299 * (pix[i] ?? 0) + 0.587 * (pix[i + 1] ?? 0) + 0.114 * (pix[i + 2] ?? 0);
  };

  // ── Frame-corner brightness check ────────────────────────────────────────
  // Reject if ≥ 2 frame corners are bright (bright background / no dark surface).
  // Also reject if ANY corner is extremely bright (>245) which indicates backlit/bright environment
  const margin = SAMPLE_STEP * 2;
  const frameCornerBrightness = [
    lum(margin, margin),
    lum(W - margin, margin),
    lum(margin, H - margin),
    lum(W - margin, H - margin),
  ];
  const brightFrameCorners = frameCornerBrightness.filter(l => l > WHITE_LUM).length;
  const extremelyBrightCorners = frameCornerBrightness.filter(l => l > 245).length;
  if (brightFrameCorners >= 2 || extremelyBrightCorners >= 1) return null;

  // ── Diagonal scoring over all white pixels ────────────────────────────────
  let tlScore =  Infinity, tlX = 0, tlY = 0;
  let trScore = -Infinity, trX = W, trY = 0;
  let blScore = -Infinity, blX = 0, blY = H;
  let brScore = -Infinity, brX = W, brY = H;
  let whiteCount = 0;
  const total = Math.floor(W / SAMPLE_STEP) * Math.floor(H / SAMPLE_STEP);

  for (let y = 0; y < H; y += SAMPLE_STEP) {
    for (let x = 0; x < W; x += SAMPLE_STEP) {
      if (lum(x, y) > WHITE_LUM) {
        whiteCount++;
        if (x + y < tlScore) { tlScore = x + y; tlX = x; tlY = y; }
        if (x - y > trScore) { trScore = x - y; trX = x; trY = y; }
        if (y - x > blScore) { blScore = y - x; blX = x; blY = y; }
        if (x + y > brScore) { brScore = x + y; brX = x; brY = y; }
      }
    }
  }

  if (whiteCount < MIN_WHITE_COUNT) return null;

  // ── Sanity check: minimum span ────────────────────────────────────────────
  const spanW = Math.max(trX, brX) - Math.min(tlX, blX);
  const spanH = Math.max(blY, brY) - Math.min(tlY, trY);

  // Stricter span requirements to reject small/partial objects
  if (spanW < W * 0.20 || spanH < H * 0.18) return null;

  // Aspect ratio validation: letter paper is ~1.3 (11" / 8.5")
  // Reject if too wide or too tall (likely external objects)
  const aspectRatio = spanW / spanH;
  if (aspectRatio < MIN_ASPECT_RATIO || aspectRatio > MAX_ASPECT_RATIO) return null;

  // ── Interior density check: validate the inside has enough white pixels ─────
  // This prevents detecting hollow or partially white shapes
  const minX = Math.min(tlX, blX);
  const maxX = Math.max(trX, brX);
  const minY = Math.min(tlY, trY);
  const maxY = Math.max(blY, brY);

  let interiorWhiteCount = 0;
  let interiorSamples = 0;
  for (let y = minY + SAMPLE_STEP * 2; y < maxY - SAMPLE_STEP * 2; y += SAMPLE_STEP) {
    for (let x = minX + SAMPLE_STEP * 2; x < maxX - SAMPLE_STEP * 2; x += SAMPLE_STEP) {
      interiorSamples++;
      if (lum(x, y) > WHITE_LUM) interiorWhiteCount++;
    }
  }
  // Interior must be at least 50% white
  if (interiorSamples > 0 && interiorWhiteCount / interiorSamples < 0.5) return null;

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

// ── Helper: calculate average luminance of video frame ──────────────────────
function calculateAverageLuminance(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
): number {
  const imgData = ctx.getImageData(0, 0, W, H);
  const pix = imgData.data;
  let totalLum = 0;
  let count = 0;

  // Sample every 16th pixel for speed
  const samplingStep = 16;
  for (let i = 0; i < pix.length; i += samplingStep * 4) {
    const r = pix[i] ?? 0;
    const g = pix[i + 1] ?? 0;
    const b = pix[i + 2] ?? 0;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLum += lum;
    count++;
  }

  return count > 0 ? totalLum / count : 128;
}

// ── Helper: robust camera access with fallbacks for Android/iOS compatibility ──
// Attempts multiple constraint profiles to maximize compatibility
async function requestCameraStream(): Promise<{ stream: MediaStream | null; error?: string }> {
  // Strategy: try increasingly permissive constraints to maximize compatibility
  const strategies: MediaStreamConstraints[] = [
    // Strategy 1: Ideal 1280x960 with environment facing (iOS + modern Android)
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
      audio: false,
    },
    // Strategy 2: Exact resolution requirement removed, just facing mode (older Android)
    {
      video: {
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    },
    // Strategy 3: No facing mode preference, let device choose (fallback)
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: Error | null = null;

  for (let i = 0; i < strategies.length; i++) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(strategies[i]);
      return { stream };
    } catch (err) {
      lastError = err as Error;
      // Continue to next strategy
    }
  }

  // Determine specific error message based on error type
  let errorMsg = 'No se pudo acceder a la cámara. Permite el acceso e intenta de nuevo.';

  if (lastError) {
    const errorName = lastError.name;
    if (errorName === 'NotAllowedError') {
      errorMsg = 'Permiso denegado. Por favor, activa el acceso a la cámara en tu dispositivo.';
    } else if (errorName === 'NotFoundError') {
      errorMsg = 'No se encontró cámara en tu dispositivo.';
    } else if (errorName === 'NotReadableError') {
      errorMsg = 'La cámara está siendo usada por otra aplicación. Cierra otras apps e intenta de nuevo.';
    } else if (errorName === 'OverconstrainedError') {
      errorMsg = 'Tu dispositivo no soporta los requisitos de cámara especificados.';
    } else if (errorName === 'TypeError') {
      errorMsg = 'Tu navegador no soporta acceso a cámara. Usa Chrome, Firefox o Safari.';
    }
  }

  return { stream: null, error: errorMsg };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CedulaDocScanner({ value, onChange, error, skipChoice, onClose }: Props) {
  // ── Static file upload ref (for "Sí, ya tengo copia") ──────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Portal mount ───────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  useEffect(() => {
    setMounted(true);
    // Check if camera API is supported
    const hasCamera = !!(
      navigator?.mediaDevices?.getUserMedia ||
      (navigator as any)?.getUserMedia ||
      (navigator as any)?.webkitGetUserMedia ||
      (navigator as any)?.mozGetUserMedia
    );
    setCameraSupported(hasCamera);
  }, []);

  // ── Scanner state ──────────────────────────────────────────────────────────
  const [scanState, setScanState]         = useState<ScanState | null>(null);
  const [previewSrc, setPreviewSrc]       = useState<string | null>(null);
  const [processingErr, setProcessingErr] = useState<string | null>(null);
  const [detectedCorners, setDetectedCorners] = useState<Corner[] | null>(null);
  const [sheetCoverage, setSheetCoverage] = useState(0);
  const [torchOn, setTorchOn]             = useState(false);
  const [stableProgress, setStableProgress] = useState(0); // 0-1 countdown to auto-capture
  const [avgLuminance, setAvgLuminance] = useState(128); // for display/debugging
  const [permissionRetries, setPermissionRetries] = useState(0); // track permission retry attempts
  const autoTorchRef = useRef(false); // tracks if auto-torch is currently managing torch state

  // ── SVG overlay viewBox — updated once when video metadata loads ──────────
  const [svgVW, setSvgVW] = useState(CAPTURE_W);
  const [svgVH, setSvgVH] = useState(CAPTURE_H);

  // ── Camera refs ────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const detectRef   = useRef<HTMLCanvasElement>(null);  // offscreen detection (hidden)
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableRef   = useRef<{ corners: Corner[]; since: number } | null>(null);
  const capturedRef = useRef(false);
  // When stream is pre-acquired (via permission step), attach it to video once
  // the 'scanning' state renders the <video> element into the DOM.
  const preloadedStreamRef = useRef(false);

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
    autoTorchRef.current = false;
    preloadedStreamRef.current = false;
    setTorchOn(false);
    setStableProgress(0);
  }, []);

  // ── Start camera ───────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    const { stream, error } = await requestCameraStream();
    if (error || !stream) {
      setProcessingErr(error || 'No se pudo acceder a la cámara. Permite el acceso e intenta de nuevo.');
      setScanState('instructions');
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch (err) {
        setProcessingErr('Error al reproducir video. Intenta de nuevo.');
        setScanState('instructions');
      }
    }
  }, []);

  // ── Edge detection loop ────────────────────────────────────────────────────
  // Uses an offscreen canvas to grab pixel data; drawing is done by the SVG
  // overlay in the JSX — no canvas drawing here.
  const startDetection = useCallback(() => {
    capturedRef.current = false;

    intervalRef.current = setInterval(() => {
      if (capturedRef.current) return;
      const video  = videoRef.current;
      const detect = detectRef.current;
      if (!video || !detect || video.readyState < 2) return;

      const vW = video.videoWidth  || CAPTURE_W;
      const vH = video.videoHeight || CAPTURE_H;

      // Offscreen canvas: full video resolution for accuracy
      detect.width  = vW;
      detect.height = vH;

      const dCtx = detect.getContext('2d', { willReadFrequently: true });
      if (!dCtx) return;
      dCtx.drawImage(video, 0, 0, vW, vH);

      // Calculate average luminance for auto-torch
      const avgLum = calculateAverageLuminance(dCtx, vW, vH);
      setAvgLuminance(avgLum);

      // ── Auto-torch logic with hysteresis ─────────────────────────────────
      // Enable if below LOW threshold, disable if above HIGH threshold
      const shouldTorchBeOn = autoTorchRef.current
        ? avgLum > AUTO_TORCH_HIGH // if torch is on, keep it on until we reach HIGH
        ? false
        : true
        : avgLum < AUTO_TORCH_LOW; // if torch is off, turn on only if below LOW

      if (shouldTorchBeOn !== autoTorchRef.current) {
        autoTorchRef.current = shouldTorchBeOn;
        // Auto-apply torch change
        const track = streamRef.current?.getVideoTracks()[0];
        if (track) {
          try {
            track.applyConstraints({ advanced: [{ torch: shouldTorchBeOn } as MediaTrackConstraintSet] });
            setTorchOn(shouldTorchBeOn);
          } catch {
            // torch not supported or already applied — ignore
          }
        }
      }

      // Detect corners of the white sheet
      const result = detectCorners(dCtx, vW, vH);
      setSheetCoverage(result?.coverage ?? 0);

      if (!result) {
        setDetectedCorners(null);
        stableRef.current = null;
        setStableProgress(0);
        return;
      }

      const { corners } = result;
      setDetectedCorners(corners);

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
      autoTorchRef.current = false; // user manual toggle disables auto-torch
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

  const goToCameraPermission = useCallback(() => {
    setPermissionRetries(0);
    setScanState('camera-permission');
  }, []);

  const goToConfirm = useCallback(() => setScanState('confirm'), []);

  // ── Request camera permission + immediately launch into scanning ─────────────
  // Android fix: do NOT stop the stream after getting permission — reuse it directly.
  // Making two getUserMedia calls in sequence (permission check then real scan) is
  // what causes NotAllowedError on Android even when the user already granted access.
  const requestCameraPermission = useCallback(async () => {
    setProcessingErr(null);

    const { stream, error } = await requestCameraStream();

    if (error || !stream) {
      setPermissionRetries(prev => {
        const next = prev + 1;
        let msg = error ?? 'No se pudo acceder a la cámara.';
        if (next >= 2) {
          msg = 'Permiso denegado. En Chrome: toca ··· → Configuración → Permisos del sitio → Cámara → busca este sitio y actívalo.';
        }
        setProcessingErr(msg);
        return next;
      });
      return;
    }

    // Stream is live — store it and mark it as preloaded so the useEffect below
    // can attach it to the <video> element once 'scanning' renders it into the DOM.
    streamRef.current = stream;
    preloadedStreamRef.current = true;
    setScanState('scanning');
    // startDetection is called from the useEffect that watches scanState → 'scanning'
  }, []);

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
      setScanState('instructions');
    }
  }, [previewSrc, onChange]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Attach preloaded stream once the <video> element enters the DOM ─────────
  // When the user comes from the 'camera-permission' step, we already have a live
  // stream in streamRef but the <video> element doesn't exist yet (it only renders
  // when scanState === 'scanning'). This effect fires after every state change and,
  // the first time it sees both the video element AND a preloaded stream, it wires
  // them up and kicks off edge detection.
  useEffect(() => {
    if (scanState !== 'scanning' || !preloadedStreamRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    preloadedStreamRef.current = false; // consume the flag — only wire up once
    video.srcObject = streamRef.current;
    video.play().catch(() => {/* autoplay policy — onPlay handles retry */});
    startDetection();
  }, [scanState, startDetection]);

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
      {/* SVG scan-line keyframe — moves the SVG <line> y attributes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes svgScanLine {
          0%   { transform: translateY(0); }
          50%  { transform: translateY(800px); }
          100% { transform: translateY(0); }
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
              onClick={goToCameraPermission}
              className="w-full py-3 text-sm font-bold bg-[#8AAA19] text-white rounded-xl hover:bg-[#6d8814] transition-colors"
            >
              Continuar
            </button>
          </div>
        )}

        {/* ── CAMERA PERMISSION ─────────────────────────────────── */}
        {scanState === 'camera-permission' && (
          <div className="w-full max-w-sm space-y-5">
            <div className="rounded-2xl border-2 border-blue-400/40 bg-blue-400/5 p-6 text-center space-y-4">
              <FaCamera size={40} className="mx-auto text-blue-400" />
              <div>
                <p className="text-white font-bold text-lg mb-2">Se necesita acceso a la cámara</p>
                <p className="text-gray-300 text-sm">
                  Toca "Permitir" en el siguiente paso para autorizar el acceso a la cámara de tu dispositivo.
                </p>
              </div>
              <div className="bg-blue-400/10 border border-blue-400/20 rounded-lg px-3 py-2 text-xs text-gray-400">
                {permissionRetries > 0 ? (
                  <p>Intento {permissionRetries}. Si aparece un diálogo, toca "Permitir".</p>
                ) : (
                  <p>Tu navegador te mostrará un diálogo solicitando permiso.</p>
                )}
              </div>
            </div>

            {processingErr && (
              <p className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {processingErr}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setScanState('instructions')}
                className="flex-1 py-3 text-sm font-semibold border-2 border-white/20 text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={requestCameraPermission}
                className="flex-1 py-3 text-sm font-bold bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <FaCamera size={14} /> {permissionRetries > 0 ? 'Reintentar' : 'Permitir'}
              </button>
            </div>
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
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ maxHeight: '65vh' }}>
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="w-full block"
                style={{ display: 'block', objectFit: 'cover' }}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setSvgVW(videoRef.current.videoWidth  || CAPTURE_W);
                    setSvgVH(videoRef.current.videoHeight || CAPTURE_H);
                  }
                }}
                onPlay={() => {
                  // Ensure video is actually playing (some Android devices need this)
                  if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.play().catch(() => {
                      // Autoplay may be blocked, but user interaction already happened
                    });
                  }
                }}
              />

              {/*
                SVG overlay — uses the SAME coordinate space as the video.
                viewBox matches the raw video pixel dimensions; preserveAspectRatio
                "xMidYMid slice" replicates `object-fit:cover` exactly, so polygon
                points in video-pixel space align perfectly with the live feed.
                No manual coordinate conversion needed.
              */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${svgVW} ${svgVH}`}
                preserveAspectRatio="xMidYMid slice"
              >
                {detectedCorners && (() => {
                  const pts = detectedCorners.map(c => `${c.x},${c.y}`).join(' ');
                  const cx  = detectedCorners.reduce((s, c) => s + c.x, 0) / 4;
                  const cy  = detectedCorners.reduce((s, c) => s + c.y, 0) / 4;
                  const ARM = 50; // in video pixels — looks ~18px on typical display
                  return (
                    <>
                      {/* Polygon: subtle fill + thin 2px-equivalent stroke */}
                      <polygon
                        points={pts}
                        fill="rgba(138,170,25,0.08)"
                        stroke="#8AAA19"
                        strokeWidth="6"
                        strokeLinejoin="round"
                      />
                      {/* L-bracket corner markers */}
                      {detectedCorners.map((c, i) => {
                        const dx = Math.sign(cx - c.x) || 1;
                        const dy = Math.sign(cy - c.y) || 1;
                        return (
                          <polyline
                            key={i}
                            points={`${c.x + dx * ARM},${c.y} ${c.x},${c.y} ${c.x},${c.y + dy * ARM}`}
                            fill="none"
                            stroke="#8AAA19"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        );
                      })}
                    </>
                  );
                })()}

                {/* Animated scan line — visible while no sheet detected */}
                {!detectedCorners && (
                  <line
                    x1="0" x2={svgVW} y1={svgVH * 0.1} y2={svgVH * 0.1}
                    stroke="#8AAA19" strokeWidth="4" opacity="0.7"
                    style={{ animation: 'svgScanLine 2s ease-in-out infinite' }}
                  />
                )}
              </svg>

              {/* "Manténgase quieto" overlay — visible during stability countdown */}
              {detectedCorners && stableProgress > 0 && (
                <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
                  <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2">
                    <span className="text-white text-xs font-bold tracking-wide">¡Manténgase quieto!</span>
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
              <img src={previewSrc} alt="Vista previa de la cédula escaneada" className="w-full block max-h-[55vh] object-contain bg-white" />
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
      {(scanState === 'scanning' || scanState === 'instructions' || scanState === 'confirm' || scanState === 'camera-permission') && (
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
          disabled={!cameraSupported}
          className={`flex flex-col items-center gap-2 px-3 py-4 border-2 rounded-xl transition-all text-center ${
            cameraSupported
              ? 'border-[#010139]/20 hover:border-[#010139] bg-[#010139]/5 hover:bg-[#010139]/10'
              : 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60'
          }`}
        >
          <FaCamera className={cameraSupported ? 'text-[#010139]' : 'text-gray-400'} size={20} />
          <span className={`text-xs font-semibold ${cameraSupported ? 'text-[#010139]' : 'text-gray-500'}`}>
            {cameraSupported ? 'No, escanear' : 'Cámara no disponible'}
          </span>
          <span className="text-xs text-gray-400">
            {cameraSupported ? 'Usar cámara' : 'Navegador no soportado'}
          </span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {!cameraSupported && (
        <p className="text-amber-600 text-xs font-medium bg-amber-50 px-3 py-2 rounded-lg">
          Tu navegador no soporta acceso a cámara. Usa Chrome, Firefox, Edge o Safari en iOS.
        </p>
      )}

      {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

      {/* Scanner portal */}
      {mounted && scannerOverlay && createPortal(scannerOverlay, document.body)}
    </div>
  );
}
