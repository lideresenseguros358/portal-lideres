/**
 * API Endpoint: Emisión Póliza CC (Cobertura Completa) REGIONAL
 * POST /api/regional/auto/emit-cc
 *
 * Flow: emitirPoliza → (optional) planPago → imprimirPoliza
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPolizaCC, actualizarPlanPago, imprimirPoliza } from '@/lib/regional/emission.service';
import { colorToRegionalCode } from '@/lib/regional/color-map';
import { crearClienteYPoliza, parseDdMmYyyy } from '@/lib/supabase/create-client-policy';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { RegionalCCEmissionBody } from '@/lib/regional/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  // Helper: truncate and clean strings to prevent Oracle ORA-06502 buffer overflow
  const sanitize = (val: unknown, maxLen: number): string => {
    const s = String(val ?? '').trim();
    return s.length > maxLen ? s.substring(0, maxLen) : s;
  };

  try {
    const body = await request.json();

    // ═══ Master broker override verification ═══
    let masterBrokerId: string | undefined;
    if (body.masterBrokerId) {
      try {
        const supabase = await getSupabaseServer();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role === 'master') {
            masterBrokerId = body.masterBrokerId;
            console.log('[REGIONAL CC Emit] Master broker override:', masterBrokerId);
          }
        }
      } catch (err) {
        console.warn('[REGIONAL CC Emit] Master verification failed:', err);
      }
    }

    // Accept both raw API field names AND the friendly names sent by the CC frontend
    const numcot = body.numcot;
    // Optional client data for Supabase record creation
    const clientNombre = body.nombre || body.primerNombre || '';
    const clientApellido = body.apellido || body.primerApellido || '';
    const clientCedula = body.cedula || body.national_id || '';
    const clientEmail = body.email || '';
    const clientCelular = body.celular || body.telefono || '';
    const clientFechaNacimiento = body.fechaNacimiento || '';
    // Dirección — raw or defaults
    const codpais = body.codpais;
    const codestado = body.codestado || body.codProvincia;
    const codciudad = body.codciudad || body.codDistrito;
    const codmunicipio = body.codmunicipio || body.codCorregimiento;
    const codurb = body.codurb || body.codUrbanizacion;
    const dirhab = sanitize(body.dirhab || body.direccion || 'Ciudad de Panamá', 100);
    // Datos cumplimiento
    const ocupacion = body.ocupacion || body.actividad;
    const ingresoAnual = body.ingresoAnual || body.nivelIngresos;
    const paisTributa = body.paisTributa;
    const pep = body.pep || body.esPEP;
    // Vehículo — accept frontend names: placa/motor/chasis/color
    // Oracle column limits: placa ~10, serial ~20, color ~5 (code)
    const vehnuevo = body.vehnuevo;
    const numplaca = sanitize(body.numplaca || body.placa, 10);
    const serialcarroceria = sanitize(body.serialcarroceria || body.chasis, 20);
    const serialmotor = sanitize(body.serialmotor || body.motor, 20);
    const rawColor = sanitize(body.color, 20);
    const usoveh = body.usoveh;
    const peso = body.peso;
    // Acreedor
    const acreedor = sanitize(body.acreedor || '81', 5);
    // Cuotas
    const cuotas = body.cuotas || body.cantCuotas;
    const opcionPrima = body.opcionPrima;

    if (!numcot) {
      return NextResponse.json(
        { success: false, error: 'Falta numcot (número de cotización)' },
        { status: 400 }
      );
    }

    // Convert color from free text to Regional catalog code
    const colorCode = colorToRegionalCode(rawColor);

    // 1. Update plan de pago if cuotas > 1
    const cuotasNum = cuotas ? parseInt(String(cuotas)) : 1;
    if (cuotasNum > 1) {
      console.log(`[REGIONAL CC Emit] Updating plan pago: numcot=${numcot}, cuotas=${cuotasNum}`);
      const pagoResult = await actualizarPlanPago({
        numcot: parseInt(String(numcot)),
        cuotas: cuotasNum,
        opcionPrima: parseInt(String(opcionPrima)) || 1,
      });
      if (!pagoResult.success) {
        console.warn('[REGIONAL CC Emit] Plan pago failed:', pagoResult.message);
        // Don't fail entirely — continue with emission
      }
    }

    // 2. Emit policy
    const { getRegionalCredentials } = await import('@/lib/regional/config');
    const creds = getRegionalCredentials();

    const emissionBody: RegionalCCEmissionBody = {
      codInter: creds.codInter,
      numcot: parseInt(String(numcot)),
      cliente: {
        direccion: {
          codpais: parseInt(String(codpais)) || 507,
          codestado: parseInt(String(codestado)) || 8,
          codciudad: parseInt(String(codciudad)) || 1,
          codmunicipio: parseInt(String(codmunicipio)) || 1,
          codurb: parseInt(String(codurb)) || 1,
          dirhab: dirhab,
        },
        datosCumplimiento: {
          ocupacion: parseInt(String(ocupacion)) || 1,
          ingresoAnual: parseInt(String(ingresoAnual)) || 1,
          paisTributa: parseInt(String(paisTributa)) || 507,
          pep: (pep === true || pep === 'S') ? 'S' : 'N',
        },
      },
      datosveh: {
        vehnuevo: vehnuevo || 'N',
        numplaca: String(numplaca).toUpperCase(),
        serialcarroceria: String(serialcarroceria).toUpperCase(),
        serialmotor: String(serialmotor).toUpperCase(),
        color: colorCode,
        usoveh: usoveh || 'P',
        peso: peso || 'L',
      },
      acreedor: acreedor,
    };

    console.log(`[REGIONAL CC Emit] Field lengths: dirhab=${dirhab.length}, placa=${numplaca.length}, carroceria=${serialcarroceria.length}, motor=${serialmotor.length}, color=${colorCode.length}`);
    console.log('[REGIONAL CC Emit] Emitting...', JSON.stringify(emissionBody));

    // Retry logic for transient REGIONAL Oracle errors (ORA-03150 DB link, timeouts)
    const isTransientError = (msg: string) =>
      /ORA-03150|ORA-03113|ORA-03114|ORA-12170|ORA-02063|end-of-file|communication channel|timeout|ETIMEDOUT|ECONNRESET|socket hang up/i.test(msg);

    let lastResult: Awaited<ReturnType<typeof emitirPolizaCC>> | null = null;
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 3000;
        console.log(`[REGIONAL CC Emit] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
      lastResult = await emitirPolizaCC(emissionBody);
      if (lastResult.success || !isTransientError(lastResult.message || '')) break;
      console.warn(`[REGIONAL CC Emit] Transient error (attempt ${attempt + 1}): ${lastResult.message}`);
    }

    const emitResult = lastResult!;

    if (!emitResult.success) {
      const errMsg = emitResult.message || 'Error emitiendo póliza CC';
      const isServerDown = isTransientError(errMsg);
      return NextResponse.json(
        {
          success: false,
          error: isServerDown
            ? 'El servidor de La Regional no responde en este momento. Por favor intente nuevamente en unos minutos.'
            : errMsg,
          _rawError: errMsg,
          _retryable: isServerDown,
        },
        { status: isServerDown ? 503 : 500 }
      );
    }

    const elapsed = Date.now() - t0;
    console.log(`[REGIONAL CC Emit] Completed in ${elapsed}ms. Poliza: ${emitResult.poliza}`);

    // ── Capture policy document from Regional immediately after emission ──
    // REGIONAL sometimes embeds the carátula HTML directly in the emission response.
    // If not, fall back to a separate imprimirPoliza call with a short delay.
    let documentStorageUrl: string | null = null;
    if (emitResult.poliza) {
      try {
        console.log(`[REGIONAL CC Emit] Capturing policy document for ${emitResult.poliza}...`);

        let htmlToStore: string | null = (emitResult as Record<string, unknown>).documentHtml as string | null || null;
        let pdfToStore: string | null = null;

        if (htmlToStore) {
          console.log(`[REGIONAL CC Emit] Using HTML from emission response (${htmlToStore.length} bytes)`);
        } else {
          // Small delay to let Regional finalize the policy before printing
          await new Promise(r => setTimeout(r, 300));
          const printResult = await imprimirPoliza(emitResult.poliza, 'cc');
          if (printResult.success) {
            htmlToStore = printResult.html || null;
            pdfToStore = printResult.pdf || null;
          } else {
            console.warn('[REGIONAL CC Emit] imprimirPoliza failed (non-fatal):', printResult.message);
          }
        }

        if (htmlToStore || pdfToStore) {
          const supabaseAdmin = getSupabaseAdmin();
          const BUCKET = 'expediente';
          const ext = pdfToStore ? 'pdf' : 'html';
          const mimeType = pdfToStore ? 'application/pdf' : 'text/html';
          const fileBuffer = pdfToStore
            ? Buffer.from(pdfToStore, 'base64')
            : Buffer.from(htmlToStore!, 'utf8');
          // Fixed filename (no timestamp) so upsert replaces on retry
          const filePath = `regional-policies/${emitResult.poliza.replace(/\//g, '-')}/caratula.${ext}`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(filePath, fileBuffer, { contentType: mimeType, cacheControl: '86400', upsert: true });
          if (uploadError) {
            console.warn('[REGIONAL CC Emit] Storage upload warning (non-fatal):', uploadError.message);
          } else {
            const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
            documentStorageUrl = urlData?.publicUrl || null;
            console.log(`[REGIONAL CC Emit] ✅ Document stored: ${filePath} (${fileBuffer.length} bytes)`);
          }
        } else {
          console.warn('[REGIONAL CC Emit] No document obtained — download will fall back to live print');
        }
      } catch (printErr: any) {
        console.warn('[REGIONAL CC Emit] Document capture error (non-fatal):', printErr.message);
      }
    }

    // Build print URL: prefer permanent storage URL, fall back to live print endpoint
    const pdfUrl = documentStorageUrl
      || (emitResult.poliza ? `/api/regional/auto/print?poliza=${encodeURIComponent(emitResult.poliza)}` : null);

    // ── Auto-save client + policy to Supabase ──
    let clientId: string | undefined;
    let policyId: string | undefined;
    if (clientCedula || clientNombre) {
      const clientName = `${clientNombre} ${clientApellido}`.trim();
      const dbResult = await crearClienteYPoliza({
        insurerPattern: '%REGIONAL%',
        national_id: clientCedula,
        name: clientName,
        email: clientEmail || undefined,
        phone: clientCelular || undefined,
        birth_date: parseDdMmYyyy(clientFechaNacimiento),
        policy_number: emitResult.poliza || `REGIONAL-CC-${Date.now()}`,
        ramo: 'AUTO',
        notas: [
          numplaca ? `Placa: ${numplaca}` : null,
          'Cobertura: Cobertura Completa',
        ].filter(Boolean).join('\n'),
        start_date: new Date().toISOString().split('T')[0],
        renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        overrideBrokerId: masterBrokerId,
      });
      if (dbResult.error) {
        console.warn('[REGIONAL CC Emit] DB save warning (non-fatal):', dbResult.error);
      } else {
        clientId = dbResult.clientId;
        policyId = dbResult.policyId;
      }
    } else {
      console.warn('[REGIONAL CC Emit] No client data in request — skipping Supabase record creation');
    }

    // ── Save policy document to expediente_documents if we have a client+policy ──
    if (clientId && policyId && documentStorageUrl && emitResult.poliza) {
      try {
        const supabaseAdmin = getSupabaseAdmin();
        const filePath = documentStorageUrl.includes('/object/public/')
          ? documentStorageUrl.split('/object/public/expediente/')[1]
          : null;
        if (filePath) {
          const ext = filePath.endsWith('.pdf') ? 'pdf' : 'html';
          await supabaseAdmin.from('expediente_documents').insert({
            client_id: clientId,
            policy_id: policyId,
            document_type: 'otros',
            document_name: `Carátula de Póliza - ${emitResult.poliza}`,
            file_path: filePath,
            file_name: `caratula.${ext}`,
            file_size: null,
            mime_type: ext === 'pdf' ? 'application/pdf' : 'text/html',
            uploaded_by: null,
            notes: 'Carátula oficial emitida por Regional de Seguros. Capturada automáticamente en el momento de emisión.',
          });
          console.log('[REGIONAL CC Emit] ✅ Policy document saved to expediente_documents');
        }
      } catch (expErr: any) {
        console.warn('[REGIONAL CC Emit] expediente_documents save warning (non-fatal):', expErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      poliza: emitResult.poliza,
      nroPoliza: emitResult.poliza,
      numcot: emitResult.numcot,
      pdfUrl,
      documentStorageUrl,
      insurer: 'REGIONAL',
      clientId,
      policyId,
      // Echo back sent data for carátula verification
      vehiculo: {
        placa: numplaca || '',
        serialcarroceria: serialcarroceria || '',
        serialmotor: serialmotor || '',
        color: colorCode,
      },
      cuotasSent: cuotasNum,
      _timing: { totalMs: elapsed },
    });
  } catch (error: any) {
    console.error('[API REGIONAL CC Emit] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
