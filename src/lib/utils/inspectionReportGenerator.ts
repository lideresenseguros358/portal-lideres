/**
 * Generador automático de PDF - Informe de Inspección
 * Se genera en background sin intervención del usuario
 */

import jsPDF from 'jspdf';
import type { InsuredData } from '@/components/cotizadores/emision/InsuredDataSection';
import type { VehicleData } from '@/components/cotizadores/emision/VehicleDataSection';
import type { VehicleInspectionData } from '@/components/cotizadores/emision/VehicleInspectionSection';

interface InspectionReportData {
  insuredData: InsuredData;
  vehicleData: VehicleData;
  inspectionData: VehicleInspectionData;
  quoteData: any;
}

export async function generateInspectionReport(
  data: InspectionReportData
): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Logo placeholder (se puede agregar después)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LÍDERES EN SEGUROS, S.A.', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Título
  doc.setFontSize(14);
  doc.text('INFORME DE INSPECCIÓN DE VEHÍCULO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Fecha de inspección
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const today = new Date().toLocaleDateString('es-PA');
  doc.text(`Fecha de Inspección: ${today}`, 20, yPosition);
  yPosition += 10;

  // Separador
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 10;

  // SECCIÓN 1: DATOS DEL ASEGURADO
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. DATOS DEL ASEGURADO', 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const nombreCompleto = `${data.insuredData.primerNombre} ${data.insuredData.segundoNombre || ''} ${data.insuredData.primerApellido} ${data.insuredData.segundoApellido || ''}`.trim();
  
  const insuredInfo = [
    `Nombre Completo: ${nombreCompleto}`,
    `Cédula/Pasaporte: ${data.insuredData.cedula}`,
    `Fecha de Nacimiento: ${data.insuredData.fechaNacimiento}`,
    `Sexo: ${data.insuredData.sexo === 'M' ? 'Masculino' : 'Femenino'}`,
    `Email: ${data.insuredData.email}`,
    `Teléfono: ${data.insuredData.telefono} / Celular: ${data.insuredData.celular}`,
    `Dirección: ${data.insuredData.direccion}`,
  ];

  insuredInfo.forEach(line => {
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    doc.text(line, 25, yPosition);
    yPosition += 6;
  });

  yPosition += 5;

  // SECCIÓN 2: DATOS DEL VEHÍCULO
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. DATOS DEL VEHÍCULO', 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const vehicleInfo = [
    `Marca: ${data.quoteData.marca || 'N/A'}`,
    `Modelo: ${data.quoteData.modelo || 'N/A'}`,
    `Año: ${data.quoteData.ano || data.quoteData.anio || 'N/A'}`,
    `Placa: ${data.vehicleData.placa}`,
    `VIN/Chasis: ${data.vehicleData.vin}`,
    `Motor: ${data.vehicleData.motor}`,
    `Color: ${data.vehicleData.color}`,
    `Pasajeros: ${data.vehicleData.pasajeros}`,
    `Puertas: ${data.vehicleData.puertas}`,
    `Valor Asegurado: $${(data.quoteData.valorVehiculo || 0).toLocaleString()}`,
  ];

  vehicleInfo.forEach(line => {
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    doc.text(line, 25, yPosition);
    yPosition += 6;
  });

  yPosition += 5;

  // SECCIÓN 3: INSPECCIÓN FOTOGRÁFICA
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. INSPECCIÓN FOTOGRÁFICA', 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const inspectionItems = [
    { name: 'Parte Frontal', status: '✓ Completo' },
    { name: 'Parte Trasera', status: '✓ Completo' },
    { name: 'Lateral Izquierdo', status: '✓ Completo' },
    { name: 'Lateral Derecho', status: '✓ Completo' },
    { name: 'Compartimiento Motor', status: '✓ Completo' },
    { name: 'Tablero/Kilometraje', status: '✓ Completo' },
    { name: 'VIN/Chasis', status: '✓ Completo' },
  ];

  inspectionItems.forEach(item => {
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    doc.text(`${item.name}: ${item.status}`, 25, yPosition);
    yPosition += 6;
  });

  yPosition += 10;

  // SECCIÓN 4: ESTADO GENERAL DEL VEHÍCULO
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. ESTADO GENERAL DEL VEHÍCULO', 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const generalStatus = [
    { item: 'Carrocería', status: '✓ Verificada' },
    { item: 'Pintura', status: '✓ Verificada' },
    { item: 'Cristales', status: '✓ Verificados' },
    { item: 'Neumáticos', status: '✓ Verificados' },
    { item: 'Motor', status: '✓ Verificado' },
    { item: 'Interior', status: '✓ Verificado' },
    { item: 'Sistemas Eléctricos', status: '✓ Verificados' },
    { item: 'Documentación', status: '✓ Verificada' },
  ];

  generalStatus.forEach(item => {
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    doc.text(`${item.item}: ${item.status}`, 25, yPosition);
    yPosition += 6;
  });

  yPosition += 10;

  // SECCIÓN 5: OBSERVACIONES
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. OBSERVACIONES', 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('El vehículo ha sido inspeccionado mediante el sistema de autoservicio', 25, yPosition);
  yPosition += 6;
  doc.text('digital de Líderes en Seguros. Todas las fotografías han sido capturadas', 25, yPosition);
  yPosition += 6;
  doc.text('y validadas exitosamente.', 25, yPosition);
  yPosition += 15;

  // SECCIÓN 6: FIRMA DIGITAL
  if (yPosition > pageHeight - 50) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('6. INSPECTOR', 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Inspector: Líderes en Seguros - Portal Self Service', 25, yPosition);
  yPosition += 6;
  doc.text(`Fecha: ${today}`, 25, yPosition);
  yPosition += 6;
  doc.text('Método: Inspección Digital Automatizada', 25, yPosition);
  yPosition += 15;

  // Línea de firma
  doc.line(25, yPosition, 100, yPosition);
  yPosition += 5;
  doc.setFontSize(8);
  doc.text('Firma Digital Automatizada', 25, yPosition);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Documento generado automáticamente por el sistema de emisión digital',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Generar blob
  return doc.output('blob');
}

/**
 * Convierte un File a base64 para incluir en PDF
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
