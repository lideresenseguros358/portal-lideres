const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Compresses an image File so it stays under maxBytes using Canvas.
 * PDFs are returned as-is (Canvas can't compress them).
 * Already-small images are returned as-is.
 *
 * Strategy:
 *  1. Draw the image to a canvas, preserving original dimensions.
 *  2. Export as JPEG and step quality down (0.9 → 0.1) until it fits.
 *  3. If quality alone isn't enough, halve the dimensions and retry.
 */
export async function compressImageFile(
  file: File,
  maxBytes: number = MAX_BYTES,
): Promise<File> {
  // PDFs and already-small files skip compression
  if (file.type === 'application/pdf' || file.size <= maxBytes) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let width = img.naturalWidth;
      let height = img.naturalHeight;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Try progressively lower quality; if still too big, halve dimensions once
      const qualitySteps = [0.92, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15];
      const dimensionPasses = [1, 0.5]; // original size, then half

      for (const scaleFactor of dimensionPasses) {
        canvas.width = Math.round(width * scaleFactor);
        canvas.height = Math.round(height * scaleFactor);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        for (const quality of qualitySteps) {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64 = dataUrl.split(',')[1] ?? '';
          const byteCount = Math.ceil((base64.length * 3) / 4);

          if (byteCount <= maxBytes) {
            // Convert dataUrl → Blob → File preserving the original filename
            canvas.toBlob(
              (blob) => {
                if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
                const ext = file.name.replace(/\.[^.]+$/, '');
                resolve(new File([blob], `${ext}.jpg`, { type: 'image/jpeg' }));
              },
              'image/jpeg',
              quality,
            );
            return;
          }
        }
      }

      // Last resort: lowest quality + half dimensions
      canvas.width = Math.round(width * 0.5);
      canvas.height = Math.round(height * 0.5);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          const ext = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${ext}.jpg`, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.1,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen para comprimir'));
    };

    img.src = url;
  });
}
