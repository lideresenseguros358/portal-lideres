# 🔧 Configuración de Reset Password - Supabase

## ❌ Problema Actual
Los enlaces de "Restablecer Contraseña" están redirigiendo a Vercel en lugar de la aplicación correcta.

## ✅ Solución

### 1. Acceder al Dashboard de Supabase

1. Ve a: https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a **Authentication** → **URL Configuration**

### 2. Configurar las URLs Correctas

**IMPORTANTE:** Actualiza estos campos con tu URL de producción:

#### Site URL:
```
https://tu-dominio.com
```
O para desarrollo local:
```
http://localhost:3000
```

#### Redirect URLs:
Agrega estas URLs a la lista permitida:
```
https://tu-dominio.com/auth/callback
https://tu-dominio.com/update-password
http://localhost:3000/auth/callback
http://localhost:3000/update-password
```

### 3. Variables de Entorno (.env.local)

Asegúrate de que tu archivo `.env.local` tenga:
```env
NEXT_PUBLIC_SITE_URL=https://tu-dominio.com
```

Para desarrollo local:
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Actualizar Email Template (Opcional)

Si el template en Supabase está personalizado, verifica que use:
```html
<a href="{{ .ConfirmationURL }}">Restablecer contraseña</a>
```

**Ubicación en Supabase:**
- Authentication → Email Templates → Reset Password

**Template local correcto:** `emails/reset_password.html` ✅

---

## 📊 Flujo Completo

```
1. Usuario → /forgot (solicita reset)
2. Backend → supabase.auth.resetPasswordForEmail(email, {
     redirectTo: "https://tu-dominio.com/auth/callback"
   })
3. Supabase → Envía email con enlace
4. Usuario → Click en enlace
5. Navegador → https://tu-dominio.com/auth/callback?type=recovery&token=...
6. Callback → Detecta type=recovery → Redirige a /update-password
7. Usuario → Cambia su contraseña
8. Sistema → Redirige a /
```

---

## 🔍 Verificar que Funciona

1. Ve a `/forgot`
2. Ingresa un email válido
3. Revisa el email recibido
4. Inspecciona el enlace del botón "Restablecer contraseña"
5. Debe apuntar a: `https://tu-dominio.com/auth/callback?type=recovery&token=...`

---

## ⚙️ Archivos del Sistema

### Email Template:
- `emails/reset_password.html` - HTML del correo ✅

### Código Backend:
- `src/app/(auth)/forgot/page.tsx` - Formulario de solicitud ✅
- `src/lib/auth/redirect.ts` - Genera URL de callback ✅
- `src/app/auth/callback/route.ts` - Maneja redirección ✅
- `src/app/(auth)/update-password/page.tsx` - Formulario de cambio ✅

**TODO ESTÁ CORRECTO EN EL CÓDIGO** - Solo necesitas actualizar la configuración en Supabase.

---

## 🚨 Importante

**NO CAMBIES el código** - El problema es solo de configuración en Supabase.

La variable `NEXT_PUBLIC_SITE_URL` del código se usa correctamente, pero Supabase necesita que configures manualmente las URLs permitidas en su dashboard por seguridad.
