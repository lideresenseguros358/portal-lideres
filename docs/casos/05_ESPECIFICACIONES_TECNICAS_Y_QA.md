# 🛠️ ESPECIFICACIONES TÉCNICAS Y QA

## 🗄️ Estructura de Base de Datos

### Tabla: `cases`

```sql
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number VARCHAR(20) UNIQUE NOT NULL, -- Auto-generado: CASE-2025-0001
  
  -- Clasificación
  ambito VARCHAR(20) NOT NULL, -- 'GENERALES' | 'PERSONAS'
  section VARCHAR(50) NOT NULL, -- 'RAMOS_GENERALES' | 'VIDA_ASSA' | 'OTROS_PERSONAS' | 'SIN_CLASIFICAR'
  policy_type_id UUID REFERENCES policy_types(id),
  insurer_id UUID REFERENCES insurers(id),
  gestion_type VARCHAR(30) NOT NULL, -- 'COTIZACION' | 'EMISION' | 'REHABILITACION' | etc.
  
  -- Asignación
  broker_id UUID REFERENCES brokers(id),
  admin_id UUID REFERENCES profiles(id), -- Administrativo interno
  
  -- Cliente y póliza
  client_id UUID REFERENCES clients(id),
  client_name VARCHAR(200),
  policy_id UUID REFERENCES policies(id),
  policy_number VARCHAR(50),
  
  -- Financiero
  forma_pago VARCHAR(50),
  prima DECIMAL(10,2),
  descontar_a_corredor BOOLEAN DEFAULT FALSE,
  pago_directo BOOLEAN DEFAULT FALSE,
  adelanto_id UUID REFERENCES advances(id),
  
  -- Estado y SLA
  status VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_REVISION',
  sla_days INT NOT NULL DEFAULT 7,
  sla_date DATE NOT NULL,
  target_date DATE, -- Solo para APLAZADO
  aplazar_reason TEXT,
  
  -- Email tracking
  email_message_id VARCHAR(200),
  thread_id VARCHAR(200),
  ticket_ref VARCHAR(50), -- ASSA ticket
  
  -- Metadata
  visto BOOLEAN DEFAULT FALSE,
  visto_at TIMESTAMPTZ,
  visto_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_reason TEXT,
  
  CONSTRAINT cases_ambito_check CHECK (ambito IN ('GENERALES', 'PERSONAS')),
  CONSTRAINT cases_section_check CHECK (section IN (
    'RAMOS_GENERALES', 
    'VIDA_ASSA', 
    'OTROS_PERSONAS', 
    'SIN_CLASIFICAR',
    'NO_IDENTIFICADOS'
  )),
  CONSTRAINT cases_status_check CHECK (status IN (
    'PENDIENTE_REVISION',
    'PENDIENTE_DOCUMENTACION',
    'EN_PROCESO',
    'COTIZANDO',
    'FALTA_DOC',
    'APLAZADO',
    'RECHAZADO',
    'APROBADO_PEND_PAGO',
    'EMITIDO',
    'CERRADO',
    'REVISAR_ORIGEN'
  ))
);

-- Índices
CREATE INDEX idx_cases_broker ON cases(broker_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_status ON cases(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_section ON cases(section) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_sla_date ON cases(sla_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_message_id ON cases(email_message_id);
CREATE INDEX idx_cases_thread_id ON cases(thread_id);
CREATE INDEX idx_cases_ticket ON cases(ticket_ref);
CREATE INDEX idx_cases_deleted ON cases(deleted_at);

-- Trigger para updated_at
CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### Tabla: `case_checklist`

```sql
CREATE TABLE case_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  
  document_name VARCHAR(200) NOT NULL,
  is_required BOOLEAN DEFAULT FALSE,
  is_downloadable BOOLEAN DEFAULT FALSE,
  download_link TEXT, -- Link a módulo Descargas
  
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING' | 'DONE' | 'NA'
  file_id UUID REFERENCES case_files(id), -- Si está cumplido con archivo
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  notes TEXT,
  
  -- Orden y agrupación
  sort_order INT DEFAULT 0,
  category VARCHAR(100), -- 'DOCUMENTOS_CLIENTE' | 'FORMULARIOS' | 'OTROS'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT checklist_status_check CHECK (status IN ('PENDING', 'DONE', 'NA'))
);

