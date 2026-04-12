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

    // ── 4. Adobe Scan-style pipeline: homomorphic background division ────────────
    //
    //   WHY previous approaches failed
    //   ────────────────────────────────
    //   normalise() / CLAHE both failed because the perspective warp fills every
    //   pixel outside the detected quadrilateral with white (255).  Those synthetic
    //   border pixels anchor the "white point" at 255, so the real paper (captured
    //   at ~150-200 gray by the phone camera) never reaches 255 — it stays gray.
    //
    //   THE CORRECT TECHNIQUE
    //   ──────────────────────
    //   Homomorphic filtering / background division:
    //
    //     out(x,y) = clamp( pixel(x,y) / background(x,y) × 255 , 0, 255 )
    //
    //   The "background" is estimated by HEAVILY blurring the grayscale image
    //   (downsample ×8 → Gaussian σ=15 → upsample ×8, equivalent to σ≈120 px on
    //   the full image).  At σ=120 px the blur:
    //     • Spans the cédula card (~500 px wide) → background inside the card
    //       is influenced mostly by the surrounding white paper → stays near 180
    //     • Accurately tracks the slow illumination gradient across the page
    //
    //   Result interpretation (typical phone capture values):
    //     Paper  pixel≈180  bg≈175  → 180/175 × 255 = 262  → clamped 255 (white ✓)
    //     Ink    pixel≈50   bg≈175  → 50/175  × 255 ≈  73             (dark grey ✓)
    //     Photo  pixel≈120  bg≈165  → 120/165 × 255 ≈ 185            (mid grey  ✓)
    //     Glare  pixel≈240  bg≈175  → 240/175 × 255 = 349  → clamped 255 (white ✓)
    //     Synth. white  255  bg≈255  → 255/255 × 255 = 255             (white ✓)
    //
    //   This is exactly what Adobe Scan / CamScan do in "Grayscale document" mode.

    // (a) Greyscale — 1 channel per pixel
    //     .removeAlpha() first guarantees 3→1 channel conversion (not 4→2)
    const { data: grayBuf, info: grayInfo } = await sharp(warpedBuffer, {
      raw: { width: OUT_W, height: OUT_H, channels: 4 },
    })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const grayChannels = grayInfo.channels; // 1 after removeAlpha+greyscale

    // (b) Illumination background estimate
    //     downsample ×8 → blur σ=15 → upsample ×8
    //     Effective σ ≈ 120 px on the A4 output.
    const DSAMPLE = 8;
    const dsW     = Math.round(OUT_W / DSAMPLE); // 155 px
    const dsH     = Math.round(OUT_H / DSAMPLE); // 219 px

    const { data: bgBuf } = await sharp(grayBuf, {
      raw: { width: OUT_W, height: OUT_H, channels: grayChannels },
    })
      .resize(dsW, dsH, { kernel: 'cubic' })
      .blur(15)
      .resize(OUT_W, OUT_H, { kernel: 'cubic' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // (c) Per-pixel division: removes illumination field, maps paper → white
    const N       = OUT_W * OUT_H;
    const normBuf = Buffer.alloc(N);
    for (let i = 0; i < N; i++) {
      const p  = grayBuf.readUInt8(i * grayChannels);
      const bg = bgBuf.readUInt8(i * grayChannels);
      // Clamp background minimum at 30 to avoid amplifying pitch-black regions
      normBuf[i] = Math.min(255, Math.round(p / Math.max(bg, 30) * 255));
    }

    // (d) Sharpen text edges and encode
    const processedBuffer = await sharp(normBuf, {
      raw: { width: OUT_W, height: OUT_H, channels: 1 },
    })
      .sharpen({ sigma: 0.6, m1: 0, m2: 1.5 })
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
