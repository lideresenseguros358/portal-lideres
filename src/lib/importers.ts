import Papa from "papaparse";
import * as XLSX from "xlsx";

import {
  getInsurerConfigByName,
  getInsurerDelinquencyConfigByName,
} from "./mappings";
import {
  normalizeMappingRow as normalizeRowByConfig,
  normalizeDelinquencyRow,
} from "./normalizer";
import type {
  NormalizedRow as Normalized,
  NormalizedDelinquencyRow as NormalizedDelinquency,
  RowObject as RowObj,
} from "./types/importing";

const isFileLike = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

const textFromFile = async (file: File): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result ?? ""));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });

const bufferFromFile = async (file: File): Promise<ArrayBuffer> =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
      } else {
        reject(new Error("Failed to read file as buffer"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

const simpleCSVParse = (input: string): { headers: string[]; rows: any[][] } => {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const firstLine = lines[0];
  if (!firstLine) {
    return { headers: [], rows: [] };
  }

  const headers = firstLine.split(",").map((item) => item.trim());
  const rows = lines
    .slice(1)
    .map((line) => line.split(",").map((item) => item.trim()));

  return { headers, rows };
};

/**
 * Lee un archivo o cadena CSV y devuelve encabezados y filas.
 */
export const readCSV = async (
  fileOrText: File | string
): Promise<{ headers: string[]; rows: any[][] }> => {
  let text: string;
  if (isFileLike(fileOrText)) {
    text = await textFromFile(fileOrText);
  } else {
    text = fileOrText;
  }

  if (typeof Papa?.parse === "function") {
    const result = Papa.parse<string[]>(text, {
      skipEmptyLines: true,
    });
    const [headers = [], ...rows] = result.data;
    return { headers, rows };
  }

  return simpleCSVParse(text);
};

/**
 * Lee XLSX y retorna datos por hoja.
 */
export const readXLSX = async (
  fileOrBuffer: File | ArrayBuffer
): Promise<{ sheets: string[]; rowsBySheet: Record<string, any[][]> }> => {
  let buffer: ArrayBuffer;
  if (isFileLike(fileOrBuffer)) {
    buffer = await bufferFromFile(fileOrBuffer);
  } else {
    buffer = fileOrBuffer;
  }

  if (typeof XLSX?.read === "function") {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheets = workbook.SheetNames ?? [];
    const rowsBySheet: Record<string, any[][]> = {};

    sheets.forEach((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) return;
      rowsBySheet[name] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      }) as any[][];
    });

    return { sheets, rowsBySheet };
  }

  throw new Error("XLSX library is required but not available");
};

/**
 * Normaliza un conjunto de filas para una aseguradora dada por nombre.
 */
export const normalizeRowsForInsurerByName = async (
  name: string,
  rows: RowObj[],
  headers?: string[]
): Promise<{ normalized: Normalized[]; skipped: number }> => {
  const config = await getInsurerConfigByName(name);
  const normalized: Normalized[] = [];
  let skipped = 0;

  rows.forEach((row) => {
    const result = normalizeRowByConfig(config as any, row, headers);
    if (!result.policy || !result.insured) {
      skipped += 1;
      return;
    }
    normalized.push(result);
  });

  return { normalized, skipped };
};

/**
 * Normaliza datos de morosidad para una aseguradora por nombre.
 */
export const normalizeDelinquencyForInsurerByName = async (
  name: string,
  rows: RowObj[],
  headers?: string[]
): Promise<{ normalized: NormalizedDelinquency[]; skipped: number }> => {
  const config = await getInsurerDelinquencyConfigByName(name);
  const normalized: NormalizedDelinquency[] = [];
  let skipped = 0;

  rows.forEach((row) => {
    const result = normalizeDelinquencyRow({ rules: config.rules } as any, row, headers);
    if (!result.policy || !result.insured) {
      skipped += 1;
      return;
    }
    normalized.push(result);
  });

  return { normalized, skipped };
};

/**
 * Smoke test (manual):
 *
 * const rows = [
 *   { "Poliza": "12345", "Asegurado": "John Doe", "Comision": "125.50" },
 * ];
 * normalizeRowsForInsurerByName("ASSA", rows).then(console.log);
 */
