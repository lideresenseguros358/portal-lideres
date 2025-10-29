# 📋 RESUMEN EJECUTIVO - MÓDULO DE CASOS/PENDIENTES

## ✅ ESTADO ACTUAL

**Completado:**
- ✅ Documentación completa en `docs/casos/` (6 archivos)
- ✅ Estructura de base de datos diseñada
- ✅ Wizard de creación de casos existente (`NewCaseWizard.tsx`)
- ✅ Skeleton del webhook de Zoho Mail (`/api/zoho/webhook/route.ts`)
- ✅ Módulo de Descargas funcional

**Pendiente (2-3 horas de trabajo):**
- ⏳ Completar webhook de Zoho Mail (agregar manejo de adjuntos)
- ⏳ Integrar descargas en el wizard de nuevos casos
- ⏳ Configurar webhook en Zoho Mail Admin Console
- ⏳ Testing end-to-end

---

## 🎯 OBJETIVO

Tener el módulo 100% funcional para:

1. **Recibir emails automáticamente** → Crear casos
2. **Descargar formularios** desde biblioteca en el wizard
3. **Diferenciar** documentos descargables vs documentos del cliente
4. **Gestión completa** de trámites con SLA, checklist y adjuntos

---

## 📁 DOCUMENTOS CREADOS

### 1. `docs/SETUP_CASOS_COMPLETO.md`
**Contenido:** Guía completa paso a paso con código completo del webhook, integración de descargas y configuración de Zoho Mail.

**Incluye:**
- Código completo del endpoint `/api/zoho/webhook`
- Funciones de clasificación automática
- Manejo de adjuntos a Storage
- Código para integrar descargas en wizard
- Configuración detallada de Zoho Mail

### 2. `docs/CASOS_PASOS_FINALES.md`
**Contenido:** Pasos concisos y prácticos para completar la implementación.

**Incluye:**
- ✅ PASO 1: Completar webhook (código y ubicaciones exactas)
- ✅ PASO 2: Integrar descargas en wizard (código React)
- ✅ PASO 3: Configurar Zoho Mail (pasos en admin panel)
- ✅ PASO 4: Testing completo (casos de prueba)
- 🔧 Troubleshooting (solución de problemas comunes)
- ✅ Checklist de entrega (verificación final)

### 3. Documentación Existente en `docs/casos/`
- `00_INDICE_MODULO_CASOS.md` - Índice maestro
- `01_REQUISITOS_DOCUMENTOS.md` - Documentos por tipo de trámite
- `02_FLUJO_MODULO_CASOS.md` - Flujo completo, páginas y componentes
- `03_INGESTA_CORREO_Y_APIS.md` - Webhook Zoho y endpoints API
- `04_SLA_NOTIFICACIONES_PDF.md` - SLA, alertas y reportes
- `05_ESPECIFICACIONES_TECNICAS_Y_QA.md` - BD, RLS y QA

---

## 🚀 PRÓXIMOS PASOS (EN ORDEN)

### 1. Configurar Variables de Entorno (5 minutos)

```bash
# Generar clave segura
openssl rand -base64 32
```

Agregar a `.env.local`:
```env
ZOHO_WEBHOOK_KEY=la_clave_generada_arriba
```

---

### 2. Completar Webhook de Zoho Mail (45 minutos)

**Archivo:** `src/app/api/zoho/webhook/route.ts`

**Tareas:**
1. Actualizar línea 46-50: Descomentar y configurar autenticación
2. Agregar función `handleAttachments` al final del archivo
3. Descomentar línea 126: Llamada a `handleAttachments`

**Código exacto:** Ver `docs/CASOS_PASOS_FINALES.md` sección "PASO 1"

---

### 3. Integrar Descargas en Wizard (60 minutos)

**Archivo:** `src/components/cases/NewCaseWizard.tsx`

