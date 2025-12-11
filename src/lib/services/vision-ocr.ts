'use server';

import { ImageAnnotatorClient } from '@google-cloud/vision';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Inicializar el cliente de Vision API
let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient() {
  if (!visionClient) {
    const keyPath = path.join(process.cwd(), 'keys', 'gcloud-key.json');
    
    if (!fs.existsSync(keyPath)) {
      throw new Error('Google Cloud credentials file not found at: ' + keyPath);
    }
    
    visionClient = new ImageAnnotatorClient({
      keyFilename: keyPath,
    });
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
 * Convierte una página de PDF a imagen PNG usando pdfjs-dist
 */
async function convertPDFPageToImage(pdfBuffer: Buffer, pageNumber: number): Promise<Buffer> {
  const pdfjsLib = await import('pdfjs-dist');
  const { createCanvas } = await import('canvas');
  
  // Cargar el documento PDF
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDocument = await loadingTask.promise;
  
  // Obtener la página
  const page = await pdfDocument.getPage(pageNumber);
  
  // Configurar el viewport (escala 2.0 para mejor calidad)
  const viewport = page.getViewport({ scale: 2.0 });
  
  // Crear canvas
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  
  // Renderizar la página en el canvas
  const renderContext = {
    canvasContext: context as any,
    viewport: viewport,
  };
  
  await (page.render as any)(renderContext).promise;
  
  // Convertir canvas a buffer PNG
  return canvas.toBuffer('image/png');
}

/**
 * Extrae texto de un PDF usando Google Cloud Vision OCR
 * Convierte PDF → Imágenes → OCR automáticamente
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    console.log('[OCR] Iniciando conversión PDF → Imágenes → OCR');
    
    const pdfjsLib = await import('pdfjs-dist');
    
    // Cargar el documento PDF
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdfDocument = await loadingTask.promise;
    
    const numPages = pdfDocument.numPages;
    console.log(`[OCR] PDF tiene ${numPages} página(s)`);
    
    let allText = '';
    
    // Procesar cada página
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`[OCR] Procesando página ${pageNum}/${numPages}...`);
      
      // Convertir página a imagen
      const imageBuffer = await convertPDFPageToImage(pdfBuffer, pageNum);
      
      // Extraer texto de la imagen con Vision OCR
      const pageText = await extractTextFromImage(imageBuffer);
      
      allText += pageText + '\n\n';
      console.log(`[OCR] Página ${pageNum} procesada: ${pageText.length} caracteres extraídos`);
    }
    
    console.log(`[OCR] PDF completo procesado: ${allText.length} caracteres totales`);
    
    if (!allText || allText.trim().length === 0) {
      throw new Error('No se pudo extraer texto del PDF. Verifique que el documento contenga texto legible.');
    }
    
    return allText;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[OCR] Error al procesar PDF:', errorMessage);
    
    throw new Error('Error al procesar PDF con OCR: ' + errorMessage);
  }
}

/**
 * Estructura el texto extraído en formato tabular
 * Intenta detectar filas y columnas basándose en el formato del texto
 */
function structureTextToTable(text: string): any[][] {
  // Dividir en líneas
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }
  
  // Estrategia 1: Detectar si hay delimitadores claros (tabs, múltiples espacios, pipes, etc.)
  const hasTabs = lines.some(line => line.includes('\t'));
  const hasPipes = lines.some(line => line.includes('|'));
  
  let rows: any[][] = [];
  
  if (hasTabs) {
    // Separar por tabs
    rows = lines.map(line => line.split('\t').map(cell => cell.trim()).filter(cell => cell));
  } else if (hasPipes) {
    // Separar por pipes (tablas markdown o similares)
    rows = lines
      .filter(line => !line.match(/^[\s\-|]+$/)) // Filtrar líneas separadoras
      .map(line => line.split('|').map(cell => cell.trim()).filter(cell => cell));
  } else {
    // Estrategia 2: Detectar columnas por espaciado consistente
    // Intentar detectar múltiples espacios consecutivos como separadores
    const multiSpaceRegex = /\s{2,}/;
    
    if (lines.some(line => multiSpaceRegex.test(line))) {
      rows = lines.map(line => 
        line.split(multiSpaceRegex).map(cell => cell.trim()).filter(cell => cell)
      );
    } else {
      // Estrategia 3: Cada línea es una celda en una sola columna
      rows = lines.map(line => [line.trim()]);
    }
  }
  
  // Normalizar: asegurar que todas las filas tengan el mismo número de columnas
  const maxCols = Math.max(...rows.map(row => row.length));
  
  if (maxCols > 1) {
    rows = rows.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });
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
