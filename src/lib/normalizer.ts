import type { MappingSnapshot } from "./mappings";
import type {
  DelinquencyRule,
  MappingRule,
  NormalizedDelinquencyRow,
  NormalizedRow,
  RowObject,
  Strategy,
} from "./types/importing";

const NUMERIC_STRATEGIES: Strategy[] = [
  "first_non_zero",
  "penultimate",
  "extract_numeric",
];

const isArrayRow = (row: RowObject): row is string[] => Array.isArray(row);

const toHeaderMap = (headers?: string[]) => {
  if (!headers) return null;
  return headers.reduce<Record<string, number>>((acc, header, index) => {
    const key = header?.trim().toLowerCase();
    if (key) acc[key] = index;
    return acc;
  }, {});
};

const toObjectMap = (row: Record<string, unknown>) => {
  const map = new Map<string, string>();
  Object.keys(row).forEach((key) => {
    map.set(key.toLowerCase(), key);
  });
  return map;
};

const pickValue = (
  row: RowObject,
  aliases: string[],
  headers?: string[]
): unknown => {
  if (!aliases.length) return undefined;

  if (isArrayRow(row)) {
    const indexMap = toHeaderMap(headers);
    if (!indexMap) return undefined;
    for (const alias of aliases) {
      const index = indexMap[alias.toLowerCase()];
      if (index !== undefined) {
        return row[index];
      }
    }
    return undefined;
  }

  const lookup = toObjectMap(row as Record<string, unknown>);
  for (const alias of aliases) {
    const key = lookup.get(alias.toLowerCase());
    if (key) {
      return (row as Record<string, unknown>)[key];
    }
  }
  return undefined;
};

const orderedValues = (row: RowObject): unknown[] => {
  if (isArrayRow(row)) return row;
  return Object.keys(row).map((key) => (row as Record<string, unknown>)[key]);
};

export const cleanText = (value: unknown): string =>
  String(value ?? "").replace(/\s+/g, " ").trim();

export const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  let source = String(value).trim();
  if (!source) return 0;

  const negative = /^\(.*\)$/.test(source);
  if (negative) {
    source = source.replace(/[()]/g, "");
  }

  const commaIndex = source.indexOf(",");
  const dotIndex = source.indexOf(".");

  if (commaIndex > -1 && dotIndex > -1) {
    if (dotIndex < commaIndex) {
      source = source.replace(/\./g, "").replace(/,/g, ".");
    } else {
      source = source.replace(/,/g, "");
    }
  } else if (commaIndex > -1) {
    source = source.replace(/\./g, "").replace(/,/g, ".");
  } else {
    source = source.replace(/,/g, "");
  }

  const parsed = Number(source);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
};

const extractNumericToken = (value: unknown): string => {
  const text = cleanText(value);
  if (!text) return "";
  const match = text.match(/\d{3,}/);
  return match ? match[0] : text;
};

const sumGroup = (
  row: RowObject,
  group: string[],
  headers?: string[]
): number => {
  return group.reduce((acc, alias) => acc + toNumber(pickValue(row, [alias], headers)), 0);
};

const firstNonZeroGroup = (
  groups: string[][],
  row: RowObject,
  headers?: string[]
): number => {
  for (const group of groups) {
    const total = sumGroup(row, group, headers);
    if (Math.abs(total) > 0) return total;
  }
  return 0;
};

const getGroupsForField = (
  field: string,
  options: Record<string, any>
): string[][] => {
  if (field === "commission") return (options?.commission_groups ?? []) as string[][];
  if (field === "amount") return (options?.amount_groups ?? []) as string[][];
  if (field === "balance") return (options?.balance_groups ?? []) as string[][];
  if (field === "days") return (options?.days_groups ?? []) as string[][];
  return [];
};

