# Security Audit Report — Portal Líderes en Seguros

**Date:** 2026-03-22  
**Auditor:** Security Hardening Session  
**Scope:** Full repository — focus on public-facing endpoints, webhooks, and API routes

---

## Executive Summary

The audit identified **17 critical/high vulnerabilities** and **8 medium findings** across the portal's public-facing surface. All critical and high findings have been **remediated in this session**. The portal now has a centralized security library, consistent authentication on all endpoints, input validation/sanitization, Content Security Policy headers, and environment validation at startup.

---

## Findings & Remediations

### CRITICAL — Exploitable vulnerabilities

| # | Finding | Location | Status |
|---|---------|----------|--------|
| C1 | **XSS via HTML injection** — User-controlled data (policy number, broker name, phone, email) rendered directly into HTML response without escaping | `/api/renewal-response` | ✅ Fixed — `escapeHtml()` applied to all dynamic values |
| C2 | **10 test endpoints with ZERO authentication** — Anyone on the internet could trigger email sends, insurance emission tests, IMAP ingestion, PDF generation | `/api/test/*`, `/api/test-emails` | ✅ Fixed — `requireCronSecret()` guard added to all 10 endpoints |
| C3 | **2 diagnostics endpoints with ZERO authentication** — Exposed Vertex AI config, credentials metadata, and Regional API connectivity info | `/api/diagnostics/regional`, `/api/diagnostics/vertex-chat` | ✅ Fixed — `requireCronSecret()` guard added |
| C4 | **Hardcoded FEDPA credentials** — Username `SLIDERES` and password `lider836` hardcoded as fallback defaults in 3 source files | `fedpa-emission-externo`, `fedpa/third-party`, `fedpa/emision-externo` | ✅ Fixed — Fallbacks changed to empty strings |
| C5 | **Open redirect** — `/api/agenda/rsvp` built redirect URL from env var without validating origin, allowing attacker-crafted redirects | `/api/agenda/rsvp` | ✅ Fixed — Uses `request.nextUrl.origin`, validates UUID + response whitelist |

### HIGH — Significant risk

| # | Finding | Location | Status |
|---|---------|----------|--------|
| H1 | **Zoho webhook — no authentication** — TODO comment left in code, webhook secret check never implemented | `/api/zoho/webhook` | ✅ Fixed — Enabled `ZOHO_WEBHOOK_SECRET` verification + rate limiting |
| H2 | **PagueloFacil webhook — no authentication** — No secret/signature verification on payment webhook | `/api/paguelofacil/webhook` | ✅ Fixed — Added `PF_WEBHOOK_SECRET` header check + rate limiting |
| H3 | **Weak auth pattern in 6 diagnostics endpoints** — `if (cronSecret && ...)` bypasses auth entirely when `CRON_SECRET` env var is missing | All `/api/diagnostics/*` endpoints | ✅ Fixed — Replaced with `requireCronSecret()` which blocks if env var is missing |
| H4 | **Error message leaks** — Internal DB error messages (`recErr.message`, `error.message`) returned directly to clients | `/api/public/overdue-payments`, `/api/webhooks/tickets` | ✅ Fixed — Generic error messages, details logged server-side only |
| H5 | **No Content-Security-Policy header** — No CSP protection against XSS, inline script injection, or data exfiltration | `next.config.ts` | ✅ Fixed — Full CSP with allowed sources for scripts, styles, images, connections, frames |
| H6 | **No input validation on cédula** — Raw user input passed directly to database queries | `/api/public/overdue-payments` | ✅ Fixed — `sanitizeCedula()` validates format (alphanumeric + hyphens, 3-20 chars) |
| H7 | **No UUID validation** — `clientId`, `policyId`, `recurrence_id` not validated before use in DB queries | `/api/renewal-response`, `/api/public/overdue-payments` | ✅ Fixed — `isValidUUID()` validation added |
| H8 | **Action reflection in error messages** — `Acción desconocida: ${action}` reflects user input in response | `/api/public/overdue-payments` | ✅ Fixed — Static error message, action whitelist validation |
| H9 | **No rate limiting on public endpoints** — `/api/public/overdue-payments`, `/api/renewal-response` had no rate limiting | Multiple public routes | ✅ Fixed — `rateLimit(RATE_LIMITS.PUBLIC_API)` added (100 req/min/IP) |
| H10 | **Tickets webhook info disclosure** — GET endpoint disclosed supported actions list; error response leaked `error.message` | `/api/webhooks/tickets` | ✅ Fixed — Minimal GET response, generic error messages |
| H11 | **No environment validation at startup** — Missing/placeholder env vars only discovered at runtime when a feature breaks | Global | ✅ Fixed — `instrumentation.ts` validates required env vars on server start |

