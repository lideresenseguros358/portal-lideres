/**
 * API Endpoint: Emisión Póliza RC (Daños a Terceros) REGIONAL
 * POST /api/regional/auto/emit-rc
 *
 * Calls POST /regional/auto/emitirPolizaRc
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPolizaRC } from '@/lib/regional/emission.service';
import { colorToRegionalCode } from '@/lib/regional/color-map';
import { getRegionalCredentials } from '@/lib/regional/config';
import { resolveRegionalVehicleCodes } from '@/lib/cotizadores/regional-vehicle-mapper';
import { crearClienteYPoliza, parseDdMmYyyy } from '@/lib/supabase/create-client-policy';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { RegionalRCEmissionBody } from '@/lib/regional/types';

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
    const creds = getRegionalCredentials();

    const {
      plan,
      // Cliente
      nombre, apellido, fechaNacimiento, edad, sexo, edocivil,
      telefono, celular, email,
      // Dirección
      codpais, codestado, codciudad, codmunicipio, codurb, dirhab,
      // Identificación
      tppersona, tpodoc, prov, letra, tomo, asiento, dv, pasaporte,
      // Vehículo
      codmarca, codmodelo, anio, numplaca, serialcarroceria, serialmotor, color,
      marca, modelo, // Brand/model names for IS→Regional normalization
      // Conductor habitual
      condHabNombre, condHabApellido, condHabSexo, condHabEdocivil,
    } = body;

    // Validations
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Falta el código del plan RC' },
        { status: 400 }
      );
    }
    if (!nombre || !apellido) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente' },
        { status: 400 }
      );
    }
    if (!codmarca || !codmodelo || !anio) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del vehículo' },
        { status: 400 }
      );
    }

    // ═══ Normalize IS vehicle codes → Regional codes ═══
    // ALWAYS resolve via Regional catalog — NEVER send raw IS codes to Regional API
    let resolvedMarca: number;
    let resolvedModelo: number;

    if (!marca) {
      return NextResponse.json(
        { success: false, error: 'Falta el nombre de la marca del vehículo. Por favor regrese al paso anterior y complete los datos del vehículo.' },
        { status: 400 }
      );
    }
    if (!modelo) {
      return NextResponse.json(
        { success: false, error: 'Falta el nombre del modelo del vehículo. Por favor regrese al paso anterior y complete los datos del vehículo.' },
        { status: 400 }
      );
    }

    try {
      const resolved = await resolveRegionalVehicleCodes({
        isMarcaCodigo: parseInt(codmarca),
        isModeloCodigo: parseInt(codmodelo),
        marcaNombre: marca || '',
        modeloNombre: modelo || '',
      });
      resolvedMarca = resolved.codMarca;
      resolvedModelo = resolved.codModelo;
      console.log(`[REGIONAL RC Emit] Vehicle codes normalized: marca ${codmarca}→${resolvedMarca}, modelo ${codmodelo}→${resolvedModelo} (${resolved.matchMethod})`);
    } catch (err: any) {
      console.error('[REGIONAL RC Emit] ❌ Vehicle code resolution FAILED:', err.message);
      return NextResponse.json(
        { success: false, error: `No se pudo resolver el vehículo en catálogo Regional: ${err.message}` },
        { status: 400 }
      );
    }

    // Convert color from free text to Regional catalog code
    const colorCode = colorToRegionalCode(color || '');

    // Sanitize phone numbers: digits only, min 7 chars
    const cleanPhone = (ph: string | undefined, fallback: string) => {
      const digits = (ph || '').replace(/\D/g, '');
      return digits.length >= 7 ? digits : fallback;
    };

    const emissionBody: RegionalRCEmissionBody = {
      codInter: creds.codInter,
      plan: String(plan),
      cliente: {
        nomter: sanitize(nombre, 50).toUpperCase(),
        apeter: sanitize(apellido, 50).toUpperCase(),
        fchnac: fechaNacimiento || '1990-01-01',
        edad: parseInt(edad) || 35,
        sexo: sexo || 'M',
        edocivil: edocivil || 'S',
        t1numero: cleanPhone(telefono, '2900000'),
        t2numero: cleanPhone(celular || telefono, '62900000'),
        email: email || '',
        direccion: {
          codpais: parseInt(codpais) || 507,
          codestado: parseInt(codestado) || 8,
          codciudad: parseInt(codciudad) || 1,
          codmunicipio: parseInt(codmunicipio) || 1,
          codurb: parseInt(codurb) || 1,
          dirhab: sanitize(dirhab || 'Ciudad de Panamá', 100),
        },
        identificacion: {
          tppersona: tppersona || 'N',
          tpodoc: tpodoc || 'C',
          prov: prov ? parseInt(prov) : null,
          letra: letra || null,
          tomo: tomo ? parseInt(tomo) : null,
          asiento: asiento ? parseInt(asiento) : null,
          dv: dv ? parseInt(dv) : null,
          pasaporte: pasaporte || null,
        },
      },
      datosveh: {
        codmarca: resolvedMarca,
        codmodelo: resolvedModelo,
        anio: parseInt(anio),
        numplaca: sanitize(numplaca, 10).toUpperCase(),
        serialcarroceria: sanitize(serialcarroceria, 20).toUpperCase(),
        serialmotor: sanitize(serialmotor, 20).toUpperCase(),
        color: colorCode,
      },
      condHab: {
        nomter: sanitize(condHabNombre || nombre, 50).toUpperCase(),
        apeter: sanitize(condHabApellido || apellido, 50).toUpperCase(),
        sexo: condHabSexo || sexo || 'M',
        edocivil: condHabEdocivil || edocivil || 'S',
      },
    };

    // Validate that at least plate OR chassis is present — Regional registers
    // the vehicle internally before emitting; sending empty strings causes a
    // "vehicle already associated" error on every subsequent attempt (Oracle
    // treats empty string as NULL, so all empty-field requests share the same
    // phantom vehicle record in their test environment).
    if (!emissionBody.datosveh.numplaca && !emissionBody.datosveh.serialcarroceria) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del vehículo: la placa o el número de carrocería son obligatorios.' },
        { status: 400 }
      );
    }

    console.log('[REGIONAL RC Emit] Sending to Regional — vehicle data:', {
      codmarca: emissionBody.datosveh.codmarca,
      codmodelo: emissionBody.datosveh.codmodelo,
      anio: emissionBody.datosveh.anio,
      numplaca: emissionBody.datosveh.numplaca,
      serialcarroceria: emissionBody.datosveh.serialcarroceria,
      serialmotor: emissionBody.datosveh.serialmotor,
      color: emissionBody.datosveh.color,
    });
    console.log('[REGIONAL RC Emit] Client:', emissionBody.cliente.nomter, emissionBody.cliente.apeter, '| Plan:', emissionBody.plan);

    const result = await emitirPolizaRC(emissionBody);

    const elapsed = Date.now() - t0;
    console.log(`[REGIONAL RC Emit] Completed in ${elapsed}ms. Success: ${result.success}`);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message || 'Error emitiendo póliza RC' },
        { status: 500 }
      );
    }

    // ── Capture policy document from Regional immediately after emission ──
    // REGIONAL sometimes embeds the carátula HTML directly in the emission response.
    // imprimirPoliza is NOT called here — it consistently returns null immediately
    // after RC emission (the document isn't ready yet). The /api/regional/auto/print
    // endpoint handles it lazily when the user clicks the download button.
    let documentStorageUrl: string | null = null;

    if (result.poliza) {
      try {
        const htmlToStore = (result as Record<string, unknown>).documentHtml as string | null || null;
        let pdfToStore: string | null = null;

        if (htmlToStore) {
          console.log(`[REGIONAL RC Emit] Using HTML from emission response (${htmlToStore.length} bytes) — storing...`);
        }

        if (htmlToStore || pdfToStore) {
          const supabaseAdmin = getSupabaseAdmin();
          const BUCKET = 'expediente';
          const ext = pdfToStore ? 'pdf' : 'html';
          const mimeType = pdfToStore ? 'application/pdf' : 'text/html';
          const fileBuffer = pdfToStore
            ? Buffer.from(pdfToStore, 'base64')
            : Buffer.from(htmlToStore!, 'utf8');
          const filePath = `regional-policies/${result.poliza.replace(/\//g, '-')}/caratula.${ext}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(filePath, fileBuffer, { contentType: mimeType, cacheControl: '86400', upsert: true });

          if (uploadError) {
            console.warn('[REGIONAL RC Emit] Storage upload warning (non-fatal):', uploadError.message);
          } else {
            const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
            documentStorageUrl = urlData?.publicUrl || null;
            console.log(`[REGIONAL RC Emit] ✅ Document stored: ${filePath} (${fileBuffer.length} bytes)`);
          }
        }
      } catch (printErr: any) {
        console.warn('[REGIONAL RC Emit] Document capture error (non-fatal):', printErr.message);
      }
    }

    // Regional's imprimirPoliza endpoint is CC-only — returns {} for RC policies.
    // RC emission response also never contains HTML. No document available via API.
    const pdfUrl = documentStorageUrl || null;

    // ── Auto-save client + policy to Supabase ──
    const cedula = prov && tomo && asiento ? `${prov}-${tomo}-${asiento}` : (pasaporte || '');
    const clientName = `${nombre} ${apellido}`.trim();
    const dbResult = await crearClienteYPoliza({
      insurerPattern: '%REGIONAL%',
      national_id: cedula,
      name: clientName,
      email: email || undefined,
      phone: String(celular || telefono || ''),
      birth_date: parseDdMmYyyy(fechaNacimiento),
      policy_number: result.poliza || `REGIONAL-RC-${Date.now()}`,
      ramo: 'AUTO',
      notas: [
        marca && modelo ? `Vehículo: ${marca} ${modelo} ${anio || ''}` : null,
        numplaca ? `Placa: ${numplaca}` : null,
        'Cobertura: Daños a Terceros',
      ].filter(Boolean).join('\n'),
      start_date: new Date().toISOString().split('T')[0],
      renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    if (dbResult.error) {
      console.warn('[REGIONAL RC Emit] DB save warning (non-fatal):', dbResult.error);
    }

    // ── Save policy document to expediente_documents if we have a client+policy ──
    if (dbResult.clientId && dbResult.policyId && documentStorageUrl && result.poliza) {
      try {
        const supabaseAdmin = getSupabaseAdmin();
        // Re-read the file from storage to get the buffer for the DB record,
        // or just insert the DB record pointing to the already-uploaded path.
        const filePath = documentStorageUrl.includes('/object/public/')
          ? documentStorageUrl.split('/object/public/expediente/')[1]
          : null;
        if (filePath) {
          const ext = filePath.endsWith('.pdf') ? 'pdf' : 'html';
          await supabaseAdmin.from('expediente_documents').insert({
            client_id: dbResult.clientId,
            policy_id: dbResult.policyId,
            document_type: 'otros',
            document_name: `Carátula de Póliza - ${result.poliza}`,
            file_path: filePath,
            file_name: `caratula.${ext}`,
            file_size: null,
            mime_type: ext === 'pdf' ? 'application/pdf' : 'text/html',
            uploaded_by: null,
            notes: 'Carátula oficial emitida por Regional de Seguros. Capturada automáticamente en el momento de emisión.',
          });
          console.log('[REGIONAL RC Emit] ✅ Policy document saved to expediente_documents');
        }
      } catch (expErr: any) {
        console.warn('[REGIONAL RC Emit] expediente_documents save warning (non-fatal):', expErr.message);
      }
    }

    return NextResponse.json({
      ...result,
      success: true,
      poliza: result.poliza,
      nroPoliza: result.poliza,
      numcot: result.numcot,
      pdfUrl,
      documentStorageUrl,
      insurer: 'REGIONAL',
      clientId: dbResult.clientId,
      policyId: dbResult.policyId,
      // Echo back sent data for carátula verification
      cliente: {
        nombre: clientName,
        cedula,
        email: email || '',
        telefono: celular || telefono || '',
        sexo: sexo || 'M',
        fechaNacimiento: fechaNacimiento || '',
      },
      vehiculo: {
        codmarca: parseInt(codmarca),
        codmodelo: parseInt(codmodelo),
        anio: parseInt(anio),
        placa: numplaca || '',
        serialcarroceria: serialcarroceria || '',
        serialmotor: serialmotor || '',
        color: colorCode,
      },
      plan: String(plan),
      _timing: { totalMs: elapsed },
    });
  } catch (error: any) {
    console.error('[API REGIONAL RC Emit] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
