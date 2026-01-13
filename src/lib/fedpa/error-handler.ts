/**
 * Manejo de Códigos de Error FEDPA
 * Según documentación de API - Reacciones del portal
 */

export interface FedpaErrorCode {
  codigo: string;
  mensaje: string;
  tipo: 'ERROR' | 'WARNING' | 'INFO';
  accion: 'REINTENTAR' | 'CORREGIR_DATOS' | 'CONTACTAR_SOPORTE' | 'CONTINUAR';
  descripcionUsuario: string;
  solucion: string;
}

// ============================================
// CÓDIGOS DE ERROR DE AUTENTICACIÓN
// ============================================

export const ERRORES_AUTENTICACION: FedpaErrorCode[] = [
  {
    codigo: 'AUTH_001',
    mensaje: 'Usuario o contraseña incorrectos',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'Las credenciales proporcionadas no son válidas',
    solucion: 'Verificar usuario y contraseña en configuración',
  },
  {
    codigo: 'AUTH_002',
    mensaje: 'Token expirado',
    tipo: 'WARNING',
    accion: 'REINTENTAR',
    descripcionUsuario: 'La sesión ha expirado',
    solucion: 'El sistema generará un nuevo token automáticamente',
  },
  {
    codigo: 'AUTH_003',
    mensaje: 'Token inválido',
    tipo: 'ERROR',
    accion: 'REINTENTAR',
    descripcionUsuario: 'Error de autenticación',
    solucion: 'Reintentar la operación',
  },
  {
    codigo: 'AUTH_004',
    mensaje: 'Corredor no autorizado',
    tipo: 'ERROR',
    accion: 'CONTACTAR_SOPORTE',
    descripcionUsuario: 'El corredor no tiene permisos para esta operación',
    solucion: 'Contactar a FEDPA para verificar permisos del corredor 836',
  },
];

// ============================================
// CÓDIGOS DE ERROR DE COTIZACIÓN
// ============================================

export const ERRORES_COTIZACION: FedpaErrorCode[] = [
  {
    codigo: 'COT_001',
    mensaje: 'Plan no disponible',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'El plan seleccionado no está disponible',
    solucion: 'Seleccionar otro plan de la lista actualizada',
  },
  {
    codigo: 'COT_002',
    mensaje: 'Año del vehículo fuera de rango',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'El año del vehículo no es válido para cotización',
    solucion: 'Verificar que el año del vehículo esté dentro del rango permitido (últimos 15 años)',
  },
  {
    codigo: 'COT_003',
    mensaje: 'Suma asegurada inválida',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'La suma asegurada no cumple con los requisitos del plan',
    solucion: 'Ajustar suma asegurada según rangos permitidos para el plan',
  },
  {
    codigo: 'COT_004',
    mensaje: 'Uso del vehículo no permitido',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'El uso del vehículo no está permitido para este plan',
    solucion: 'Seleccionar un plan compatible con el uso del vehículo',
  },
  {
    codigo: 'COT_005',
    mensaje: 'Límites de cobertura inválidos',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'Los límites de cobertura seleccionados no son válidos',
    solucion: 'Verificar límites de lesiones, propiedad y gastos médicos',
  },
  {
    codigo: 'COT_006',
    mensaje: 'Marca o modelo no encontrado',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'La marca o modelo del vehículo no está en el catálogo',
    solucion: 'Verificar código de marca y modelo, o contactar soporte',
  },
];

// ============================================
// CÓDIGOS DE ERROR DE DOCUMENTOS
// ============================================

export const ERRORES_DOCUMENTOS: FedpaErrorCode[] = [
  {
    codigo: 'DOC_001',
    mensaje: 'Archivo demasiado grande',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'El archivo excede el tamaño máximo permitido (10MB)',
    solucion: 'Comprimir el archivo o usar una versión de menor tamaño',
  },
  {
    codigo: 'DOC_002',
    mensaje: 'Formato de archivo no permitido',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'El formato del archivo no es válido',
    solucion: 'Usar formatos permitidos: PDF, JPG, PNG',
  },
  {
    codigo: 'DOC_003',
    mensaje: 'Documento requerido faltante',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'Falta cargar un documento obligatorio',
    solucion: 'Cargar todos los documentos requeridos: cédula, licencia, registro',
  },
  {
    codigo: 'DOC_004',
    mensaje: 'Documento ilegible',
    tipo: 'WARNING',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'El documento no es legible',
    solucion: 'Cargar una imagen más clara del documento',
  },
  {
    codigo: 'DOC_005',
    mensaje: 'Error al procesar documento',
    tipo: 'ERROR',
    accion: 'REINTENTAR',
    descripcionUsuario: 'Error al procesar el documento',
    solucion: 'Reintentar la carga del documento',
  },
];

