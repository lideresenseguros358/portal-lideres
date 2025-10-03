export const norm = (s: any) => String(s ?? "").trim();

export function toNumber(v: any): number {
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "");
  const comma = s.indexOf(","),
    dot = s.indexOf(".");
  if (comma > -1 && dot > -1) s = dot < comma ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (comma > -1 && dot === -1) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return neg ? -Math.abs(n) : isFinite(n) ? n : 0;
}

export function cleanText(v: any) {
  return norm(v).replace(/\s+/g, " ");
}

export function extractPolicyFromMixed(cell: any): string {
  const s = norm(cell);
  const tokens = s.split(/\s+/);
  const best = tokens.find((t) => /^\d{3,}$/.test(t));
  return best ?? s;
}
