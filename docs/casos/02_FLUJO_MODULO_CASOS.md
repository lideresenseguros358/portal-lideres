# 🔄 FLUJO COMPLETO DEL MÓDULO DE CASOS/PENDIENTES

## 📌 REGLAS GLOBALES (NO ROMPER)

### Roles y Permisos

#### MASTER
- ✅ Ve y edita TODO (datos, estados, checklist, adjuntos, comentarios)
- ✅ Asigna broker
- ✅ Define SLA
- ✅ Marca "descontar a corredor"
- ✅ Crea preliminar BD
- ✅ Aplaza/Cierra/Elimina (papelera 30 días)
- ✅ Reclasifica
- ✅ Fusiona casos
- ✅ Marca documentos como cumplidos sin archivo adjunto
- ✅ Ve sección "No identificados"

#### BROKER
- ✅ Ve SOLO sus trámites (RLS aplicado)
- ✅ Adjunta archivos
- ✅ Comenta
- ✅ Marca entregas del checklist (sus propios documentos)
- ✅ Puede marcar "mío" sobre pendientes sin identificar
- ❌ NO cambia SLA/estado
- ❌ NO "descontar a corredor"
- ❌ NO ve casos de otros brokers

---

### Flujo ASSA (Todos los correos)

#### Primer Correo (Sin Ticket)
1. Llega correo de broker/asistente a ASSA
2. Se crea el pendiente en tab "Vida ASSA"
3. Estado: `PENDIENTE_REVISION`
4. **NO** tiene `ticket_ref` aún

#### Respuesta de ASSA (Con Ticket)
1. ASSA responde con ticket (ej: "TICKET #12345")
2. Sistema detecta ticket en asunto o cuerpo
3. Busca caso existente por:
   - `ticket_ref` (si ya existe)
   - Hilo de correo (`thread_id`)
   - Broker + gestión + cliente (últimas 48h)
4. Asocia ticket al caso existente
5. **Sugiere** cambio de estado basado en contenido
6. ⚠️ **Humano SIEMPRE confirma** el cambio de estado

---

### Emisión → Preliminar BD

**Al cambiar estado a "EMITIDO":**

1. ✅ Se exige `policy_number` (Nº de póliza)
2. ⚠️ Si no existe en BD **Y** NO es **VIDA ASSA WEB**:
   - Mostrar popup a MASTER:
     ```
     "¿Desea crear preliminar en Base de Datos con estos datos?"
     [Cliente: Juan Pérez | Póliza: ABC123 | Aseguradora: XXX]
     
     [SÍ, CREAR PRELIMINAR]  [NO, SOLO MARCAR EMITIDO]
     ```
3. Si MASTER elige **SÍ**:
   - Crea registro preliminar en tablas `clients` y `policies`
   - Marca como `is_preliminary = true`
   - Notifica al broker asignado:
     ```
     "Tienes un preliminar para completar en Base de Datos
     Cliente: Juan Pérez | Póliza: ABC123
     [IR A COMPLETAR]"
     ```
4. Si MASTER elige **NO**:
   - Solo cambia estado a EMITIDO
   - No crea nada en BD

**Exclusión VIDA ASSA WEB:**
- **NO** preguntar por preliminar
- Cambio directo a EMITIDO con policy_number

---

### PDF - Estructura y Descarga

**Desde la lista:**
- Selección múltiple de casos
- Botón "Descargar PDF"
- Genera PDF consolidado con:
  - Logo institucional
  - Branding: Arial, Azul #010139, Oliva #8AAA19
  - Tabla con: ID | Aseguradora | Gestión | Cliente | Estado | SLA restante | Ticket

**Desde detalle del caso:**
- Botón "Descargar PDF del trámite"
- Incluye:
  - Resumen completo
  - Checklist con estados
  - Adjuntos listados
  - Timeline compacto

---

### Clasificación (NO IA - Determinista)

**NO usar IA para clasificar.**

Usar **keywords y catálogos** existentes:

