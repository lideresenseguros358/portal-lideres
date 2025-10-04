# 📋 SISTEMA DE PENDIENTES (CASES) - INSTRUCCIONES

## ⚠️ ESTADO ACTUAL

Se ha creado la estructura base del sistema de Pendientes (Trámites), pero **requiere ejecutar migración SQL** antes de poder usar.

---

## 🗄️ PASO 1: EJECUTAR MIGRACIÓN SQL

Debes ejecutar esta migración en **Supabase SQL Editor**:

```
migrations/enhance_cases_table.sql
```

Esta migración agrega:
- ✅ Nuevas columnas a `cases` (sla_date, management_type, is_deleted, etc.)
- ✅ Tabla `case_comments` (comentarios por canal)
- ✅ Tabla `case_history` (timeline/audit log)
- ✅ Funciones automáticas (auto-purge, SLA tracking)
- ✅ Triggers (updated_at, status change logging)
- ✅ RLS policies

---

## 🔄 PASO 2: REGENERAR TIPOS

Después de ejecutar la migración SQL:

```bash
npm run types
```

Esto actualizará `src/lib/database.types.ts` con las nuevas tablas y columnas.

---

## ✅ PASO 3: VERIFICAR COMPILACIÓN

```bash
npm run typecheck
npm run build
```

Ambos deben pasar sin errores.

---

## 📁 ARCHIVOS CREADOS

### Backend (Server Actions)
- ✅ `src/app/(app)/cases/actions.ts` - CRUD de cases
- ✅ `src/app/(app)/cases/actions-details.ts` - Checklist, archivos, comentarios, historial

### Frontend (Componentes)
- ✅ `src/app/(app)/cases/page.tsx` - Server page
- ✅ `src/components/cases/CasesMainClient.tsx` - Componente orquestador
- ✅ `src/components/cases/CasesList.tsx` - Lista de casos con barra de progreso
- ✅ `src/components/cases/SearchModal.tsx` - Modal de búsqueda

### Constantes y Utilidades
- ✅ `src/lib/constants/cases.ts` - Etiquetas, colores, keywords para clasificación

---

## 🎨 CARACTERÍSTICAS IMPLEMENTADAS

### ✅ Diseño Mobile-First
- Cards responsivas con breakpoints 320px - 1280px+
- Tabs navegables en móvil con scroll horizontal
- Detalles colapsables (ocultos por defecto)
- Barra de progreso visual por caso

### ✅ Funcionalidades
- **Tabs por sección:** Ramos Generales, Vida ASSA, Otros Personas, Sin clasificar (Master)
- **Barra de progreso:** Calcula % basado en estado del caso
- **Detalles expandibles:** Click en chevron para ver info completa
- **Filtros Master:** Por estado, broker, aseguradora
- **Búsqueda:** Por cliente, póliza, ticket, notas
- **Selección múltiple:** Para export PDF y envío email
- **SLA semáforo:** Verde (en tiempo), Naranja (por vencer ≤5d), Rojo (vencido)
- **Badges "Nuevo":** Para casos sin ver por broker

### ✅ Colores Corporativos
- Azul profundo #010139 (headers, títulos)
- Oliva #8AAA19 (acentos, progreso, acciones)
- Rojo para vencidos
- Gradientes en barra de progreso

---

## 🚧 PENDIENTE DE IMPLEMENTAR

### Alto Prioridad
1. **Página detalle (`/cases/[id]`)**: Vista completa de caso individual
2. **Wizard creación manual**: Para que Master cree casos manualmente
3. **Upload de archivos**: Implementar storage de Supabase
4. **Export PDF**: Generación de PDFs con branding
5. **Envío de emails**: Integración con servicio de email

### Medio Prioridad
6. **Webhook Zoho** (`/api/zoho/webhook`): Ingesta automática por correo
7. **Clasificación determinista**: Usar keywords de `cases.ts`
8. **Fusionar casos**: UI para combinar casos duplicados
9. **Reclasificar casos**: Cambiar sección/tipo
10. **Vista Kanban**: Opcional (columnas por estado)

### Bajo Prioridad
11. **Notificaciones push**: Campanita en tiempo real
12. **Email diario 7:00 AM**: Resumen de pendientes
13. **Auto-trash expired**: Cron job (ya está la función SQL)
14. **Postpone con notificación**: Aviso 5 días antes

---

## 📊 ESTRUCTURA DE DATOS

### Tabla `cases` (actualizada)
- `id`, `section`, `status`, `ctype`, `management_type`
- `broker_id`, `client_id`, `client_name`, `insurer_id`
- `policy_number`, `premium`, `payment_method`
- `sla_date`, `sla_days`, `postponed_until`
- `ticket_ref`, `thread_id`, `message_id` (para emails)
- `is_verified`, `is_deleted`, `deleted_at`
- `claimed_by_broker_id` (para "mío")
- `discount_to_broker`, `direct_payment`
- `seen_by_broker`, `notes`

### Tabla `case_comments`
- `id`, `case_id`, `created_by`, `content`
- `channel` ('aseguradora' | 'oficina')
- `created_at`

### Tabla `case_history`
- `id`, `case_id`, `action`, `created_by`
- `metadata` (JSONB)
- `created_at`

---

## 🔧 FUNCIONES SQL DISPONIBLES

```sql
-- Purgar casos eliminados >30 días
SELECT public.purge_deleted_cases();

-- Auto-mover a papelera casos vencidos >7 días sin actualización
SELECT public.auto_trash_expired_cases();

-- Calcular días restantes de SLA
SELECT public.get_sla_days_remaining('<case_id>');
```

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

1. ✅ **Ejecutar migración SQL** (paso crítico)
2. ✅ **Regenerar tipos** (`npm run types`)
3. ✅ **Verificar compilación** (`npm run typecheck && npm run build`)
4. 🚀 **Probar en navegador**: `/cases`
5. 📝 **Implementar página detalle**: `/cases/[id]`
6. 🎨 **Implementar wizard creación**: `/cases/new`
7. 📧 **Implementar webhook Zoho**: `/api/zoho/webhook`

---

## 💡 NOTAS IMPORTANTES

- **RLS está configurado**: Broker solo ve sus casos, Master ve todo
- **Triggers automáticos**: Status changes se loggean en `case_history`
- **SLA automático**: Se calcula según sección (7-20 días)
- **Mobile-first**: Todos los componentes son responsive
- **Barra de progreso**: Oculta detalles por defecto (click para expandir)
- **Keywords deterministas**: No usa IA, usa arrays de palabras clave
- **Storage paths**: `pendientes/<año>/<mes>/<case_id>/` (verificados)
- **Storage paths**: `pendientes/_unverified/...` (no verificados)

---

## 📞 SI ENCUENTRAS ERRORES

Los errores de tipos actuales son **normales** hasta que ejecutes la migración SQL y regeneres tipos. Todos los archivos usan `as any` temporal donde es necesario.

Después de los pasos 1-3, todos los errores deben desaparecer.
