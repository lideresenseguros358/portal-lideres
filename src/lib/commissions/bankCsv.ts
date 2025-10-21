/**
 * @deprecated ARCHIVO DEPRECADO - NO USAR
 * 
 * Este archivo ha sido reemplazado por el formato oficial ACH de Banco General.
 * 
 * USAR EN SU LUGAR:
 * - src/lib/commissions/bankACH.ts para comisiones
 * - src/lib/commissions/adjustments-ach.ts para ajustes
 * - src/lib/commissions/ach-normalization.ts para funciones de normalización
 * 
 * El formato CSV NO es compatible con Banca en Línea Comercial de Banco General.
 * Solo se acepta formato TXT ACH según instructivo oficial.
 * 
 * Este archivo se mantiene temporalmente para evitar romper imports legacy,
 * pero DEBE ser eliminado en la próxima versión.
 */

import { buildBankACH } from './bankACH';

/**
 * @deprecated Usar buildBankACH() de './bankACH' en su lugar
 */
export async function buildBankCsv(): Promise<string> {
  throw new Error(
    'DEPRECADO: buildBankCsv() ya no se usa. '
    + 'Usar buildBankACH() de ./bankACH para generar formato ACH oficial Banco General.'
  );
}

/**
 * @deprecated Usar getACHFilename() de './bankACH' en su lugar
 */
export function getBankCsvFilename(): string {
  throw new Error(
    'DEPRECADO: getBankCsvFilename() ya no se usa. '
    + 'Usar getACHFilename() de ./bankACH para generar nombre de archivo ACH.'
  );
}

/**
 * @deprecated Usar createACHBlob() de './bankACH' en su lugar
 */
export function createCsvBlob(): Blob {
  throw new Error(
    'DEPRECADO: createCsvBlob() ya no se usa. '
    + 'Usar createACHBlob() de ./bankACH para crear blob de archivo ACH.'
  );
}
