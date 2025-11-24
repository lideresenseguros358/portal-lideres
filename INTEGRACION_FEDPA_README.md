# 📡 Integración API FEDPA - Enriquecimiento de Datos

## 🎯 **OBJETIVO**

Automatizar el enriquecimiento de datos de clientes y pólizas consultando la API de FEDPA usando los números de póliza como referencia.

---

## 🔑 **CONFIGURACIÓN INICIAL**

### **Paso 1: Agregar API Key**

Edita `.env.local` y configura:

```env
# FEDPA API Integration
FEDPA_API_KEY="TU_API_KEY_REAL_DE_FEDPA"
FEDPA_API_URL="https://api.fedpa.com.pa"
```

⚠️ **IMPORTANTE:** Reemplaza `TU_API_KEY_REAL_DE_FEDPA` con la key real proporcionada por FEDPA.

---

## 📂 **ARCHIVOS CREADOS**

### **1. Servicio de Integración**
```
src/lib/integrations/fedpa.ts
```
- Maneja las llamadas a la API de FEDPA
- Normaliza datos entre formatos
- Incluye rate limiting y manejo de errores

### **2. Servicio de Sincronización**
```
src/lib/services/fedpa-sync.ts
```
- Sincroniza datos entre FEDPA y nuestra BD
- Solo actualiza campos vacíos (no sobrescribe)
- Procesa en lotes para eficiencia

### **3. API Endpoint**
```
src/app/api/fedpa/sync/route.ts
```
- `POST /api/fedpa/sync` - Sincronizar todas o una póliza
- `GET /api/fedpa/sync` - Verificar estado de FEDPA

### **4. Componente UI**
```
src/components/db/FEDPASyncButton.tsx
```
- Botón de sincronización en interfaz
- Modal con resultados detallados
- Feedback visual de progreso

---

## 🚀 **CÓMO USAR**

### **Opción 1: Desde la Interfaz (Master)**

1. Ve a **Base de Datos** (`/db`)
2. Haz clic en **"Sincronizar con FEDPA"** (botón azul)
3. Espera a que se complete la sincronización
4. Revisa el modal con estadísticas detalladas

### **Opción 2: API Manual**

```bash
# Sincronizar todas las pólizas
curl -X POST http://localhost:3000/api/fedpa/sync

# Sincronizar una póliza específica
curl -X POST http://localhost:3000/api/fedpa/sync \
  -H "Content-Type: application/json" \
  -d '{"policyId": "uuid-de-la-poliza"}'

# Verificar estado de FEDPA
curl http://localhost:3000/api/fedpa/sync
```

### **Opción 3: Programáticamente**

```typescript
import { fedpaSyncService } from '@/lib/services/fedpa-sync';

// Sincronizar todas
const result = await fedpaSyncService.syncAllPolicies();
console.log(result.stats);

// Sincronizar una
const result = await fedpaSyncService.syncPolicy('policy-id');
```

---

## 📊 **QUÉ DATOS SE ACTUALIZAN**

### **Clientes (`clients`)**

| Campo | Se actualiza si... | Fuente FEDPA |
|-------|-------------------|--------------|
| `national_id` | Está vacío | `client_national_id` |
| `email` | Está vacío | `client_email` |
| `phone` | Está vacío | `client_phone` |

### **Pólizas (`policies`)**

| Campo | Se actualiza si... | Fuente FEDPA |
|-------|-------------------|--------------|
| `start_date` | Está vacío | `start_date` |
| `renewal_date` | Está vacío | `renewal_date` |
| `ramo` | Está vacío | `policy_type` |
| `status` | Siempre | `status` |

---

## 🔍 **LÓGICA DE ACTUALIZACIÓN**

### **Regla Principal:**
**Solo actualiza campos que estén vacíos (NULL)**

```
SI clients.email IS NULL
  Y FEDPA devuelve email
ENTONCES actualizar clients.email = email_de_fedpa

SI clients.email TIENE VALOR
  NO actualizar (mantener valor existente)
```

### **Excepción:**
`status` de la póliza siempre se actualiza si FEDPA lo provee (para mantener estados sincronizados).

---

## 📈 **RESULTADO DE SINCRONIZACIÓN**

Después de ejecutar, verás:

```json
{
  "success": true,
  "stats": {
    "policiesProcessed": 150,    // Total procesadas
    "policiesUpdated": 45,        // Pólizas actualizadas
    "clientsUpdated": 38,         // Clientes actualizados
    "errors": 2                   // Errores encontrados
  },
  "details": [
    {
      "policy_number": "AUTO-12345",
      "status": "updated",
      "message": "Datos enriquecidos exitosamente"
    },
    {
      "policy_number": "VIDA-67890",
      "status": "not_found",
      "message": "Póliza no encontrada en FEDPA"
    }
  ]
}
```