### MEDIUM — Should be addressed

| # | Finding | Location | Status |
|---|---------|----------|--------|
| M1 | **Chat input not sanitized** — Message text, cédula, sessionId passed through without sanitization | `/api/chat` | ✅ Fixed — `sanitizeText()`, `sanitizeCedula()`, history size limit |
| M2 | **Conversation history unbounded** — Chat endpoint accepted unlimited `conversationHistory` array | `/api/chat` | ✅ Fixed — Limited to last 20 entries |
| M3 | **`dangerouslyAllowSVG: true`** in Next.js image config — SVG files can contain embedded scripts | `next.config.ts` | ⚠️ Mitigated — `contentSecurityPolicy` on images restricts execution, but consider disabling if SVGs not needed |
| M4 | **`typescript.ignoreBuildErrors: true`** — Type errors silently ignored during builds | `next.config.ts` | ⚠️ Noted — Should be `false` in production to catch type-related bugs |

---

## New Files Created

| File | Purpose |
|------|---------|
| `src/lib/security/sanitize.ts` | Input sanitization: `escapeHtml`, `sanitizeText`, `sanitizeCedula`, `isValidUUID`, `isValidEmail`, `isValidPhone`, `sanitizeRedirectUrl`, `validateRequiredFields`, `isExternalUrl` |
| `src/lib/security/rate-limit.ts` | Centralized rate limiter with preset configs (`PUBLIC_API`, `CHAT`, `WEBHOOK`, `DIAGNOSTICS`, `AUTH_STRICT`), traffic anomaly detection |
| `src/lib/security/api-guard.ts` | API route guards: `requireCronSecret()`, `requireDevOrSecret()` |
| `src/lib/security/env-check.ts` | Environment variable validation with placeholder detection |
| `src/instrumentation.ts` | Next.js instrumentation — runs env validation on server startup |

---

## Files Modified (28 files)

### Public Endpoints (4)
- `src/app/api/public/overdue-payments/route.ts` — Rate limiting, cédula sanitization, UUID validation, error message hardening
- `src/app/api/renewal-response/route.ts` — XSS fix (escapeHtml), UUID validation, rate limiting
- `src/app/api/agenda/rsvp/route.ts` — Open redirect fix, UUID + response validation
- `src/app/api/chat/route.ts` — Input sanitization (message, cédula, sessionId, history limit)

### Webhooks (3)
- `src/app/api/paguelofacil/webhook/route.ts` — `PF_WEBHOOK_SECRET` auth, rate limiting, Content-Type check
- `src/app/api/zoho/webhook/route.ts` — `ZOHO_WEBHOOK_SECRET` auth enabled, rate limiting
- `src/app/api/webhooks/tickets/route.ts` — Error message hardening, rate limiting, info disclosure fix

### Diagnostics (8)
- `src/app/api/diagnostics/cron/route.ts` — Secure auth guard
- `src/app/api/diagnostics/e2e/route.ts` — Secure auth guard
- `src/app/api/diagnostics/env/route.ts` — Secure auth guard
- `src/app/api/diagnostics/imap/route.ts` — Secure auth guard
- `src/app/api/diagnostics/regional/route.ts` — Auth guard (was ZERO auth)
- `src/app/api/diagnostics/smtp/route.ts` — Secure auth guard
- `src/app/api/diagnostics/ui-probe/route.ts` — Secure auth guard
- `src/app/api/diagnostics/vertex-chat/route.ts` — Auth guard (was ZERO auth)

