/**
 * perspective-transform.ts
 * Pure-JS homography: maps 4 source corners → rectangle (dstW × dstH).
 * Used by the backend to warp a document photo to A4 proportions.
 */

export interface Point { x: number; y: number; }

type Matrix8 = [number,number,number,number,number,number,number,number];
type Matrix9 = [number,number,number,number,number,number,number,number,number];

/** Gaussian elimination on an 8×9 augmented matrix. Returns the 8-element solution vector. */
function gaussianElim(aug: number[][]): number[] {
  const n = 8;
  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    let maxVal = Math.abs(aug[col]![col]!);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(aug[row]![col]!);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    const tmp = aug[col]!; aug[col] = aug[maxRow]!; aug[maxRow] = tmp;

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row]![col]! / aug[col]![col]!;
      for (let k = col; k <= n; k++) {
        aug[row]![k]! -= factor * aug[col]![k]!;
      }
    }
  }
  const h = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    h[i] = aug[i]![n]!;
    for (let j = i + 1; j < n; j++) h[i]! -= aug[i]![j]! * h[j]!;
    h[i]! /= aug[i]![i]!;
  }
  return h;
}

/**
 * Compute 3×3 homography H such that dst_pt = H * src_pt (homogeneous coords).
 * src/dst: 4 corners ordered [TL, TR, BR, BL].
 */
export function computeHomography(src: Point[], dst: Point[]): Matrix9 {
  const aug: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const sx = src[i]!.x, sy = src[i]!.y;
    const dx = dst[i]!.x, dy = dst[i]!.y;
    aug.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy, dx]);
    aug.push([0,  0,  0, sx, sy, 1, -dy * sx, -dy * sy, dy]);
  }
  const h = gaussianElim(aug);
  return [h[0]!,h[1]!,h[2]!,h[3]!,h[4]!,h[5]!,h[6]!,h[7]!,1];
}

/** Invert a 3×3 homography matrix (row-major flat array of 9). */
export function invertHomography(H: Matrix9): Matrix9 {
  const [h0,h1,h2,h3,h4,h5,h6,h7,h8] = H;
  const det = h0*(h4*h8-h5*h7) - h1*(h3*h8-h5*h6) + h2*(h3*h7-h4*h6);
  return [
    (h4*h8-h5*h7)/det, (h2*h7-h1*h8)/det, (h1*h5-h2*h4)/det,
    (h5*h6-h3*h8)/det, (h0*h8-h2*h6)/det, (h2*h3-h0*h5)/det,
    (h3*h7-h4*h6)/det, (h1*h6-h0*h7)/det, (h0*h4-h1*h3)/det,
  ];
}

/** Apply a 3×3 homography to a point. */
export function applyH(H: Matrix9, x: number, y: number): Point {
  const w = H[6]*x + H[7]*y + H[8];
  return { x: (H[0]*x + H[1]*y + H[2])/w, y: (H[3]*x + H[4]*y + H[5])/w };
}

/**
 * Warp RGBA pixel data using an inverse homography (dst → src mapping).
 * srcData: Uint8ClampedArray of size srcW × srcH × 4
 * Returns new Uint8ClampedArray of size dstW × dstH × 4.
 */
export function warpPerspective(
  srcData: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  Hinv: Matrix9,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);

  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      const { x: sx, y: sy } = applyH(Hinv, dx, dy);

      // Clamp source coords to valid bilinear range — replicates border pixel instead
      // of white-filling, which eliminates white lateral stripes at warp edges.
      const sxc = Math.max(0, Math.min(srcW - 1 - 1e-6, sx));
      const syc = Math.max(0, Math.min(srcH - 1 - 1e-6, sy));
      const x0  = Math.floor(sxc), y0 = Math.floor(syc);
      const x1  = x0 + 1,          y1 = y0 + 1;
      const fx  = sxc - x0,        fy = syc - y0;
      const di  = (dy * dstW + dx) * 4;

      const i00 = (y0*srcW + x0)*4, i10 = (y0*srcW + x1)*4;
      const i01 = (y1*srcW + x0)*4, i11 = (y1*srcW + x1)*4;

      for (let c = 0; c < 3; c++) {
        dst[di+c] = Math.round(
          (srcData[i00+c] ?? 255)*(1-fx)*(1-fy) +
          (srcData[i10+c] ?? 255)*fx*(1-fy) +
          (srcData[i01+c] ?? 255)*(1-fx)*fy +
          (srcData[i11+c] ?? 255)*fx*fy,
        );
      }
      dst[di+3] = 255;
    }
  }
  return dst;
}
