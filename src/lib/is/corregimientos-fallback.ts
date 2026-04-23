/**
 * Catálogo estático de corregimientos de Panamá organizados por
 * codProvincia → nombre de distrito (UPPERCASE) → corregimientos.
 *
 * Lookup por NOMBRE de distrito (no por código) para que funcione
 * independientemente de si los códigos de distrito vienen del API IS
 * o del fallback secuencial de DISTRITOS_POR_PROVINCIA.
 *
 * DATO codes son secuenciales por distrito — IS acepta cualquier valor
 * numérico en vcodcorregimiento (fallback actual del emisor es || 1).
 */
export const CORREGIMIENTOS_POR_NOMBRE: Record<
  number,
  Record<string, { DATO: number; TEXTO: string }[]>
> = {

  /* ──────────────────────────────────────────────────────────────
   * Province 1 — BOCAS DEL TORO
   * ────────────────────────────────────────────────────────────── */
  1: {
    'BOCAS DEL TORO': [
      { DATO: 1, TEXTO: 'BOCAS DEL TORO' },
      { DATO: 2, TEXTO: 'BASTIMENTOS' },
      { DATO: 3, TEXTO: 'CARENERO' },
      { DATO: 4, TEXTO: 'PUNTA PEÑA' },
      { DATO: 5, TEXTO: 'TIERRA OSCURA' },
    ],
    'CHANGUINOLA': [
      { DATO: 1, TEXTO: 'CHANGUINOLA' },
      { DATO: 2, TEXTO: 'ALMIRANTE' },
      { DATO: 3, TEXTO: 'EL EMPALME' },
      { DATO: 4, TEXTO: 'GUABITO' },
      { DATO: 5, TEXTO: 'TERIBE' },
    ],
    'CHIRIQUÍ GRANDE': [
      { DATO: 1, TEXTO: 'CHIRIQUÍ GRANDE' },
      { DATO: 2, TEXTO: 'COCLECITO' },
      { DATO: 3, TEXTO: 'KUSAPÍN' },
      { DATO: 4, TEXTO: 'RAMBALA' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 2 — COCLÉ
   * ────────────────────────────────────────────────────────────── */
  2: {
    'AGUADULCE': [
      { DATO: 1, TEXTO: 'AGUADULCE' },
      { DATO: 2, TEXTO: 'EL ROBLE' },
      { DATO: 3, TEXTO: 'LOS OLIVOS' },
      { DATO: 4, TEXTO: 'POCRÍ' },
      { DATO: 5, TEXTO: 'RÍO GRANDE' },
    ],
    'ANTÓN': [
      { DATO: 1, TEXTO: 'ANTÓN' },
      { DATO: 2, TEXTO: 'EL CHIRÚ' },
      { DATO: 3, TEXTO: 'EL VALLE DE ANTÓN' },
      { DATO: 4, TEXTO: 'JUAN DÍAZ' },
      { DATO: 5, TEXTO: 'RÍO HATO' },
      { DATO: 6, TEXTO: 'SANTA CLARA' },
    ],
    'LA PINTADA': [
      { DATO: 1, TEXTO: 'LA PINTADA' },
      { DATO: 2, TEXTO: 'EL HARINO' },
      { DATO: 3, TEXTO: 'LLANITO' },
      { DATO: 4, TEXTO: 'LLANO GRANDE' },
      { DATO: 5, TEXTO: 'RÍO INDIO' },
    ],
    'NATÁ': [
      { DATO: 1, TEXTO: 'NATÁ' },
      { DATO: 2, TEXTO: 'EL CAÑO' },
      { DATO: 3, TEXTO: 'LAS HUACAS DEL NATÁ' },
      { DATO: 4, TEXTO: 'TOZA' },
    ],
    'OLÁ': [
      { DATO: 1, TEXTO: 'OLÁ' },
      { DATO: 2, TEXTO: 'EL COPÉ' },
      { DATO: 3, TEXTO: 'ENCANTO' },
      { DATO: 4, TEXTO: 'LA PITALOZA' },
    ],
    'PENONOMÉ': [
      { DATO: 1, TEXTO: 'PENONOMÉ' },
      { DATO: 2, TEXTO: 'COCLÉ DEL NORTE' },
      { DATO: 3, TEXTO: 'EL HARINO' },
      { DATO: 4, TEXTO: 'PAJONAL' },
      { DATO: 5, TEXTO: 'RÍO GRANDE' },
      { DATO: 6, TEXTO: 'TULÚ' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 3 — COLÓN
   * ────────────────────────────────────────────────────────────── */
  3: {
    'CHAGRES': [
      { DATO: 1, TEXTO: 'CHAGRES' },
      { DATO: 2, TEXTO: 'ACHIOTE' },
      { DATO: 3, TEXTO: 'EL GUABO' },
      { DATO: 4, TEXTO: 'PALMAS BELLAS' },
      { DATO: 5, TEXTO: 'RÍO INDIO' },
    ],
    'COLÓN': [
      { DATO: 1, TEXTO: 'BARRIO NORTE' },
      { DATO: 2, TEXTO: 'BARRIO SUR' },
      { DATO: 3, TEXTO: 'BUENA VISTA' },
      { DATO: 4, TEXTO: 'CATIVÁ' },
      { DATO: 5, TEXTO: 'CIRICITO' },
      { DATO: 6, TEXTO: 'CRISTÓBAL' },
      { DATO: 7, TEXTO: 'ESCOBAL' },
      { DATO: 8, TEXTO: 'LIMÓN' },
      { DATO: 9, TEXTO: 'NUEVO VIGÍA' },
      { DATO: 10, TEXTO: 'PUERTO PILÓN' },
      { DATO: 11, TEXTO: 'SALAMANCA' },
      { DATO: 12, TEXTO: 'SABANITAS' },
      { DATO: 13, TEXTO: 'SAN JUAN' },
    ],
    'DONOSO': [
      { DATO: 1, TEXTO: 'COCLESITO' },
      { DATO: 2, TEXTO: 'EL GUÁSIMO' },
      { DATO: 3, TEXTO: 'EL PALMAR' },
      { DATO: 4, TEXTO: 'GOBEA' },
      { DATO: 5, TEXTO: 'RÍO INDIO' },
    ],
    'PORTOBELO': [
      { DATO: 1, TEXTO: 'PORTOBELO' },
      { DATO: 2, TEXTO: 'GARROTE' },
      { DATO: 3, TEXTO: 'LA GUAIRA' },
      { DATO: 4, TEXTO: 'MARÍA CHIQUITA' },
      { DATO: 5, TEXTO: 'NOMBRE DE DIOS' },
    ],
    'SANTA ISABEL': [
      { DATO: 1, TEXTO: 'SANTA ISABEL' },
      { DATO: 2, TEXTO: 'CUIPO' },
      { DATO: 3, TEXTO: 'EL BANCO' },
      { DATO: 4, TEXTO: 'EL ENEAL' },
      { DATO: 5, TEXTO: 'PALMIRA' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 4 — CHIRIQUÍ
   * ────────────────────────────────────────────────────────────── */
  4: {
    'ALANJE': [
      { DATO: 1, TEXTO: 'ALANJE' },
      { DATO: 2, TEXTO: 'COCHEA' },
      { DATO: 3, TEXTO: 'DOS RÍOS' },
      { DATO: 4, TEXTO: 'LAS LOMAS' },
      { DATO: 5, TEXTO: 'LOS ALGARROBOS' },
      { DATO: 6, TEXTO: 'PAJA DE SOMBRERO' },
    ],
    'BARÚ': [
      { DATO: 1, TEXTO: 'BOCA DEL MONTE' },
      { DATO: 2, TEXTO: 'LOS NARANJOS' },
      { DATO: 3, TEXTO: 'PUERTO ARMUELLES' },
    ],
    'BOQUERÓN': [
      { DATO: 1, TEXTO: 'BOQUERÓN' },
      { DATO: 2, TEXTO: 'LOS ASIENTOS' },
      { DATO: 3, TEXTO: 'NUEVO SAN ANDRÉS DE BUENA VISTA' },
      { DATO: 4, TEXTO: 'POTRERO' },
    ],
    'BOQUETE': [
      { DATO: 1, TEXTO: 'BAJO BOQUETE' },
      { DATO: 2, TEXTO: 'ALTO BOQUETE' },
      { DATO: 3, TEXTO: 'CALDERA' },
      { DATO: 4, TEXTO: 'JARAMILLO ABAJO' },
      { DATO: 5, TEXTO: 'JARAMILLO ARRIBA' },
      { DATO: 6, TEXTO: 'LOS NARANJOS DE CALDERA' },
    ],
    'BUGABA': [
      { DATO: 1, TEXTO: 'BUGABA' },
      { DATO: 2, TEXTO: 'CONCEPCIÓN' },
      { DATO: 3, TEXTO: 'GUADALUPE' },
      { DATO: 4, TEXTO: 'HORCONCITOS' },
      { DATO: 5, TEXTO: 'LA CONCEPCIÓN' },
      { DATO: 6, TEXTO: 'PASO CANOAS' },
    ],
    'DAVID': [
      { DATO: 1, TEXTO: 'DAVID' },
      { DATO: 2, TEXTO: 'BIJAGUAL' },
      { DATO: 3, TEXTO: 'GUACA' },
      { DATO: 4, TEXTO: 'LAS LOMAS' },
      { DATO: 5, TEXTO: 'PEDREGAL' },
      { DATO: 6, TEXTO: 'SAN CARLOS' },
      { DATO: 7, TEXTO: 'SAN PABLO NUEVO' },
      { DATO: 8, TEXTO: 'SAN PABLO VIEJO' },
      { DATO: 9, TEXTO: 'SANTA MARTA' },
    ],
    'DOLEGA': [
      { DATO: 1, TEXTO: 'DOLEGA' },
      { DATO: 2, TEXTO: 'ASUNCIÓN' },
      { DATO: 3, TEXTO: 'EL HIGO' },
      { DATO: 4, TEXTO: 'LOS ANASTACIOS' },
      { DATO: 5, TEXTO: 'POTRERILLOS ABAJO' },
      { DATO: 6, TEXTO: 'POTRERILLOS ARRIBA' },
      { DATO: 7, TEXTO: 'QUERÉVALO' },
      { DATO: 8, TEXTO: 'TINAJAS' },
    ],
    'GUALACA': [
      { DATO: 1, TEXTO: 'GUALACA' },
      { DATO: 2, TEXTO: 'BAGALA' },
      { DATO: 3, TEXTO: 'GONZALILLO' },
      { DATO: 4, TEXTO: 'HORNITO' },
      { DATO: 5, TEXTO: 'TULÚ' },
    ],
    'REMEDIOS': [
      { DATO: 1, TEXTO: 'REMEDIOS' },
      { DATO: 2, TEXTO: 'BISVALLES' },
      { DATO: 3, TEXTO: 'CABALLERO' },
      { DATO: 4, TEXTO: 'EL NANCITO' },
      { DATO: 5, TEXTO: 'LAS LAJAS' },
    ],
    'RENACIMIENTO': [
      { DATO: 1, TEXTO: 'RENACIMIENTO' },
      { DATO: 2, TEXTO: 'CAÑAS GORDAS' },
      { DATO: 3, TEXTO: 'RÍO SERENO' },
      { DATO: 4, TEXTO: 'SANTA CLARA' },
    ],
    'SAN FÉLIX': [
      { DATO: 1, TEXTO: 'SAN FÉLIX' },
      { DATO: 2, TEXTO: 'HORCONCITOS' },
      { DATO: 3, TEXTO: 'LAJAS ADENTRO' },
      { DATO: 4, TEXTO: 'LAJAS DE TOLÉ' },
    ],
    'SAN LORENZO': [
      { DATO: 1, TEXTO: 'SAN LORENZO' },
      { DATO: 2, TEXTO: 'BIJAO' },
      { DATO: 3, TEXTO: 'EL NANCITO' },
      { DATO: 4, TEXTO: 'LAS PALMAS' },
      { DATO: 5, TEXTO: 'RAMBALA' },
    ],
    'TIERRAS ALTAS': [
      { DATO: 1, TEXTO: 'VOLCÁN' },
      { DATO: 2, TEXTO: 'CERRO PUNTA' },
      { DATO: 3, TEXTO: 'GUADALUPE' },
      { DATO: 4, TEXTO: 'PASO ANCHO' },
      { DATO: 5, TEXTO: 'SANTA CLARA' },
    ],
    'TOLÉ': [
      { DATO: 1, TEXTO: 'TOLÉ' },
      { DATO: 2, TEXTO: 'CERRO BANCO' },
      { DATO: 3, TEXTO: 'CHICHICA' },
      { DATO: 4, TEXTO: 'HATO PILÓN' },
      { DATO: 5, TEXTO: 'HATO RATÓN' },
      { DATO: 6, TEXTO: 'LAS LAJAS' },
      { DATO: 7, TEXTO: 'QUEBRADA DE LORO' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 5 — DARIÉN
   * ────────────────────────────────────────────────────────────── */
  5: {
    'CHEPIGANA': [
      { DATO: 1, TEXTO: 'LA PALMA' },
      { DATO: 2, TEXTO: 'CUCUNATÍ' },
      { DATO: 3, TEXTO: 'GARACHINÉ' },
      { DATO: 4, TEXTO: 'METETÍ' },
      { DATO: 5, TEXTO: 'PUERTO LARA' },
      { DATO: 6, TEXTO: 'RÍO CONGO ARRIBA' },
      { DATO: 7, TEXTO: 'RÍO IGLESIAS' },
      { DATO: 8, TEXTO: 'SANTA FE' },
      { DATO: 9, TEXTO: 'TUCUTÍ' },
    ],
    'PINOGANA': [
      { DATO: 1, TEXTO: 'YAVIZA' },
      { DATO: 2, TEXTO: 'BOCA DE CUPE' },
      { DATO: 3, TEXTO: 'EL REAL DE SANTA MARÍA' },
      { DATO: 4, TEXTO: 'LA MAREA' },
      { DATO: 5, TEXTO: 'PINOGANA' },
      { DATO: 6, TEXTO: 'PUCURO' },
      { DATO: 7, TEXTO: 'SAMBÚ' },
      { DATO: 8, TEXTO: 'UNIÓN CHOCÓ' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 6 — HERRERA
   * ────────────────────────────────────────────────────────────── */
  6: {
    'CHITRÉ': [
      { DATO: 1, TEXTO: 'CHITRÉ' },
      { DATO: 2, TEXTO: 'LA ARENA' },
      { DATO: 3, TEXTO: 'LLANO BONITO' },
      { DATO: 4, TEXTO: 'MONAGRILLO' },
      { DATO: 5, TEXTO: 'MONAGRE' },
      { DATO: 6, TEXTO: 'SAN JUAN BAUTISTA' },
    ],
    'LAS MINAS': [
      { DATO: 1, TEXTO: 'LAS MINAS' },
      { DATO: 2, TEXTO: 'CHUPAMPA' },
      { DATO: 3, TEXTO: 'EL PEDREGOSO' },
      { DATO: 4, TEXTO: 'QUEBRADA DEL ROSARIO' },
    ],
    'LOS POZOS': [
      { DATO: 1, TEXTO: 'LOS POZOS' },
      { DATO: 2, TEXTO: 'EL CALABACITO' },
      { DATO: 3, TEXTO: 'EL CEDRO' },
      { DATO: 4, TEXTO: 'EL TORO' },
      { DATO: 5, TEXTO: 'LOS CERRITOS' },
    ],
    'OCÚ': [
      { DATO: 1, TEXTO: 'OCÚ' },
      { DATO: 2, TEXTO: 'EL CAPURÍ' },
      { DATO: 3, TEXTO: 'EL TIJERA' },
      { DATO: 4, TEXTO: 'LLANO DE LA CRUZ' },
      { DATO: 5, TEXTO: 'PEÑAS CHATAS' },
    ],
    'PARITA': [
      { DATO: 1, TEXTO: 'PARITA' },
      { DATO: 2, TEXTO: 'CABUYA' },
      { DATO: 3, TEXTO: 'EL RINCÓN' },
      { DATO: 4, TEXTO: 'LOS CASTILLOS' },
      { DATO: 5, TEXTO: 'París' },
      { DATO: 6, TEXTO: 'POTUGA' },
    ],
    'PESÉ': [
      { DATO: 1, TEXTO: 'PESÉ' },
      { DATO: 2, TEXTO: 'AGUA BUENA' },
      { DATO: 3, TEXTO: 'EL ESPINO DE SANTA ROSA' },
      { DATO: 4, TEXTO: 'LA CARRILLO' },
      { DATO: 5, TEXTO: 'LOS CERRITOS' },
    ],
    'SANTA MARÍA': [
      { DATO: 1, TEXTO: 'SANTA MARÍA' },
      { DATO: 2, TEXTO: 'EL LIMÓN' },
      { DATO: 3, TEXTO: 'EL PRADO' },
      { DATO: 4, TEXTO: 'LA MATA' },
      { DATO: 5, TEXTO: 'LOS LLANOS' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 7 — LOS SANTOS
   * ────────────────────────────────────────────────────────────── */
  7: {
    'GUARARÉ': [
      { DATO: 1, TEXTO: 'GUARARÉ' },
      { DATO: 2, TEXTO: 'LA ENEA' },
      { DATO: 3, TEXTO: 'LAS GUABAS' },
      { DATO: 4, TEXTO: 'LLANO ABAJO' },
      { DATO: 5, TEXTO: 'LOS CAÑOS' },
      { DATO: 6, TEXTO: 'PUERTO MENSABÉ' },
    ],
    'LAS TABLAS': [
      { DATO: 1, TEXTO: 'LAS TABLAS' },
      { DATO: 2, TEXTO: 'BAJO CORRAL' },
      { DATO: 3, TEXTO: 'EL COCAL' },
      { DATO: 4, TEXTO: 'EL EJIDO' },
      { DATO: 5, TEXTO: 'EL MANANTIAL' },
      { DATO: 6, TEXTO: 'LA LAJA' },
      { DATO: 7, TEXTO: 'LA PALMA' },
      { DATO: 8, TEXTO: 'LAS PALMILLAS' },
      { DATO: 9, TEXTO: 'LAS TRANCAS' },
      { DATO: 10, TEXTO: 'LOS DÍAZ' },
      { DATO: 11, TEXTO: 'PALMIRA' },
      { DATO: 12, TEXTO: 'PEÑA BLANCA' },
    ],
    'LOS SANTOS': [
      { DATO: 1, TEXTO: 'LOS SANTOS' },
      { DATO: 2, TEXTO: 'EL COCAL' },
      { DATO: 3, TEXTO: 'LAS CRUCES' },
      { DATO: 4, TEXTO: 'LOS OLIVOS' },
      { DATO: 5, TEXTO: 'LLANO LARGO' },
    ],
    'MACARACAS': [
      { DATO: 1, TEXTO: 'MACARACAS' },
      { DATO: 2, TEXTO: 'BAHÍA HONDA' },
      { DATO: 3, TEXTO: 'EL BEBEDERO' },
      { DATO: 4, TEXTO: 'EL FLORES' },
      { DATO: 5, TEXTO: 'ESPIGADILLA' },
      { DATO: 6, TEXTO: 'GUÁNICO' },
      { DATO: 7, TEXTO: 'LAJAMINA' },
    ],
    'PEDASÍ': [
      { DATO: 1, TEXTO: 'PEDASÍ' },
      { DATO: 2, TEXTO: 'ARENA' },
      { DATO: 3, TEXTO: 'CAÑAS' },
      { DATO: 4, TEXTO: 'EL CIRUELO' },
      { DATO: 5, TEXTO: 'LOS ASIENTOS' },
      { DATO: 6, TEXTO: 'ORIA ARRIBA' },
    ],
    'POCRÍ': [
      { DATO: 1, TEXTO: 'POCRÍ' },
      { DATO: 2, TEXTO: 'CAMBUTAL' },
      { DATO: 3, TEXTO: 'LA RICA' },
      { DATO: 4, TEXTO: 'LOS ASIENTOS' },
      { DATO: 5, TEXTO: 'TRES QUEBRADAS' },
    ],
    'TONOSÍ': [
      { DATO: 1, TEXTO: 'TONOSÍ' },
      { DATO: 2, TEXTO: 'CAÑAS' },
      { DATO: 3, TEXTO: 'EL CORTEZO' },
      { DATO: 4, TEXTO: 'FLORES' },
      { DATO: 5, TEXTO: 'LA LAJA' },
      { DATO: 6, TEXTO: 'LA PALMA' },
      { DATO: 7, TEXTO: 'LA TRONOSA' },
      { DATO: 8, TEXTO: 'LOS ÁLAMOS' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 8 — PANAMÁ
   * ────────────────────────────────────────────────────────────── */
  8: {
    'BALBOA': [
      { DATO: 1, TEXTO: 'ANCÓN' },
      { DATO: 2, TEXTO: 'BALBOA' },
    ],
    'CHEPO': [
      { DATO: 1, TEXTO: 'CHEPO' },
      { DATO: 2, TEXTO: 'CANITA' },
      { DATO: 3, TEXTO: 'EL LLANO' },
      { DATO: 4, TEXTO: 'LAS MARGARITAS' },
      { DATO: 5, TEXTO: 'PACORÁ' },
      { DATO: 6, TEXTO: 'SAN MARTÍN' },
      { DATO: 7, TEXTO: 'TORTÍ' },
      { DATO: 8, TEXTO: 'UNIÓN CHOCÓ' },
    ],
    'CHIMÁN': [
      { DATO: 1, TEXTO: 'CHIMÁN' },
      { DATO: 2, TEXTO: 'GONZALO VÁSQUEZ' },
      { DATO: 3, TEXTO: 'IPETÍ' },
      { DATO: 4, TEXTO: 'MAJÉ' },
      { DATO: 5, TEXTO: 'PUERTO LARA' },
      { DATO: 6, TEXTO: 'TONOSÍ' },
    ],
    'PANAMÁ': [
      { DATO: 1,  TEXTO: 'ALCALDE DÍAZ' },
      { DATO: 2,  TEXTO: 'ANCÓN' },
      { DATO: 3,  TEXTO: 'BELLA VISTA' },
      { DATO: 4,  TEXTO: 'BETANIA' },
      { DATO: 5,  TEXTO: 'CALIDONIA' },
      { DATO: 6,  TEXTO: 'CHILIBRE' },
      { DATO: 7,  TEXTO: 'CURUNDÚ' },
      { DATO: 8,  TEXTO: 'EL CHORRILLO' },
      { DATO: 9,  TEXTO: 'JUAN DÍAZ' },
      { DATO: 10, TEXTO: 'LA EXPOSICIÓN' },
      { DATO: 11, TEXTO: 'LAS CUMBRES' },
      { DATO: 12, TEXTO: 'LAS MAÑANITAS' },
      { DATO: 13, TEXTO: 'PARQUE LEFEVRE' },
      { DATO: 14, TEXTO: 'PEDREGAL' },
      { DATO: 15, TEXTO: 'PUEBLO NUEVO' },
      { DATO: 16, TEXTO: 'RÍO ABAJO' },
      { DATO: 17, TEXTO: 'SAN FELIPE' },
      { DATO: 18, TEXTO: 'SAN FRANCISCO' },
      { DATO: 19, TEXTO: 'SANTA ANA' },
      { DATO: 20, TEXTO: 'TOCUMEN' },
    ],
    'SAN MIGUELITO': [
      { DATO: 1, TEXTO: 'AMELIA DENIS DE ICAZA' },
      { DATO: 2, TEXTO: 'ARNULFO ARIAS' },
      { DATO: 3, TEXTO: 'BELISARIO FRÍAS' },
      { DATO: 4, TEXTO: 'BELISARIO PORRAS' },
      { DATO: 5, TEXTO: 'JOSÉ DOMINGO ESPINAR' },
      { DATO: 6, TEXTO: 'MATEO ITURRALDE' },
      { DATO: 7, TEXTO: 'VICTORIANO LORENZO' },
    ],
    'TABOGA': [
      { DATO: 1, TEXTO: 'TABOGA' },
      { DATO: 2, TEXTO: 'OTOQUE OCCIDENTE' },
      { DATO: 3, TEXTO: 'OTOQUE ORIENTE' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 9 — VERAGUAS
   * ────────────────────────────────────────────────────────────── */
  9: {
    'ATALAYA': [
      { DATO: 1, TEXTO: 'ATALAYA' },
      { DATO: 2, TEXTO: 'EL BARRITO' },
      { DATO: 3, TEXTO: 'LA GARCEANA' },
      { DATO: 4, TEXTO: 'LA LAGUNA' },
      { DATO: 5, TEXTO: 'PONUGA' },
      { DATO: 6, TEXTO: 'SAN ANTONIO' },
    ],
    'CALOBRE': [
      { DATO: 1, TEXTO: 'CALOBRE' },
      { DATO: 2, TEXTO: 'CHITRA' },
      { DATO: 3, TEXTO: 'EL MARÍA' },
      { DATO: 4, TEXTO: 'LA LAGUNA' },
      { DATO: 5, TEXTO: 'SAN JOSÉ' },
      { DATO: 6, TEXTO: 'SAN MARCELO' },
      { DATO: 7, TEXTO: 'VIEJO VELADERO' },
    ],
    'CAÑAZAS': [
      { DATO: 1, TEXTO: 'CAÑAZAS' },
      { DATO: 2, TEXTO: 'EL HIGO' },
      { DATO: 3, TEXTO: 'LAS GUÍAS ABAJO' },
      { DATO: 4, TEXTO: 'LLANO GRANDE' },
      { DATO: 5, TEXTO: 'LOS HATILLOS' },
      { DATO: 6, TEXTO: 'SAN BARTOLO' },
    ],
    'LA MESA': [
      { DATO: 1, TEXTO: 'LA MESA' },
      { DATO: 2, TEXTO: 'EL ÁSPERO' },
      { DATO: 3, TEXTO: 'EL CUAY' },
      { DATO: 4, TEXTO: 'EL PIRO' },
      { DATO: 5, TEXTO: 'EL SUSPIRO' },
      { DATO: 6, TEXTO: 'LLANO DE LA CRUZ' },
      { DATO: 7, TEXTO: 'LOS HATILLOS' },
      { DATO: 8, TEXTO: 'URRACÁ' },
    ],
    'LAS PALMAS': [
      { DATO: 1, TEXTO: 'LAS PALMAS' },
      { DATO: 2, TEXTO: 'EL MARAÑÓN' },
      { DATO: 3, TEXTO: 'LOS CASTILLOS' },
      { DATO: 4, TEXTO: 'PIXVAE' },
      { DATO: 5, TEXTO: 'QUEBRO' },
      { DATO: 6, TEXTO: 'TEBARIO' },
    ],
    'MARIATO': [
      { DATO: 1, TEXTO: 'MARIATO' },
      { DATO: 2, TEXTO: 'ARENAS' },
      { DATO: 3, TEXTO: 'EL CACAO' },
      { DATO: 4, TEXTO: 'EL COCAL' },
      { DATO: 5, TEXTO: 'EL REAL' },
    ],
    'MONTIJO': [
      { DATO: 1, TEXTO: 'MONTIJO' },
      { DATO: 2, TEXTO: 'CÉBACO' },
      { DATO: 3, TEXTO: 'EL PIÑAL' },
      { DATO: 4, TEXTO: 'LA GARCEANA' },
      { DATO: 5, TEXTO: 'LA RAYA' },
      { DATO: 6, TEXTO: 'LEONES' },
      { DATO: 7, TEXTO: 'PIXVAE' },
    ],
    'RÍO DE JESÚS': [
      { DATO: 1, TEXTO: 'RÍO DE JESÚS' },
      { DATO: 2, TEXTO: 'CANTO DEL LLANO' },
      { DATO: 3, TEXTO: 'LA GARCEANA' },
      { DATO: 4, TEXTO: 'LA YEGUADA' },
      { DATO: 5, TEXTO: 'LLANO BONITO' },
    ],
    'SAN FRANCISCO': [
      { DATO: 1, TEXTO: 'SAN FRANCISCO' },
      { DATO: 2, TEXTO: 'LA SOLEDAD' },
      { DATO: 3, TEXTO: 'LOS HATILLOS' },
      { DATO: 4, TEXTO: 'SAN JOSÉ' },
    ],
    'SANTA FE': [
      { DATO: 1, TEXTO: 'SANTA FE' },
      { DATO: 2, TEXTO: 'CALOVÉBORA' },
      { DATO: 3, TEXTO: 'EL CUAY' },
      { DATO: 4, TEXTO: 'EL PANTANO' },
      { DATO: 5, TEXTO: 'GATÚ' },
      { DATO: 6, TEXTO: 'LOS HIGOS' },
      { DATO: 7, TEXTO: 'RÍO LUIS' },
      { DATO: 8, TEXTO: 'SAN LUIS' },
    ],
    'SANTIAGO': [
      { DATO: 1, TEXTO: 'SANTIAGO' },
      { DATO: 2, TEXTO: 'CANTO DEL LLANO' },
      { DATO: 3, TEXTO: 'LA COLORADA' },
      { DATO: 4, TEXTO: 'LA PEÑA' },
      { DATO: 5, TEXTO: 'LA RAYA DE SANTA MARÍA' },
      { DATO: 6, TEXTO: 'LLANO GRANDE' },
      { DATO: 7, TEXTO: 'LOS ALGARROBOS' },
      { DATO: 8, TEXTO: 'PONUGA' },
      { DATO: 9, TEXTO: 'SAN PEDRO DEL ESPINO' },
    ],
    'SONÁ': [
      { DATO: 1, TEXTO: 'SONÁ' },
      { DATO: 2, TEXTO: 'EL MARAÑÓN' },
      { DATO: 3, TEXTO: 'LAS PALMAS' },
      { DATO: 4, TEXTO: 'RODEO VIEJO' },
      { DATO: 5, TEXTO: 'SAN FRANCISCO' },
      { DATO: 6, TEXTO: 'URRACÁ' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 10 — GUNA YALA
   * ────────────────────────────────────────────────────────────── */
  10: {
    'GUNA YALA': [
      { DATO: 1, TEXTO: 'AILIGANDÍ' },
      { DATO: 2, TEXTO: 'EL PORVENIR' },
      { DATO: 3, TEXTO: 'GARDI' },
      { DATO: 4, TEXTO: 'MULATUPPU' },
      { DATO: 5, TEXTO: 'NARGANA' },
      { DATO: 6, TEXTO: 'PLAYÓN CHICO' },
      { DATO: 7, TEXTO: 'RÍO AZÚCAR' },
      { DATO: 8, TEXTO: 'TUPILE' },
      { DATO: 9, TEXTO: 'USTUPU' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 11 — EMBERÁ-WOUNAAN
   * ────────────────────────────────────────────────────────────── */
  11: {
    'CÉMACO': [
      { DATO: 1, TEXTO: 'CÉMACO' },
      { DATO: 2, TEXTO: 'LAJAS BLANCAS' },
      { DATO: 3, TEXTO: 'LA PALMA' },
      { DATO: 4, TEXTO: 'MOGUE' },
      { DATO: 5, TEXTO: 'RÍO CONGO ABAJO' },
    ],
    'SAMBÚ': [
      { DATO: 1, TEXTO: 'SAMBÚ' },
      { DATO: 2, TEXTO: 'MOGUE' },
      { DATO: 3, TEXTO: 'PUERTO INDIO' },
      { DATO: 4, TEXTO: 'RÍO BALSA' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 12 — NGÄBE-BUGLÉ
   * ────────────────────────────────────────────────────────────── */
  12: {
    'BESIKO': [
      { DATO: 1, TEXTO: 'BESIKO' },
      { DATO: 2, TEXTO: 'ALTO DE JESÚS' },
      { DATO: 3, TEXTO: 'KANKINTÚ' },
    ],
    'KANKINTÚ': [
      { DATO: 1, TEXTO: 'KANKINTÚ' },
      { DATO: 2, TEXTO: 'CALOVÉBORA' },
      { DATO: 3, TEXTO: 'SAN LUIS' },
    ],
    'KUSAPÍN': [
      { DATO: 1, TEXTO: 'KUSAPÍN' },
      { DATO: 2, TEXTO: 'BAHÍA AZUL' },
      { DATO: 3, TEXTO: 'BINATURI' },
      { DATO: 4, TEXTO: 'TOBOBE' },
    ],
    'MIRONÓ': [
      { DATO: 1, TEXTO: 'MIRONÓ' },
      { DATO: 2, TEXTO: 'ALTO DE GÜERA' },
      { DATO: 3, TEXTO: 'CERRO PELADO' },
      { DATO: 4, TEXTO: 'CHICHICA' },
      { DATO: 5, TEXTO: 'HATO COROTÚ' },
      { DATO: 6, TEXTO: 'HATO JULÍ' },
    ],
    'MÜNA': [
      { DATO: 1, TEXTO: 'MÜNA' },
      { DATO: 2, TEXTO: 'CAMARÓN' },
      { DATO: 3, TEXTO: 'GUAYABITO' },
      { DATO: 4, TEXTO: 'LLANO DE LEÓN' },
      { DATO: 5, TEXTO: 'QUEBRADA GUABO' },
    ],
    'NOLE DUIMA': [
      { DATO: 1, TEXTO: 'NOLE DUIMA' },
      { DATO: 2, TEXTO: 'BUENOS AIRES' },
      { DATO: 3, TEXTO: 'CERRO PELADO' },
      { DATO: 4, TEXTO: 'CHICHICA' },
      { DATO: 5, TEXTO: 'HATO CHAMÍ' },
      { DATO: 6, TEXTO: 'LAJERO' },
    ],
    'ÑÜRÜM': [
      { DATO: 1, TEXTO: 'ÑÜRÜM' },
      { DATO: 2, TEXTO: 'CAMARÓN' },
      { DATO: 3, TEXTO: 'CASCABEL' },
      { DATO: 4, TEXTO: 'EL BALE' },
      { DATO: 5, TEXTO: 'GUAYABITO' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 13 — PANAMÁ OESTE
   * ────────────────────────────────────────────────────────────── */
  13: {
    'ARRAIJÁN': [
      { DATO: 1, TEXTO: 'ARRAIJÁN' },
      { DATO: 2, TEXTO: 'BURUNGA' },
      { DATO: 3, TEXTO: 'CERRO SILVESTRE' },
      { DATO: 4, TEXTO: 'JUAN DEMÓSTENES AROSEMENA' },
      { DATO: 5, TEXTO: 'NUEVO EMPERADOR' },
      { DATO: 6, TEXTO: '24 DE DICIEMBRE' },
      { DATO: 7, TEXTO: 'VISTA ALEGRE' },
    ],
    'CAPIRA': [
      { DATO: 1, TEXTO: 'CAPIRA' },
      { DATO: 2, TEXTO: 'EL CACAO' },
      { DATO: 3, TEXTO: 'LA TRINIDAD' },
      { DATO: 4, TEXTO: 'LAS OLLAS ARRIBA' },
      { DATO: 5, TEXTO: 'PICHINDÉ' },
      { DATO: 6, TEXTO: 'SAN LUIS' },
      { DATO: 7, TEXTO: 'VILLA DEL CARMEN' },
    ],
    'CHAME': [
      { DATO: 1, TEXTO: 'CHAME' },
      { DATO: 2, TEXTO: 'BEJUCO' },
      { DATO: 3, TEXTO: 'EL CAMPANO' },
      { DATO: 4, TEXTO: 'EL LÍBANO' },
      { DATO: 5, TEXTO: 'NUEVA GORGONA' },
      { DATO: 6, TEXTO: 'PUNTA CHAME' },
    ],
    'LA CHORRERA': [
      { DATO: 1,  TEXTO: 'LA CHORRERA' },
      { DATO: 2,  TEXTO: 'EL ARADO' },
      { DATO: 3,  TEXTO: 'EL COCO' },
      { DATO: 4,  TEXTO: 'EL ESPINO' },
      { DATO: 5,  TEXTO: 'FEUILLET' },
      { DATO: 6,  TEXTO: 'GUADALUPE' },
      { DATO: 7,  TEXTO: 'HERRERA' },
      { DATO: 8,  TEXTO: 'LA REPRESA' },
      { DATO: 9,  TEXTO: 'LAS ZANGÜENGAS' },
      { DATO: 10, TEXTO: 'OBALDÍA' },
      { DATO: 11, TEXTO: 'PLAYA LEONA' },
      { DATO: 12, TEXTO: 'VERACRUZ' },
    ],
    'SAN CARLOS': [
      { DATO: 1, TEXTO: 'SAN CARLOS' },
      { DATO: 2, TEXTO: 'EL MARÍA' },
      { DATO: 3, TEXTO: 'LA ERMITA' },
      { DATO: 4, TEXTO: 'LAS UVAS' },
      { DATO: 5, TEXTO: 'SAN JOSÉ' },
    ],
  },

  /* ──────────────────────────────────────────────────────────────
   * Province 14 — NASO TJËR DI
   * ────────────────────────────────────────────────────────────── */
  14: {
    'NASO TJËR DI': [
      { DATO: 1, TEXTO: 'BOCA DEL RÍO SAN SAN' },
      { DATO: 2, TEXTO: 'SIEYIK' },
      { DATO: 3, TEXTO: 'SAN SAN DRUY' },
      { DATO: 4, TEXTO: 'SOLONG' },
    ],
  },
};
