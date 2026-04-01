/**
 * WhatsApp Media Downloader
 * =========================
 * Downloads audio/image/document files from Meta's WhatsApp Cloud API
 * and converts them to Base64 for Vertex AI multimodal processing.
 *
 * Flow: GET /v18.0/{media_id} → resolve temporary URL → GET with Bearer → base64
 */

export interface WhatsAppMedia {
  base64: string;
  mimeType: string;
  fileSize: number;
}

// 20 MB — Gemini inlineData limit per request
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// Normalize WhatsApp MIME types to Gemini-supported equivalents
const MIME_NORMALIZE: Record<string, string> = {
  'audio/ogg':       'audio/ogg',
  'audio/mpeg':      'audio/mp3',
  'audio/mp4':       'audio/mp3',
  'audio/aac':       'audio/aac',
  'audio/wav':       'audio/wav',
  'audio/flac':      'audio/flac',
  'image/jpeg':      'image/jpeg',
  'image/jpg':       'image/jpeg',
  'image/png':       'image/png',
  'image/webp':      'image/webp',
  'image/gif':       'image/gif',
  'application/pdf': 'application/pdf',
};

function normalizeMime(raw: string): string {
  // Strip codec params (e.g. "audio/ogg; codecs=opus" → "audio/ogg")
  const parts = raw.split(';');
  const base = (parts[0] ?? raw).trim().toLowerCase();
  const mapped: string | undefined = MIME_NORMALIZE[base];
  return mapped !== undefined ? mapped : base;
}

export async function downloadWhatsAppMedia(
  mediaId: string,
  rawMimeType: string,
): Promise<WhatsAppMedia | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[MEDIA] WHATSAPP_ACCESS_TOKEN not configured');
    return null;
  }

  const mimeType = normalizeMime(rawMimeType);

  try {
    // Step 1: Resolve the temporary download URL from Meta Graph API
    const metaRes = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error(`[MEDIA] Meta resolve failed (${metaRes.status}): ${errText.substring(0, 200)}`);
      return null;
    }

    const metaJson = await metaRes.json();
    const downloadUrl: string | undefined = metaJson.url;
    const reportedSize: number | undefined = metaJson.file_size;

    if (!downloadUrl) {
      console.error('[MEDIA] No download URL in Meta response:', JSON.stringify(metaJson).substring(0, 200));
      return null;
    }

    if (reportedSize && reportedSize > MAX_FILE_SIZE_BYTES) {
      console.warn(`[MEDIA] File too large: ${reportedSize} bytes — skipping`);
      return null;
    }

    // Step 2: Download the actual binary using the temporary URL
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!fileRes.ok) {
      console.error(`[MEDIA] File download failed (${fileRes.status})`);
      return null;
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      console.warn(`[MEDIA] Downloaded file too large: ${buffer.length} bytes — skipping`);
      return null;
    }

    console.log(`[MEDIA] OK — id=${mediaId}, size=${buffer.length}B, mime=${mimeType}`);

    return {
      base64: buffer.toString('base64'),
      mimeType,
      fileSize: buffer.length,
    };
  } catch (err: any) {
    console.error('[MEDIA] Download exception:', err.message);
    return null;
  }
}
