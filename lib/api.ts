// /lib/api.ts
export async function apiGet<T = any>(path: string): Promise<T> {
  const token = localStorage.getItem('sb-access-token') || '';
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'omit',
  });
  if (!res.ok) {
    const msg = await res.text().catch(()=>'');
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}
