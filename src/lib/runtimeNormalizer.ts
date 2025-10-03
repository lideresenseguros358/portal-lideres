import type { MappingRule } from "./types/importing";
import { toNumber, cleanText, extractPolicyFromMixed } from "./normalize";

type RowObj = Record<string, unknown> | string[];

const buildHeaderMap = (headers?: string[]) => {
  if (!headers) return null;
  return headers.reduce<Record<string, number>>((acc, header, index) => {
    if (header) {
      acc[header.toLowerCase()] = index;
    }
    return acc;
  }, {});
};

function pick(row: RowObj, aliases: string[], headers?: string[]) {
  if (Array.isArray(row)) {
    const map = buildHeaderMap(headers);
    if (!map) return undefined;
    for (const alias of aliases) {
      const key = alias.toLowerCase();
      const index = map[key];
      if (index !== undefined) {
        return row[index];
      }
    }
    return undefined;
  }

  const lowerMap = new Map<string, string>();
  Object.keys(row).forEach((key) => {
    lowerMap.set(key.toLowerCase(), key);
  });
  for (const alias of aliases) {
    const originalKey = lowerMap.get(alias.toLowerCase());
    if (originalKey) {
      return (row as Record<string, unknown>)[originalKey];
    }
  }
  return undefined;
}

export function applyRules(
  rules: MappingRule[],
  row: RowObj,
  headers?: string[]
): { policy: string; insured: string; commission: number } {
  let policy = "";
  let insured = "";
  let commission = 0;

  for (const rule of rules) {
    const value = pick(row, rule.aliases, headers);
    switch (rule.target_field) {
      case "policy":
        if (rule.strategy === "mixed_token") {
          policy = extractPolicyFromMixed(value);
        } else {
          policy = cleanText(value);
        }
        break;
      case "insured":
        insured = cleanText(value);
        break;
      case "commission":
        if (rule.strategy === "first_nonzero") {
          // Assuming options are stored elsewhere or passed in
        } else {
          commission = toNumber(value);
        }
        break;
    }
  }

  return { policy, insured, commission };
}
