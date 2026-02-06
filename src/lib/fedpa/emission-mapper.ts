/**
 * Mapper: EmissionData → FEDPA API
 * Convierte datos del formulario al formato exacto de FEDPA
 */

import type { EmissionData } from '@/components/cotizadores/EmissionDataForm';
import type { VehicleData } from '@/components/cotizadores/VehicleDataForm';
import type { EmitirPolizaRequest } from './types';

/**
 * Convierte EmissionData + VehicleData a formato FEDPA EmitirPolizaRequest
 */
export function mapEmissionDataToFedpa(
  emissionData: EmissionData,
  vehicleData: VehicleData,
  idDoc: string,
  planCode: number,
  quoteData: any
): EmitirPolizaRequest {
  // Convertir fecha YYYY-MM-DD a dd/mm/yyyy
  const convertDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return {
    // Plan y documentos
    Plan: planCode,
    idDoc: idDoc,
    PrimaTotal: quoteData.annualPremium || 0,

    // Cliente - Obligatorios
    PrimerNombre: emissionData.primerNombre,
    PrimerApellido: emissionData.primerApellido,
    Identificacion: emissionData.cedula,
    FechaNacimiento: convertDate(emissionData.fechaNacimiento),
    Sexo: emissionData.sexo,
    Email: emissionData.email,
    Telefono: parseInt(emissionData.telefono.replace(/\D/g, '')) || 0,
    Celular: parseInt(emissionData.celular.replace(/\D/g, '')) || 0,
    Direccion: emissionData.direccion,
    esPEP: emissionData.esPEP ? 1 : 0,

    // Cliente - Opcionales
    SegundoNombre: emissionData.segundoNombre,
    SegundoApellido: emissionData.segundoApellido,
    Ocupacion: undefined, // No lo solicitamos en el form
    Acreedor: emissionData.acreedor || undefined,

    // Vehículo - De quoteData (ya validados en cotización)
    sumaAsegurada: quoteData.valorVehiculo || 0,
    Uso: quoteData.uso || '10', // Particular por defecto
    Marca: quoteData.marca || '',
    Modelo: quoteData.modelo || '',
    Ano: quoteData.ano?.toString() || new Date().getFullYear().toString(),
    
    // Vehículo - De vehicleData
    Motor: vehicleData.motor,
    Placa: vehicleData.placa,
    MesVencimientoPlaca: undefined, // Opcional
    Vin: vehicleData.vinChasis, // VIN/Chasis unificado
    Color: vehicleData.color,
    Pasajero: vehicleData.pasajeros,
    Puerta: vehicleData.puertas,
  };
}

/**
 * Validar que EmissionData tenga todos los campos requeridos para FEDPA
 */
export function validateEmissionDataForFedpa(data: EmissionData): { valid: boolean; error?: string } {
  // Cliente obligatorios
  if (!data.primerNombre) return { valid: false, error: 'Primer nombre requerido' };
  if (!data.primerApellido) return { valid: false, error: 'Primer apellido requerido' };
  if (!data.cedula) return { valid: false, error: 'Cédula requerida' };
  if (!data.fechaNacimiento) return { valid: false, error: 'Fecha de nacimiento requerida' };
  if (!data.sexo) return { valid: false, error: 'Sexo requerido' };
  if (!data.email) return { valid: false, error: 'Email requerido' };
  if (!data.telefono) return { valid: false, error: 'Teléfono requerido' };
  if (!data.celular) return { valid: false, error: 'Celular requerido' };
  if (!data.direccion) return { valid: false, error: 'Dirección requerida' };

  // Documentos obligatorios
  if (!data.cedulaFile) return { valid: false, error: 'Documento de identidad requerido' };
  if (!data.licenciaFile) return { valid: false, error: 'Licencia requerida' };

  return { valid: true };
}

/**
 * Validar que VehicleData tenga todos los campos requeridos
 */
export function validateVehicleDataForFedpa(data: VehicleData): { valid: boolean; error?: string } {
  if (!data.placa) return { valid: false, error: 'Placa requerida' };
  if (!data.vinChasis) return { valid: false, error: 'VIN/Chasis requerido' };
  if (!data.motor) return { valid: false, error: 'Motor requerido' };
  if (!data.color) return { valid: false, error: 'Color requerido' };
  if (!data.pasajeros) return { valid: false, error: 'Pasajeros requerido' };
  if (!data.puertas) return { valid: false, error: 'Puertas requerido' };
  if (!data.registroVehicular) return { valid: false, error: 'Registro vehicular requerido' };

  return { valid: true };
}

/**
 * Preparar FormData para upload de documentos
 */
export function prepareDocumentsFormData(
  emissionData: EmissionData,
  vehicleData: VehicleData,
  environment: 'DEV' | 'PROD' = 'DEV'
): FormData {
  const formData = new FormData();
  
  formData.append('environment', environment);
  
  if (emissionData.cedulaFile) {
    formData.append('documento_identidad', emissionData.cedulaFile, 'documento_identidad');
  }
  
  if (emissionData.licenciaFile) {
    formData.append('licencia_conducir', emissionData.licenciaFile, 'licencia_conducir');
  }
  
  if (vehicleData.registroVehicular) {
    formData.append('registro_vehicular', vehicleData.registroVehicular, 'registro_vehicular');
  }
  
  return formData;
}
