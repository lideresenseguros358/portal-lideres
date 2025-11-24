# 🎭 FEDPA - Modo Demo

## ⚠️ PROBLEMA ACTUAL

El error que ves es **completamente normal**:

```
ENOTFOUND api.fedpa.com.pa
```

**Causa:** La URL `api.fedpa.com.pa` es un placeholder. La API real de FEDPA tiene una URL diferente.

---

## ✅ SOLUCIÓN TEMPORAL: Modo Demo

He activado el **Modo Demo** para que puedas probar la funcionalidad sin la API real.

### **¿Qué hace el Modo Demo?**

- ✅ Simula respuestas de FEDPA con datos de ejemplo
- ✅ Te permite probar toda la interfaz
- ✅ Muestra cómo funcionará cuando tengas las credenciales reales
- ❌ NO actualiza con datos reales (obviamente)

---

## 🚀 CÓMO ACTIVAR

### **Paso 1: Verificar `.env.local`**

Abre `.env.local` y asegúrate de tener:

```env
FEDPA_DEMO_MODE="true"
```

### **Paso 2: Reiniciar servidor**

```bash
# Detener (Ctrl + C)
# Reiniciar:
npm run dev
```

### **Paso 3: Probar**

1. Ve a Base de Datos (`/db`)
2. Click en **"Sincronizar con FEDPA"**
3. Verás datos simulados actualizando tus pólizas

---

## 📊 DATOS QUE SIMULA

El modo demo rellena:

```javascript
{
  national_id: "8-123-4567",
  email: "demo@fedpa.com",
  phone: "6123-4567",
  start_date: "2024-01-01",
  renewal_date: "2025-01-01",
  ramo: "AUTO",
  status: "ACTIVA"
}
```

---

## 🔑 CUANDO TENGAS CREDENCIALES REALES

### **Paso 1: Obtener de FEDPA**

Contacta a FEDPA y solicita:
1. ✅ **API Key**
2. ✅ **URL de la API** (ejemplo: `https://api-produccion.fedpa.com.pa`)
3. ✅ **Documentación** de endpoints
4. ✅ **Límites de uso** (requests por minuto)

### **Paso 2: Configurar**

Edita `.env.local`:

```env
FEDPA_API_KEY="tu-key-real-aqui"
FEDPA_API_URL="https://url-real-de-fedpa.com"
FEDPA_DEMO_MODE="false"
```

### **Paso 3: Reiniciar**

```bash
npm run dev
```

### **Paso 4: Probar con 1 póliza**

1. Ve a una póliza específica
2. Click en sincronizar
3. Verifica que los datos sean correctos

### **Paso 5: Sincronización completa**

Una vez confirmado que funciona:
1. Hacer backup de BD
2. Sincronizar todas las pólizas
3. Revisar resultados

---

## ⚙️ CONFIGURACIÓN SEGÚN FEDPA

### **Si FEDPA tiene autenticación diferente:**

Puede que use:
- OAuth 2.0
- API Key en header diferente
- Firma de requests

En ese caso, necesitaré actualizar `fedpa.ts` con el método correcto.

### **Si FEDPA tiene endpoints diferentes:**

Actualiza en `fedpa.ts` línea 59:

```typescript
// En lugar de:
`${this.apiUrl}/v1/policies/${policyNumber}`

// Usa el formato que FEDPA especifique:
`${this.apiUrl}/policies/search?number=${policyNumber}`
```

---

## 🎯 PRÓXIMOS PASOS

1. **Ahora (Modo Demo):**
   - ✅ Probar la funcionalidad
   - ✅ Verificar que la interfaz funciona
   - ✅ Ver el flujo completo

2. **Cuando tengas credenciales:**
   - ⏳ Configurar API real
   - ⏳ Desactivar modo demo
   - ⏳ Probar con datos reales

3. **Uso regular:**
   - ⏳ Sincronizar mensualmente
   - ⏳ O después de imports masivos

---

## 📝 EJEMPLO DE USO (Modo Demo)

```
1. Usuario hace click en "Sincronizar con FEDPA"

2. Sistema consulta 100 pólizas

3. Modo Demo devuelve:
   ✅ 100 respuestas simuladas
   ✅ Datos de ejemplo para todas
   
4. Sistema actualiza BD con datos demo

5. Modal muestra:
   "✅ 100 pólizas procesadas"
   "✅ 100 actualizadas"
   "✅ 0 errores"
```

---

## ⚠️ IMPORTANTE

**Modo Demo:**
- ✅ Perfecto para desarrollo
- ✅ Perfecto para demostración
- ❌ NO usar en producción
- ❌ Datos NO son reales

**Modo Real:**
- Solo cuando tengas:
  - ✅ API Key válida
  - ✅ URL correcta
  - ✅ Autorización de FEDPA

---

## 🔍 VERIFICAR SI ESTÁ EN MODO DEMO

En la consola del servidor verás:

```
[FEDPA] 🎭 MODO DEMO activado - Usando datos simulados
[FEDPA DEMO] Simulando consulta para: AUTO-12345
```

Si ves esto, estás en modo demo y TODO es simulado.

---

**¿Necesitas ayuda activando el modo demo o configurando las credenciales reales cuando las tengas?**
