/**
 * Catálogos Complementarios FEDPA
 * Ocupaciones, Colores, Usos Especiales, Acreedores
 */

// ============================================
// OCUPACIONES
// ============================================

export interface Ocupacion {
  codigo: number;
  descripcion: string;
}

// Lista de ocupaciones comunes (input abierto permitido)
export const OCUPACIONES_SUGERIDAS: Ocupacion[] = [
  { codigo: 1, descripcion: 'Abogado' },
  { codigo: 2, descripcion: 'Administrador' },
  { codigo: 3, descripcion: 'Agricultor' },
  { codigo: 4, descripcion: 'Arquitecto' },
  { codigo: 5, descripcion: 'Ama de Casa' },
  { codigo: 6, descripcion: 'Comerciante' },
  { codigo: 7, descripcion: 'Contador' },
  { codigo: 8, descripcion: 'Conductor' },
  { codigo: 9, descripcion: 'Empleado' },
  { codigo: 10, descripcion: 'Empresario' },
  { codigo: 11, descripcion: 'Enfermero' },
  { codigo: 12, descripcion: 'Estudiante' },
  { codigo: 13, descripcion: 'Ingeniero' },
  { codigo: 14, descripcion: 'Médico' },
  { codigo: 15, descripcion: 'Pensionado' },
  { codigo: 16, descripcion: 'Profesor' },
  { codigo: 17, descripcion: 'Secretaria' },
  { codigo: 18, descripcion: 'Técnico' },
  { codigo: 19, descripcion: 'Vendedor' },
  { codigo: 99, descripcion: 'Otro' },
];

/**
 * Buscar ocupación por descripción
 * Si no existe, retorna código 99 (Otro) para input libre
 */
export function buscarOcupacion(descripcion: string): Ocupacion {
  const normalizado = descripcion.toLowerCase().trim();
  const encontrada = OCUPACIONES_SUGERIDAS.find(
    o => o.descripcion.toLowerCase().includes(normalizado)
  );
  return encontrada || { codigo: 99, descripcion };
}

// ============================================
// COLORES
// ============================================

export interface Color {
  codigo: string;
  descripcion: string;
  hex?: string;
}

// Lista de colores comunes (input abierto permitido)
export const COLORES_VEHICULO: Color[] = [
  { codigo: 'BLANCO', descripcion: 'Blanco', hex: '#FFFFFF' },
  { codigo: 'NEGRO', descripcion: 'Negro', hex: '#000000' },
  { codigo: 'GRIS', descripcion: 'Gris', hex: '#808080' },
  { codigo: 'PLATA', descripcion: 'Plata', hex: '#C0C0C0' },
  { codigo: 'ROJO', descripcion: 'Rojo', hex: '#FF0000' },
  { codigo: 'AZUL', descripcion: 'Azul', hex: '#0000FF' },
  { codigo: 'VERDE', descripcion: 'Verde', hex: '#008000' },
  { codigo: 'AMARILLO', descripcion: 'Amarillo', hex: '#FFFF00' },
  { codigo: 'NARANJA', descripcion: 'Naranja', hex: '#FFA500' },
  { codigo: 'CAFE', descripcion: 'Café', hex: '#8B4513' },
  { codigo: 'BEIGE', descripcion: 'Beige', hex: '#F5F5DC' },
  { codigo: 'DORADO', descripcion: 'Dorado', hex: '#FFD700' },
  { codigo: 'PLATEADO', descripcion: 'Plateado', hex: '#C0C0C0' },
  { codigo: 'VINO', descripcion: 'Vino', hex: '#722F37' },
  { codigo: 'OTRO', descripcion: 'Otro' },
];

/**
 * Buscar color por descripción
 * Si no existe, permite input libre
 */
export function buscarColor(descripcion: string): Color {
  const normalizado = descripcion.toUpperCase().trim();
  const encontrado = COLORES_VEHICULO.find(
    c => c.codigo === normalizado || c.descripcion.toUpperCase() === normalizado
  );
  return encontrado || { codigo: normalizado, descripcion };
}

// ============================================
// USOS ESPECIALES
// ============================================

export interface UsoEspecial {
  codigo: string;
  descripcion: string;
  requiereAprobacion: boolean;
  notas?: string;
}

// Usos especiales que pueden requerir validación adicional
export const USOS_ESPECIALES: UsoEspecial[] = [
  {
    codigo: '10',
    descripcion: 'Particular',
    requiereAprobacion: false,
  },
  {
    codigo: '20',
    descripcion: 'Comercial',
    requiereAprobacion: false,
  },
  {
    codigo: '30',
    descripcion: 'Taxi',
    requiereAprobacion: true,
    notas: 'Requiere documentación adicional de transporte público',
  },
  {
    codigo: '40',
    descripcion: 'Uber/Cabify',
    requiereAprobacion: true,
    notas: 'Requiere certificado de plataforma digital',
  },
  {
    codigo: '50',
    descripcion: 'Carga Liviana',
    requiereAprobacion: true,
    notas: 'Requiere especificación de tipo de carga',
  },
  {
    codigo: '60',
    descripcion: 'Carga Pesada',
    requiereAprobacion: true,
    notas: 'Requiere inspección especial',
  },
];

/**
 * Obtener uso especial por código
 */
export function obtenerUsoEspecial(codigo: string): UsoEspecial | undefined {
  return USOS_ESPECIALES.find(u => u.codigo === codigo);
}

// ============================================
// ACREEDORES (DEBE ESTAR EN LÍNEA CON ASEGURADORA)
// ============================================

export interface Acreedor {
  codigo: string;
  nombre: string;
  tipo: 'BANCO' | 'FINANCIERA' | 'COOPERATIVA' | 'OTRO';
  activo: boolean;
}