**Tareas:**
1. Agregar constante `DOCUMENTOS_CLIENTE` (cédula, licencia, etc.)
2. Agregar función `esDocumentoDescargable()`
3. Agregar función `handleDownloadFromLibrary()`
4. Actualizar UI del checklist con badges y botones

**Código exacto:** Ver `docs/CASOS_PASOS_FINALES.md` sección "PASO 2"

---

### 4. Configurar Zoho Mail (30 minutos)

**Requisito:** Acceso a `https://mailadmin.zoho.com`

**Pasos:**
1. Settings → Integrations → Webhooks
2. Add Webhook
3. Configurar:
   - URL: `https://portal-lideres.com/api/zoho/webhook`
   - Header: `Authorization: Bearer [TU_ZOHO_WEBHOOK_KEY]`
   - Events: New Email, Email Replied
   - Filter: `To Contains: casos@lideresenseguros.com`
4. Test Webhook
5. Enviar email de prueba

**Detalles completos:** Ver `docs/CASOS_PASOS_FINALES.md` sección "PASO 3"

---

### 5. Testing Completo (30 minutos)

**Tests a ejecutar:**

✅ **Test 1:** Email de broker → Caso creado automáticamente
✅ **Test 2:** Wizard manual → Checklist generado
✅ **Test 3:** Botón "Descargar" → Archivo de biblioteca descargado
✅ **Test 4:** Botón "Adjuntar" → Archivo subido a Storage
✅ **Test 5:** Marcar EMITIDO → Modal de preliminar

**Guía de testing:** Ver `docs/CASOS_PASOS_FINALES.md` sección "PASO 4"

---

## 💡 CONCEPTOS CLAVE

### Documentos Descargables vs Cliente

**📥 DESCARGABLES** (de la biblioteca):
- Solicitudes
- Formularios
- Anexos
- Guías
- Cotizaciones
- Contratos

→ Tienen botón "Descargar desde Biblioteca"

**📄 DEL CLIENTE** (propios del asegurado):
- Cédula
- Licencia
- RUC
- Pasaporte
- Fotos de vehículo
- Inspecciones

→ Solo tienen botón "Adjuntar"

---

### Flujo del Webhook

```
📧 Email llega a casos@lideresenseguros.com
         ↓
🔗 Zoho Mail activa webhook
         ↓
🔐 Verifica autenticación (Bearer token)
         ↓
✅ Valida remitente (broker o asistente)
         ↓
🤖 Clasifica automáticamente:
   - Aseguradora (keywords)
   - Tipo de gestión (keywords)
   - Ticket ASSA (regex)
         ↓
💾 Crea o actualiza caso en BD
         ↓
📎 Guarda adjuntos en Storage
         ↓
🔔 Notifica al broker asignado
```

---

### Integración con Descargas

```
📋 Wizard paso 3: Checklist
         ↓
🏷️ Cada documento se clasifica:
   ├─ DESCARGABLE → Botón "Descargar"
   └─ CLIENTE → Solo "Adjuntar"
         ↓
🔍 Al hacer click "Descargar":
   1. Busca en download_docs
   2. Filtra por insurer_id + policy_type
   3. Descarga desde Storage
   4. Ofrece archivo al usuario
         ↓
✅ Usuario puede adjuntar versión completada
```

---

## 🔧 ARCHIVOS CLAVE

### Backend
```
src/app/api/zoho/webhook/route.ts     → Webhook Zoho Mail
src/app/(app)/cases/actions.ts         → Server actions
src/lib/cases/classifier.ts            → Clasificador automático
src/lib/cases/sla.ts                   → Cálculo de SLA
```

### Frontend
```
src/components/cases/NewCaseWizard.tsx → Wizard creación
src/components/cases/CasesList.tsx     → Lista de casos
src/components/cases/CaseDetailClient.tsx → Detalle del caso
```

### Base de Datos
```
cases                  → Casos principales
case_files             → Archivos adjuntos
case_checklist         → Checklist de documentos
case_comments          → Comentarios
case_history           → Historial de cambios
broker_assistants      → Asistentes de brokers
```