#### Detectar Aseguradora
```javascript
const aseguradoraKeywords = {
  'ASSA': ['assa', 'assa compañía'],
  'MAPFRE': ['mapfre'],
  'FEDPA': ['fedpa'],
  'VIVIR': ['vivir'],
  // ... catálogo completo
};
```

#### Detectar Gestión
```javascript
const gestionKeywords = {
  'COTIZACION': ['cotizar', 'cotización', 'cot.', 'quote'],
  'EMISION': ['emitir', 'emisión', 'emitir póliza', 'nueva póliza'],
  'REHABILITACION': ['rehabilitar', 'rehabilitación', 'reactivar'],
  'MODIFICACION': ['modificar', 'modificación', 'cambio'],
  'CANCELACION': ['cancelar', 'cancelación'],
  'CAMBIO_CORREDOR': ['cambio de corredor', 'cambio corredor'],
  'RECLAMO': ['reclamo', 'siniestro', 'claim'],
  // ...
};
```

#### Detectar Rama
- Usar catálogo existente de tipos de póliza
- Keywords: 'vida', 'salud', 'auto', 'incendio', etc.

---

### Storage - Rutas de Archivos

#### Archivos Verificados (broker/asistente validado)
```
pendientes/<yyyy>/<mm>/<case_id>/<filename>

Ejemplo:
pendientes/2025/10/c4f8a2b1-1234/solicitud.pdf
```

#### Archivos NO Verificados (correo no validado)
```
pendientes/_unverified/<yyyy>/<mm>/<temp_id>/<filename>

Ejemplo:
pendientes/_unverified/2025/10/temp_abc123/documento.pdf
```

**Reglas:**
- ✅ Guardar nombre original
- ✅ Guardar mime type
- ❌ NO renombrar automáticamente
- ❌ NO poner marca de agua

---

## 🖥️ PÁGINAS Y COMPONENTES

### 1. Lista de Casos - `/cases`

**Server Component** con layout autenticado.

#### Header
- Título: "Pendientes (Trámites)"
- Buscador (modal)
- Acciones de selección múltiple:
  - Enviar correo
  - Descargar PDF

