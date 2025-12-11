# ✅ FIX APLICADO: OCR en Vercel

## 🎯 Problema Resuelto

El código ahora busca las credenciales en este orden:
1. **Variable de entorno:** `GOOGLE_APPLICATION_CREDENTIALS_JSON` (Producción)
2. **Archivo local:** `keys/gcloud-key.json` (Desarrollo)

## 📋 Pasos para Activar en Vercel

### ✅ Paso 1: Verificar Variable de Entorno

Ya tienes configurada: `GOOGLE_APPLICATION_CREDENTIALS_JSON` ✓

Verifica que:
- El valor sea el **contenido completo del JSON** (no la ruta)
- Esté seleccionado para: **Production, Preview, Development**

### ✅ Paso 2: Redeploy (IMPORTANTE)

El código se acaba de subir al repositorio. Ahora debes:

1. Ve a: https://vercel.com/lideresenseguros358/portal-lideres/deployments
2. Vercel debería estar deployando automáticamente (verás un deployment "Building")
3. Si NO está deployando automáticamente:
   - Click en el último deployment
   - Click en los **3 puntos** (⋮) en la esquina superior derecha
   - Click en **"Redeploy"**
   - Marcar "Use existing Build Cache" (opcional)
   - Click en **"Redeploy"**

### ✅ Paso 3: Verificar el Deploy

Espera a que el deployment termine (1-3 minutos). Verás:
- ✅ Estado: **Ready** (verde)
- ✅ Commit: Debe ser el último con mensaje "FIX: Configurar Google Vision..."

### ✅ Paso 4: Probar OCR

1. Ve a tu portal: https://portal.lideresenseguros.com
2. Comisiones → Nueva Quincena → Importar
3. Sube un **PDF de ANCON**
4. Deberías ver el progreso de OCR

## 🔍 Ver Logs en Vercel (Troubleshooting)

Si sigue fallando:

1. Ve al deployment en Vercel
2. Click en **"Functions"** tab
3. Busca la función que maneja el upload
4. Deberías ver logs:

**✅ CORRECTO (nuevo código):**
```
[VISION] Usando credenciales desde variable de entorno
[OCR] Procesando PDF con Google Cloud Vision Document AI
```

**❌ INCORRECTO (código viejo):**
```
Google Cloud credentials file not found at: /var/task/keys/gcloud-key.json
```

Si ves el error incorrecto, significa que Vercel no deployó el nuevo código.

## 🔧 Solución si Persiste el Error

### Opción 1: Force Redeploy
```bash
git commit --allow-empty -m "Force redeploy for OCR fix"
git push
```

### Opción 2: Verificar Build en Vercel

1. Ve a: Settings → General
2. Verifica:
   - **Framework Preset:** Next.js
   - **Build Command:** `next build` o vacío
   - **Output Directory:** `.next` o vacío
3. Si cambió algo, guarda y redeploy

### Opción 3: Limpiar Cache

Cuando hagas redeploy, **DESMARCA** "Use existing Build Cache"

## 📊 Formato Correcto de la Variable

Tu variable `GOOGLE_APPLICATION_CREDENTIALS_JSON` debe contener:

```json
{"type":"service_account","project_id":"tu-proyecto","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\nTU_CLAVE_AQUI\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

**IMPORTANTE:**
- ✅ Es un **JSON en una sola línea**
- ✅ Los `\n` en `private_key` deben mantenerse
- ✅ Todo entre comillas dobles
- ❌ NO es una ruta al archivo
- ❌ NO tiene saltos de línea reales

## 🎉 Resultado Esperado

Después del redeploy y configuración correcta:

1. **En desarrollo local:** Usa `keys/gcloud-key.json`
2. **En producción (Vercel):** Usa variable de entorno
3. **PDFs de ANCON:** Se procesan automáticamente con OCR
4. **Sin errores** de credenciales

---

## 📞 Si Necesitas Ayuda

Comparte:
1. Screenshot de los logs del deployment en Vercel
2. Screenshot de la configuración de la variable de entorno
3. El error exacto que aparece

¡Listo! El código está actualizado en el repositorio. Solo falta que Vercel haga el deploy. 🚀