const applyStrategy = (
  field: string,
  rule: MappingRule | DelinquencyRule,
  row: RowObject,
  headers: string[] | undefined,
  options: Record<string, any>
): unknown => {
  const strategy = rule.strategy ?? "by_alias";

  if (strategy === "penultimate") {
    const values = orderedValues(row);
    if (values.length < 2) return undefined;
    return values[values.length - 2];
  }

  if (strategy === "extract_numeric") {
    const value = pickValue(row, rule.aliases, headers);
    return extractNumericToken(value);
  }

  if (strategy === "first_non_zero") {
    const groups = getGroupsForField(field, options);
    if (Array.isArray(groups) && groups.length > 0) {
      const result = firstNonZeroGroup(groups, row, headers);
      if (Math.abs(result) > 0) return result;
    }
    const value = pickValue(row, rule.aliases, headers);
    return toNumber(value);
  }

  const value = pickValue(row, rule.aliases, headers);
  if (NUMERIC_STRATEGIES.includes(strategy)) {
    return toNumber(value);
  }
  if (strategy === "custom") {
    return cleanText(value);
  }
  return value;
};

const coerceString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    return cleanText(value.toString());
  }
  return cleanText(String(value));
};

const coerceNumber = (value: unknown): number => toNumber(value);

const ruleMap = <T extends { target_field: string }>(rules: T[]) => {
  const map = new Map<string, T>();
  rules.forEach((rule) => {
    map.set(rule.target_field, rule);
  });
  return map;
};

export const normalizeMappingRow = (
  snapshot: MappingSnapshot,
  row: RowObject,
  headers?: string[]
): NormalizedRow => {
  const rules = ruleMap(snapshot.rules);
  const options = {};

  const policyRule = rules.get("policy") ?? snapshot.rules[0];
  const insuredRule = rules.get("insured") ?? snapshot.rules[0];
  const commissionRule = rules.get("commission") ?? snapshot.rules[0];
  const statusRule = rules.get("status");
  const daysRule = rules.get("days");
  const amountRule = rules.get("amount");

  const policy = policyRule ? coerceString(applyStrategy("policy", policyRule, row, headers, options)) : "";
  const insured = insuredRule ? coerceString(applyStrategy("insured", insuredRule, row, headers, options)) : "";
  const commission = commissionRule ? coerceNumber(
    applyStrategy("commission", commissionRule, row, headers, options)
  ) : 0;

  const status = statusRule
    ? coerceString(applyStrategy("status", statusRule, row, headers, options))
    : undefined;
  const days = daysRule
    ? coerceNumber(applyStrategy("days", daysRule, row, headers, options))
    : undefined;
  const amount = amountRule
    ? coerceNumber(applyStrategy("amount", amountRule, row, headers, options))
    : undefined;

  return {
    policy,
    insured,
    commission,
    status,
    days,
    amount,
  };
};

export const normalizeDelinquencyRow = (
  snapshot: { rules: DelinquencyRule[] },
  row: RowObject,
  headers?: string[]
): NormalizedDelinquencyRow => {
  const rules = ruleMap(snapshot.rules);
  const options = {};

  const balanceRule = rules.get("balance") ?? snapshot.rules[0];
  const daysRule = rules.get("days") ?? snapshot.rules[0];
  const statusRule = rules.get("status") ?? snapshot.rules[0];
  const policyRule = rules.get("policy") ?? snapshot.rules[0];
  const insuredRule = rules.get("insured") ?? snapshot.rules[0];

  const balance = balanceRule ? coerceNumber(
    applyStrategy("balance", balanceRule, row, headers, options)
  ) : 0;
  const days = daysRule ? coerceNumber(applyStrategy("days", daysRule, row, headers, options)) : 0;
  const status = statusRule ? coerceString(applyStrategy("status", statusRule, row, headers, options)) : "";
  const policy = policyRule ? coerceString(applyStrategy("policy", policyRule, row, headers, options)) : "";
  const insured = insuredRule ? coerceString(applyStrategy("insured", insuredRule, row, headers, options)) : "";

  return {
    policy,
    insured,
    days,
    amount: balance,
  };
};
