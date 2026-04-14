import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { computeHomography, invertHomography, warpPerspective } from '@/lib/utils/perspective-transform';

// Letter portrait at 150 DPI → 1275 × 1650 px  (8.5" × 11")
const OUT_W = 1275;
const OUT_H = 1650;

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

    // ── 3. Perspective warp → Letter ────────────────────────────────────────
    const dstCorners = [
      { x: 0,         y: 0 },
      { x: OUT_W - 1, y: 0 },
      { x: OUT_W - 1, y: OUT_H - 1 },
      { x: 0,         y: OUT_H - 1 },
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

    // ── 4. Clean color-document pipeline ────────────────────────────────────
    //
    //   WHY the previous homomorphic filter was removed
    //   ─────────────────────────────────────────────────
    //   The old pipeline:
    //     grayscale → downsample×8 → Gaussian blur → upsample×8 (cubic) → divide
    //
    //   The cubic resize kernel overshoots at high-contrast edges (ringing /
    //   Gibbs phenomenon).  When this wavy background estimate is used as the
    //   divisor, the rings are amplified across the entire page as visible
    //   horizontal / vertical bands.
    //
    //   Additionally, the original reason for the filter (white synthetic border
    //   pixels anchoring Sharp's normalise white-point) no longer applies:
    //   warpPerspective now uses border-clamping (commit 4718084c), so out-of-
    //   bounds pixels replicate the nearest source pixel (dark table) instead of
    //   filling with white.
    //
    //   NEW PIPELINE — color, no artifacts
    //   ────────────────────────────────────
    //   • Keep RGB color — preserves the cédula photo and colored seals/text.
    //   • normalise(2, 98): stretches contrast so phone-camera gray paper → white
    //     and dark text → black.  The 2% / 98% percentile clip ignores the few
    //     dark border-clamp pixels at the warp edges.
    //   • sharpen: unsharp mask tuned for text — sharpens edges only (m1=0),
    //     boosts fine strokes (m2=3), no flat-area ringing (sigma=1.2).
    //   • JPEG 92%: well above the artifact threshold; good quality/size ratio.

    const processedBuffer = await sharp(warpedBuffer, {
      raw: { width: OUT_W, height: OUT_H, channels: 4 },
    })
      .removeAlpha()
      .normalise({ lower: 2, upper: 98 })
      .sharpen({ sigma: 1.2, m1: 0, m2: 3 })
      .jpeg({ quality: 92, mozjpeg: false })
      .toBuffer();

    // ── 5. Return base64 JPEG ─────────────────────────────────────────────
    const resultBase64 = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;

    return NextResponse.json({ processedBase64: resultBase64 });

  } catch (err) {
    console.error('[cedula-scanner] process error:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