/**
 * Servicio para obtener acreedores desde API de FEDPA
 * Los acreedores deben estar sincronizados con la aseguradora
 */
export async function obtenerAcreedores(): Promise<Acreedor[]> {
  try {
    // TODO: Implementar endpoint de FEDPA para acreedores
    // Por ahora retornamos lista estática que debe actualizarse desde API
    console.log('[FEDPA Acreedores] Obteniendo lista de acreedores...');
    
    // Lista de acreedores comunes en Panamá
    const acreedoresEstaticos: Acreedor[] = [
      { codigo: 'BAC', nombre: 'Banco BAC', tipo: 'BANCO', activo: true },
      { codigo: 'BG', nombre: 'Banco General', tipo: 'BANCO', activo: true },
      { codigo: 'BN', nombre: 'Banco Nacional', tipo: 'BANCO', activo: true },
      { codigo: 'BANESCO', nombre: 'Banesco', tipo: 'BANCO', activo: true },
      { codigo: 'GLOBAL', nombre: 'Global Bank', tipo: 'BANCO', activo: true },
      { codigo: 'MULTIBANK', nombre: 'Multibank', tipo: 'BANCO', activo: true },
      { codigo: 'CREDICORP', nombre: 'Credicorp Bank', tipo: 'BANCO', activo: true },
      { codigo: 'TOWERBANK', nombre: 'Towerbank', tipo: 'BANCO', activo: true },
      { codigo: 'PRIVAL', nombre: 'Prival Bank', tipo: 'BANCO', activo: true },
      { codigo: 'FICOHSA', nombre: 'Ficohsa', tipo: 'BANCO', activo: true },
      { codigo: 'LAFISE', nombre: 'Lafise', tipo: 'FINANCIERA', activo: true },
      { codigo: 'FINANCORP', nombre: 'Financorp', tipo: 'FINANCIERA', activo: true },
      { codigo: 'ACACOOP', nombre: 'Acacoop', tipo: 'COOPERATIVA', activo: true },
      { codigo: 'OTRO', nombre: 'Otro', tipo: 'OTRO', activo: true },
    ];
    
    return acreedoresEstaticos;
  } catch (error) {
    console.error('[FEDPA Acreedores] Error obteniendo acreedores:', error);
    return [];
  }
}

/**
 * Buscar acreedor por código o nombre
 */
export async function buscarAcreedor(busqueda: string): Promise<Acreedor | undefined> {
  const acreedores = await obtenerAcreedores();
  const normalizado = busqueda.toUpperCase().trim();
  
  return acreedores.find(
    a => a.codigo === normalizado || a.nombre.toUpperCase().includes(normalizado)
  );
}

// ============================================
// VALIDACIONES DE SUMA ASEGURADA VS PLAN
// ============================================

export interface ValidacionSumaAsegurada {
  planId: number;
  planNombre: string;
  sumaMinima: number;
  sumaMaxima: number;
  incrementos: number; // Incrementos permitidos (ej: 1000)
}

// Tabla de validación según plan
export const VALIDACIONES_SUMA_ASEGURADA: ValidacionSumaAsegurada[] = [
  // Daños a Terceros (no aplica suma asegurada)
  {
    planId: 410,
    planNombre: 'D.T. PARTICULAR',
    sumaMinima: 0,
    sumaMaxima: 0,
    incrementos: 0,
  },
  {
    planId: 411,
    planNombre: 'D.T. COMERCIAL',
    sumaMinima: 0,
    sumaMaxima: 0,
    incrementos: 0,
  },
  // Cobertura Completa (rangos según plan)
  {
    planId: 412,
    planNombre: 'C.C. BÁSICO',
    sumaMinima: 5000,
    sumaMaxima: 15000,
    incrementos: 1000,
  },
  {
    planId: 413,
    planNombre: 'C.C. ESTÁNDAR',
    sumaMinima: 10000,
    sumaMaxima: 30000,
    incrementos: 1000,
  },
  {
    planId: 414,
    planNombre: 'C.C. PREMIUM',
    sumaMinima: 20000,
    sumaMaxima: 100000,
    incrementos: 5000,
  },
];

/**
 * Validar suma asegurada según plan
 */
export function validarSumaAsegurada(
  planId: number,
  sumaAsegurada: number
): { valido: boolean; mensaje?: string } {
  const validacion = VALIDACIONES_SUMA_ASEGURADA.find(v => v.planId === planId);
  
  if (!validacion) {
    return {
      valido: false,
      mensaje: 'Plan no encontrado en tabla de validación',
    };
  }
  
  // Daños a terceros no requiere suma asegurada
  if (validacion.sumaMinima === 0 && validacion.sumaMaxima === 0) {
    return { valido: true };
  }
  
  // Validar rango
  if (sumaAsegurada < validacion.sumaMinima) {
    return {
      valido: false,
      mensaje: `Suma asegurada mínima: B/.${validacion.sumaMinima.toLocaleString()}`,
    };
  }
  
  if (sumaAsegurada > validacion.sumaMaxima) {
    return {
      valido: false,
      mensaje: `Suma asegurada máxima: B/.${validacion.sumaMaxima.toLocaleString()}`,
    };
  }
  
  // Validar incrementos
  if (validacion.incrementos > 0) {
    const resto = sumaAsegurada % validacion.incrementos;
    if (resto !== 0) {
      return {
        valido: false,
        mensaje: `Suma asegurada debe ser múltiplo de B/.${validacion.incrementos.toLocaleString()}`,
      };
    }
  }
  
  return { valido: true };
}

/**
 * Obtener rango de suma asegurada para un plan
 */
export function obtenerRangoSumaAsegurada(planId: number): ValidacionSumaAsegurada | undefined {
  return VALIDACIONES_SUMA_ASEGURADA.find(v => v.planId === planId);
}
