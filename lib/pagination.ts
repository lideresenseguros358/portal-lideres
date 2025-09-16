export function parsePaging(req: any) {
  const page = Math.max(1, Number(req.query?.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize ?? 10)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = String(req.query?.q ?? '').trim();
  const me = String(req.query?.me ?? '') === '1';
  return { page, pageSize, from, to, q, me };
}
