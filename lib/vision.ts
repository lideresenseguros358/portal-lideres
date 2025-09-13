// /lib/vision.ts
import { visionClient, uploadBufferToGcs, readGcsText, GC_BUCKET } from './gcloud';
import { randomUUID } from 'crypto';

/** OCR para IMAGEN en Base64 (data URL permitido) */
export async function ocrImageFromBase64(fileBase64: string): Promise<string> {
  const base = fileBase64.replace(/^data:.*;base64,/, '');
  const buf = Buffer.from(base, 'base64');
  const name = `uploads/${Date.now()}_${randomUUID()}.png`;
  const gsUri = await uploadBufferToGcs(buf, name, 'image/png');
  return await readGcsText(gsUri);
}

/** OCR para PDF en Base64 (data URL permitido) */
export async function ocrPdfFromBase64(fileBase64: string): Promise<string> {
  const base = fileBase64.replace(/^data:.*;base64,/, '');
  const buf = Buffer.from(base, 'base64');
  const name = `uploads/${Date.now()}_${randomUUID()}.pdf`;
  const gsUri = await uploadBufferToGcs(buf, name, 'application/pdf');
  return await readGcsText(gsUri);
}

// Exporta también por si otros módulos requieren bucket o cliente
export { visionClient, GC_BUCKET };
