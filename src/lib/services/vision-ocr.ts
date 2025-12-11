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
  try {
    const { extractText } = await import('unpdf');
    
    // Convertir Buffer a Uint8Array
    const uint8Array = new Uint8Array(pdfBuffer);
    
    // Extraer texto del PDF
    const result = await extractText(uint8Array);
    const { text } = result;
    
    // text es un array de strings (uno por página), unirlos
    const fullText = Array.isArray(text) ? text.join('\n') : String(text);
    
    if (!fullText || fullText.trim().length === 0) {
      throw new Error('El PDF no contiene texto extraíble');
    }
    
    return fullText;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    
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
 * PARSER GENÉRICO PARA MÚLTIPLES ASEGURADORAS (ANCON, INTERNACIONAL, ETC)
 */
function structureTextToTable(text: string): any[][] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return [];
  }
  
  const rows: any[][] = [];
  
  // Regex para detectar líneas de datos (comienzan con número de póliza)
  // Formatos soportados:
  // - ANCON: XXXX-XXXXX-XX (ej: 0122-00173-01)
  // - INTERNACIONAL: X-X-XXXXX o X-XX-XXXXX (ej: 1-1-36919, 1-15-36032)
  const policyLineRegex = /^(\d{1,4}-\d{1,5}-\d{2,5})\s+/;
  
  for (const line of lines) {
    // Saltar headers repetidos
    if (line.includes('Póliza') && line.includes('Asegurado') && line.includes('Comisión')) {
      continue;
    }
    
    // Saltar líneas de totales
    if (line.includes('Total por Corredor') || line.includes('Total')) {
      continue;
    }
    
    // Saltar encabezados de página (ANCON)
    if (line.includes('ASEGURADORA ANCON') || line.includes('Primas Cobradas') || 
        line.includes('LIDERES EN SEGUROS') || line.includes('Desde:') || line.includes('Fecha:')) {
      continue;
    }
    
    // Saltar encabezados de página (INTERNACIONAL)
    if (line.includes('Compañía Internacional') || line.includes('Estado de Cuenta') || 
        line.includes('Corredor LIDERES')) {
      continue;
    }
    
    // Saltar filas que tienen "--" o están vacías en la columna de póliza
    if (line.startsWith('--') || line.startsWith('###')) {
      continue;
    }
    
    // Detectar líneas de datos por el patrón de póliza
    const policyMatch = line.match(policyLineRegex);
    if (policyMatch) {
      const poliza = policyMatch[1];
      
      // Saltar si la póliza es "--" o está vacía
      if (!poliza || poliza === '--' || poliza.trim() === '') {
        continue;
      }
      
      // Resto de la línea después de la póliza
      const restOfLine = line.substring(policyMatch[0].length).trim();
      
      // Buscar donde termina el asegurado y empieza el recibo
      // Patrones de recibo: ACH, VC, BG, GB, TCR seguidos de números
      const reciboMatch = restOfLine.match(/(ACH|VC|BG|GB|TCR|232-)\d+/);
      
      if (reciboMatch && reciboMatch.index !== undefined) {
        // Asegurado es todo antes del recibo
        const asegurado = restOfLine.substring(0, reciboMatch.index).trim();
        
        // Resto después del asegurado (incluye recibo, fecha, montos, comisión)
        const afterAsegurado = restOfLine.substring(reciboMatch.index).trim();
        
        // La comisión es el último número de la línea
        const parts = afterAsegurado.split(/\s+/);
        const comision = parts[parts.length - 1];
        
        if (asegurado && comision) {
          rows.push([poliza, asegurado, comision]);
        }
      } else {
        // Fallback: usar el método anterior si no encuentra patrón de recibo
        const parts = restOfLine.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          const asegurado = parts[0];
          const comision = parts[parts.length - 1];
          rows.push([poliza, asegurado, comision]);
        }
      }
    }
  }
  
  // Agregar header
  const finalRows = [
    ['Póliza', 'Asegurado', 'Comisión'], // Header
    ...rows
  ];
  
  return finalRows;
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
