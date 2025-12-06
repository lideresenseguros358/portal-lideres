import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API route de prueba FUERA de (app) para evitar middleware
export async function POST() {
  try {
    // Cliente 100% anónimo
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from('user_requests')
      .insert([{
        email: 'test-api@example.com',
        encrypted_password: 'dGVzdDEyMzQ1Ng==',
        cedula: '8-999-9999',
        fecha_nacimiento: '1990-01-01',
        telefono: '6000-0000',
        nombre_completo: 'Test API',
        bank_route: '71',
        bank_account_no: '9999999999',
        tipo_cuenta: '04',
        nombre_completo_titular: 'TEST API',
        status: 'pending'
      }]);

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        code: error.code,
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Test insert funcionó!' 
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
