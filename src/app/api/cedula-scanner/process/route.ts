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

    // ── 3. Perspective warp → Letter ───────────────────────────────────────
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

    // ── 4. Adobe Scan-style pipeline: homomorphic background division ───────
    //
    //   This is the SAME approach as before but with the artifact-line bug fixed.
    //
    //   WHY LINES APPEARED BEFORE
    //   ──────────────────────────
    //   The background estimate used `kernel: 'cubic'` for both the 8× downsample
    //   AND the 8× upsample.  The cubic (Catmull-Rom) kernel has significant
    //   negative lobes → overshoots at every high-contrast edge (text, stamps).
    //   At ×8 upscale the ringing is amplified into visible horizontal/vertical
    //   bands.  Dividing the original by this banded background then printed the
    //   bands across the whole page.
    //
    //   THE FIX
    //   ────────
    //   • Downsample with `mitchell` — Mitchell-Netravali has tiny negative lobes
    //     (much less than cubic), gives smooth averaging without aliasing.
    //   • Upsample with `linear`    — bilinear has ZERO negative lobes → zero
    //     ringing.  The background estimate just needs to be smooth, not sharp.
    //
    //   Result: background estimate is artifact-free; division maps paper → white
    //   and text → dark grey exactly as before, with no band artifacts.

    // (a) Greyscale — 1 channel per pixel
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
    const dsW     = Math.round(OUT_W / DSAMPLE); // ~159 px
    const dsH     = Math.round(OUT_H / DSAMPLE); // ~206 px

    const { data: bgBuf } = await sharp(grayBuf, {
      raw: { width: OUT_W, height: OUT_H, channels: grayChannels },
    })
      .resize(dsW, dsH, { kernel: 'mitchell' }) // Mitchell: minimal ringing on downsample
      .blur(15)
      .resize(OUT_W, OUT_H, { kernel: 'linear' }) // bilinear: zero ringing on upsample
      .raw()
      .toBuffer({ resolveWithObject: true });

    // (c) Per-pixel division: removes illumination field, maps paper → white
    const N       = OUT_W * OUT_H;
    const normBuf = Buffer.alloc(N);
    for (let i = 0; i < N; i++) {
      const p  = grayBuf.readUInt8(i * grayChannels);
      const bg = bgBuf.readUInt8(i * grayChannels);
      // If background estimate is very low (<50), this pixel is in a genuinely dark
      // region (table edge).  Keep it dark — don't amplify dark/dark → white.
      normBuf[i] = bg < 50
        ? p
        : Math.min(255, Math.round(p / bg * 255));
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
