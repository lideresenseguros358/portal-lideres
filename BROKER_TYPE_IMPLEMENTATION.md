# 📋 Implementación: Tipo de Broker (Corredor vs Agente)

## 📝 Descripción

Sistema de diferenciación entre **Corredor** y **Agente** en la gestión de brokers, con campos condicionales según el tipo seleccionado.

---

## 🎯 Diferencias entre Corredor y Agente

### 📋 CORREDOR:
- ✅ Muestra campo: **Licencia** (opcional)
- ❌ Oculta: **Código ASSA**
- ❌ Oculta: **Fecha Vencimiento Carnet**
- ❌ **NO recibe notificaciones de carnet** (no tiene)

### 🎫 AGENTE:
- ✅ Muestra campo: **Código ASSA** (opcional)
- ✅ Muestra campo: **Fecha Vencimiento Carnet** (opcional)
- ❌ Oculta: **Licencia**
- ✅ **SÍ recibe notificaciones de carnet** (si tiene fecha configurada)

---

## 🗄️ Cambios en Base de Datos

### Migración SQL

**Archivo:** `supabase/migrations/20251016_add_broker_type.sql`

```sql
-- Crear enum para tipo de broker
CREATE TYPE broker_type_enum AS ENUM ('corredor', 'agente');

-- Agregar columna a brokers
ALTER TABLE brokers 
ADD COLUMN broker_type broker_type_enum DEFAULT 'corredor';
```

**Valores por defecto:**
- Todos los brokers existentes → `'corredor'`
- Los nuevos pueden elegir entre corredor o agente

---

## 🎨 Interfaz de Usuario

### Toggle Switch (Componente)

Botones interactivos con diseño corporativo:

```tsx
📋 Corredor  |  🎫 Agente
```