---

## ⚙️ **CONFIGURACIÓN AVANZADA**

### **Ajustar Tamaño de Lotes**

En `fedpa.ts`, línea 99:

```typescript
const batchSize = 10; // Cambiar a 5, 20, etc.
```

**Valores recomendados:**
- `5`: API lenta o muchos errores
- `10`: Balance óptimo (default)
- `20`: API rápida y estable

### **Pausas entre Lotes**

En `fedpa.ts`, línea 118:

```typescript
await this.sleep(500); // milisegundos
```

**Ajustes:**
- `100-300ms`: APIs rápidas
- `500ms`: Balance (default)
- `1000ms+`: APIs con rate limiting estricto

---

## 🐛 **SOLUCIÓN DE PROBLEMAS**

### **Error: API Key no configurada**

```
❌ API Key de FEDPA no configurada
```

**Solución:** Verifica `.env.local` y reinicia el servidor:
```bash
npm run dev
```

### **Error: Póliza no encontrada**

```
❌ La póliza XYZ no existe en la base de datos de FEDPA
```

**Causa:** El número de póliza no está en FEDPA (puede ser antigua o mal ingresada).

**Solución:** Verificar y corregir número de póliza manualmente.

### **Error: HTTP 429 (Too Many Requests)**

```
❌ Error HTTP 429
```

**Causa:** Se excedió el rate limit de FEDPA.

**Solución:**
1. Aumentar pausas entre lotes
2. Reducir tamaño de lotes
3. Consultar con FEDPA sobre límites

### **Error: Health check failed**

```
❌ API de FEDPA no disponible
```

**Causa:** FEDPA está caída o hay problemas de red.

**Solución:** Intentar más tarde o contactar soporte FEDPA.

---

## 🔐 **SEGURIDAD**

### **API Key**
- ✅ Almacenada en `.env.local` (no versionado)
- ✅ Solo accesible en servidor (no en cliente)
- ✅ No se expone en logs públicos

### **Acceso**
- ✅ Solo usuarios `master` pueden sincronizar
- ✅ Endpoints protegidos con autenticación
- ✅ Logs de auditoría en servidor

---

## 📝 **EJEMPLO COMPLETO**

### **Escenario:**
Tienes 100 pólizas, 40 sin email de cliente.

### **Proceso:**
1. Click en "Sincronizar con FEDPA"
2. Sistema consulta FEDPA en lotes de 10
3. FEDPA devuelve datos para 35 pólizas
4. Sistema actualiza 35 emails vacíos
5. Modal muestra resultados:

```
✅ Procesadas: 100
✅ Pólizas Actualizadas: 35
✅ Clientes Actualizados: 35
❌ Errores: 5 (no encontradas en FEDPA)
```

---

## 🔄 **MANTENIMIENTO**

### **Sincronización Regular**

Recomendación: Sincronizar **mensualmente** o **cuando importes nuevos datos**.

### **Monitoreo**

Revisa logs en servidor:

```bash
# Ver logs de FEDPA
grep "FEDPA" .next/server/app.log
```

### **Actualización de Mapeos**

Si FEDPA cambia su formato de respuesta, actualizar:
- `normalizeData()` en `fedpa.ts`
- `normalizeRamo()` para nuevos tipos
- `normalizeStatus()` para nuevos estados

---

## ✅ **CHECKLIST DE VERIFICACIÓN**

Antes de usar en producción:

- [ ] API Key de FEDPA configurada en `.env.local`
- [ ] Endpoint `/api/fedpa/sync` responde correctamente
- [ ] Botón visible solo para rol `master`
- [ ] Prueba con 1 póliza específica
- [ ] Prueba sincronización completa en staging
- [ ] Verificar que no sobrescribe datos existentes
- [ ] Logs de errores configurados
- [ ] Backup de base de datos antes de sincronizar

---

## 📞 **SOPORTE**

### **Problemas con la Integración**
- Revisar logs del servidor
- Verificar network tab en DevTools
- Consultar este README

### **Problemas con FEDPA**
- Contactar soporte técnico de FEDPA
- Verificar estado de su API
- Revisar límites de uso

---

## 🎉 **BENEFICIOS**

✅ **Ahorro de Tiempo:** Rellena datos automáticamente  
✅ **Precisión:** Datos directos de FEDPA (fuente oficial)  
✅ **Integridad:** Solo actualiza vacíos, no sobrescribe  
✅ **Escalable:** Procesa cientos de pólizas en minutos  
✅ **Auditable:** Logs detallados de cada operación  

---

**Versión:** 1.0  
**Fecha:** Enero 2025  
**Autor:** Sistema Líderes en Seguros
