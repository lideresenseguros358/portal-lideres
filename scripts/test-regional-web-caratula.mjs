/**
 * Prueba standalone: Regional Web Portal Carátula URL
 *
 * Ejecutar: node scripts/test-regional-web-caratula.mjs
 *
 * Lee credenciales desde .env.local
 */

import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Leer .env.local ──
function loadEnvLocal() {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    }
    console.log('✅ .env.local cargado');
  } catch {
    console.warn('⚠️  .env.local no encontrado, usando variables de entorno existentes');
  }
}

loadEnvLocal();

const WEB_BASE = 'https://contactoenlinea.laregionaldeseguros.com:7443';
const LOGIN_URL = `${WEB_BASE}/ords/ws_regional/r/lrds201/login`;

// Acepta credenciales por: args (--user=X --pass=Y), env vars, o prod env vars
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')]; })
);

const USER = args.user || process.env.REGIONAL_USER || process.env.REGIONAL_USERNAME_PROD || process.env.REGIONAL_USERNAME || '';
const PASS = args.pass || process.env.REGIONAL_PASSWORD || process.env.REGIONAL_PASSWORD_PROD || '';

if (!USER || !PASS) {
  console.error('❌ Credenciales no configuradas.');
  console.error('   Uso: node scripts/test-regional-web-caratula.mjs --user=LIDERES_SEGUROS_99 --pass=LIDERES_SEGUROS_99');
  process.exit(1);
}

console.log(`\n🔐 Usuario: ${USER}`);
console.log(`🔑 Password: ${'*'.repeat(PASS.length)}\n`);

