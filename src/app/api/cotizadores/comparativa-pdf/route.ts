import { NextRequest, NextResponse } from 'next/server';
import { generarComparativaPDF } from '@/lib/cotizadores/comparar-pdf';

export async function POST(request: NextRequest) {
  try {
    const { quotes } = await request.json();

    if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
      return NextResponse.json({ error: 'No quotes provided' }, { status: 400 });
    }

    // Get the base URL for image fetching
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    const pdfBuffer = await generarComparativaPDF(quotes, baseUrl);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="comparativa-cobertura-completa.pdf"',
      },
    });
  } catch (error: any) {
    console.error('[Comparativa PDF] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error generating PDF' },
      { status: 500 }
    );
  }
}
