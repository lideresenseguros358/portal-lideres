/**
 * Catálogo estático de distritos de Panamá organizados por provincia.
 * Fallback cuando el API IS no responde para /catalogos/distritos.
 *
 * NOTA: Los DATO (códigos de distrito) son secuenciales dentro de cada provincia.
 * Si el API IS usa códigos distintos, la cascada de corregimientos puede fallar
 * cuando se usa este fallback — en ese caso el usuario puede editar la dirección completa.
 */
export const DISTRITOS_POR_PROVINCIA: Record<number, { DATO: number; TEXTO: string }[]> = {
  1: [ // BOCAS DEL TORO
    { DATO: 1, TEXTO: 'BOCAS DEL TORO' },
    { DATO: 2, TEXTO: 'CHANGUINOLA' },
    { DATO: 3, TEXTO: 'CHIRIQUÍ GRANDE' },
  ],
  2: [ // COCLÉ
    { DATO: 1, TEXTO: 'AGUADULCE' },
    { DATO: 2, TEXTO: 'ANTÓN' },
    { DATO: 3, TEXTO: 'LA PINTADA' },
    { DATO: 4, TEXTO: 'NATÁ' },
    { DATO: 5, TEXTO: 'OLÁ' },
    { DATO: 6, TEXTO: 'PENONOMÉ' },
  ],
  3: [ // COLÓN
    { DATO: 1, TEXTO: 'CHAGRES' },
    { DATO: 2, TEXTO: 'COLÓN' },
    { DATO: 3, TEXTO: 'DONOSO' },
    { DATO: 4, TEXTO: 'PORTOBELO' },
    { DATO: 5, TEXTO: 'SANTA ISABEL' },
  ],
  4: [ // CHIRIQUÍ
    { DATO: 1,  TEXTO: 'ALANJE' },
    { DATO: 2,  TEXTO: 'BARÚ' },
    { DATO: 3,  TEXTO: 'BOQUERÓN' },
    { DATO: 4,  TEXTO: 'BOQUETE' },
    { DATO: 5,  TEXTO: 'BUGABA' },
    { DATO: 6,  TEXTO: 'DAVID' },
    { DATO: 7,  TEXTO: 'DOLEGA' },
    { DATO: 8,  TEXTO: 'GUALACA' },
    { DATO: 9,  TEXTO: 'REMEDIOS' },
    { DATO: 10, TEXTO: 'RENACIMIENTO' },
    { DATO: 11, TEXTO: 'SAN FÉLIX' },
    { DATO: 12, TEXTO: 'SAN LORENZO' },
    { DATO: 13, TEXTO: 'TIERRAS ALTAS' },
    { DATO: 14, TEXTO: 'TOLÉ' },
  ],
  5: [ // DARIÉN
    { DATO: 1, TEXTO: 'CHEPIGANA' },
    { DATO: 2, TEXTO: 'PINOGANA' },
  ],
  6: [ // HERRERA
    { DATO: 1, TEXTO: 'CHITRÉ' },
    { DATO: 2, TEXTO: 'LAS MINAS' },
    { DATO: 3, TEXTO: 'LOS POZOS' },
    { DATO: 4, TEXTO: 'OCÚ' },
    { DATO: 5, TEXTO: 'PARITA' },
    { DATO: 6, TEXTO: 'PESÉ' },
    { DATO: 7, TEXTO: 'SANTA MARÍA' },
  ],
  7: [ // LOS SANTOS
    { DATO: 1, TEXTO: 'GUARARÉ' },
    { DATO: 2, TEXTO: 'LAS TABLAS' },
    { DATO: 3, TEXTO: 'LOS SANTOS' },
    { DATO: 4, TEXTO: 'MACARACAS' },
    { DATO: 5, TEXTO: 'PEDASÍ' },
    { DATO: 6, TEXTO: 'POCRÍ' },
    { DATO: 7, TEXTO: 'TONOSÍ' },
  ],
  8: [ // PANAMÁ
    { DATO: 1, TEXTO: 'BALBOA' },
    { DATO: 2, TEXTO: 'CHEPO' },
    { DATO: 3, TEXTO: 'CHIMÁN' },
    { DATO: 4, TEXTO: 'PANAMÁ' },
    { DATO: 5, TEXTO: 'SAN MIGUELITO' },
    { DATO: 6, TEXTO: 'TABOGA' },
  ],
  9: [ // VERAGUAS
    { DATO: 1,  TEXTO: 'ATALAYA' },
    { DATO: 2,  TEXTO: 'CALOBRE' },
    { DATO: 3,  TEXTO: 'CAÑAZAS' },
    { DATO: 4,  TEXTO: 'LA MESA' },
    { DATO: 5,  TEXTO: 'LAS PALMAS' },
    { DATO: 6,  TEXTO: 'MARIATO' },
    { DATO: 7,  TEXTO: 'MONTIJO' },
    { DATO: 8,  TEXTO: 'RÍO DE JESÚS' },
    { DATO: 9,  TEXTO: 'SAN FRANCISCO' },
    { DATO: 10, TEXTO: 'SANTA FE' },
    { DATO: 11, TEXTO: 'SANTIAGO' },
    { DATO: 12, TEXTO: 'SONÁ' },
  ],
  10: [ // GUNA YALA
    { DATO: 1, TEXTO: 'GUNA YALA' },
  ],
  11: [ // EMBERÁ-WOUNAAN
    { DATO: 1, TEXTO: 'CÉMACO' },
    { DATO: 2, TEXTO: 'SAMBÚ' },
  ],
  12: [ // NGÄBE-BUGLÉ
    { DATO: 1, TEXTO: 'BESIKO' },
    { DATO: 2, TEXTO: 'KANKINTÚ' },
    { DATO: 3, TEXTO: 'KUSAPÍN' },
    { DATO: 4, TEXTO: 'MIRONÓ' },
    { DATO: 5, TEXTO: 'MÜNA' },
    { DATO: 6, TEXTO: 'NOLE DUIMA' },
    { DATO: 7, TEXTO: 'ÑÜRÜM' },
  ],
  13: [ // PANAMÁ OESTE
    { DATO: 1, TEXTO: 'ARRAIJÁN' },
    { DATO: 2, TEXTO: 'CAPIRA' },
    { DATO: 3, TEXTO: 'CHAME' },
    { DATO: 4, TEXTO: 'LA CHORRERA' },
    { DATO: 5, TEXTO: 'SAN CARLOS' },
  ],
  14: [ // NASO TJËR DI
    { DATO: 1, TEXTO: 'NASO TJËR DI' },
  ],
};
