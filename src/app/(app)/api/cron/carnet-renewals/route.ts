/**
 * Cron Job: Carnet Renewals Daily Check
 * Verifica carnets de corredores y envía notificaciones según urgencia
 * 
 * Condiciones:
 * - 60 días antes: Warning (primera alerta)
 * - 30 días antes: Critical (segunda alerta)
 * - Mismo día: Expired (vence hoy)
 * - Después del vencimiento: Expired (ya venció)
 * 
 * Destinatarios: Broker + Master (ambos reciben email)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications/create';
import { sendNotificationEmail } from '@/lib/notifications/send-email';
import { getDeepLink } from '@/lib/notifications/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getTodayLocalDate, addDaysToLocalDate } from '@/lib/utils/dates';

export async function GET(request: NextRequest) {
  // Verificar autorización (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  
  // CRÍTICO: Usar fecha LOCAL de Panamá (UTC-5) para coincidir con fechas en BD
  // Las fechas en carnet_expiry_date son date-only (YYYY-MM-DD) sin timezone
  const todayStr = getTodayLocalDate();

  const results = {
    total: 0,
    sent: 0,
    duplicates: 0,
    errors: 0,
    conditions: {
      '60days': 0,
      '30days': 0,
      'sameday': 0,
      'expired': 0,
    }
  };

  try {
    // Calcular fechas de referencia usando zona horaria local
    const sixtyDaysAheadStr = addDaysToLocalDate(todayStr, 60);
    const thirtyDaysAheadStr = addDaysToLocalDate(todayStr, 30);

    console.log('🔍 [Carnet Renewals] Buscando carnets por vencer...');
    console.log(`📅 Hoy: ${todayStr}`);
    console.log(`📅 60 días: ${sixtyDaysAheadStr}`);
    console.log(`📅 30 días: ${thirtyDaysAheadStr}`);

    // 1. CONDICIÓN: 60 días antes (exacto)
    // Solo procesa brokers de tipo 'agente' (tienen carnet)
    const { data: brokers60Days } = await supabase
      .from('brokers')
      .select(`
        id,
        name,
        carnet_expiry_date,
        broker_type,
        p_id,
        profiles!brokers_p_id_fkey (id, full_name, email)
      `)
      .eq('carnet_expiry_date', sixtyDaysAheadStr)
      .eq('active', true)
      .eq('broker_type', 'agente') as any;

    if (brokers60Days) {
      console.log(`📋 Encontrados ${brokers60Days.length} carnets que vencen en 60 días`);
      for (const broker of brokers60Days) {
        await processCarnetNotification(
          broker,
          '60days',
          60,
          supabase,
          results
        );
      }
    }

    // 2. CONDICIÓN: 30 días antes (exacto)
    const { data: brokers30Days } = await supabase
      .from('brokers')
      .select(`
        id,
        name,
        carnet_expiry_date,
        broker_type,
        p_id,
        profiles!brokers_p_id_fkey (id, full_name, email)
      `)
      .eq('carnet_expiry_date', thirtyDaysAheadStr)
      .eq('active', true)
      .eq('broker_type', 'agente') as any;

    if (brokers30Days) {
      console.log(`📋 Encontrados ${brokers30Days.length} carnets que vencen en 30 días`);
      for (const broker of brokers30Days) {
        await processCarnetNotification(
          broker,
          '30days',
          30,
          supabase,
          results
        );
      }
    }

    // 3. CONDICIÓN: Mismo día (vence hoy)
    const { data: brokersToday } = await supabase
      .from('brokers')
      .select(`
        id,
        name,
        carnet_expiry_date,
        broker_type,
        p_id,
        profiles!brokers_p_id_fkey (id, full_name, email)
      `)
      .eq('carnet_expiry_date', todayStr)
      .eq('active', true)
      .eq('broker_type', 'agente') as any;

    if (brokersToday) {
      console.log(`📋 Encontrados ${brokersToday.length} carnets que vencen HOY`);
      for (const broker of brokersToday) {
        await processCarnetNotification(
          broker,
          'sameday',
          0,
          supabase,
          results
        );
      }
    }

    // 4. CONDICIÓN: Ya vencidos (fecha < hoy)
    const { data: brokersExpired } = await supabase
      .from('brokers')
      .select(`
        id,
        name,
        carnet_expiry_date,
        broker_type,
        p_id,
        profiles!brokers_p_id_fkey (id, full_name, email)
      `)
      .lt('carnet_expiry_date', todayStr)
      .eq('active', true)
      .eq('broker_type', 'agente') as any;

    if (brokersExpired) {
      console.log(`📋 Encontrados ${brokersExpired.length} carnets VENCIDOS`);
      for (const broker of brokersExpired) {
        const expiryDate = new Date(broker.carnet_expiry_date);
        const diffTime = today.getTime() - expiryDate.getTime();
        const daysExpired = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        await processCarnetNotification(
          broker,
          'expired',
          -daysExpired,
          supabase,
          results
        );
      }
    }

    console.log('✅ [Carnet Renewals] Proceso completado');
    console.log('📊 Resultados:', results);

    return NextResponse.json({
      success: true,
      message: 'Carnet renewals check completed',
      results
    });

  } catch (error: any) {
    console.error('❌ [Carnet Renewals] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Procesa notificación de renovación de carnet
 */