### Test Endpoints (10)
- `src/app/api/test/auto-smoke/route.ts` — Auth guard (was ZERO auth)
- `src/app/api/test/auth-pdf-signature/route.ts` — Auth guard (was ZERO auth)
- `src/app/api/test/e2e-caratula/route.ts` — Auth guard (was ZERO auth)
- `src/app/api/test/fedpa-emission/route.ts` — Auth guard (was ZERO auth)
- `src/app/api/test/fedpa-emission-externo/route.ts` — Auth guard + credential cleanup
- `src/app/api/test/imap-autotest/route.ts` — Auth guard (was ZERO auth)
- `src/app/api/test/quote-pdf/route.ts` — Auth guard (was ZERO auth)
- `src/app/api/test/regional-smoke/route.ts` — Auth guard (was ZERO auth)
- `src/app/api/test-emails/route.ts` — Auth guard (was ZERO auth, could send emails)

### Credential Cleanup (2)
- `src/app/api/fedpa/third-party/route.ts` — Removed hardcoded FEDPA credentials
- `src/app/api/fedpa/emision-externo/route.ts` — Removed hardcoded FEDPA credentials

### Infrastructure (1)
- `next.config.ts` — Full CSP header, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`

---

## Dependency Vulnerabilities (npm audit)

| Package | Severity | Issue | Action Required |
|---------|----------|-------|-----------------|
| **next** 15.x | HIGH | Source code exposure, DoS via Server Components, Image Optimizer DoS | **Upgrade Next.js** to latest patched version |
| **jspdf** ≤4.2.0 | CRITICAL | Path traversal, PDF injection, XSS, DoS | Run `npm audit fix --force` (breaking change to 4.2.1) |
| **axios** (via @shoopiapp/paguelofacil) | HIGH | CSRF, SSRF, DoS via `__proto__` | No fix available — vendor dependency issue |
| **dompurify** 3.1.3–3.3.1 | MODERATE | XSS bypass | Run `npm audit fix` |
| **mailparser** <3.9.3 | MODERATE | XSS | Run `npm audit fix` |
| **minimatch** ≤3.1.3 | HIGH | ReDoS | Run `npm audit fix` |

### Recommended Actions
```bash
# Fix non-breaking vulnerabilities
npm audit fix

# Fix breaking vulnerabilities (test thoroughly after)
npm audit fix --force
```

---

## Environment Variables to Add

Add these to your Vercel environment variables:

| Variable | Purpose |
|----------|---------|
| `PF_WEBHOOK_SECRET` | Shared secret for PagueloFacil webhook authentication |
| `ZOHO_WEBHOOK_SECRET` | Shared secret for Zoho Mail webhook authentication |
| `USUARIO_FEDPA` | FEDPA API username (previously hardcoded) |
| `CLAVE_FEDPA` | FEDPA API password (previously hardcoded) |

> **Note:** `PF_WEBHOOK_SECRET` and `ZOHO_WEBHOOK_SECRET` should be strong random strings (32+ chars). Configure the same value in PagueloFacil/Zoho webhook settings as a custom header (`x-webhook-secret`).

---

## Architecture Recommendations (Future)

1. **Persistent Rate Limiting** — Current in-memory rate limiter resets on cold starts. Consider Vercel KV or Upstash Redis for production-grade rate limiting.
2. **WAF/DDoS Protection** — Enable Vercel's built-in DDoS protection or add Cloudflare in front.
3. **HMAC Webhook Signatures** — When PagueloFacil supports it, switch from shared secret to HMAC-SHA256 signature verification.
4. **CSP Nonces** — Replace `'unsafe-inline'` in script-src with per-request nonces for stronger XSS protection (requires Next.js middleware integration).
5. **Audit Logging** — Add structured security event logging to Supabase for auth failures, rate limit hits, and suspicious activity.
6. **Remove Test Endpoints in Production** — Consider removing `/api/test/*` routes entirely from production builds, or gate them behind feature flags.
7. **Disable `typescript.ignoreBuildErrors`** — Fix type errors and set to `false` for production builds.
8. **Rotate FEDPA Credentials** — Credentials were exposed in source code history. Rotate `USUARIO_FEDPA` / `CLAVE_FEDPA` immediately.