// ── HTTP helper ──
function request(url, method, headers, body, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyBuf = body ? Buffer.from(body, 'utf8') : undefined;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? '443' : '80'),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        ...headers,
        ...(bodyBuf ? { 'Content-Length': bodyBuf.length.toString() } : {}),
      },
      rejectUnauthorized: false,
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, text, buf });
      });
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function extractCookies(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

function mergeCookies(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  const map = new Map();
  for (const pair of existing.split('; ')) {
    const idx = pair.indexOf('=');
    if (idx > 0) map.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  for (const pair of incoming.split('; ')) {
    const idx = pair.indexOf('=');
    if (idx > 0) map.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function extractHiddenInputs(html) {
  const inputs = {};
  const regex = /<input[^>]+type=["']?hidden["']?[^>]*>/gi;
  const nameVal = /name=["']([^"']*)["']/i;
  const valueVal = /value=["']([^"']*)["']/i;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    const n = nameVal.exec(tag);
    const v = valueVal.exec(tag);
    if (n) inputs[n[1]] = v ? v[1] : '';
  }
  return inputs;
}

function extractFormAction(html) {
  const m = html.match(/<form[^>]+action=["']([^"']*)["']/i);
  return m ? m[1] : null;
}

// ── Extrae el <base href> del HTML ──
function extractBaseHref(html) {
  const m = html.match(/<base[^>]+href=["']([^"']*)["']/i);
  return m ? m[1] : null;
}

// ── Resuelve action usando <base href> si está disponible ──
function resolveActionWithBase(formAction, baseHref, pageUrl) {
  if (!formAction) return pageUrl;
  if (formAction.startsWith('http')) return formAction;
  if (formAction.startsWith('/')) {
    const b = new URL(pageUrl);
    return `${b.protocol}//${b.host}${formAction}`;
  }
  // Relativo — usa <base href> si existe, sino el directorio de la URL
  if (baseHref) {
    const b = new URL(pageUrl);
    if (baseHref.startsWith('/')) {
      return `${b.protocol}//${b.host}${baseHref}${formAction}`;
    }
    return `${b.protocol}//${b.host}/${baseHref}${formAction}`;
  }
  return resolveUrl(pageUrl, formAction);
}

function resolveUrl(base, relative) {
  if (!relative) return base;
  if (relative.startsWith('http')) return relative;
  if (relative.startsWith('/')) {
    const b = new URL(base);
    return `${b.protocol}//${b.host}${relative}`;
  }
  const b = new URL(base);
  const dir = b.pathname.split('/').slice(0, -1).join('/');
  return `${b.protocol}//${b.host}${dir}/${relative}`;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  const TEST_POLIZAS = ['10-29-2227295', '10-29-2227294', '10-29-2227291'];
  let cookies = '';
  let currentUrl = LOGIN_URL;

  // ══════════════════════════════
  // PASO 1: GET Login page
  // ══════════════════════════════
  console.log('═'.repeat(60));
  console.log(`PASO 1: GET ${LOGIN_URL}`);
  const r1 = await request(LOGIN_URL, 'GET', {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    Accept: 'text/html,application/xhtml+xml,*/*',
  });
  console.log(`  Status: ${r1.status}`);
  console.log(`  Content-Length: ${r1.text.length} bytes`);
  cookies = extractCookies(r1.headers);
  console.log(`  Cookies: ${cookies || '(ninguna)'}`);
  console.log(`  Location: ${r1.headers['location'] || '(sin redirect)'}`);

  // Seguir redirect si aplica
  if (r1.status >= 300 && r1.status < 400 && r1.headers['location']) {
    const rUrl = resolveUrl(LOGIN_URL, r1.headers['location']);
    console.log(`  → Redirect a: ${rUrl}`);
    const rR = await request(rUrl, 'GET', {
      'User-Agent': 'Mozilla/5.0',
      Cookie: cookies,
    });
    const nc = extractCookies(rR.headers);
    cookies = mergeCookies(cookies, nc);
    currentUrl = rUrl;
    console.log(`  Redirect status: ${rR.status}, length: ${rR.text.length}`);
    console.log(`  New cookies: ${nc || '(ninguna)'}`);
  }

  // Extraer formulario
  const hiddenInputs = extractHiddenInputs(r1.text);
  const formAction = extractFormAction(r1.text);
  const baseHref = extractBaseHref(r1.text);
  console.log(`\n  Hidden inputs: ${JSON.stringify(hiddenInputs, null, 2)}`);
  console.log(`  Form action: ${formAction || '(no encontrado en HTML)'}`);
  console.log(`  Base href: ${baseHref || '(no encontrado)'}`);

  // Buscar cualquier campo de nombre de usuario en el form
  const userFields = [...r1.text.matchAll(/name=["']([^"']*(?:user|login|nombre|cuenta)[^"']*)["']/gi)].map(m => m[1]);
  const passFields = [...r1.text.matchAll(/name=["']([^"']*(?:pass|contra|clave|pwd)[^"']*)["']/gi)].map(m => m[1]);
  console.log(`  User-like fields: ${userFields.join(', ') || '(ninguno)'}`);
  console.log(`  Pass-like fields: ${passFields.join(', ') || '(ninguno)'}`);

  // Extraer botones de submit (tanto <input type=submit> como <button>)
  const submitBtns = [...r1.text.matchAll(/<(button|input)[^>]+(?:type=["']?submit["']?|apex\.submit)[^>]*>/gi)].map(m => m[0]);
  console.log(`  Submit buttons (input/button): ${submitBtns.join(' | ').slice(0, 400) || '(ninguno)'}`);

  // Buscar botones con onclick que llaman apex.submit({request:...})
  const apexSubmitCalls = [...r1.text.matchAll(/apex\.submit\s*\(\s*\{[^}]*request\s*:\s*['"]([^'"]+)['"][^}]*\}/gi)].map(m => m[1]);
  console.log(`  apex.submit request values: ${apexSubmitCalls.join(', ') || '(ninguno)'}`);

  // Buscar <button> elements normales
  const allButtons = [...r1.text.matchAll(/<button[^>]*>([\s\S]{0,100}?)<\/button>/gi)].map(m => m[0].slice(0, 200));
  console.log(`  All <button> elements: ${allButtons.join(' | ').slice(0, 400) || '(ninguno)'}`);

  // Extraer todos los inputs del form (no solo hidden)
  const allInputs = [...r1.text.matchAll(/<input[^>]+>/gi)].map(m => {
    const n = /name=["']([^"']*)["']/i.exec(m[0]);
    const v = /value=["']([^"']*)["']/i.exec(m[0]);
    const t = /type=["']([^"']*)["']/i.exec(m[0]);
    return { name: n?.[1], value: v?.[1], type: t?.[1] || 'text' };
  }).filter(i => i.name);
  console.log(`  All form inputs: ${allInputs.map(i => `${i.name}[${i.type}]=${i.value||''}`).join(', ')}`);

  // Snippet del HTML para inspección
  console.log(`\n  HTML snippet (primeros 800 chars):\n${r1.text.slice(0, 800)}`);

  // ══════════════════════════════
  // PASO 2: POST Login
  // ══════════════════════════════
  console.log('\n' + '═'.repeat(60));
  // Usar <base href> para resolver la action correctamente (APEX usa base href="/ords/")
  const postUrl = resolveActionWithBase(formAction, baseHref, currentUrl);
  console.log(`PASO 2: POST Login → ${postUrl}`);

  // Solo enviar los campos correctos de APEX (P9999_USERNAME / P9999_PASSWORD)
  // + los hidden inputs del formulario.
  // CRÍTICO: p_request debe ser "LOGIN" — APEX usa esto para enrutar el submit al handler correcto
  const formFields = {
    ...hiddenInputs,
    p_request: 'LOGIN',  // ← APEX requiere esto para autenticar
  };

  // Asignar el usuario al campo detectado (P9999_USERNAME)
  if (userFields.length > 0) {
    formFields[userFields[0]] = USER;
    console.log(`  Usando campo usuario: ${userFields[0]}`);
  } else {
    formFields['p_username'] = USER;
  }
  if (passFields.length > 0) {
    formFields[passFields[0]] = PASS;
    console.log(`  Usando campo password: ${passFields[0]}`);
  } else {
    formFields['p_password'] = PASS;
  }

  const formBody = Object.entries(formFields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  console.log(`  Campos enviados: ${Object.keys(formFields).join(', ')}`);

  const r2 = await request(postUrl, 'POST', {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    Accept: 'text/html,application/xhtml+xml,*/*',
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: currentUrl,
    Cookie: cookies,
  }, formBody);

  console.log(`  Status: ${r2.status}`);
  const nc2 = extractCookies(r2.headers);
  cookies = mergeCookies(cookies, nc2);
  console.log(`  New cookies: ${nc2 || '(ninguna)'}`);
  console.log(`  Location: ${r2.headers['location'] || '(sin redirect)'}`);
  console.log(`  Content-Type: ${r2.headers['content-type'] || '(desconocido)'}`);
  console.log(`  Content-Length: ${r2.text.length}`);
  // Buscar mensaje real del error de APEX
  const apexErr = r2.text.match(/class="[^"]*error[^"]*"[^>]*>([\s\S]{0,300}?)<\/[a-z]/i);
  if (apexErr) console.log(`  APEX error container: ${apexErr[1].replace(/<[^>]+>/g, '').trim().slice(0, 200)}`);
  const errEl = r2.text.match(/id="error[^"]*"[^>]*>([\s\S]{0,500}?)<\/(div|span|p)/i);
  if (errEl) console.log(`  Error element text: ${errEl[1].replace(/<[^>]+>/g, '').trim().slice(0, 200)}`);

  // Buscar JS redirect en la respuesta
  const jsRedirect = r2.text.match(/(?:location\.href|window\.location|apex\.navigation\.redirect)\s*=?\s*["'(]([^"')]+)/i);
  if (jsRedirect) console.log(`  ✅ JavaScript redirect: ${jsRedirect[1]}`);

  // Buscar cualquier mención de página de destino (home, dashboard, etc.)
  const homeRef = r2.text.match(/["']([^"']*(?:home|dashboard|inicio|menu|principal)[^"']*)["']/gi);
  if (homeRef) console.log(`  Home references: ${[...new Set(homeRef)].slice(0, 5).join(', ')}`);

  // Diferencia de tamaño entre login original (r1) y respuesta post (r2)
  console.log(`  Size diff from original login: ${r2.text.length - r1.text.length} bytes`);
  console.log(`  Response snippet (first 600 chars):\n${r2.text.slice(0, 600)}`);

  // ══════════════════════════════
  // PASO 2b: Detectar redirect JavaScript post-login (solo en bloques <script>, no en onclick)
  // ══════════════════════════════
  // Oracle APEX puede hacer un redirect JS en lugar de HTTP 302 para cambios de contraseña obligatorios
  // Buscamos SOLO dentro de bloques <script>...</script>, no en atributos onclick/href
  const scriptBlocks = [...r2.text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const scriptContent = scriptBlocks.join('\n');
  const jsRedirectRaw = scriptContent.match(/(?:location\.href|window\.location(?:\.href)?|location\.replace)\s*[=(]\s*["']([^"']+)["']/i)
    || scriptContent.match(/apex\.navigation\.redirect\s*\(\s*["']([^"']+)["']\s*\)/i);

  if (jsRedirectRaw) {
    // Decodificar Unicode escapes y HTML entities
    let jsUrl = jsRedirectRaw[1]
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\u0025/g, '%')  // %25 → % (para URLs URL-encoded dentro de JS)
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Si la URL tiene %C3%B1 etc., son caracteres URL-encoded válidos — dejarlos como están
    console.log(`\n  ✅ APEX JS redirect detectado: ${jsUrl}`);

    if (!jsUrl.startsWith('http')) {
      jsUrl = resolveUrl(WEB_BASE, jsUrl);
    }
    console.log(`  URL completa: ${jsUrl}`);

    // Seguir el redirect de cambio de contraseña
    const rPwd = await request(jsUrl, 'GET', {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Accept: 'text/html,*/*',
      Cookie: cookies,
    }, undefined, 15000);

    const pwdCookies = extractCookies(rPwd.headers);
    cookies = mergeCookies(cookies, pwdCookies);
    console.log(`  Password change page: ${rPwd.status} (${rPwd.text.length} bytes)`);
    console.log(`  Title: ${(rPwd.text.match(/<title>([^<]*)<\/title>/i) || ['',''])[1]}`);

    // Extraer form de cambio de contraseña
    const pwdHiddenInputs = extractHiddenInputs(rPwd.text);
    const pwdFormAction = extractFormAction(rPwd.text);
    const pwdBaseHref = extractBaseHref(rPwd.text);
    const pwdAllInputs = [...rPwd.text.matchAll(/<input[^>]+>/gi)].map(m => {
      const n = /name=["']([^"']*)["']/i.exec(m[0]);
      const v = /value=["']([^"']*)["']/i.exec(m[0]);
      const t = /type=["']([^"']*)["']/i.exec(m[0]);
      return { name: n?.[1], value: v?.[1], type: t?.[1] || 'text' };
    }).filter(i => i.name);
    console.log(`  Password form inputs: ${pwdAllInputs.map(i => `${i.name}[${i.type}]`).join(', ')}`);
    console.log(`  Password form action: ${pwdFormAction}`);

    // Intentar auto-completar el cambio de contraseña
    // Mantenemos la misma contraseña (submit con old=xxx, new=xxx, confirm=xxx)
    const pwdFields = { ...pwdHiddenInputs };
    const newPass = PASS; // Mismo password

    for (const inp of pwdAllInputs) {
      if (!inp.name) continue;
      if (/old|actual|current|anterior/i.test(inp.name)) pwdFields[inp.name] = PASS;
      else if (/confirm|verif|retype|repetir/i.test(inp.name)) pwdFields[inp.name] = newPass;
      else if (/new|nueva|nuevo|password|contrase/i.test(inp.name) && inp.type === 'password') pwdFields[inp.name] = newPass;
    }

    console.log(`  Campos a enviar: ${Object.keys(pwdFields).join(', ')}`);

    // Determinar si tenemos los campos suficientes para intentar
    const hasPasswordFields = Object.keys(pwdFields).some(k => /pass|contrase/i.test(k));
    if (hasPasswordFields && pwdFormAction) {
      const pwdPostUrl = resolveActionWithBase(pwdFormAction, pwdBaseHref, jsUrl);
      console.log(`\n  📝 Intentando auto-completar cambio de contraseña → ${pwdPostUrl}`);

      const pwdFormBody = Object.entries(pwdFields)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v || '')}`)
        .join('&');

      const rPwdPost = await request(pwdPostUrl, 'POST', {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: jsUrl,
        Cookie: cookies,
      }, pwdFormBody, 15000);

      const newCookiesPwd = extractCookies(rPwdPost.headers);
      cookies = mergeCookies(cookies, newCookiesPwd);
      console.log(`  Resultado: ${rPwdPost.status} (${rPwdPost.text.length} bytes)`);
      console.log(`  Location: ${rPwdPost.headers['location'] || '(sin redirect)'}`);

      // Buscar JS redirect en la respuesta
      const jsRedir2 = rPwdPost.text.match(/(?:location\.href|window\.location(?:\.href)?)\s*[=(]\s*&#x27;([^']+)&#x27;/i);
      if (jsRedir2) {
        let url2 = jsRedir2[1].replace(/&#x27;/g, "'").replace(/\u0025/g, '%')
          .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        if (!url2.startsWith('http')) url2 = resolveUrl(WEB_BASE, url2);
        console.log(`  JS redirect post-password-change: ${url2}`);

        // Seguir el redirect post-cambio (debería ir al home)
        const rHome = await request(url2, 'GET', {
          'User-Agent': 'Mozilla/5.0',
          Cookie: cookies,
        }, undefined, 15000);
        const nc = extractCookies(rHome.headers);
        cookies = mergeCookies(cookies, nc);
        currentUrl = url2;
        console.log(`  Home tras cambio de contraseña: ${rHome.status} (${rHome.text.length} bytes)`);
        const isLogin2 = rHome.text.includes('P9999_USERNAME');
        const isHome = !isLogin2 && rHome.status === 200 && rHome.text.length > 2000;
        if (isHome) {
          console.log(`  ✅ ¡LOGIN COMPLETO! Acceso al home de la aplicación`);
          const allLinks = [];
          const lr2 = /href=["']([^"']*)["']/gi;
          let lm2;
          while ((lm2 = lr2.exec(rHome.text)) !== null) allLinks.push(lm2[1]);
          console.log(`  Links en home (filtrado): ${allLinks.filter(l => l.includes('ords') || l.includes('caratula') || l.includes('poliza')).slice(0, 10).join(' | ')}`);
        }
      }
    } else {
      console.log(`  ⚠️  No se detectaron campos de contraseña en el form o no hay action`);
      console.log(`  Snippet de la página:\n${rPwd.text.slice(0, 600)}`);
    }
  }

  // ══════════════════════════════
  // PASO 3: Seguir redirects post-login
  // ══════════════════════════════
  let afterLoginUrl = r2.headers['location'];
  let loginPageHtml = r2.text;

  if (r2.status >= 300 && r2.status < 400 && afterLoginUrl) {
    console.log('\n' + '═'.repeat(60));
    let redirectChain = [resolveUrl(postUrl, afterLoginUrl)];

    for (let i = 0; i < 5; i++) {
      const rUrl = redirectChain[redirectChain.length - 1];
      console.log(`PASO 3.${i + 1}: GET ${rUrl}`);

      const rR = await request(rUrl, 'GET', {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,application/xhtml+xml,*/*',
        Cookie: cookies,
      });

      const nc = extractCookies(rR.headers);
      cookies = mergeCookies(cookies, nc);
      currentUrl = rUrl;
      loginPageHtml = rR.text;

      console.log(`  Status: ${rR.status}, length: ${rR.text.length}`);
      if (nc) console.log(`  New cookies: ${nc}`);

      if (rR.status >= 300 && rR.status < 400 && rR.headers['location']) {
        redirectChain.push(resolveUrl(rUrl, rR.headers['location']));
      } else {
        console.log(`  ✅ Landing final en: ${rUrl}`);
        console.log(`  HTML snippet:\n${rR.text.slice(0, 600)}`);
        break;
      }
    }
  }

  // Extraer el session de APEX de la URL final
  const sessionMatch = currentUrl.match(/:(\d{10,})/);
  const apexSession = sessionMatch ? sessionMatch[1] : null;
  console.log(`\n  📍 URL final: ${currentUrl}`);
  console.log(`  🎟️  APEX Session: ${apexSession || '(no encontrado en URL)'}`);
  console.log(`  🍪 Cookies finales: ${cookies}`);

  // ══════════════════════════════
  // PASO 4: Probar URLs de carátula
  // ══════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('PASO 4: Probando URLs de carátula');

  const buildCandidates = (poliza) => {
    const enc = encodeURIComponent(poliza);
    const candidates = [];

    if (apexSession) {
      candidates.push(
        `${WEB_BASE}/ords/ws_regional/r/lrds201/caratula:${apexSession}?P_POLIZA=${enc}`,
        `${WEB_BASE}/ords/ws_regional/r/lrds201/imprimir:${apexSession}?P_POLIZA=${enc}`,
        `${WEB_BASE}/ords/ws_regional/r/lrds201/descarga:${apexSession}?P_POLIZA=${enc}`,
        `${WEB_BASE}/ords/ws_regional/r/lrds201/pdf:${apexSession}?P_POLIZA=${enc}`,
        `${WEB_BASE}/ords/ws_regional/r/lrds201/poliza:${apexSession}?P_POLIZA=${enc}`,
        `${WEB_BASE}/ords/ws_regional/r/lrds201/print:${apexSession}?P_POLIZA=${enc}`,
        `${WEB_BASE}/ords/ws_regional/r/lrds201/ver-poliza:${apexSession}?P_POLIZA=${enc}`,
        `${WEB_BASE}/ords/ws_regional/r/lrds201/descargar:${apexSession}?P_POLIZA=${enc}`,
      );
    }

    candidates.push(
      `${WEB_BASE}/ords/ws_regional/ws/caratula?poliza=${enc}`,
      `${WEB_BASE}/ords/ws_regional/ws/imprimirPoliza?poliza=${enc}`,
      `${WEB_BASE}/ords/ws_regional/r/lrds201/caratula?poliza=${enc}`,
      `${WEB_BASE}/ords/ws_regional/r/lrds201/descargar-caratula?poliza=${enc}`,
    );

    return candidates;
  };

  // Probar primera póliza con todas las URLs
  const poliza1 = TEST_POLIZAS[0];
  console.log(`\nPóliza: ${poliza1}`);
  const candidates = buildCandidates(poliza1);

  const workingUrls = [];

  for (const url of candidates) {
    try {
      const r = await request(url, 'GET', {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,application/pdf,*/*',
        Cookie: cookies,
      }, undefined, 10000);

      const ct = r.headers['content-type'] || '';
      const isPdf = ct.includes('pdf') || (r.buf.length > 4 && r.buf.slice(0, 4).toString() === '%PDF');
      const isHtml = ct.includes('html');
      const hasContent = r.text.length > 500;
      const shortUrl = url.replace(WEB_BASE, '').slice(0, 80);

      const icon = (r.status === 200 && hasContent) ? '✅' : (r.status === 200 ? '🟡' : '❌');
      console.log(`  ${icon} ${r.status} ${ct.slice(0, 25).padEnd(25)} ${r.text.length.toString().padStart(8)}b  ${shortUrl}`);

      if (isPdf && r.status === 200) {
        console.log(`     ↳ ¡PDF recibido! (${r.buf.length} bytes)`);
        workingUrls.push({ url, type: 'PDF', poliza: poliza1 });
      } else if (isHtml && hasContent && r.status === 200) {
        const hasLoginForm = r.text.includes('p_username') || r.text.includes('login');
        if (!hasLoginForm) {
          console.log(`     ↳ HTML con contenido (puede ser la carátula)`);
          workingUrls.push({ url, type: 'HTML', poliza: poliza1 });
          console.log(`     ↳ Snippet: ${r.text.slice(0, 200)}`);
        } else {
          console.log(`     ↳ HTML es página de login (sesión inválida)`);
        }
      }
    } catch (e) {
      const shortUrl = url.replace(WEB_BASE, '').slice(0, 80);
      console.log(`  💥 ERR                                             ${shortUrl}: ${e.message}`);
    }
  }

  // Si encontramos URLs funcionales, probar las demás pólizas
  if (workingUrls.length > 0) {
    console.log(`\n✅ URLs funcionales encontradas:`);
    for (const w of workingUrls) {
      console.log(`  ${w.type}: ${w.url}`);
    }

    console.log('\nProbando pólizas adicionales con URL funcional:');
    const templateUrl = workingUrls[0].url;
    for (const poliza of TEST_POLIZAS.slice(1)) {
      const testUrl = templateUrl.replace(encodeURIComponent(poliza1), encodeURIComponent(poliza));
      try {
        const r = await request(testUrl, 'GET', {
          Cookie: cookies,
          Accept: 'text/html,application/pdf,*/*',
        }, undefined, 10000);
        const ct = r.headers['content-type'] || '';
        console.log(`  ${poliza} → ${r.status} ${ct.slice(0, 30)} (${r.text.length}b)`);
      } catch (e) {
        console.log(`  ${poliza} → ERROR: ${e.message}`);
      }
    }
  } else {
    console.log('\n⚠️  No se encontraron URLs funcionales.');
    console.log('   Revisando contenido de la página post-login para encontrar links...');

    // Buscar links en el HTML de la página post-login
    const linkRegex = /href=["']([^"']*(?:caratula|poliza|imprimir|descarga|pdf)[^"']*)["']/gi;
    const foundLinks = [];
    let match;
    while ((match = linkRegex.exec(loginPageHtml)) !== null) {
      foundLinks.push(match[1]);
    }

    if (foundLinks.length > 0) {
      console.log('   Links relevantes encontrados en página:');
      for (const link of [...new Set(foundLinks)].slice(0, 10)) {
        console.log(`     ${link}`);
      }
    } else {
      console.log('   No se encontraron links relevantes en la página.');
    }

    // Buscar en el HTML cualquier referencia a descarga
    const downloadMatches = loginPageHtml.match(/["'][^"']*(?:download|descarg|caratula|caratula)[^"']*["']/gi) || [];
    if (downloadMatches.length > 0) {
      console.log('   Menciones de descarga/carátula en HTML:');
      [...new Set(downloadMatches)].slice(0, 10).forEach(m => console.log(`     ${m}`));
    }
  }

  // ══════════════════════════════
  // PASO 4b: Explorar páginas APEX con session cookie
  // Intenta acceder a la home y otras páginas comunes con la cookie SOAT
  // ══════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('PASO 4b: Explorar páginas APEX con cookie de sesión');

  // En APEX 21+, las URLs pueden incluir el session en el path o como query param
  // También podemos probar con ":0" que indica sesión pública/sin auth
  const apexPages = [
    `${WEB_BASE}/ords/ws_regional/r/lrds201/home`,
    `${WEB_BASE}/ords/ws_regional/r/lrds201/home:0`,
    `${WEB_BASE}/ords/ws_regional/r/lrds201/1`,           // page 1
    `${WEB_BASE}/ords/ws_regional/r/lrds201/1:0`,
    `${WEB_BASE}/ords/ws_regional/r/lrds201/2`,           // page 2
    `${WEB_BASE}/ords/ws_regional/r/lrds201/`,            // app root
    `${WEB_BASE}/ords/ws_regional/r/201/home`,            // numeric app ID
    `${WEB_BASE}/ords/ws_regional/r/201/`,
    `${WEB_BASE}/ords/ws_regional/r/lrds201/caratula`,    // sin query param
    `${WEB_BASE}/ords/ws_regional/r/lrds201/polizas`,
    `${WEB_BASE}/ords/ws_regional/r/lrds201/imprimir`,
  ];

  for (const url of apexPages) {
    try {
      const r = await request(url, 'GET', {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,*/*',
        Cookie: cookies,
      }, undefined, 10000);
      const ct = r.headers['content-type'] || '';
      const isLogin = r.text.includes('P9999_USERNAME') || r.text.includes('Iniciar Sesi');
      const isNotFound = r.text.includes("isn't availab") || r.text.includes('not found') || r.text.includes('404');
      const redirectLoc = r.headers['location'];
      const icon = r.status === 200 && !isLogin && !isNotFound ? '✅' : (r.status >= 300 && r.status < 400 ? '🔀' : isLogin ? '🔒' : '❌');
      const shortUrl = url.replace(WEB_BASE, '').slice(0, 70);
      const note = r.status >= 300 ? `(→ ${redirectLoc || '?'})` : isLogin ? '(→ login)' : isNotFound ? '(→ 404)' : '';
      console.log(`  ${icon} ${r.status} ${r.text.length.toString().padStart(7)}b  ${shortUrl} ${note}`);
      if (!isLogin && !isNotFound && r.status === 200 && r.text.length > 1000) {
        // Encontramos algo interesante! Buscar links en él
        const links = [];
        const lr = /href=["']([^"']*(?:caratula|poliza|imprimir|descarga|pdf|print)[^"']*)["']/gi;
        let lm;
        while ((lm = lr.exec(r.text)) !== null) links.push(lm[1]);
        if (links.length > 0) {
          console.log(`     ↳ Links relevantes: ${[...new Set(links)].slice(0, 5).join(' | ')}`);
        }
        console.log(`     ↳ Title: ${(r.text.match(/<title>([^<]*)<\/title>/i) || ['',''])[1]}`);
        console.log(`     ↳ Snippet: ${r.text.slice(0, 200)}`);
        // Seguir redirect si aplica
        if (r.headers['location']) {
          console.log(`     ↳ Location: ${r.headers['location']}`);
        }
      }
    } catch (e) {
      const shortUrl = url.replace(WEB_BASE, '').slice(0, 70);
      console.log(`  💥 ${shortUrl}: ${e.message}`);
    }
  }

  // ══════════════════════════════
  // PASO 5: Probar Basic Auth directamente en carátula
  // (por si el APEX acepta Basic Auth sin sesión web)
  // ══════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('PASO 5: Basic Auth directo (sin sesión web)');
  const basicAuth = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
  const basicAuthCandidates = [
    `${WEB_BASE}/ords/ws_regional/ws/caratula?poliza=${encodeURIComponent(TEST_POLIZAS[0])}`,
    `${WEB_BASE}/ords/ws_regional/ws/imprimirPoliza?poliza=${encodeURIComponent(TEST_POLIZAS[0])}`,
    `${WEB_BASE}/ords/ws_regional/ws/caratulaPoliza?poliza=${encodeURIComponent(TEST_POLIZAS[0])}`,
    `${WEB_BASE}/ords/ws_regional/ws/getCaratula?poliza=${encodeURIComponent(TEST_POLIZAS[0])}`,
    `${WEB_BASE}/ords/ws_regional/ws/descargaCaratula?poliza=${encodeURIComponent(TEST_POLIZAS[0])}`,
    `${WEB_BASE}/ords/ws_regional/ws/downloadCaratula?poliza=${encodeURIComponent(TEST_POLIZAS[0])}`,
  ];

  for (const url of basicAuthCandidates) {
    try {
      const r = await request(url, 'GET', {
        'Authorization': basicAuth,
        'Accept': 'application/pdf,text/html,*/*',
        'User-Agent': 'Mozilla/5.0',
      }, undefined, 10000);
      const ct = r.headers['content-type'] || '';
      const isPdf = ct.includes('pdf') || r.text.startsWith('%PDF');
      const isHtml = ct.includes('html');
      const shortUrl = url.replace(WEB_BASE, '').slice(0, 80);
      const icon = r.status === 200 && r.text.length > 500 ? '✅' : (r.status === 401 ? '🔒' : '❌');
      console.log(`  ${icon} ${r.status} ${ct.slice(0, 25).padEnd(25)} ${r.text.length.toString().padStart(8)}b  ${shortUrl}`);
      if (isPdf) console.log(`     ↳ ¡PDF!`);
      if (r.status === 401) console.log(`     ↳ 401 = endpoint existe pero requiere auth diferente`);
    } catch (e) {
      console.log(`  💥 ${url.replace(WEB_BASE, '').slice(0, 80)}: ${e.message}`);
    }
  }

  // ══════════════════════════════
  // RESUMEN FINAL
  // ══════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('RESUMEN FINAL:');
  console.log(`  Login exitoso: ${r2.status >= 200 && r2.status < 400 ? '✅ Sí' : '❌ No'}`);
  console.log(`  APEX Session: ${apexSession || 'No encontrado'}`);
  console.log(`  Cookies: ${cookies ? cookies.slice(0, 100) + '...' : 'Ninguna'}`);
  console.log(`  URLs funcionales: ${workingUrls.length}`);
  for (const w of workingUrls) {
    console.log(`    ✅ ${w.type}: ${w.url}`);
  }
}

main().catch((e) => {
  console.error('ERROR FATAL:', e);
  process.exit(1);
});