- **Activo Corredor:** Fondo azul (#010139)
- **Activo Agente:** Fondo oliva (#8AAA19)
- **Inactivo:** Fondo blanco con borde gris
- **Efecto:** Scale y shadow al seleccionar

### Indicador Visual (Solo Lectura)

Cuando NO está en modo edición, muestra un badge:
- `📋 CORREDOR` o `🎫 AGENTE`
- Fondo blanco, borde oliva, texto azul

---

## 📁 Archivos Modificados

### 1. **`src/components/brokers/BrokerDetailClient.tsx`**

**Cambios:**
- ✅ Agregado estado `broker_type` al `formData`
- ✅ Toggle switch para cambiar tipo (solo en modo edición)
- ✅ Badge indicador cuando no está editando
- ✅ Título dinámico: "Datos del corredor" o "Datos del agente"
- ✅ Campos condicionales:
  - `license_no` → Solo si `broker_type === 'corredor'`
  - `assa_code` → Solo si `broker_type === 'agente'`
  - `carnet_expiry_date` → Solo si `broker_type === 'agente'`

### 2. **`src/app/(auth)/new-user/page.tsx`**

**Cambios:**
- ✅ Agregado campo `broker_type` a `personalData` (default: 'corredor')
- ✅ Agregado campo `assa_code` a `personalData`
- ✅ Agregado campo `carnet_expiry_date` a `personalData`
- ✅ Toggle switch en el Paso 2 (Datos Personales)
- ✅ Campos condicionales según tipo seleccionado
- ✅ Auto-uppercase para código ASSA

### 3. **`src/app/(app)/api/cron/carnet-renewals/route.ts`**

**Cambios:**
- ✅ Agregado filtro `.eq('broker_type', 'agente')` en todas las queries
- ✅ Solo verifica carnets de brokers tipo "agente"
- ✅ Las 4 condiciones (60, 30, mismo día, vencido) aplican filtro

**Líneas modificadas:**
- Línea 75: Condición 60 días
- Línea 103: Condición 30 días
- Línea 131: Condición mismo día
- Línea 159: Condición vencidos

### 4. **`supabase/migrations/20251016_add_broker_type.sql`** ⭐ NUEVO

Migración para agregar el enum y la columna a la tabla brokers.

---

## 🔄 Flujo de Trabajo

### Crear Nuevo Broker (Formulario Público)

1. Usuario va a `/new-user`
2. En **Paso 2**, ve el toggle "Corredor / Agente"
3. Selecciona su tipo:
   - **Corredor:** Ve campo "Licencia"
   - **Agente:** Ve "Código ASSA" y "Fecha Vencimiento Carnet"
4. Llena los campos (todos opcionales)
5. Completa registro
6. Se guarda en BD con `broker_type` correcto

### Editar Broker Existente (Master)

1. Master va a `/brokers/[id]`
2. Click en **"Editar"**
3. Ve el toggle "Corredor / Agente"
4. Cambia el tipo si es necesario
5. Los campos se muestran/ocultan automáticamente
6. Guarda cambios

### Visualizar Broker (Solo Lectura)

1. Cualquier usuario va a `/brokers/[id]`
2. Ve badge "📋 CORREDOR" o "🎫 AGENTE"
3. Ve solo los campos relevantes según tipo
4. Licencia (corredor) o ASSA + Carnet (agente)

---

## 📧 Impacto en Notificaciones de Carnet

### Antes:
- ❌ TODOS los brokers con `carnet_expiry_date` recibían notificaciones
- ❌ Corredores recibían notificaciones innecesarias

### Después:
- ✅ Solo brokers tipo **"agente"** reciben notificaciones
- ✅ Filtro: `broker_type = 'agente'` AND `carnet_expiry_date IS NOT NULL`
- ✅ Corredores NO reciben notificaciones de carnet

---

## 🧪 Testing

### Caso 1: Broker Tipo Corredor

```bash
# En /brokers/[id]
- Tipo: 📋 CORREDOR
- Campos visibles: Licencia
- Campos ocultos: Código ASSA, Fecha Carnet
- Notificaciones de carnet: ❌ NO
```

### Caso 2: Broker Tipo Agente

```bash
# En /brokers/[id]
- Tipo: 🎫 AGENTE
- Campos visibles: Código ASSA, Fecha Carnet
- Campos ocultos: Licencia
- Notificaciones de carnet: ✅ SÍ (si tiene fecha)
```

### Caso 3: Cambiar de Corredor a Agente

```bash
1. Broker es "corredor" con licencia "LIC123"
2. Master edita y cambia a "agente"
3. Campo licencia se oculta (pero NO se borra de BD)
4. Aparecen campos ASSA y Carnet vacíos
5. Master puede llenarlos
6. Si agrega fecha de carnet → recibirá notificaciones
```

### Caso 4: Cambiar de Agente a Corredor

```bash
1. Agente tiene código ASSA y carnet
2. Master cambia a "corredor"
3. Campos ASSA y Carnet se ocultan (pero NO se borran)
4. Aparece campo Licencia
5. Cron de carnets ya NO lo procesará (filtro por tipo)
```

---

## ⚠️ Consideraciones Importantes

### Datos NO se Borran

Cuando cambias el tipo de broker:
- ✅ Los datos se **ocultan** en la UI
- ✅ Los datos se **mantienen** en la BD
- ✅ Si vuelves a cambiar el tipo, los datos reaparecen

Esto es intencional para:
- Evitar pérdida accidental de datos
- Permitir correcciones fáciles
- Mantener historial completo

### Todos los Campos son Opcionales

- Licencia → Opcional
- Código ASSA → Opcional
- Fecha Carnet → Opcional

**No hay validaciones** que obliguen a llenar estos campos.

### Migración de Datos Existentes

Todos los brokers existentes serán:
- `broker_type = 'corredor'` (por defecto)
- Master debe revisar uno por uno
- Cambiar a "agente" los que corresponda

---

## 📋 Pasos para Implementar (Usuario debe hacer)

### 1. Ejecutar Migración SQL ⚠️

```sql
-- En Supabase Dashboard → SQL Editor
-- Ejecutar: supabase/migrations/20251016_add_broker_type.sql
```

### 2. Actualizar Types

```bash
npm run db:types
```

Esto regenerará `database.types.ts` con el nuevo enum `broker_type_enum`.

### 3. Desplegar

```bash
git add .
git commit -m "feat: Tipo de broker (corredor/agente) con campos condicionales"
git push
```

### 4. Revisar Brokers Existentes

Como Master:
1. Ve a `/brokers`
2. Revisa cada broker
3. Cambia los que son "agentes" (no corredores)
4. Agrega fecha de carnet a los agentes que corresponda

---

## ✅ Checklist de Implementación

- [x] Migración SQL creada
- [x] Enum `broker_type_enum` agregado
- [x] Columna `broker_type` en tabla brokers
- [x] Toggle switch en BrokerDetailClient
- [x] Toggle switch en formulario new-user
- [x] Campos condicionales implementados
- [x] Cron de carnets filtrado por tipo 'agente'
- [x] UI con badges e iconos
- [x] TypeCheck pasa sin errores
- [x] Documentación completa

---

## 🎉 Resultado Final

**Ahora el sistema:**
- ✅ Diferencia claramente entre Corredores y Agentes
- ✅ Muestra solo los campos relevantes para cada tipo
- ✅ No envía notificaciones de carnet a corredores
- ✅ Solo procesa carnets de agentes en el cron job
- ✅ Interfaz intuitiva con toggle switch visual
- ✅ Todos los datos se mantienen aunque se oculten

**¡Sistema de tipos de broker listo para producción!** 🚀
