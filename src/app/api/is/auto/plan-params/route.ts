/**
 * API Endpoint: Obtener parámetros dinámicos para cotización IS
 * GET /api/is/auto/plan-params?tipo=CC&env=development
 * 
 * Usa catálogos cacheados en Supabase (NO llama API live que falla con 401).
 * Fallback a valores conocidos de la documentación oficial IS.
 * 
 * Según documentación oficial (Postman screenshots):
 * - gettipoplanes: 3=DAT Particular, 16=DAT Comercial, 14=Cobertura Completa Comercial, 6=Perdida Total
 * - getgrupotarifa/14: DATO=20 (PARTICULAR)
 * - getplanes/14: DATO=306 (plan cobertura)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ISEnvironment } from '@/lib/is/config';
import { getTipoPlanes, getGruposTarifa, getPlanes } from '@/lib/is/catalogs.service';

// Valores por defecto de la documentación oficial IS (Postman screenshots)
// Estos se usan cuando no hay datos en cache de Supabase
const DEFAULTS = {
  tiposPlanes: [
    { DATO: 3, TEXTO: 'DAT Particular', ID_ORDEN: 2 },
    { DATO: 16, TEXTO: 'DAT Comercial', ID_ORDEN: 4 },
    { DATO: 14, TEXTO: 'Cobertura Completa Comercial', ID_ORDEN: 5 },
    { DATO: 6, TEXTO: 'Perdida Total', ID_ORDEN: 8 },
  ],
  // Valores de la documentación (Página 5 del manual)
  CC: { vCodTipoPlan: 14, vcodgrupotarifa: 20, vcodplancobertura: 306 },
  DAT: { vCodTipoPlan: 3, vcodgrupotarifa: 20, vcodplancobertura: 306 },
};

// Cache en memoria para evitar consultas repetidas a Supabase (válido 24h)
const planParamsCache = new Map<string, { data: any; exp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tipo = searchParams.get('tipo') || 'CC';
  const env = (searchParams.get('env') || 'development') as ISEnvironment;
  
  const cacheKey = `${tipo}_${env}`;
  const cached = planParamsCache.get(cacheKey);
  
  if (cached && cached.exp > Date.now()) {
    console.log('[IS Plan Params] Cache hit (memoria):', cacheKey);
    return NextResponse.json({ success: true, ...cached.data });
  }
  
  try {
    // Intentar obtener datos de catálogos cacheados en Supabase
    // Estas funciones leen de BD local, NO llaman a la API IS
    const [tiposPlanesRaw, gruposTarifaRaw, planesRaw] = await Promise.allSettled([
      getTipoPlanes(env),
      getGruposTarifa(tipo === 'DAT' ? '3' : '14', env),
      getPlanes(env),
    ]);
    
    // Extraer datos o usar defaults
    const tiposPlanes = (tiposPlanesRaw.status === 'fulfilled' && tiposPlanesRaw.value.length > 0)
      ? tiposPlanesRaw.value
      : DEFAULTS.tiposPlanes;
    
    const isFromCache = tiposPlanesRaw.status === 'fulfilled' && tiposPlanesRaw.value.length > 0;
    console.log(`[IS Plan Params] Fuente: ${isFromCache ? 'Cache Supabase' : 'Valores por defecto (docs IS)'}`);
    
    // Seleccionar tipo de plan según solicitud
    let vCodTipoPlan: number;
    
    if (tipo === 'CC' || tipo === 'COBERTURA_COMPLETA') {
      const ccPlan = tiposPlanes.find((t: any) => 
        t.TEXTO?.toUpperCase().includes('COBERTURA COMPLETA') || 
        t.TEXTO?.toUpperCase().includes('COMPLETA')
      );
      vCodTipoPlan = (ccPlan as any)?.DATO || DEFAULTS.CC.vCodTipoPlan;
    } else if (tipo === 'DAT' || tipo === 'DANOS_TERCEROS') {
      const datPlan = tiposPlanes.find((t: any) => 
        t.TEXTO?.toUpperCase().includes('DAT') && t.TEXTO?.toUpperCase().includes('PARTICULAR')
      );
      vCodTipoPlan = (datPlan as any)?.DATO || DEFAULTS.DAT.vCodTipoPlan;
    } else {
      vCodTipoPlan = (tiposPlanes[0] as any)?.DATO || DEFAULTS.CC.vCodTipoPlan;
    }
    
    // Obtener grupo tarifa
    const gruposTarifa = (gruposTarifaRaw.status === 'fulfilled' && gruposTarifaRaw.value.length > 0)
      ? gruposTarifaRaw.value
      : [];
    const defaultGrupo = tipo === 'DAT' ? DEFAULTS.DAT.vcodgrupotarifa : DEFAULTS.CC.vcodgrupotarifa;
    const vcodgrupotarifa = gruposTarifa.length > 0 
      ? Math.floor((gruposTarifa[0] as any)?.DATO || defaultGrupo)
      : defaultGrupo;
    
    // Obtener plan cobertura
    const planes = (planesRaw.status === 'fulfilled' && planesRaw.value.length > 0)
      ? planesRaw.value
      : [];
    const defaultPlan = tipo === 'DAT' ? DEFAULTS.DAT.vcodplancobertura : DEFAULTS.CC.vcodplancobertura;
    const vcodplancobertura = planes.length > 0
      ? Math.floor((planes[0] as any)?.DATO || defaultPlan)
      : defaultPlan;
    
    const result = {
      vCodTipoPlan,
      vcodgrupotarifa,
      vcodplancobertura,
      tiposPlanes,
      gruposTarifa,
      planes,
      source: isFromCache ? 'cache' : 'defaults',
    };
    
    // Guardar en cache de memoria
    planParamsCache.set(cacheKey, { data: result, exp: Date.now() + CACHE_TTL });
    
    console.log('[IS Plan Params] ✅ Parámetros obtenidos:', {
      vCodTipoPlan,
      vcodgrupotarifa,
      vcodplancobertura,
      source: result.source,
    });
    
    return NextResponse.json({ success: true, ...result });
    
  } catch (error: any) {
    // Si todo falla, usar defaults hardcodeados de la documentación
    console.error('[IS Plan Params] Error, usando defaults:', error.message);
    const defaults = tipo === 'DAT' ? DEFAULTS.DAT : DEFAULTS.CC;
    
    return NextResponse.json({
      success: true,
      ...defaults,
      tiposPlanes: DEFAULTS.tiposPlanes,
      gruposTarifa: [],
      planes: [],
      source: 'fallback',
    });
  }
}
