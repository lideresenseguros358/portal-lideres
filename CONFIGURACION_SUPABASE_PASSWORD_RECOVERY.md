# Configuración de Recuperación de Contraseña en Supabase

## Problema Identificado
Los usuarios reportan que el enlace de recuperación de contraseña expira muy rápido, impidiendo completar el proceso.

## Configuración Recomendada en Supabase Dashboard

### 1. **Tiempo de Expiración del Token de Recuperación**

**Ubicación:** `Authentication > Settings > Email Auth Provider`

**Configuración Actual vs Recomendada:**

| Setting | Valor Predeterminado | Recomendado | Razón |
|---------|---------------------|-------------|-------|
| **Password Recovery Token Expiry** | 1 hora (3600 segundos) | **2-3 horas** (7200-10800 segundos) | Los usuarios pueden distraerse, recibir llamadas, o estar en movimiento. 2-3 horas es un balance entre seguridad y usabilidad. |

**Pasos para cambiar:**
1. Ve a: `Authentication > Settings`
2. Busca: **"Email Auth Provider"** o **"Password Recovery"**
3. Localiza: **"Password Recovery Token Expiry"** o **"Recovery Token Validity"**
4. Cambia de `3600` a `7200` (2 horas) o `10800` (3 horas)
5. Guarda cambios

---

### 2. **Rate Limiting de Solicitudes de Recovery**

**Ubicación:** `Authentication > Rate Limits`

Verifica que el rate limiting NO sea demasiado estricto:

```
Password recovery requests: 10 per hora (por IP)
```

Si es menor (ej: 3 per hora), los usuarios legítimos pueden ser bloqueados si reenvían el link.

---

### 3. **Template de Email de Recuperación**

**Ubicación:** `Authentication > Email Templates > Reset Password`

Asegúrate de que el template incluya:

```html
<h2>Recuperación de Contraseña</h2>
<p>Hola,</p>
<p>Has solicitado restablecer tu contraseña. Haz click en el botón de abajo:</p>
<p><a href="{{ .ConfirmationURL }}">Restablecer Contraseña</a></p>
<p><strong>Este enlace es válido por 2 horas.</strong></p>
<p>Si no solicitaste este cambio, ignora este correo.</p>
```

**Importante:** El `{{ .ConfirmationURL }}` ya contiene el token y debe redirigir a:
```
https://portal.lideresenseguros.com/update-password
```

---

## Mejoras Implementadas en el Código

### 1. **Revalidación de Sesión Antes de Actualizar**

**Antes:**
```tsx
const handleSubmit = async (event) => {
  // Solo intenta actualizar sin verificar
  const { error } = await supabase.auth.updateUser({ password });
}
```

**Después:**
```tsx
const handleSubmit = async (event) => {
  // REVALIDA sesión inmediatamente antes de actualizar
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (!session || sessionError) {
    setError("Tu sesión ha expirado. Por favor solicita un nuevo enlace.");
    setSessionExpired(true);
    return;
  }
  
  const { error } = await supabase.auth.updateUser({ password });
}
```

**Beneficio:** Detecta expiración ANTES de intentar actualizar, evitando errores confusos.

---

### 2. **UI Mejorada para Sesión Expirada**

**Componente de Alerta:**
```tsx
{sessionExpired && (
  <div className="bg-amber-50 border-l-4 border-amber-500">
    <FaExclamationTriangle />
    <h3>Enlace Expirado</h3>
    <p>El enlace de recuperación ha expirado por seguridad.</p>
    <button onClick={handleRequestNewLink}>
      Solicitar Nuevo Enlace
    </button>
  </div>
)}
```

**Beneficios:**
- ✅ Mensaje claro y visible
- ✅ Botón directo para solicitar nuevo link
- ✅ Formulario deshabilitado cuando expira (previene frustración)

---

### 3. **Detección Inteligente de Errores de Expiración**

```tsx
if (updateError) {
  // Detectar errores específicos de sesión expirada
  if (updateError.message.includes('session') || 
      updateError.message.includes('expired') || 
      updateError.message.includes('invalid')) {
    setError("Tu sesión ha expirado...");
    setSessionExpired(true);
  } else {
    setError(updateError.message);
  }
}
```

**Beneficio:** Maneja múltiples tipos de errores de expiración de Supabase.

---

## Flujo Completo del Usuario

### **Escenario 1: Usuario Rápido (Sin Expiración)**
1. Usuario recibe email → Click en link
2. Supabase crea sesión de recovery → Redirige a `/update-password`
3. Usuario escribe contraseña inmediatamente
4. Sistema revalida sesión ✅
5. Contraseña actualizada exitosamente
6. Redirección a `/` (login automático)

