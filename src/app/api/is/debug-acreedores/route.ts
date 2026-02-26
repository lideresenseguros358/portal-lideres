import { NextResponse } from 'next/server';
import { getISBaseUrl, getISPrimaryToken } from '@/lib/is/config';
import type { ISEnvironment } from '@/lib/is/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const env: ISEnvironment = 'development';
  const baseUrl = getISBaseUrl(env).replace(/\/+$/, '');
  const primaryToken = getISPrimaryToken(env);

  // Get daily token
  let dailyToken: string | null = null;
  for (const method of ['POST', 'GET'] as const) {
    try {
      const r = await fetch(`${baseUrl}/tokens`, {
        method,
        headers: { Authorization: `Bearer ${primaryToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      const text = await r.text();
      const clean = text.trim().replace(/^"|"$/g, '');
      if (clean.startsWith('eyJ') && clean.split('.').length === 3 && clean !== primaryToken) {
        dailyToken = clean;
        break;
      }
    } catch {}
  }

  const token = dailyToken || primaryToken;

  // Fetch /catalogos/bancos
  const r = await fetch(`${baseUrl}/catalogos/bancos`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();

  return NextResponse.json({ status: r.status, count: Array.isArray(data) ? data.length : 0, data });
}
