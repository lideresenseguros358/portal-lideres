'use server';

import { ImageAnnotatorClient } from '@google-cloud/vision';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Inicializar el cliente de Vision API
let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient() {
  if (!visionClient) {
    // Opción 1: Usar credenciales desde variable de entorno (Producción/Vercel)
    const googleCredsJSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    
    if (googleCredsJSON) {
      console.log('[VISION] Usando credenciales desde variable de entorno');
      try {
        const credentials = JSON.parse(googleCredsJSON);
        visionClient = new ImageAnnotatorClient({
          credentials,
        });
      } catch (error) {
        throw new Error('Error al parsear credenciales de Google Cloud desde variable de entorno: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      }
    } else {
      // Opción 2: Usar archivo local (Desarrollo)
      const keyPath = path.join(process.cwd(), 'keys', 'gcloud-key.json');
      
      if (fs.existsSync(keyPath)) {
        console.log('[VISION] Usando credenciales desde archivo local:', keyPath);
        visionClient = new ImageAnnotatorClient({
          keyFilename: keyPath,
        });
      } else {
        throw new Error(
          'Google Cloud credentials no configuradas. Configure:\n' +
          '1. Variable de entorno GOOGLE_APPLICATION_CREDENTIALS_JSON en producción, o\n' +
          '2. Archivo keys/gcloud-key.json en desarrollo\n' +
          'Ruta buscada: ' + keyPath
        );
      }
    }
  }
  return visionClient;
}

interface OCRResult {
  success: boolean;
  text?: string;
  xlsxBuffer?: ArrayBuffer;
  structuredData?: any[][];
  error?: string;
}

/**
 * Extrae texto de una imagen usando Google Cloud Vision OCR
 */
async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const client = getVisionClient();
  
  const [result] = await client.textDetection({
    image: { content: imageBuffer },
  });
  
  const detections = result.textAnnotations;
  if (!detections || detections.length === 0) {
    throw new Error('No se detectó texto en la imagen');
  }
  
  // El primer resultado contiene todo el texto detectado
  return detections[0]?.description || '';
}

/**
 * Extrae texto de un PDF usando estrategia de fallback
 * Flujo: Intenta texto nativo primero, luego iLovePDF si falla
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // USAR SOLO PDF-PARSE (texto nativo) - MÁS RÁPIDO Y CONFIABLE
  console.log('[PDF-NATIVO] 🚀 Extrayendo texto nativo del PDF con pdf-parse...');
  console.log(`[PDF-NATIVO] Tamaño del PDF: ${pdfBuffer.length} bytes`);
  
  try {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    
    const pdfData = await (pdfParse as any)(pdfBuffer);
    
    console.log(`[PDF-NATIVO] 📄 PDF tiene ${pdfData.numpages} página(s)`);
    console.log(`[PDF-NATIVO] 📝 Texto extraído: ${pdfData.text?.length || 0} caracteres`);
    
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error('El PDF no contiene texto nativo extraíble');
    }
    
    console.log(`[PDF-NATIVO] ✅ ÉXITO - Texto extraído: ${pdfData.text.length} caracteres`);
    console.log(`[PDF-NATIVO] Primeras 500 caracteres:\n${pdfData.text.substring(0, 500)}`);
    
    return pdfData.text;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[PDF-NATIVO] ❌ ERROR:', errorMsg);
    
    throw new Error(
      'No se pudo extraer texto del PDF.\n\n' +
      'El PDF podría no tener texto extraíble (puede ser un escaneo).\n' +
      'Por favor:\n\n' +
      '1️⃣ Exportar el PDF a Excel (.xlsx) manualmente\n' +
      '2️⃣ Verificar que el PDF contenga texto seleccionable\n\n' +
      `Detalle técnico: ${errorMsg}`
    );
  }
}

/**
 * Estructura el texto extraído en formato tabular
 * Optimizado para reportes de seguros con múltiples columnas
 */
function structureTextToTable(text: string): any[][] {
  // Dividir en líneas y limpiar
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return [];
  }
  
  console.log(`[PARSER] Procesando ${lines.length} líneas de texto`);
  
  // Detectar si hay delimitadores explícitos
  const hasTabs = lines.some(line => line.includes('\t'));
  const hasPipes = lines.some(line => line.includes('|'));
  
  let rows: any[][] = [];
  
  if (hasTabs) {
    console.log('[PARSER] Detectado delimitador: TAB');
    rows = lines.map(line => line.split('\t').map(cell => cell.trim()).filter(cell => cell));
  } else if (hasPipes) {
    console.log('[PARSER] Detectado delimitador: PIPE');
    rows = lines
      .filter(line => !line.match(/^[\s\-|]+$/)) // Filtrar líneas separadoras
      .map(line => line.split('|').map(cell => cell.trim()).filter(cell => cell));
  } else {
    // Detectar columnas por espaciado múltiple (2+ espacios)
    const multiSpaceRegex = /\s{2,}/;
    
    if (lines.some(line => multiSpaceRegex.test(line))) {
      console.log('[PARSER] Detectado delimitador: ESPACIOS MÚLTIPLES');
      rows = lines.map(line => 
        line.split(multiSpaceRegex).map(cell => cell.trim()).filter(cell => cell)
      );
    } else {
      console.log('[PARSER] Sin delimitador claro, usando espacio simple');
      // Para reportes con columnas muy ajustadas, separar por espacio simple
      // pero intentar mantener números y texto juntos
      rows = lines.map(line => {
        // Dividir por espacios pero mantener grupos de dígitos con puntos/comas
        const parts = line.split(/\s+/).filter(part => part.length > 0);
        return parts;
      });
    }
  }
  
  // Filtrar filas que parecen ser headers o footers no deseados
  rows = rows.filter(row => {
    const rowText = row.join(' ').toLowerCase();
    // No filtrar si la fila tiene información de seguros
    if (rowText.includes('polic') || rowText.includes('asegurad') || 
        rowText.includes('prima') || rowText.includes('comis')) {
      return true;
    }
    // Filtrar filas con muy pocas celdas (probablemente headers genéricos)
    if (row.length < 2) {
      return false;
    }
    return true;
  });
  
  // Normalizar: asegurar que todas las filas tengan el mismo número de columnas
  const maxCols = Math.max(...rows.map(row => row.length), 0);
  
  console.log(`[PARSER] Detectadas ${maxCols} columnas`);
  console.log(`[PARSER] Total de filas: ${rows.length}`);
  
  if (maxCols > 1) {
    rows = rows.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });
  }
  
  // Log de muestra
  if (rows.length > 0 && rows[0]) {
    console.log(`[PARSER] Primera fila (headers): ${rows[0].join(' | ')}`);
    if (rows.length > 1 && rows[1]) {
      console.log(`[PARSER] Segunda fila (datos): ${rows[1].join(' | ')}`);
    }
  }
  
  return rows;
}

