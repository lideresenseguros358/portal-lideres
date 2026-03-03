/**
 * Official security measures list for Incendio + Contenido/Hogar cotizadores.
 * Sourced from the official portal system image. CCTV appears once (deduped).
 * Keys are snake_case, no accents, no spaces.
 */

export interface SecurityMeasure {
  key: string;
  label: string;
  icon: string;
}

export const SECURITY_MEASURES: SecurityMeasure[] = [
  // ── Column 1 (left in official image) ──
  { key: 'por_reportar',                    label: 'POR REPORTAR',                                     icon: '📋' },
  { key: 'verjas_hierro',                   label: 'VERJAS DE HIERRO',                                 icon: '🔩' },
  { key: 'alarma_incendio',                 label: 'SISTEMA DE ALARMA CONTRA INCENDIO',                icon: '🔥' },
  { key: 'guardia_seguridad',               label: 'GUARDIA DE SEGURIDAD',                             icon: '👮' },
  { key: 'puerta_hierro',                   label: 'PUERTA DE HIERRO',                                 icon: '🚪' },
  { key: 'cerca',                           label: 'CERCA',                                            icon: '🏗️' },
  { key: 'portero_electrico',               label: 'PORTERO ELECTRICO',                                icon: '🔔' },
  { key: 'vigilancia_canina',               label: 'VIGILANCIA CANINA',                                icon: '🐕' },
  { key: 'cctv',                            label: 'CIRCUITO CERRADO DE TELEVISION',                   icon: '📹' },
  { key: 'empleada_domestica',              label: 'EMPLEADA DOMESTICA',                               icon: '🏠' },
  { key: 'puerta_blindada',                 label: 'PUERTA BLINDADA',                                  icon: '🛡️' },
  { key: 'cuidador',                        label: 'CUIDADOR',                                         icon: '👤' },
  { key: 'cerraduras_especiales',           label: 'CERRADURAS ESPECIALES',                            icon: '🔐' },
  { key: 'puertas_enrollables',             label: 'PUERTAS ENROLLABLES',                              icon: '🚧' },
  { key: 'proteccion_tragaluces',           label: 'PROTECCION PARA TRAGALUCES',                       icon: '🪟' },
  { key: 'luces_alrededor_edificio',        label: 'LUCES ALREDEDOR DEL EDIFICIO',                     icon: '💡' },
  { key: 'detectores_humo',                 label: 'DETECTORES DE HUMO',                               icon: '🌫️' },
  // ── Column 2 (right in official image) ──
  { key: 'extintores_fuego',               label: 'EXTINTORES DE FUEGO',                               icon: '🧯' },
  { key: 'guardia_compartido',             label: 'GUARDIA COMPARTIDO',                                icon: '👥' },
  { key: 'ubicacion_pisos_superiores',     label: 'UBICACION EN PISOS SUPERIORES A P.B. (ALTOS)',      icon: '🏢' },
  { key: 'cerca_vigilancia_canina',        label: 'CERCA Y VIGILANCIA CANINA',                         icon: '🐕‍🦺' },
  { key: 'alarma_robo',                    label: 'SISTEMA DE ALARMA CONTRA ROBO',                     icon: '🔔' },
  { key: 'puertas_electricas',             label: 'PUERTAS ELECTRICAS',                                icon: '⚡' },
  { key: 'hidrantes',                      label: 'HIDRANTES',                                         icon: '🚒' },
  { key: 'orden_limpieza',                 label: 'ORDEN Y LIMPIEZA',                                  icon: '🧹' },
  { key: 'pared_perimetral',              label: 'PARED PERIMETRAL',                                   icon: '🧱' },
  { key: 'plan_evaluacion',               label: 'PLAN DE EVALUACION',                                 icon: '📄' },
  { key: 'pozo_propio',                   label: 'POZO PROPIO',                                        icon: '💧' },
  { key: 'robots',                        label: 'ROBOTS',                                              icon: '🤖' },
  { key: 'rociadores_automaticos',        label: 'ROCIADORES AUTOMATICOS',                              icon: '🚿' },
  { key: 'senalizacion_salida',           label: 'SEÑALIZACION PARA EL ACCESO DE SALIDA',              icon: '🚪' },
  { key: 'sensores_calor',               label: 'SENSORES DE CALOR',                                   icon: '🌡️' },
];