// ============================================
// CÓDIGOS DE ERROR DE EMISIÓN
// ============================================

export const ERRORES_EMISION: FedpaErrorCode[] = [
  {
    codigo: 'EMI_001',
    mensaje: 'Datos incompletos',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'Faltan datos obligatorios para emitir la póliza',
    solucion: 'Completar todos los campos requeridos',
  },
  {
    codigo: 'EMI_002',
    mensaje: 'Identificación inválida',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'El número de identificación no es válido',
    solucion: 'Verificar formato de cédula, RUC o pasaporte',
  },
  {
    codigo: 'EMI_003',
    mensaje: 'VIN duplicado',
    tipo: 'ERROR',
    accion: 'CONTACTAR_SOPORTE',
    descripcionUsuario: 'El VIN del vehículo ya está registrado en otra póliza',
    solucion: 'Verificar VIN o contactar soporte si es correcto',
  },
  {
    codigo: 'EMI_004',
    mensaje: 'Placa duplicada',
    tipo: 'ERROR',
    accion: 'CONTACTAR_SOPORTE',
    descripcionUsuario: 'La placa del vehículo ya está registrada en otra póliza',
    solucion: 'Verificar placa o contactar soporte si es correcto',
  },
  {
    codigo: 'EMI_005',
    mensaje: 'Cliente en lista PEP sin validación',
    tipo: 'WARNING',
    accion: 'CONTACTAR_SOPORTE',
    descripcionUsuario: 'El cliente requiere validación adicional (PEP)',
    solucion: 'Contactar soporte para validación de cliente PEP',
  },
  {
    codigo: 'EMI_006',
    mensaje: 'Edad del conductor fuera de rango',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'La edad del conductor no cumple con los requisitos',
    solucion: 'Verificar fecha de nacimiento (edad mínima 18 años)',
  },
  {
    codigo: 'EMI_007',
    mensaje: 'Error al generar número de póliza',
    tipo: 'ERROR',
    accion: 'REINTENTAR',
    descripcionUsuario: 'Error al generar el número de póliza',
    solucion: 'Reintentar la emisión',
  },
  {
    codigo: 'EMI_008',
    mensaje: 'Error al generar PDF de póliza',
    tipo: 'ERROR',
    accion: 'CONTACTAR_SOPORTE',
    descripcionUsuario: 'La póliza se emitió pero hubo error al generar el PDF',
    solucion: 'Contactar soporte con el número de póliza para obtener el PDF',
  },
  {
    codigo: 'EMI_009',
    mensaje: 'Acreedor no válido',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'El acreedor especificado no es válido',
    solucion: 'Seleccionar un acreedor de la lista o dejar en blanco si no aplica',
  },
  {
    codigo: 'EMI_010',
    mensaje: 'Vigencia inválida',
    tipo: 'ERROR',
    accion: 'CORREGIR_DATOS',
    descripcionUsuario: 'Las fechas de vigencia no son válidas',
    solucion: 'Verificar que la fecha de inicio sea futura y la vigencia sea de 1 año',
  },
];

// ============================================
// CÓDIGOS DE ERROR DE SISTEMA
// ============================================

export const ERRORES_SISTEMA: FedpaErrorCode[] = [
  {
    codigo: 'SYS_001',
    mensaje: 'Servicio no disponible',
    tipo: 'ERROR',
    accion: 'REINTENTAR',
    descripcionUsuario: 'El servicio de FEDPA no está disponible temporalmente',
    solucion: 'Reintentar en unos minutos',
  },
  {
    codigo: 'SYS_002',
    mensaje: 'Timeout de conexión',
    tipo: 'ERROR',
    accion: 'REINTENTAR',
    descripcionUsuario: 'La conexión con FEDPA tardó demasiado',
    solucion: 'Verificar conexión a internet y reintentar',
  },
  {
    codigo: 'SYS_003',
    mensaje: 'Error interno del servidor',
    tipo: 'ERROR',
    accion: 'CONTACTAR_SOPORTE',
    descripcionUsuario: 'Error interno en el servidor de FEDPA',
    solucion: 'Contactar soporte técnico de FEDPA',
  },
  {
    codigo: 'SYS_004',
    mensaje: 'Mantenimiento programado',
    tipo: 'INFO',
    accion: 'REINTENTAR',
    descripcionUsuario: 'El sistema está en mantenimiento',
    solucion: 'Reintentar después del horario de mantenimiento',
  },
];

