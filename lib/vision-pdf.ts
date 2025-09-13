// /lib/vision-pdf.ts
import vision from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';

const client = new vision.ImageAnnotatorClient();
const storage = new Storage();

export async function ocrPdfViaGcs(pdfBuffer: Buffer, gcsBucket: string) {
  const bucket = storage.bucket(gcsBucket);

  // 1) Subir PDF temporal
  const inName = `in/${Date.now()}.pdf`;
  await bucket.file(inName).save(pdfBuffer, { contentType: 'application/pdf' });

  // 2) Definir salida
  const outPrefix = `out/${Date.now()}`;
  const outputUri = `gs://${gcsBucket}/${outPrefix}/`;

  // 3) Llamar Vision batch (DOCUMENT_TEXT_DETECTION)
  const request = {
    requests: [{
      inputConfig: { mimeType: 'application/pdf', gcsSource: { uri: `gs://${gcsBucket}/${inName}` } },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      outputConfig: { gcsDestination: { uri: outputUri } },
    }],
  };

  const [operation] = await client.asyncBatchAnnotateFiles(request as any);
  await operation.promise();

  // 4) Leer JSON(es) generados
  const [files] = await bucket.getFiles({ prefix: outPrefix });
  let fullText = '';
  for (const f of files) {
    const [buf] = await f.download();
    const json = JSON.parse(buf.toString());
    const responses = json.responses ?? [];
    for (const r of responses) {
      fullText += (r?.fullTextAnnotation?.text ?? '') + '\n';
    }
  }

  // 5) Limpiar (opcional, reduce a casi $0)
  await bucket.file(inName).delete({ ignoreNotFound: true });
  for (const f of files) await f.delete({ ignoreNotFound: true });

  return fullText.trim();
}
