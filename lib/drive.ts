// /lib/drive.ts
import { google } from 'googleapis';
import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
* Crea un GoogleAuth:
* - Opción A: usa ruta a JSON en GOOGLE_APPLICATION_CREDENTIALS
* - Opción B: usa el contenido del JSON en GOOGLE_APPLICATION_CREDENTIALS_JSON
*/
function getAuth() {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (path && path.trim() !== '') {
    return new google.auth.GoogleAuth({ keyFile: path, scopes: SCOPES });
  }
  if (json && json.trim() !== '') {
    const creds = JSON.parse(json);
    return new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
  }
  throw new Error('Faltan credenciales de Google: define GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_APPLICATION_CREDENTIALS_JSON');
}

function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
* Sube un archivo a Drive y devuelve el webViewLink
*/
export async function uploadToDrive(
  buffer: Buffer,
  name: string,
  mimeType: string,
  folderId: string
): Promise<string> {
  const auth = getAuth(); // GoogleAuth
  const drive = google.drive({ version: 'v3', auth }); // <== tipado válido

  const { data } = await drive.files.create({
    requestBody: { name, parents: [folderId], mimeType },
    media: { mimeType, body: bufferToStream(buffer) },
    fields: 'id, webViewLink'
  } as any);

  return data.webViewLink || '';
}

