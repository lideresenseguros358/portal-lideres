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

    // ── 4. Gentle scan enhancement ────────────────────────────────────────
    //   greyscale → auto-levels → subtle sharpening → mild contrast lift
    //   NO threshold / binarise: keep grayscale so text and detail are preserved
    const processedBuffer = await sharp(warpedBuffer, {
      raw: { width: OUT_W, height: OUT_H, channels: 4 },
    })
      .greyscale()
      .normalise()                         // auto white/black point
      .linear(1.12, -8)                    // mild contrast lift (was 1.4 / -30)
      .sharpen({ sigma: 0.7, m1: 0, m2: 1.2 }) // subtle sharpening (was sigma 1.2 / m2 3)
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
