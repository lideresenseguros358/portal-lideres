import { NextRequest, NextResponse } from 'next/server';
import { runRenewalNotifications } from '@/lib/notifications/renewals';

export async function GET(request: NextRequest) {
  // Verificar header de seguridad
  const cronSecret = request.headers.get('x-cron-secret');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const result = await runRenewalNotifications({ daysBefore: 30 });
    
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error running renewal notifications:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
