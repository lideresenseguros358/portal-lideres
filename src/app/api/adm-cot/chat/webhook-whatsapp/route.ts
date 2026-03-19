/**
 * ADM COT — WhatsApp Webhook (Legacy Stub)
 * 
 * DEPRECATED: The main WhatsApp webhook is now at /api/whatsapp.
 * This stub is kept for backwards compatibility and redirects
 * any incoming requests to the main endpoint.
 * 
 * Configure your Meta webhook URL to: /api/whatsapp
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Forward to main webhook for Meta verification
  const url = new URL('/api/whatsapp', request.url);
  url.search = new URL(request.url).search;
  return NextResponse.redirect(url);
}

export async function POST() {
  // Direct callers to use the main endpoint
  return NextResponse.json(
    { error: 'Deprecated. Use /api/whatsapp instead.' },
    { status: 301 },
  );
}
