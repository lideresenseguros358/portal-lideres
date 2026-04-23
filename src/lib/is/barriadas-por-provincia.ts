/**
 * Mapeo de código de provincia IS → DATO codes de urbanizaciones/barriadas
 * Permite filtrar el dropdown de barriadas según la provincia seleccionada.
 *
 * Códigos de provincia (PROVINCIAS_FALLBACK):
 *  1=BOCAS DEL TORO  2=COCLÉ  3=COLÓN  4=CHIRIQUÍ  5=DARIÉN
 *  6=HERRERA  7=LOS SANTOS  8=PANAMÁ  9=VERAGUAS  10=GUNA YALA
 *  11=EMBERÁ-WOUNAAN  12=NGÄBE-BUGLÉ  13=PANAMÁ OESTE  14=NASO TJËR DI
 *
 * Los DATO codes referencian URBANIZACIONES_FALLBACK.
 */
export const BARRIADAS_POR_PROVINCIA: Record<number, number[]> = {
  1: [109, 110, 370, 371, 372, 373, 374, 375], // BOCAS DEL TORO
  2: [107, 108, 264, 266, 268, 340, 341, 342],  // COCLÉ
  3: [91, 280, 281, 282, 283, 284, 285, 286, 287, 288], // COLÓN
  4: [93, 94, 103, 104, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309], // CHIRIQUÍ
  5: [360, 362, 363, 364], // DARIÉN
  6: [105, 320, 321, 322, 323, 324, 325], // HERRERA
  7: [106, 330, 331, 332, 333, 334, 335], // LOS SANTOS
  8: [
    // Ciudad de Panamá y área metropolitana (DATO 1–86)
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
    39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56,
    57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
    75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86,
    97, 102, 361, 270,
    // Barriadas extendidas Ciudad de Panamá (DATO 200–240)
    200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213,
    214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227,
    228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240,
  ], // PANAMÁ
  9: [99, 267, 269, 350, 351, 352, 353, 354, 355, 356, 357], // VERAGUAS
  10: [380, 381, 382], // GUNA YALA
  11: [], // EMBERÁ-WOUNAAN
  12: [], // NGÄBE-BUGLÉ
  13: [
    // Panamá Oeste: Arraiján, La Chorrera, Capira, Chame, San Carlos
    87,  // 24 DE DICIEMBRE (Arraiján)
    88,  // ARRAIJAN
    89,  // BURUNGA (Arraiján)
    90,  // CHORRERA
    92,  // CORONADO (Chame)
    95,  // HOWARD (Arraiján)
    96,  // LA CHORRERA
    98,  // PANAMA PACIFICO (Arraiján)
    100, // VACAMONTE (Arraiján)
    101, // VERACRUZ (Arraiján)
    250, 251, 252, 253, 254, 255, 256, 257, 258, 259,
    260, 261, 262, 263, 265,
  ], // PANAMÁ OESTE
  14: [], // NASO TJËR DI
};