#### Tabs (Navegador Superior)
1. **Ramos Generales**
2. **Vida ASSA** (prioridad #1 en Broker)
3. **Otros Personas** (Vida otras, Salud, AP, Colectivos)
4. **Sin clasificar**
   - Sub-sección: **No identificados** (solo Master)

#### Menú Lateral (Desktop)
- Badges "Nuevos" = `status: PENDIENTE_REVISION AND visto: false`
- Contador por categoría

#### Vista: Listado o Kanban (Toggle)

**Listado (Tabla/Cards):**
- Estado con chip de color
- SLA días restantes con semáforo
- Aseguradora + logo
- Tipo de gestión
- Broker asignado
- Cliente
- Ticket (si aplica)
- Badges: Nuevos, Vencido, Por vencer

**Kanban (Opcional):**
- Columnas:
  - En trámite
  - Pendiente info
  - Emitido
  - Aplazado
  - Cerrado
- Click en card → abre detalle
- ❌ NO editar inline en kanban

#### Acciones por Ítem
- Ver/Editar (modal o página lateral)
- Marcar visto
- Reclasificar (Master)
- Fusionar (Master)
- Cambiar estado
- Ver comentarios
- Ver adjuntos
- Ver checklist
- "Descontar a corredor" (Master)
- Marcar "mío" (Broker en pendientes sin identificar)

#### Selección Múltiple

**Enviar Correo:**
- Modal con preview
- Seleccionar brokers destino
- Resumen de casos
- Incluir links a cada caso
- Plantilla institucional

**Descargar PDF:**
- PDF consolidado
- Branding institucional
- Tabla de todos los seleccionados

#### Seguridad
- RLS aplicado
- Broker ve solo sus cases
- Filtros server-side

---

### 2. Crear Caso Manual - `/cases/new`

**Solo MASTER**

#### Wizard: 3-5 Pasos (Móvil-first, Modales Centrados)

##### PASO 1: Datos Base
- **Ámbito:** Generales | Personas
- **Tipo de póliza:** (catálogo existente)
- **Aseguradora:** (solo activas)
- **Gestión:**
  - Cotización
  - Emisión
  - Rehabilitación
  - Modificación
  - Cancelación
  - Cambio de corredor
  - Emisión express (oficina)
  - Reclamo
- **Broker asignado:** (select)
- **Administrativo interno:** (select)
- **SLA:** (prellenado desde Configuración por tipo, editable)

##### PASO 2: Cliente y Póliza
- **Cliente:** nombre y/o `client_id` (si ya existe en BD)
- **Nº póliza:** (opcional al crear; se vuelve obligatorio al cambiar a EMITIDO)
- **Forma de pago:** (opcional)
- **Prima:** (opcional)

##### PASO 3: Checklist Dinámico
- Se autogenera desde **tabla maestra** según:
  - Ramo
  - Tipo de gestión
  - Aseguradora
  - Ámbito (Personas/Generales)
- Cada ítem tiene:
  - ✅ Obligatorio / Opcional (según requisitos)
  - 📥 Descargable (link a módulo Descargas)
  - 📄 Requisito cliente (no descargable)
- **Reordenable** (drag & drop)
- **Agregar ítem ad-hoc:**
  - Botón "+ Agregar documento"
  - Nombre del documento
  - Obligatorio/Opcional
  - Descargable (link) o Cliente
- **Upload de archivo:**
  - Si subes archivo que NO está en checklist → popup:
    ```
    "¿Es un documento recurrente que debe estar en Descargas?"
    
    [SÍ] → Guardar también en Descargas (elige ruta)
           Opcionalmente marcar como obligatorio para futuros
    
    [NO] → Queda solo en este caso
    ```
- **Marcar cumplido sin archivo:**
  - Solo Master
  - Para cuando un documento único cubre varios ítems

##### PASO 4: Pagos (si aplica)

**Emisión Express (Oficina):**
- Marca deuda a corredor
- Deuda activa hasta pagar o descontar en Comisiones

**Descontar a Corredor:**
- Solo Master
- Genera pendiente hacia módulo Cheques
- Se descuenta en próxima quincena

**Pago Recibido (Transferencia):**
- Registra preliminar para Cheques
- Espera match con referencia bancaria
- Número de referencia obligatorio

**Pago Directo del Corredor:**
- Marcar como pagado
- NO genera deuda

##### PASO 5: Revisión & Crear
- Resumen completo
- Validaciones de campos
- Crear caso + `case_checklist` inicial
- Notificación al broker asignado

---

### 3. Detalle del Caso - `/cases/[id]`

#### Header
- **Estado actual** (chip con color)
- **SLA semáforo:**
  - 🟢 En tiempo
  - 🟡 Por vencer (–5 días)
  - 🔴 Vencido
- **Ticket:** `ticket_ref` (si existe)
- **Aseguradora** (con logo)
- **Tipo de gestión**
- **Acciones Master:**
  - Reclasificar
  - Fusionar
  - Aplazar
  - Cerrar
  - Eliminar → Papelera 30d

#### Panel 1: Resumen
- Cliente
- Broker asignado
- Admin interno
- Nº de póliza
- Prima / Forma de pago (si aplica)
- Fecha de creación
- Última actualización

#### Panel 2: Checklist
- Lista de documentos requeridos
- Estado de cada uno:
  - ✅ Cumplido
  - ⏳ Pendiente
  - 🚫 N/A
  - 📥 Descargable (botón download)
- **Upload inline** (drag & drop o click)
- **Marcar cumplido sin archivo** (Master)
- **Trazabilidad:** quién/cuándo marcó

#### Panel 3: Adjuntos
- Lista de archivos subidos
- Nombre original
- Tipo (mime)
- Tamaño
- Subido por
- Fecha/hora
- Acciones:
  - 👁️ Ver/Previsualizar
  - 📥 Descargar
  - 🗑️ Eliminar (Master)

#### Panel 4: Comentarios

**Canales:**
1. **Aseguradora** (comunicación externa con aseguradora)
2. **Oficina** (comunicación interna)

**Visibilidad:**
- Broker asignado ve ambos canales
- Master ve todo
- Otros brokers NO ven

**Campos:**
- Texto del comentario
- Canal
- Autor
- Fecha/hora

#### Panel 5: Historial (Timeline)

Eventos rastreados:
- `EMAIL_INGRESO` - Correo creó el caso
- `EMAIL_UPDATE` - Correo actualizó el caso
- `CLASSIFY_CHANGE` - Reclasificación
- `STATE_CHANGE` - Cambio de estado
- `FILE_UPLOADED` - Archivo subido
- `FILE_DELETED` - Archivo eliminado
- `COMMENT_ADDED` - Comentario agregado
- `CHECKLIST_UPDATED` - Checklist marcado
- `BROKER_ASSIGNED` - Broker asignado/cambiado
- `SLA_CHANGED` - SLA modificado
- `MERGED_FROM` - Fusionado desde otro caso
- `APLAZADO` - Caso aplazado
- `REABIERTO` - Caso reabierto

Cada evento con:
- Descripción
- Usuario
- Fecha/hora
- Detalles adicionales

#### Panel 6: Pagos/Comisiones

**Descontar a Corredor (solo Master):**
- Checkbox "Descontar a corredor"
- Monto
- Genera pendiente en módulo Cheques
- Link para ver el pendiente

**Pago Directo:**
- Marcar como "Pago directo del corredor"
- Elimina deuda si existía

**Prima Inicial:**
- Monto recibido
- Forma de pago
- Número de referencia (si es transferencia)
- Estado: Pendiente | Registrado | Aplicado

#### Cambiar Estado a EMITIDO

**Botón: "Marcar como Emitido"**

1. Validar que existe `policy_number`
   - Si no existe → solicitar antes de continuar
2. Si NO existe en BD **Y** NO es VIDA ASSA WEB:
   ```
   Modal:
   "¿Desea crear un registro preliminar en Base de Datos?"
   
   Cliente: [nombre]
   Póliza: [número]
   Aseguradora: [nombre]
   
   Esto creará registros preliminares que el broker
   deberá completar con información adicional.
   
   [SÍ, CREAR PRELIMINAR]  [NO, SOLO EMITIR]
   ```
3. Si SÍ:
   - Crear en `clients` (is_preliminary = true)
   - Crear en `policies` (is_preliminary = true)
   - Notificar broker:
     ```
     🔔 Tienes un preliminar para completar
     
     Cliente: [nombre]
     Póliza: [número]
     
     [IR A BASE DE DATOS]
     ```
4. Cambiar estado a `EMITIDO`

---

### Estados del Sistema

| Estado | Descripción | Acciones |
|--------|-------------|----------|
| `PENDIENTE_REVISION` | Nuevo, no revisado | Revisar, Clasificar |
| `PENDIENTE_DOCUMENTACION` | Faltan documentos | Adjuntar, Solicitar |
| `EN_PROCESO` | En trámite activo | Actualizar, Adjuntar |
| `COTIZANDO` | Cotización en proceso | Enviar cotización |
| `FALTA_DOC` | Docs identificados faltantes | Solicitar al cliente |
| `APLAZADO` | Con fecha objetivo | Seguimiento, Reactivar |
| `RECHAZADO` | Rechazado por aseguradora | Cerrar, Reclasificar |
| `APROBADO_PEND_PAGO` | Aprobado esperando pago | Registrar pago |
| `EMITIDO` | Póliza emitida (req. Nº) | Crear preliminar BD |
| `CERRADO` | Finalizado | Ver historial |
| `REVISAR_ORIGEN` | Correo no identificado | Clasificar, Asignar |

---

**Continúa en archivo siguiente...**
