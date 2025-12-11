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
 * Convierte PDF a Excel y extrae el texto
 * Usa iLovePDF API para conversión automática
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    console.log('[PDF→EXCEL] Convirtiendo PDF a Excel con iLovePDF API...');
    console.log(`[PDF→EXCEL] Tamaño del PDF: ${pdfBuffer.length} bytes`);
    
    // Importar servicio de iLovePDF
    const { convertPDFToExcel } = await import('./ilovepdf-converter');
    
    // Convertir PDF a Excel
    const excelBuffer = await convertPDFToExcel(pdfBuffer);
    console.log(`[PDF→EXCEL] ✅ Excel generado: ${excelBuffer.length} bytes`);
    
    // Leer el Excel con XLSX
    console.log('[PDF→EXCEL] Leyendo contenido del Excel...');
    const workbook = XLSX.read(excelBuffer);
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      throw new Error('El Excel generado no contiene hojas');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error('No se pudo leer la hoja del Excel');
    }
    
    // Convertir a array de arrays (texto estructurado)
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    console.log(`[PDF→EXCEL] ✅ Datos extraídos: ${data.length} filas`);
    
    // Convertir a texto con tabs como separadores (para mantener estructura)
    const text = data
      .filter(row => row && row.length > 0)
      .map(row => row.join('\t'))
      .join('\n');
    
    console.log(`[PDF→EXCEL] ✅ Texto generado: ${text.length} caracteres`);
    console.log(`[PDF→EXCEL] Primeras 300 caracteres:\n${text.substring(0, 300)}`);
    
    return text;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[PDF→EXCEL] ❌ Error:', errorMessage);
    
    // Si el error es de credenciales de iLovePDF, re-lanzarlo directamente
    if (errorMessage.includes('iLovePDF API no está configurada') || 
        errorMessage.includes('Credenciales de iLovePDF inválidas')) {
      throw error;
    }
    
    // Si es límite alcanzado, dar mensaje específico
    if (errorMessage.includes('Límite de conversiones alcanzado')) {
      throw error;
    }
    
    // Para otros errores, dar mensaje genérico
    throw new Error(
      'Error al convertir PDF a Excel.\n\n' +
      'El sistema intentó convertir automáticamente su PDF a Excel pero falló.\n' +
      'Por favor intente:\n\n' +
      '1️⃣ Exportar el PDF a Excel (.xlsx) manualmente desde su aplicación\n' +
      '2️⃣ Verificar que el PDF no esté corrupto o protegido con contraseña\n' +
      '3️⃣ Usar un conversor online: https://www.ilovepdf.com/pdf_to_excel\n\n' +
      `Detalle técnico: ${errorMessage}`
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