### **Escenario 2: Usuario Lento (Expiración Durante Uso)**
1. Usuario recibe email → Click en link
2. Supabase crea sesión → Redirige a `/update-password`
3. **Usuario se distrae 2 horas**
4. Usuario escribe contraseña y hace submit
5. Sistema revalida sesión ❌ (expirada)
6. **Mensaje de alerta visible con botón**
7. Usuario click en "Solicitar Nuevo Enlace"
8. Redirige a `/forgot` → Usuario solicita nuevo link
9. Repite proceso exitosamente

### **Escenario 3: Link Usado Antes (Ya Expiró)**
1. Usuario click en link antiguo (>2 horas)
2. Supabase NO crea sesión
3. Página carga → Verifica sesión ❌
4. **Mensaje de alerta visible inmediatamente**
5. Usuario click en "Solicitar Nuevo Enlace"
6. Redirige a `/forgot` → Solicita nuevo link

---

## Verificación en Producción

### **Probar Flujo Completo:**

1. **Solicitar recovery:**
   ```bash
   POST https://portal.lideresenseguros.com/api/auth/reset-password
   { "email": "test@example.com" }
   ```

2. **Verificar email recibido:**
   - ✅ Link correcto: `https://portal.lideresenseguros.com/update-password?token=...`
   - ✅ Mensaje indica tiempo de validez: "válido por 2 horas"

3. **Probar expiración:**
   - Abrir link → Esperar 5 minutos sin hacer nada
   - Intentar actualizar contraseña
   - ✅ Debe seguir funcionando (sesión activa)
   - ❌ Si falla antes de tiempo → revisar config en Supabase

4. **Probar link antiguo:**
   - Usar link de hace >2 horas
   - ✅ Debe mostrar alerta de expiración inmediatamente
   - ✅ Formulario debe estar deshabilitado
   - ✅ Botón "Solicitar Nuevo Enlace" visible

---

## Logs y Debugging

Los logs en consola del navegador mostrarán:

```
========== UPDATE-PASSWORD DEBUG ==========
[1] Verificando sesión de recovery...
[2] Session error: null
[3] Session data: {
  user_id: "...",
  email: "user@example.com",
  recovery_sent_at: "2026-01-28T...",
  aud: "authenticated",
  role: "authenticated"
}
[4] ✅ Sesión válida para: user@example.com
==========================================
```

Si la sesión expiró:
```
[2] Session error: null
[3] Session data: null
[4] ❌ No hay sesión activa
```

---

## Resumen de Cambios

| Archivo | Líneas | Cambios |
|---------|--------|---------|
| `src/app/(auth)/update-password/page.tsx` | 21 | Agregado estado `sessionExpired` |
| | 44-51 | Marca cuando sesión expira al cargar |
| | 77-86 | **Revalidación de sesión antes de actualizar** |
| | 93-97 | Detección inteligente de errores de expiración |
| | 109-111 | Handler para solicitar nuevo link |
| | 116-137 | **UI de alerta de sesión expirada** |
| | 154, 186, 207 | Inputs y botón deshabilitados si expiró |

---

## Recomendaciones de Seguridad

### ✅ **Mantener:**
- Token único por solicitud
- Token expira después de usarse exitosamente
- Rate limiting en solicitudes de recovery

### ⚠️ **Ajustar:**
- **Aumentar tiempo de expiración de 1 hora → 2-3 horas**
- Motivo: Balance entre seguridad y UX
- Los tokens son de un solo uso de todos modos
- Los usuarios pueden necesitar tiempo para pensar en su nueva contraseña

### ❌ **NO Hacer:**
- NO aumentar más de 4 horas (riesgo de seguridad)
- NO permitir re-uso de tokens
- NO eliminar rate limiting

---

## Próximos Pasos

1. **Desplegar cambios de código** (ya implementados)
2. **Actualizar configuración en Supabase Dashboard:**
   - Ir a Authentication > Settings
   - Cambiar "Password Recovery Token Expiry" a `7200` (2 horas)
3. **Actualizar template de email** (opcional pero recomendado)
4. **Probar en producción:**
   - Solicitar recovery
   - Verificar que ahora hay más tiempo
   - Confirmar que alerta funciona si expira
5. **Monitorear quejas de usuarios** en las próximas semanas

---

**Fecha de Implementación:** 28 de Enero, 2026  
**Autor:** Sistema de IA - Cascade  
**Estado:** ✅ Código implementado, pendiente configuración en Supabase
