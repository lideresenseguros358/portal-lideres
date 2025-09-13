// /lib/gcloud.ts
// Soporta credenciales por JSON embebido (GOOGLE_APPLICATION_CREDENTIALS_JSON),
// por ruta a keyfile (GC_KEY_FILE), o ADC (Application Default Credentials).
// Exporta:
//   - GC_BUCKET
//   - storage (Google Cloud Storage client)
//   - visionClient (ImageAnnotatorClient)
//   - uploadBufferToGcs(buf, destPath, contentType) -> gs:// URI
//   - readGcsText(gsUri) -> string (OCR; PDF o imagen)

import { Storage, StorageOptions } from '@google-cloud/storage';
import vision from '@google-cloud/vision';
import { protos, v1 } from '@google-cloud/vision';

// =========================
// 1) Opciones de cliente
// =========================
function getClientOptions(): StorageOptions {
  // 1) JSON embebido (ideal en Vercel / variables de entorno)
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (json) {
    const creds = JSON.parse(json);
    return {
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
      projectId: creds.project_id,
    };
  }

  // 2) Keyfile local
  const keyFile = process.env.GC_KEY_FILE;
  if (keyFile) {
    return {
      keyFilename: keyFile,
      projectId: process.env.GC_PROJECT_ID,
    };
  }

  // 3) ADC (sin opciones) + projectId opcional
  return {
    projectId: process.env.GC_PROJECT_ID,
  };
}

// =========================
// 2) Clientes y constantes
// =========================
export const GC_BUCKET = (process.env.GC_BUCKET ?? '').trim();

const clientOptions = getClientOptions();

export const storage = new Storage(clientOptions);

// Cliente de Vision (usa mismas credenciales)
export const visionClient = new vision.ImageAnnotatorClient(clientOptions as any);

// =========================
// 3) Helpers
// =========================

/**
* Sube un Buffer a GCS y retorna la URI gs://...
*/
export async function uploadBufferToGcs(
  buf: Buffer,
  destPath: string,
  contentType: string
): Promise<string> {
  if (!GC_BUCKET) throw new Error('GC_BUCKET no está configurado');
  const file = storage.bucket(GC_BUCKET).file(destPath);

  await file.save(buf, {
    metadata: { contentType },
    resumable: false,
  });

  return `gs://${GC_BUCKET}/${destPath}`;
}

/**
* Lee texto (OCR) desde una URI gs://... (PDF o imagen).
* Para PDF usa batchAnnotateFiles con DOCUMENT_TEXT_DETECTION.
* Para imagen usa documentTextDetection directo.
*/
export async function readGcsText(gsUri: string): Promise<string> {
  const isPdf =
    /\.pdf(\?|$)/i.test(gsUri) || gsUri.toLowerCase().includes('.pdf');

  try {
    if (isPdf) {
      const FeatureType =
        protos.google.cloud.vision.v1.Feature.Type;

      // Remove duplicate declaration
      const req = {
        requests: [
          {
            inputConfig: {
              mimeType: 'application/pdf',
              gcsSource: { uri: gsUri },
            },
            features: [
              { type: FeatureType.DOCUMENT_TEXT_DETECTION },
            ],
          },
        ],
      };
      // Nota: el tipo del método es un poco verboso; casteamos a any para
      // evitar incompatibilidades menores de tipos entre versiones.
      const [resp] = await (visionClient as any).batchAnnotateFiles(req);

      // Estructura: responses[0].responses[0].fullTextAnnotation?.text
      return (
        resp?.responses?.[0]?.responses?.[0]?.fullTextAnnotation?.text ?? ''
      );
    } else {
      const [result] = await visionClient.documentTextDetection(gsUri);
      return result?.fullTextAnnotation?.text ?? '';
    }
  } catch (error) {
    // Always return a string even on error
    return '';
  }
}