// ============================================
// MAPA COMPLETO DE ERRORES
// ============================================

export const TODOS_ERRORES_FEDPA = [
  ...ERRORES_AUTENTICACION,
  ...ERRORES_COTIZACION,
  ...ERRORES_DOCUMENTOS,
  ...ERRORES_EMISION,
  ...ERRORES_SISTEMA,
];

// ============================================
// FUNCIONES DE MANEJO DE ERRORES
// ============================================

/**
 * Buscar información de error por código
 */
export function obtenerInfoError(codigo: string): FedpaErrorCode | undefined {
  return TODOS_ERRORES_FEDPA.find(e => e.codigo === codigo);
}

/**
 * Procesar error de respuesta de FEDPA
 */
export function procesarErrorFedpa(error: any): {
  codigo: string;
  info: FedpaErrorCode;
  detalles?: any;
} {
  // Intentar extraer código de error
  let codigoError = 'SYS_003'; // Default: error interno
  
  if (typeof error === 'string') {
    // Buscar código en el mensaje
    const match = error.match(/([A-Z]+_\d+)/);
    if (match && match[1]) {
      codigoError = match[1];
    }
  } else if (error?.codigo || error?.code) {
    codigoError = error.codigo || error.code || 'SYS_003';
  } else if (error?.message) {
    // Intentar mapear mensaje a código conocido
    const mensaje = error.message.toLowerCase();
    
    if (mensaje.includes('token') && mensaje.includes('expirado')) {
      codigoError = 'AUTH_002';
    } else if (mensaje.includes('autenticación') || mensaje.includes('credenciales')) {
      codigoError = 'AUTH_001';
    } else if (mensaje.includes('plan') && mensaje.includes('disponible')) {
      codigoError = 'COT_001';
    } else if (mensaje.includes('documento')) {
      codigoError = 'DOC_005';
    } else if (mensaje.includes('timeout') || mensaje.includes('tiempo')) {
      codigoError = 'SYS_002';
    } else if (mensaje.includes('servicio') || mensaje.includes('disponible')) {
      codigoError = 'SYS_001';
    }
  }
  
  const info = obtenerInfoError(codigoError) || {
    codigo: codigoError,
    mensaje: 'Error desconocido',
    tipo: 'ERROR' as const,
    accion: 'CONTACTAR_SOPORTE' as const,
    descripcionUsuario: 'Ha ocurrido un error inesperado',
    solucion: 'Contactar soporte técnico con los detalles del error',
  };
  
  return {
    codigo: codigoError,
    info,
    detalles: error,
  };
}

/**
 * Determinar si un error es recuperable (se puede reintentar)
 */
export function esErrorRecuperable(codigo: string): boolean {
  const info = obtenerInfoError(codigo);
  return info?.accion === 'REINTENTAR';
}

/**
 * Obtener mensaje amigable para el usuario
 */
export function obtenerMensajeUsuario(error: any): string {
  const { info } = procesarErrorFedpa(error);
  return info.descripcionUsuario;
}

/**
 * Obtener acción recomendada
 */
export function obtenerAccionRecomendada(error: any): string {
  const { info } = procesarErrorFedpa(error);
  return info.solucion;
}

/**
 * Registrar error en logs
 */
export function registrarError(
  operacion: string,
  error: any,
  contexto?: Record<string, any>
): void {
  const { codigo, info, detalles } = procesarErrorFedpa(error);
  
  console.error('[FEDPA Error]', {
    timestamp: new Date().toISOString(),
    operacion,
    codigo,
    tipo: info.tipo,
    mensaje: info.mensaje,
    contexto,
    detalles,
  });
  
  // TODO: Enviar a sistema de monitoreo/alertas si es crítico
  if (info.tipo === 'ERROR' && info.accion === 'CONTACTAR_SOPORTE') {
    console.error('[FEDPA Error Crítico] Requiere atención:', {
      codigo,
      operacion,
      contexto,
    });
  }
}

/**
 * Crear respuesta de error estandarizada
 */
export function crearRespuestaError(error: any): {
  success: false;
  error: {
    codigo: string;
    mensaje: string;
    descripcion: string;
    solucion: string;
    tipo: string;
    accion: string;
  };
} {
  const { codigo, info } = procesarErrorFedpa(error);
  
  return {
    success: false,
    error: {
      codigo: codigo || 'SYS_003',
      mensaje: info.mensaje,
      descripcion: info.descripcionUsuario,
      solucion: info.solucion,
      tipo: info.tipo,
      accion: info.accion,
    },
  };
}
