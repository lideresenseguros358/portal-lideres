/**
 * API Proxy: Download IS policy PDF
 * GET /api/is/auto/pdf?url=<encoded IS LinkDescarga URL>
 * 
 * The IS LinkDescarga URL is an ASPX page that doesn't return a direct PDF download
 * when opened from a different origin. This route proxies the request server-side
 * and streams the PDF content back to the client.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const pdfUrl = request.nextUrl.searchParams.get('url');

  if (!pdfUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate URL is from IS domain
  if (!pdfUrl.includes('iseguros.com')) {
    return NextResponse.json({ error: 'Invalid URL domain' }, { status: 400 });
  }

  try {
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
        'Accept-Language': 'es-PA,es;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.error('[IS PDF Proxy] Error fetching PDF:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Error fetching PDF: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const body = await response.arrayBuffer();

    // If IS returns PDF directly
    if (contentType.includes('application/pdf')) {
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="poliza.pdf"',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // IS ASPX pages often render HTML with an embedded PDF or redirect
    // Return whatever content IS gives us, letting the browser handle it
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    };

    // If it's not HTML, treat as downloadable file
    if (!contentType.includes('text/html')) {
      responseHeaders['Content-Disposition'] = 'attachment; filename="poliza.pdf"';
    }

    return new NextResponse(body, { headers: responseHeaders });
  } catch (error: any) {
    console.error('[IS PDF Proxy] Error:', error.message);
    return NextResponse.json(
      { error: 'Error downloading PDF: ' + error.message },
      { status: 500 }
    );
  }
}