### Storage
```
pendientes/YYYY/MM/case_id/archivo.pdf    → Archivos verificados
pendientes/_unverified/...                 → No verificados
downloads/...                              → Biblioteca de formularios
```

---

## ⚠️ PUNTOS CRÍTICOS

### 1. Seguridad del Webhook
- ✅ **USAR** `Authorization: Bearer` header
- ✅ **VALIDAR** token en cada request
- ❌ **NO** exponer la clave en el código
- ✅ **USAR** variables de entorno

### 2. Clasificación Automática
- ✅ **USAR** keywords deterministas
- ❌ **NO** usar IA/ML para clasificar
- ✅ **REQUERIR** confirmación humana en cambios de estado
- ✅ **PERMITIR** reclasificación manual

### 3. Manejo de Adjuntos
- ✅ **VERIFICAR** mime type
- ✅ **VALIDAR** tamaño máximo
- ✅ **GUARDAR** nombre original
- ❌ **NO** renombrar automáticamente
- ✅ **SEPARAR** verificados vs no verificados

### 4. Permisos (RLS)
- ✅ Broker ve solo sus casos
- ✅ Master ve todos
- ✅ Storage policies alineadas con BD
- ✅ No permitir borrado a brokers

---

## 📊 MÉTRICAS DE ÉXITO

Al completar, deberás poder:

✅ **Email → Caso:** Email automático crea caso en <5 segundos
✅ **Clasificación:** 80%+ de emails correctamente clasificados
✅ **Descargas:** Todos los formularios descargables desde wizard
✅ **Adjuntos:** Archivos guardados en Storage con metadata
✅ **Notificaciones:** Broker recibe notificación en tiempo real
✅ **SLA:** Semáforo correcto (verde/amarillo/rojo)
✅ **Preliminares:** Modal aparece al marcar EMITIDO
✅ **Testing:** 100% de casos de prueba pasan

---

## 🎯 ENTREGABLES

1. ✅ Webhook de Zoho Mail funcional
2. ✅ Integración de descargas en wizard
3. ✅ Clasificación automática de emails
4. ✅ Manejo de adjuntos a Storage
5. ✅ Diferenciación docs descargables vs cliente
6. ✅ Testing completo ejecutado
7. ✅ Documentación actualizada

---

## 📞 SOPORTE

**Documentación completa:**
- `docs/SETUP_CASOS_COMPLETO.md` - Guía técnica detallada
- `docs/CASOS_PASOS_FINALES.md` - Pasos prácticos
- `docs/casos/` - Especificaciones completas

**Orden de lectura recomendado:**
1. Este archivo (resumen ejecutivo)
2. `CASOS_PASOS_FINALES.md` (pasos prácticos)
3. `SETUP_CASOS_COMPLETO.md` (si necesitas más detalles)
4. `docs/casos/02_FLUJO_MODULO_CASOS.md` (flujo completo)

---

## ✅ CHECKLIST FINAL

Antes de marcar como completado:

- [ ] Variable `ZOHO_WEBHOOK_KEY` en `.env.local`
- [ ] Función `handleAttachments` agregada a webhook
- [ ] Autenticación del webhook activa
- [ ] Función `handleDownloadFromLibrary` en wizard
- [ ] UI del checklist actualizada con badges
- [ ] Webhook configurado en Zoho Mail
- [ ] Email de prueba enviado y procesado
- [ ] Caso creado correctamente en BD
- [ ] Archivos guardados en Storage
- [ ] Botón "Descargar" funciona
- [ ] Botón "Adjuntar" funciona
- [ ] Documentos correctamente clasificados
- [ ] Notificaciones funcionan
- [ ] Todos los tests pasan

---

**Tiempo estimado total: 2-3 horas**
**Dificultad: Media**
**Prioridad: Alta**

**¡Todo listo para implementar!** 🚀
