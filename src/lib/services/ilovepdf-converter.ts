/**
 * Servicio para procesar PDFs usando iLovePDF OCR API
 * Convierte PDFs escaneados en PDFs con texto extraíble/buscable
 * Tool: 'pdfocr' para aplicar OCR y luego extraer texto
 */

const ILOVEPDF_API_URL = 'https://api.ilovepdf.com/v1';

/**
 * Interfaz para las credenciales
 */
interface ILovePDFCredentials {
  publicKey: string;
  secretKey: string;
}

/**
 * Interfaz para la respuesta de autenticación
 */
interface AuthResponse {
  token: string;
}

/**
 * Interfaz para la respuesta de start
 */
interface StartResponse {
  server: string;
  task: string;
}

/**
 * Interfaz para la respuesta de upload
 */
interface UploadResponse {
  server_filename: string;
}

/**
 * Interfaz para la respuesta de process
 */
interface ProcessResponse {
  download_filename: string;
  filesize: number;
  output_filesize: number;
  output_filenumber: number;
  output_extensions: string[];
  timer: string;
  status: string;
}

/**
 * Obtiene las credenciales de iLovePDF
 */
function getCredentials(): ILovePDFCredentials {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  const secretKey = process.env.ILOVEPDF_SECRET_KEY;

  if (!publicKey || !secretKey) {
    console.error('[iLovePDF] Credenciales no configuradas');
    console.error('[iLovePDF] Variables esperadas: ILOVEPDF_PUBLIC_KEY, ILOVEPDF_SECRET_KEY');
    throw new Error(
      'iLovePDF API no está configurada.\n\n' +
      'Por favor configure las variables de entorno:\n' +
      '- ILOVEPDF_PUBLIC_KEY\n' +
      '- ILOVEPDF_SECRET_KEY\n\n' +
      'Ver documentación en: keys/README.md'
    );
  }

  console.log('[iLovePDF] ✅ Credenciales encontradas');
  console.log(`[iLovePDF] Public Key: ${publicKey.substring(0, 30)}...`);

  return { publicKey, secretKey };
}

/**
 * Obtiene token de autenticación
 */
async function getAuthToken(): Promise<string> {
  const { publicKey, secretKey } = getCredentials();

  console.log('[iLovePDF] Obteniendo token de autenticación...');

  const response = await fetch(`${ILOVEPDF_API_URL}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      public_key: publicKey,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error de autenticación: ${error}`);
  }

  const data = await response.json() as AuthResponse;
  console.log('[iLovePDF] ✅ Token obtenido');

  return data.token;
}

/**
 * Procesa un PDF con OCR usando iLovePDF OCR API
 * Convierte PDFs escaneados en PDFs con texto extraíble
 * @param pdfBuffer Buffer del archivo PDF
 * @returns Buffer del PDF procesado con OCR
 */
export async function convertPDFToExcel(pdfBuffer: Buffer): Promise<Buffer> {
  console.log('[iLovePDF-OCR] Iniciando procesamiento PDF con OCR');
  console.log(`[iLovePDF-OCR] Tamaño del PDF: ${pdfBuffer.length} bytes`);

  try {
    // 1. Obtener token
    const token = await getAuthToken();

    // 2. Iniciar tarea de OCR
    console.log('[iLovePDF-OCR] Iniciando tarea pdfocr (OCR)...');
    const startResponse = await fetch(`${ILOVEPDF_API_URL}/start/pdfocr`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!startResponse.ok) {
      const error = await startResponse.text();
      throw new Error(`Error al iniciar tarea: ${error}`);
    }

    const startData = await startResponse.json() as StartResponse;
    const { server, task } = startData;
    console.log('[iLovePDF-OCR] ✅ Tarea iniciada:', task);
    console.log('[iLovePDF-OCR] Servidor asignado:', server);

    // Asegurar que el servidor tenga el esquema https://
    const serverUrl = server.startsWith('http') ? server : `https://${server}`;
    console.log('[iLovePDF-OCR] URL del servidor:', serverUrl);

    // 3. Subir archivo PDF
    console.log('[iLovePDF-OCR] Subiendo archivo PDF...');
    const formData = new FormData();
    formData.append('task', task);
    formData.append('file', new Blob([new Uint8Array(pdfBuffer)]), 'document.pdf');

    const uploadResponse = await fetch(`${serverUrl}/v1/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Error al subir archivo: ${error}`);
    }

    const uploadData = await uploadResponse.json() as UploadResponse;
    console.log('[iLovePDF-OCR] ✅ Archivo subido:', uploadData.server_filename);

    // 4. Procesar OCR del PDF
    console.log('[iLovePDF-OCR] Procesando OCR del PDF...');
    const processResponse = await fetch(`${serverUrl}/v1/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: task,
        // detailed: false por defecto - extrae solo texto sin posiciones
      }),
    });

    if (!processResponse.ok) {
      const error = await processResponse.text();
      throw new Error(`Error al procesar: ${error}`);
    }

    const processData = await processResponse.json() as ProcessResponse;
    console.log('[iLovePDF-OCR] ✅ OCR completado');
    console.log(`[iLovePDF-OCR] Archivo de salida: ${processData.download_filename}`);
    console.log(`[iLovePDF-OCR] Tamaño de salida: ${processData.output_filesize} bytes`);

    // 5. Descargar PDF con OCR aplicado
    console.log('[iLovePDF-OCR] Descargando PDF procesado...');
    const downloadResponse = await fetch(`${serverUrl}/v1/download/${task}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!downloadResponse.ok) {
      const error = await downloadResponse.text();
      throw new Error(`Error al descargar: ${error}`);
    }

    const pdfOcrBuffer = await downloadResponse.arrayBuffer();
    console.log('[iLovePDF-OCR] ✅ PDF con OCR descargado exitosamente');
    console.log(`[iLovePDF-OCR] Tamaño final: ${pdfOcrBuffer.byteLength} bytes`);

    return Buffer.from(pdfOcrBuffer);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[iLovePDF] ❌ Error en conversión:', errorMessage);

    // Mensajes de error específicos
    if (errorMessage.includes('Invalid public key') || errorMessage.includes('Unauthorized')) {
      throw new Error(
        'Credenciales de iLovePDF inválidas.\n\n' +
        'Verifique que las variables de entorno estén correctamente configuradas:\n' +
        '- ILOVEPDF_PUBLIC_KEY\n' +
        '- ILOVEPDF_SECRET_KEY\n\n' +
        `Error técnico: ${errorMessage}`
      );
    }

    if (errorMessage.includes('Invalid file') || errorMessage.includes('corrupted')) {
      throw new Error(
        'El archivo PDF no puede ser procesado.\n\n' +
        'Posibles causas:\n' +
        '- PDF corrupto o dañado\n' +
        '- PDF protegido con contraseña\n' +
        '- Formato de archivo inválido\n\n' +
        `Error técnico: ${errorMessage}`
      );
    }

    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      throw new Error(
        'Límite de conversiones alcanzado.\n\n' +
        'La cuenta de iLovePDF ha alcanzado su cuota mensual.\n' +
        'Por favor espere hasta el próximo mes o actualice su plan.\n\n' +
        `Error técnico: ${errorMessage}`
      );
    }

    throw new Error(`Error al convertir PDF a Excel: ${errorMessage}`);
  }
}

/**
 * Valida que las credenciales de iLovePDF estén configuradas
 */
export function validateILovePDFConfig(): boolean {
  try {
    getCredentials();
    return true;
  } catch (error) {
    return false;
  }
}