/**
 * Convierte datos estructurados a buffer de XLSX
 */
function convertToXLSX(data: any[][]): ArrayBuffer {
  // Crear workbook
  const wb = XLSX.utils.book_new();
  
  // Crear worksheet desde el array 2D
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Agregar worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  
  // Convertir a buffer
  const xlsxBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  
  return xlsxBuffer as ArrayBuffer;
}

/**
 * Función principal: Procesa imagen o PDF y retorna XLSX normalizado
 */
export async function processDocumentOCR(
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<OCRResult> {
  try {
    const buffer = Buffer.from(fileBuffer);
    const fileExtension = fileName.toLowerCase().split('.').pop();
    
    let extractedText = '';
    
    // Detectar tipo de archivo y extraer texto
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(fileExtension || '')) {
      // Imagen: usar Vision API directamente
      extractedText = await extractTextFromImage(buffer);
    } else if (fileExtension === 'pdf') {
      // PDF: intentar extraer texto o indicar que use imágenes
      extractedText = await extractTextFromPDF(buffer);
    } else {
      return {
        success: false,
        error: `Formato de archivo no soportado: ${fileExtension}. Use imágenes (JPG, PNG) o PDF.`,
      };
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      return {
        success: false,
        error: 'No se pudo extraer texto del documento. Verifique que el documento contenga texto legible.',
      };
    }
    
    // Estructurar el texto en formato tabular
    const structuredData = structureTextToTable(extractedText);
    
    if (structuredData.length === 0) {
      return {
        success: false,
        error: 'No se pudo estructurar el texto extraído en formato tabular.',
        text: extractedText,
      };
    }
    
    // Convertir a XLSX
    const xlsxBuffer = convertToXLSX(structuredData);
    
    return {
      success: true,
      text: extractedText,
      structuredData,
      xlsxBuffer,
    };
    
  } catch (error) {
    console.error('Error en OCR:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al procesar el documento',
    };
  }
}

/**
 * Función auxiliar interna: Valida si un archivo requiere OCR
 * Nota: Esta función NO se exporta para evitar conflictos con 'use server'
 * Use una función helper inline en los componentes que la necesiten
 */
function requiresOCRInternal(fileName: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop();
  const ocrExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'pdf'];
  return ocrExtensions.includes(extension || '');
}