CREATE INDEX idx_checklist_case ON case_checklist(case_id);
CREATE INDEX idx_checklist_status ON case_checklist(status);
```

---

### Tabla: `case_files`

```sql
CREATE TABLE case_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  
  uploaded_by VARCHAR(100) NOT NULL, -- UUID o 'EMAIL_WEBHOOK'
  is_verified BOOLEAN DEFAULT TRUE,
  
  -- Relación con checklist
  checklist_item_id UUID REFERENCES case_checklist(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT case_files_size_check CHECK (size_bytes > 0)
);

CREATE INDEX idx_case_files_case ON case_files(case_id);
CREATE INDEX idx_case_files_uploaded ON case_files(uploaded_by);
```

---

### Tabla: `case_comments`

```sql
CREATE TABLE case_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  
  channel VARCHAR(20) NOT NULL, -- 'ASEGURADORA' | 'OFICINA'
  content TEXT NOT NULL,
  
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT comments_channel_check CHECK (channel IN ('ASEGURADORA', 'OFICINA'))
);

CREATE INDEX idx_case_comments_case ON case_comments(case_id);
CREATE INDEX idx_case_comments_created ON case_comments(created_at DESC);
```

---

### Tabla: `case_history`

```sql
CREATE TABLE case_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB, -- Datos adicionales del evento
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT history_event_check CHECK (event_type IN (
    'EMAIL_INGRESO',
    'EMAIL_UPDATE',
    'CASE_CREATED',
    'CLASSIFY_CHANGE',
    'STATE_CHANGE',
    'FILE_UPLOADED',
    'FILE_DELETED',
    'COMMENT_ADDED',
    'CHECKLIST_UPDATED',
    'BROKER_ASSIGNED',
    'SLA_CHANGED',
    'MERGED_FROM',
    'MERGED_TO',
    'APLAZADO',
    'REABIERTO',
    'MOVED_TO_TRASH',
    'RESTORED'
  ))
);

CREATE INDEX idx_case_history_case ON case_history(case_id);
CREATE INDEX idx_case_history_type ON case_history(event_type);
CREATE INDEX idx_case_history_created ON case_history(created_at DESC);
```

---

### Tabla: `broker_assistants` (Nueva)

```sql
CREATE TABLE broker_assistants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broker_assistants_broker ON broker_assistants(broker_id);
CREATE INDEX idx_broker_assistants_email ON broker_assistants(email) WHERE is_active = TRUE;
```

---

## 🔒 Row Level Security (RLS)

### Política: Brokers solo ven sus casos

```sql
-- Habilitar RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Broker ve solo sus casos
CREATE POLICY "Brokers can view their own cases"
ON cases
FOR SELECT
TO authenticated
USING (
  broker_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'MASTER'
  )
);

-- Broker puede actualizar solo sus casos (campos limitados)
CREATE POLICY "Brokers can update their own cases"
ON cases
FOR UPDATE
TO authenticated
USING (broker_id = auth.uid())
WITH CHECK (
  broker_id = auth.uid()
  AND
  -- Solo pueden actualizar ciertos campos
  (
    (NEW.visto IS DISTINCT FROM OLD.visto) OR
    (NEW.visto_at IS DISTINCT FROM OLD.visto_at)
  )
);

-- Master puede todo
CREATE POLICY "Masters can do everything on cases"
ON cases
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'MASTER'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'MASTER'
  )
);
```

---

### Política: Archivos y Comentarios

```sql
-- case_files: RLS igual que cases
ALTER TABLE case_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files from their cases"
ON case_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = case_files.case_id
    AND (
      cases.broker_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MASTER')
    )
  )
);

