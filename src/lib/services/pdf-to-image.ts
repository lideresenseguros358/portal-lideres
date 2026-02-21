'use server';

/**
 * Convert PDF pages to PNG image buffers using pdfjs-dist + canvas.
 * No native dependencies (GraphicsMagick/Ghostscript) required.
 */
export async function pdfPagesToPng(pdfBuffer: Buffer, scale = 2.0): Promise<Buffer[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

  const pages: Buffer[] = [];

  const { createCanvas } = await import('canvas');

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    // pdfjs-dist v5 requires canvas + canvasContext + viewport
    await (page.render({
      canvas: canvas as any,
      canvasContext: ctx as any,
      viewport,
    } as any)).promise;

    const pngBuffer = canvas.toBuffer('image/png');
    pages.push(pngBuffer);

    console.log(`[PDF-TO-IMG] Página ${i}/${doc.numPages} renderizada (${viewport.width}x${viewport.height})`);
  }

  return pages;
}