async function processCarnetNotification(
  broker: any,
  condition: '60days' | '30days' | 'sameday' | 'expired',
  daysUntilExpiry: number,
  supabase: any,
  results: any
) {
  try {
    results.total++;
    console.log(`\n🔔 Procesando notificación para: ${broker.name}`);
    console.log(`   Condición: ${condition}, Días: ${daysUntilExpiry}`);

    const profile = broker.profiles;
    if (!profile?.email) {
      console.log('   ⚠️ Sin email de perfil, saltando...');
      return;
    }

    const brokerName = broker.name || profile.full_name || 'Corredor';
    const expiryDate = format(new Date(broker.carnet_expiry_date), "d 'de' MMMM 'de' yyyy", { locale: es });

    // Determinar urgencia
    let urgency: 'critical' | 'warning' | 'expired';
    if (daysUntilExpiry < 0) {
      urgency = 'expired';
    } else if (daysUntilExpiry <= 30) {
      urgency = 'critical';
    } else {
      urgency = 'warning';
    }

    // Título de notificación
    const title = daysUntilExpiry < 0
      ? `🚨 Carnet Vencido - ${brokerName}`
      : daysUntilExpiry === 0
      ? `⚠️ Carnet Vence HOY - ${brokerName}`
      : daysUntilExpiry <= 30
      ? `⚠️ Carnet vence en ${daysUntilExpiry} días - ${brokerName}`
      : `📋 Carnet vence en ${daysUntilExpiry} días - ${brokerName}`;

    const body = daysUntilExpiry < 0
      ? `El carnet del corredor ${brokerName} venció hace ${Math.abs(daysUntilExpiry)} día(s). Es necesario renovarlo inmediatamente.`
      : daysUntilExpiry === 0
      ? `El carnet del corredor ${brokerName} vence hoy (${expiryDate}). Acción requerida.`
      : `El carnet del corredor ${brokerName} vencerá en ${daysUntilExpiry} días (${expiryDate}).`;

    // Deep link
    const deepLink = getDeepLink('carnet_renewal', { broker_id: broker.id });

    // Crear notificación para el BROKER
    console.log('   📝 Creando notificación para broker...');
    const brokerNotification = await createNotification({
      type: 'carnet_renewal',
      target: 'BROKER',
      title,
      body,
      brokerId: broker.p_id,
      entityId: broker.id,
      condition,
      meta: {
        cta_url: deepLink,
        broker_id: broker.id,
        broker_name: brokerName,
        expiry_date: broker.carnet_expiry_date,
        days_until_expiry: daysUntilExpiry,
        urgency
      }
    });

    if (brokerNotification.isDuplicate) {
      console.log('   ⏭️ Notificación duplicada (ya enviada hoy)');
      results.duplicates++;
      return;
    }

    if (!brokerNotification.success) {
      console.log('   ❌ Error creando notificación:', brokerNotification.error);
      results.errors++;
      return;
    }

    // Obtener emails de masters
    const { data: masters } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'master');

    const masterEmails = masters?.map((m: any) => m.email).filter(Boolean) || [];
    console.log(`   📧 Masters encontrados: ${masterEmails.length}`);

    // Enviar email al BROKER (TO) con MASTERS en CC
    console.log('   📤 Enviando email...');
    const emailResult = await sendNotificationEmail({
      type: 'carnet_renewal',
      to: profile.email,
      cc: masterEmails.length > 0 ? masterEmails : undefined,
      data: {
        brokerName,
        brokerEmail: profile.email,
        expiryDate,
        daysUntilExpiry,
        urgency
      },
      notificationId: brokerNotification.notificationId
    });

    if (emailResult.success) {
      console.log('   ✅ Email enviado correctamente');
      results.sent++;
      results.conditions[condition]++;
    } else {
      console.log('   ❌ Error enviando email:', emailResult.error);
      results.errors++;
    }

  } catch (error) {
    console.error('   ❌ Error procesando notificación:', error);
    results.errors++;
  }
}