CREATE POLICY "Users can upload files to their cases"
ON case_files
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = case_files.case_id
    AND (
      cases.broker_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MASTER')
    )
  )
);

-- Solo Master puede eliminar
CREATE POLICY "Only masters can delete files"
ON case_files
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MASTER')
);
```

---

## 🎨 Componentes UI (React/Next.js)

### Lista de Casos - Mobile First

```tsx
// components/cases/CasesList.tsx
'use client';

import { useState } from 'react';
import { CaseCard } from './CaseCard';
import { CaseKanban } from './CaseKanban';
import { CaseFilters } from './CaseFilters';

interface CasesListProps {
  initialCases: Case[];
  userRole: 'MASTER' | 'BROKER';
}

export function CasesList({ initialCases, userRole }: CasesListProps) {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  
  return (
    <div className="cases-container">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#010139]">
          Pendientes (Trámites)
        </h1>
        
        {/* Acciones */}
        <div className="flex gap-2">
          {selectedCases.length > 0 && (
            <>
              <button onClick={handleSendEmail}>
                Enviar Correo ({selectedCases.length})
              </button>
              <button onClick={handleDownloadPDF}>
                Descargar PDF
              </button>
            </>
          )}
          
          {/* Toggle Vista */}
          <button onClick={() => setViewMode(v => v === 'list' ? 'kanban' : 'list')}>
            {viewMode === 'list' ? '📊 Kanban' : '📋 Lista'}
          </button>
        </div>
      </div>
      
      {/* Filtros */}
      <CaseFilters />
      
      {/* Vista */}
      {viewMode === 'list' ? (
        <div className="grid gap-4">
          {cases.map(case => (
            <CaseCard 
              key={case.id}
              case={case}
              selected={selectedCases.includes(case.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <CaseKanban cases={cases} />
      )}
    </div>
  );
}
```

---

### Card de Caso

```tsx
// components/cases/CaseCard.tsx
interface CaseCardProps {
  case: Case;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function CaseCard({ case: c, selected, onSelect }: CaseCardProps) {
  const slaStatus = calculateSLAStatus(c.sla_date);
  
  return (
    <div 
      className={`
        p-4 rounded-lg border-l-4 shadow-md
        ${selected ? 'bg-blue-50' : 'bg-white'}
        ${slaStatus.borderColor}
      `}
    >
      {/* Checkbox de selección */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(c.id)}
        />
        
        <div className="flex-1">
          {/* Header */}
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-bold text-[#010139]">
                {c.case_number}
              </h3>
              <p className="text-sm text-gray-600">
                {c.client_name}
              </p>
            </div>
            
            {/* Badges */}
            <div className="flex gap-2">
              {!c.visto && (
                <span className="badge badge-new">Nuevo</span>
              )}
              {slaStatus.badge}
            </div>
          </div>
          
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Aseguradora:</span>
              <strong> {c.insurer_name}</strong>
            </div>
            <div>
              <span className="text-gray-500">Gestión:</span>
              <strong> {c.gestion_type}</strong>
            </div>
            <div>
              <span className="text-gray-500">Estado:</span>
              <StatusChip status={c.status} />
            </div>
            <div>
              <span className="text-gray-500">Broker:</span>
              <strong> {c.broker_name}</strong>
            </div>
          </div>
          
          {/* Ticket si aplica */}
          {c.ticket_ref && (
            <div className="mt-2 text-sm">
              <span className="text-gray-500">Ticket:</span>
              <code className="ml-2 px-2 py-1 bg-gray-100 rounded">
                {c.ticket_ref}
              </code>
            </div>
          )}
          
          {/* Acciones */}
          <div className="flex gap-2 mt-3">
            <button onClick={() => navigate(`/cases/${c.id}`)}>
              Ver Detalle
            </button>
            {userRole === 'MASTER' && (
              <>
                <button onClick={() => handleReclassify(c.id)}>
                  Reclasificar
                </button>
                <button onClick={() => handleMerge(c.id)}>
                  Fusionar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## ✅ Criterios de Aceptación (QA)

### Wizard de Creación Manual

- [ ] Solo Master puede acceder
- [ ] 3-5 pasos funcionan correctamente
- [ ] Checklist se autogenera según tipo de póliza/gestión/aseguradora
- [ ] Items son reordenables (drag & drop)
- [ ] Puede agregar ítems ad-hoc
- [ ] Upload de archivo fuera de checklist → popup "¿Recurrente?"
- [ ] Si recurrente → guarda también en Descargas
- [ ] Validaciones antes de crear
- [ ] Notifica al broker asignado tras crear
- [ ] Mobile-friendly (modales centrados, touch-friendly)

---

### Cambio a Estado EMITIDO

- [ ] Exige `policy_number` antes de cambiar
- [ ] Si no existe en BD y NO es VIDA ASSA WEB → popup a Master
- [ ] Popup pregunta: "¿Crear preliminar en BD?"
- [ ] Si SÍ: crea registros preliminares y notifica broker
- [ ] Si NO: solo cambia estado
- [ ] VIDA ASSA WEB: cambio directo sin popup
- [ ] Registra evento en historial

---

### Ingesta por Correo (Zoho Webhook)

- [ ] Idempotencia: mismo `message_id` o `thread_id` no crea duplicados
- [ ] Normaliza texto (limpia Fw:/Re:, firmas, disclaimers)
- [ ] Verifica remitente (broker/asistente vs no validado)
- [ ] No validado → va a "No identificados" con adjuntos a `_unverified/`
- [ ] Clasificación determinista (NO IA): detecta aseguradora, gestión, rama
- [ ] ASSA sin ticket → crea caso
- [ ] ASSA con ticket → asocia al caso existente
- [ ] Agrupa por 48h (si no hay ticket)
- [ ] Adjuntos se guardan con nombre original
- [ ] Auto-respuesta enviada
- [ ] Notifica al broker asignado
- [ ] Badge "Nuevos" se actualiza
- [ ] Respuesta JSON correcta

---

### Estados y Selección Múltiple

- [ ] Broker ve solo sus casos (RLS funciona)
- [ ] Master ve todos incluido "No identificados"
- [ ] Selección múltiple funciona
- [ ] "Enviar correo" abre modal con preview
- [ ] Email incluye links a cada caso
- [ ] "Descargar PDF" genera PDF consolidado con branding correcto
- [ ] PDF individual desde detalle funciona
- [ ] Kanban opcional se puede habilitar
- [ ] Click en card de Kanban abre detalle (NO edita inline)

---

### SLA y Semáforo

- [ ] Semáforo: 🟢 En tiempo (>5d), 🟡 Por vencer (0-5d), 🔴 Vencido (<0d)
- [ ] Notificación diaria a broker cuando está por vencer
- [ ] Casos vencidos sin actualización 7 días → auto a Papelera
- [ ] Aplazado: guarda `target_date`, notifica 5 días antes
- [ ] Puede re-aplazar múltiples veces
- [ ] Papelera: visible 30 días, luego purga automática
- [ ] Master puede restaurar desde Papelera

---

### Notificaciones

- [ ] Campanita muestra contador de no leídas
- [ ] Badge "Nuevos" solo muestra `PENDIENTE_REVISION` + no visto
- [ ] Eventos correctos disparan notificaciones (ver tabla de eventos)
- [ ] Correo 7:00 AM enviado a todos los usuarios activos
- [ ] Broker recibe resumen de SUS casos
- [ ] Master recibe resumen de Oficina + No identificados
- [ ] Toggle de Comisiones NO afecta a Trámites
- [ ] Template de email usa branding correcto

---

### Permisos y Seguridad

- [ ] RLS aplicado correctamente
- [ ] Broker NO puede ver casos de otros brokers
- [ ] Broker NO puede cambiar SLA, estado global, "descontar a corredor"
- [ ] Master puede hacer todo
- [ ] "Marcar cumplido sin archivo" solo Master
- [ ] Eliminar archivos solo Master
- [ ] Reclasificar solo Master
- [ ] Fusionar solo Master
- [ ] Aplazar/Cerrar/Eliminar solo Master

---

### Mobile y UX

- [ ] Wizard funciona en móvil (modales centrados)
- [ ] Lista de casos responsive
- [ ] Tabs navegables en móvil
- [ ] Acciones touch-friendly (botones grandes)
- [ ] Drag & drop funciona en táctil (checklist)
- [ ] Modales se cierran con gesto de swipe
- [ ] Loading states claros
- [ ] Mensajes de error descriptivos
- [ ] Confirmaciones antes de acciones destructivas

---

### Búsqueda y Filtros

- [ ] Buscador en modal funciona
- [ ] Busca por: cliente, aseguradora, tipo, ticket, broker, estado
- [ ] Filtros por estado, tipo, aseguradora, broker (Master)
- [ ] Resultados se actualizan en tiempo real
- [ ] Filtros se pueden combinar
- [ ] "Limpiar filtros" funciona

---

## 📦 Notas de Implementación

### No Cambiar Helpers de Supabase

Usar patrones existentes:
```typescript
import { supabaseClient } from "@/lib/supabase/client"
import { getSupabaseServer } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
```

---

### Adaptar Nombres Existentes

Si ya existen endpoints/tablas:
- **NO crear rutas nuevas innecesarias**
- Adaptar a nomenclatura existente
- Verificar catálogos antes de crear constantes

---

### Clasificación Determinista

**NO usar IA.**

Definir arrays de keywords:
```typescript
const ASEGURADORAS_KEYWORDS = { ... };
const GESTION_KEYWORDS = { ... };
const TIPO_POLIZA_KEYWORDS = { ... };
```

Reutilizar catálogos existentes de Descargas/Pendientes si ya están.

---

### PDF con Branding

- **Tipografía:** Arial
- **Logo:** `/public/logo_alternativo.png`
- **Colores:**
  - Azul: `#010139`
  - Oliva: `#8AAA19`
  - Grises: `#666`, `#999`, `#f5f5f5`

Usar generador existente del proyecto o `jspdf` + `jspdf-autotable`.

---

### Emails con Plantillas

Reusar mailer/plantillas existentes.

**Asunto claro:**
- "Nuevo trámite asignado: CASE-2025-0123"
- "Resumen Diario de Trámites - 17 Oct 2025"
- "Caso vencido: CASE-2025-0456"

**Enlaces al portal:**
```html
<a href="https://portal.lideresenseguros.com/cases/123">
  Ver Caso CASE-2025-0123
</a>
```

---

## 🚀 Resumen ASSA (Crítico)

### Flujo Completo

1. **Broker envía correo a ASSA** (sin ticket aún)
   - Sistema crea caso en tab "Vida ASSA"
   - Estado: `PENDIENTE_REVISION`
   - `ticket_ref` = null

2. **ASSA responde con ticket** (ej: "TICKET #12345")
   - Sistema detecta ticket en asunto/cuerpo
   - Busca caso existente por `thread_id` o broker+gestión+cliente (48h)
   - Asocia `ticket_ref` al caso
   - **Sugiere** cambio de estado basado en contenido

3. **Master/Broker confirma**
   - Humano **SIEMPRE** confirma el cambio de estado sugerido
   - No es automático

4. **Actualizaciones posteriores**
   - Correos con mismo `ticket_ref` actualizan el caso
   - No crean casos nuevos

---

**Fecha de creación:** 2025-10-17  
**Versión:** 1.0 - Especificaciones completas
