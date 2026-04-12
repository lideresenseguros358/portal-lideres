import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { computeHomography, invertHomography, warpPerspective } from '@/lib/utils/perspective-transform';

// A4 portrait at 150 DPI → 1240 × 1754 px
const OUT_W = 1240;
const OUT_H = 1754;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      imageBase64: string;
      corners: { x: number; y: number }[]; // [TL, TR, BR, BL] in original image pixels
      srcW: number; // original capture width
      srcH: number; // original capture height
    };

    const { imageBase64, corners, srcW, srcH } = body;

    if (!imageBase64 || !corners || corners.length !== 4) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // ── 1. Decode base64 → buffer ──────────────────────────────────────────
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const inputBuffer = Buffer.from(base64Data, 'base64');

    // ── 2. Get raw RGBA pixels from Sharp ──────────────────────────────────
    const { data: rawData, info } = await sharp(inputBuffer)
      .resize(srcW, srcH, { fit: 'fill' }) // normalise to declared capture size
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const srcPixels = new Uint8ClampedArray(rawData);

    // ── 3. Perspective warp → A4 ───────────────────────────────────────────
    const dstCorners = [
      { x: 0,        y: 0 },
      { x: OUT_W - 1, y: 0 },
      { x: OUT_W - 1, y: OUT_H - 1 },
      { x: 0,        y: OUT_H - 1 },
    ];

    const H    = computeHomography(corners, dstCorners);
    const Hinv = invertHomography(H);

    const warpedRgba = warpPerspective(
      srcPixels,
      info.width,
      info.height,
      OUT_W,
      OUT_H,
      Hinv,
    );

    const warpedBuffer = Buffer.from(warpedRgba);

    // ── 4. Adobe Scan-style grayscale pipeline ────────────────────────────────
    //
    //   Goal: professional document scan — pure-white paper, dark legible ink,
    //         preserved cédula photo detail. Equivalent to what CamScanner /
    //         Adobe Scan produce with their "B&W document" mode.
    //
    //   Step 1 — greyscale
    //     Standard luma conversion. Single channel going forward.
    //
    //   Step 2 — normalise({ lower:1, upper:96 })
    //     Global exposure correction: maps the 1st–96th percentile to 0–255.
    //     upper:96 clips the top 4 % (specular glare hotspots) from the white
    //     point so the glare doesn't anchor 255 and leave the actual paper gray.
    //     After this step the paper is at ~200-240 (light gray), not yet white.
    //
    //   Step 3 — clahe({ width:256, height:256, maxSlope:3 })
    //     Contrast Limited Adaptive Histogram Equalization.
    //     The A4 output (1240×1754 px) is divided into ~5×7 tiles of 256×256 px.
    //     Within each tile the algorithm independently redistributes the histogram
    //     (capped at slope 3 to prevent noise amplification).
    //     Effect: each tile's local maximum (the gray paper) maps to pure white;
    //     ink and photo details retain their relative tones.  This is the same
    //     technique used internally by Adobe Scan to neutralise uneven phone
    //     lighting without blowing out document content.
    //     maxSlope:3 = moderate clip limit — aggressive enough to whiten paper,
    //     safe enough not to create ring artifacts around the cédula photo.
    //
    //   Step 4 — sharpen({ sigma:0.5, m1:0, m2:1.0 })
    //     Slightly stronger sharpening than before (m2 raised 0.7→1.0) to restore
    //     crispness after CLAHE's slight smoothing.  m1:0 skips flat-area halos.
    //
    //   Deliberately omitted:
    //     • linear(a,b)  — was causing the "rough photocopy" texture complaint.
    //     • threshold    — binarises to pure B&W, destroys photo on cédula.
    const processedBuffer = await sharp(warpedBuffer, {
      raw: { width: OUT_W, height: OUT_H, channels: 4 },
    })
      .greyscale()
      .normalise({ lower: 1, upper: 96 })
      .clahe({ width: 256, height: 256, maxSlope: 3 })
      .sharpen({ sigma: 0.5, m1: 0, m2: 1.0 })
      .jpeg({ quality: 95, mozjpeg: false })
      .toBuffer();

    // ── 5. Return base64 JPEG ─────────────────────────────────────────────
    const resultBase64 = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;

    return NextResponse.json({ processedBase64: resultBase64 });

  } catch (err) {
    console.error('[cedula-scanner] process error:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
