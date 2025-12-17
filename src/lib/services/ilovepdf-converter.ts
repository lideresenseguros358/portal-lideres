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
 * Extrae CSV detailed directamente desde el PDF SIN aplicar OCR (sin pdfocr).
 * Útil para PDFs con fuentes embebidas donde extractores locales devuelven glyphs.
 */
export async function extractPDFToDetailedCSV(pdfBuffer: Buffer): Promise<Buffer> {
  console.log('=== INICIO: PDF → Extract(detailed CSV) (sin OCR) ===');
  return extractTextToCSV(pdfBuffer);
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
 * Aplica OCR a un PDF usando iLovePDF OCR API
 * @param pdfBuffer Buffer del archivo PDF original
 * @returns Buffer del PDF con OCR aplicado
 */
async function applyOCRToPDF(pdfBuffer: Buffer): Promise<Buffer> {
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

    throw new Error(`Error al aplicar OCR al PDF: ${errorMessage}`);
  }
}

/**
 * Extrae texto estructurado de un PDF a CSV usando iLovePDF Extract API
 * @param pdfBuffer Buffer del PDF (debe tener texto extraíble)
 * @returns Buffer del archivo CSV con texto estructurado
 */
async function extractTextToCSV(pdfBuffer: Buffer): Promise<Buffer> {
  console.log('[iLovePDF-Extract] Iniciando extracción de texto a CSV');
  console.log(`[iLovePDF-Extract] Tamaño del PDF: ${pdfBuffer.length} bytes`);

  try {
    // 1. Obtener token
    const token = await getAuthToken();

    // 2. Iniciar tarea de extracción
    console.log('[iLovePDF-Extract] Iniciando tarea extract (extracción a CSV)...');
    const startResponse = await fetch(`${ILOVEPDF_API_URL}/start/extract`, {
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
    console.log('[iLovePDF-Extract] ✅ Tarea iniciada:', task);

    const serverUrl = server.startsWith('http') ? server : `https://${server}`;

    // 3. Subir archivo PDF
    console.log('[iLovePDF-Extract] Subiendo PDF con OCR...');
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
    console.log('[iLovePDF-Extract] ✅ Archivo subido');

    // 4. Procesar extracción con modo detailed (CSV)
    console.log('[iLovePDF-Extract] Procesando extracción a CSV (modo detailed)...');
    const processResponse = await fetch(`${serverUrl}/v1/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: task,
        detailed: true, // CSV con PageNo,XPos,YPos,Width,FontName,FontSize,Length,Text
      }),
    });

    if (!processResponse.ok) {
      const error = await processResponse.text();
      throw new Error(`Error al procesar: ${error}`);
    }

    const processData = await processResponse.json() as ProcessResponse;
    console.log('[iLovePDF-Extract] ✅ Extracción completada');

    // 5. Descargar CSV
    console.log('[iLovePDF-Extract] Descargando archivo CSV...');
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

    const csvBuffer = await downloadResponse.arrayBuffer();
    console.log('[iLovePDF-Extract] ✅ CSV descargado exitosamente');
    console.log(`[iLovePDF-Extract] Tamaño: ${csvBuffer.byteLength} bytes`);

    return Buffer.from(csvBuffer);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[iLovePDF-Extract] ❌ Error:', errorMessage);
    throw new Error(`Error al extraer texto a CSV: ${errorMessage}`);
  }
}

/**
 * FUNCIÓN PRINCIPAL: Procesa PDF con OCR y luego extrae a CSV
 * Flujo de 2 pasos:
 * 1. Aplica OCR al PDF (pdfocr)
 * 2. Extrae texto estructurado a CSV (extract con detailed=true)
 * 
 * @param pdfBuffer Buffer del PDF original
 * @returns Buffer del archivo CSV con texto estructurado
 */
export async function convertPDFToExcel(pdfBuffer: Buffer): Promise<Buffer> {
  console.log('=== INICIO: Procesamiento completo PDF → OCR → CSV ===');
  
  try {
    // PASO 1: Aplicar OCR al PDF
    console.log('\n📄 PASO 1/2: Aplicando OCR al PDF...');
    const pdfWithOCR = await applyOCRToPDF(pdfBuffer);
    console.log('✅ PASO 1/2 completado\n');
    
    // PASO 2: Extraer texto estructurado a CSV
    console.log('📊 PASO 2/2: Extrayendo texto a CSV...');
    const csvBuffer = await extractTextToCSV(pdfWithOCR);
    console.log('✅ PASO 2/2 completado\n');
    
    console.log('=== ✅ PROCESO COMPLETO: PDF → OCR → CSV exitoso ===');
    return csvBuffer;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('=== ❌ ERROR en proceso completo ===');
    console.error(errorMessage);
    throw new Error(`Error en proceso PDF → OCR → CSV: ${errorMessage}`);
  }
}

/**
 * Convierte PDF a imagen JPG usando iLovePDF
 * @param pdfBuffer Buffer del PDF a convertir
 * @returns Buffer de la imagen JPG de la primera página
 */
export async function convertPDFToImage(pdfBuffer: Buffer): Promise<Buffer> {
  console.log('[iLovePDF-PDFtoJPG] Iniciando conversión PDF → imagen JPG');
  console.log(`[iLovePDF-PDFtoJPG] Tamaño del PDF: ${pdfBuffer.length} bytes`);

  try {
    // 1. Obtener token
    const token = await getAuthToken();

    // 2. Iniciar tarea pdfjpg
    console.log('[iLovePDF-PDFtoJPG] Iniciando tarea pdfjpg...');
    const startResponse = await fetch(`${ILOVEPDF_API_URL}/start/pdfjpg`, {
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
    console.log('[iLovePDF-PDFtoJPG] ✅ Tarea iniciada:', task);

    const serverUrl = server.startsWith('http') ? server : `https://${server}`;

    // 3. Subir archivo PDF
    console.log('[iLovePDF-PDFtoJPG] Subiendo PDF...');
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
    console.log('[iLovePDF-PDFtoJPG] ✅ Archivo subido');

    // 4. Procesar conversión a JPG (solo primera página)
    console.log('[iLovePDF-PDFtoJPG] Procesando conversión a JPG...');
    const processResponse = await fetch(`${serverUrl}/v1/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: task,
        pdfjpg_mode: 'pages', // Convertir cada página a imagen
      }),
    });

    if (!processResponse.ok) {
      const error = await processResponse.text();
      throw new Error(`Error al procesar: ${error}`);
    }

    const processData = await processResponse.json() as ProcessResponse;
    console.log('[iLovePDF-PDFtoJPG] ✅ Conversión completada');

    // 5. Descargar archivo ZIP con las imágenes
    console.log('[iLovePDF-PDFtoJPG] Descargando imágenes...');
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

    const zipBuffer = await downloadResponse.arrayBuffer();
    console.log('[iLovePDF-PDFtoJPG] ✅ ZIP descargado exitosamente');

    // 6. Extraer la primera imagen del ZIP
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipBuffer);
    
    // Buscar el primer archivo JPG en el ZIP
    const jpgFiles = Object.keys(zip.files).filter(name => 
      name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg')
    );

    if (jpgFiles.length === 0) {
      throw new Error('No se encontraron imágenes JPG en el archivo ZIP');
    }

    const firstImageName = jpgFiles[0];
    if (!firstImageName) {
      throw new Error('Error al obtener el nombre de la imagen');
    }

    console.log(`[iLovePDF-PDFtoJPG] Extrayendo primera imagen: ${firstImageName}`);
    
    const zipFile = zip.files[firstImageName];
    if (!zipFile) {
      throw new Error(`No se encontró el archivo ${firstImageName} en el ZIP`);
    }

    const imageBuffer = await zipFile.async('nodebuffer');
    console.log(`[iLovePDF-PDFtoJPG] ✅ Imagen extraída: ${imageBuffer.length} bytes`);

    return imageBuffer;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[iLovePDF-PDFtoJPG] ❌ Error:', errorMessage);
    throw new Error(`Error al convertir PDF a imagen: ${errorMessage}`);
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
