/**
 * API Endpoint: Procesar pago con tarjeta
 * POST /api/is/payment/process
 * 
 * ⚠️ PREPARADO PARA CONECTAR - Esperando API real de INTERNACIONAL
 */

import { NextRequest, NextResponse } from 'next/server';
import { procesarPagoCompleto } from '@/lib/is/payment.service';
import { ISEnvironment } from '@/lib/is/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      // Datos de tarjeta
      cardData,
      // Pago
      amount,
      policyNumber,
      // Config
      environment = 'development',
    } = body;
    
    // Validaciones
    if (!cardData || !cardData.cardNumber || !cardData.cardName) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos de la tarjeta' },
        { status: 400 }
      );
    }
    
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Monto inválido' },
        { status: 400 }
      );
    }
    
    if (!policyNumber) {
      return NextResponse.json(
        { success: false, error: 'Falta número de póliza' },
        { status: 400 }
      );
    }
    
    // Procesar pago
    const result = await procesarPagoCompleto({
      cardData,
      amount: parseFloat(amount),
      policyNumber,
      env: environment as ISEnvironment,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al procesar pago' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      token: result.token,
      message: 'Pago procesado exitosamente',
    });
    
  } catch (error: any) {
    console.error('[API IS Payment] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
