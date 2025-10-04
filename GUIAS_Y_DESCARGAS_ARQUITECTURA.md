# GUÍAS Y DESCARGAS - ARQUITECTURA COMPLETA 📚

**Fecha:** 2025-10-03  
**Estado:** 📋 PLAN DE IMPLEMENTACIÓN

---

## 🎯 OBJETIVO

Crear dos módulos de repositorios de documentos PDF con:
- **Guías**: Repositorio interno sin aseguradoras (7 secciones fijas)
- **Descargas**: Repositorio por Ramo → Tipo → Aseguradora → Sección

**Características comunes:**
- Modal de búsqueda global al inicio
- Patrón de diseño de Pendientes/Cheques
- Mobile-first
- Badges "Nuevo" 24-48h
- Duplicado sincronizado opcional
- Visor en pestaña nueva
- Notificaciones en campanita

---

## 📊 BASE DE DATOS

### Tablas Creadas:

#### GUÍAS:
```sql
guide_sections {
  id, name, display_order, created_at, updated_at
}

guide_files {
  id, section_id, name, file_url, display_order,
  created_by, created_at, updated_at,
  is_new, marked_new_until
}

guide_file_links {
  id, source_file_id, linked_file_id, created_at
}
```

#### DESCARGAS:
```sql
download_sections {
  id, scope (generales/personas), policy_type, insurer_id,
  name, display_order, created_at, updated_at
}

download_files {
  id, section_id, name, file_url, display_order,
  created_by, created_at, updated_at,
  is_new, marked_new_until
}

download_file_links {
  id, source_file_id, linked_file_id, created_at
}
```

---

## 📁 ESTRUCTURA DE ARCHIVOS

### GUÍAS:
```
src/
├── app/(app)/guides/
│   ├── page.tsx                     # Índice de secciones
│   ├── [section]/
│   │   └── page.tsx                 # Lista de PDFs por sección
│   └── api/
│       ├── sections/
│       │   └── route.ts             # CRUD secciones
│       ├── files/
│       │   └── route.ts             # CRUD archivos
│       └── search/
│           └── route.ts             # Búsqueda global
│
├── components/guides/
│   ├── GuidesMainClient.tsx         # Container principal
│   ├── SearchModal.tsx              # Modal de búsqueda
│   ├── SectionsList.tsx             # Grid de secciones
│   ├── FilesList.tsx                # Tabla de archivos
│   ├── UploadFileModal.tsx          # Modal subir PDF
│   └── FileActions.tsx              # Acciones por archivo
│
└── lib/guides/
    ├── actions.ts                   # Server actions
    └── types.ts                     # TypeScript types
```

### DESCARGAS:
```
src/
├── app/(app)/downloads/
│   ├── page.tsx                     # Ramos (Generales/Personas)
│   ├── [scope]/                     # Ramo específico
│   │   └── page.tsx                 # Tipos de póliza
│   ├── [scope]/[type]/              # Tipo específico
│   │   └── page.tsx                 # Lista de aseguradoras
│   ├── [scope]/[type]/[insurer]/    # Aseguradora específica
│   │   └── page.tsx                 # Secciones
│   ├── [scope]/[type]/[insurer]/[section]/
│   │   └── page.tsx                 # Lista de PDFs
│   └── api/
│       ├── sections/
│       │   └── route.ts             # CRUD secciones
│       ├── files/
│       │   └── route.ts             # CRUD archivos
│       └── search/
│           └── route.ts             # Búsqueda global
│
├── components/downloads/
│   ├── DownloadsMainClient.tsx      # Container principal
│   ├── SearchModal.tsx              # Modal de búsqueda
│   ├── ScopeSelector.tsx            # Botones Ramos
│   ├── TypesList.tsx                # Lista tipos de póliza
│   ├── InsurersList.tsx             # Botones aseguradoras
│   ├── SectionsList.tsx             # Lista secciones
│   ├── FilesList.tsx                # Tabla de archivos
│   ├── RequirementsGuide.tsx        # Requisitos no descargables
│   ├── UploadFileModal.tsx          # Modal subir PDF
│   └── FileActions.tsx              # Acciones por archivo
│
└── lib/downloads/
    ├── actions.ts                   # Server actions
    ├── types.ts                     # TypeScript types
    └── constants.ts                 # Tipos de póliza, requisitos
```

---

## 🎨 PATRÓN DE DISEÑO

### Colores (Consistente con Pendientes):
```css
- Azul profundo: #010139 (headers, títulos)
- Oliva: #8AAA19 (badges Nuevo, botones primarios)
- Rojo: acciones destructivas
- Grises: secundario
```

### Componentes:
```tsx
// Buttons (vistosos con animación)
<button className="
  px-6 py-3 rounded-xl font-bold
  bg-gradient-to-r from-[#8AAA19] to-[#6d8814]
  text-white shadow-lg
  hover:shadow-xl hover:scale-105
  transition-all duration-200
  flex items-center gap-2
">
  <Icon />
  <span>Acción</span>
</button>

// Cards
<Card className="shadow-lg hover:shadow-xl transition-shadow">
  <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
    ...
  </CardHeader>
</Card>

// Badges
<span className="px-2 py-1 bg-[#8AAA19] text-white text-xs font-bold rounded-full">
  Nuevo
</span>

// Tabs (patrón Pendientes)
<div className="border-b-2 border-gray-200">
  <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
    <button className={activeTab ? 
      'bg-[#010139] text-white border-b-4 border-[#8AAA19]' : 
      'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }>
      Tab
    </button>
  </div>
</div>
```

---

## 🔍 BÚSQUEDA GLOBAL

### Modal (ambos módulos):
```tsx
// Se abre al entrar a /guides o /downloads
// Autocompletar mientras escribes
// Resultados con tags y acciones inline

<SearchModal>
  <Input 
    placeholder="Buscar documento..."
    autoFocus
    onChange={handleSearch}
  />
  
  <Results>
    {results.map(file => (
      <ResultCard>
        <span>{file.name}</span>
        <Tags>
          {/* Guías: [Sección] */}
          {/* Descargas: [Aseguradora] · [Ramo/Tipo] · [Sección] */}
        </Tags>
        <Actions>
          <Button onClick={() => window.open(file.url, '_blank')}>
            Ver
          </Button>
          <Button onClick={() => downloadFile(file.url)}>
            Descargar
          </Button>
        </Actions>
      </ResultCard>
    ))}
  </Results>
</SearchModal>
```

---

## 📤 SUBIR ARCHIVOS

### Modal Upload (ambos módulos):
```tsx
<UploadFileModal>
  <Form>
    <Input 
      name="name" 
      placeholder="Nombre del documento"
      required
    />
    
    <FileInput 
      accept=".pdf"
      onChange={handleFileSelect}
      required
    />
    
    <Toggle 
      label="Marcar como Nuevo (24-48h)"
      defaultChecked={true}
    />
    
    {/* Solo si hay otras rutas disponibles */}
    <Accordion title="Duplicar en otras rutas">
      <CheckboxGroup>
        {otherRoutes.map(route => (
          <Checkbox 
            label={route.name}
            value={route.id}
          />
        ))}
      </CheckboxGroup>
      <Toggle label="Vincular cambios (sincronizado)" />
    </Accordion>
    
    <Button type="submit">
      Subir Documento
    </Button>
  </Form>
</UploadFileModal>
```

---

## 🔗 DUPLICADO SINCRONIZADO

### Lógica:
```typescript
// Al crear/reemplazar archivo
interface UploadOptions {
  file: File;
  name: string;
  sectionId: string;
  markAsNew: boolean;
  duplicateIn?: string[]; // IDs de otras secciones
  linkChanges: boolean; // Sincronizar o copiar independiente
}

// Si linkChanges = true:
// 1. Crear archivo principal
// 2. Crear archivos duplicados en otras secciones
// 3. Crear relaciones en guide_file_links / download_file_links
// 4. Al editar/eliminar principal → propagar a vinculados

// Si linkChanges = false:
// 1. Crear archivo principal
// 2. Copiar archivo a otras secciones (independientes)
// 3. NO crear relaciones
```

---

## 🔔 NOTIFICACIONES

### Al agregar/reemplazar documento:
```typescript
// Crear notificación para todos los brokers
await createNotification({
  type: 'guide_new_file' | 'download_new_file',
  title: `Nuevo material en ${module}`,
  message: `Nuevo documento "${fileName}" en ${sectionPath}`,
  recipients: 'all_brokers',
  link: documentUrl
});

// Badge visible 24-48h
const markedNewUntil = new Date();
markedNewUntil.setHours(markedNewUntil.getHours() + 48);

await updateFile({
  is_new: true,
  marked_new_until: markedNewUntil
});
```

---

## 📱 RESPONSIVE (Mobile-First)

### Breakpoints:
```css
/* Mobile: 320px - 767px */
- Grid: 1 columna
- Tabs: scroll horizontal
- Modales: fullscreen
- Botones: full-width

/* Tablet: 768px - 1023px */
- Grid: 2 columnas
- Tabs: wrap
- Modales: centrados (80% width)

/* Desktop: 1024px+ */
- Grid: 3-4 columnas
- Tabs: inline
- Modales: centrados (max 600px)
```

---

## 🔐 PERMISOS

### Roles:
```typescript
// Master:
- Ver todo ✅
- Crear secciones ✅
- Editar secciones ✅
- Eliminar secciones ✅
- Subir archivos ✅
- Editar archivos ✅
- Eliminar archivos ✅
- Mover archivos ✅
- Duplicar archivos ✅
- Reordenar ✅

// Broker:
- Ver todo ✅
- Descargar archivos ✅
- Ver en pestaña nueva ✅
- Todo lo demás ❌
```

---

## 🗺️ NAVEGACIÓN - DESCARGAS

### Tipos de Póliza por Ramo:

#### Generales:
1. Auto (más usado)
2. Incendio
3. Multipóliza
4. RC
5. Fianzas
6. Flotas
7. CAR
8. Casco marino
9. Casco aéreo
10. Transporte
11. Carga
12. Otros

#### Personas:
1. VIDA ASSA (destacado primero)
2. Vida (otras)
3. Salud
4. AP (Accidentes Personales)
5. Colectivos

---

## 📋 REQUISITOS NO DESCARGABLES

### Auto:
- Cédula / Pasaporte
- Licencia de conducir
- Registro vehicular
- Fotos de inspección:
  - Frontal
  - Posterior
  - Laterales (izquierdo y derecho)
  - Tablero
  - Odómetro
  - Asientos
  - Chasis
  - Motor
  - Maletero
  - Llave

### VIDA ASSA:
- Activos y Pasivos (opcional)

### Otros:
- Según tipo de póliza (mapear en constants.ts)

---

## 🔄 CONEXIÓN CON OTROS MÓDULOS

### Pendientes (Trámites):
```typescript
// Desde checklist de trámite:
<ChecklistItem>
  <span>{requirement.name}</span>
  {requirement.downloadable && (
    <Button onClick={() => downloadFromRepository(requirement.id)}>
      <FaDownload /> Descargar
    </Button>
  )}
</ChecklistItem>

// Si adjuntan algo que no existe en Descargas:
<Button onClick={() => saveToRepository(file, context)}>
  Guardar en Descargas para reusar
</Button>
```

### Configuración:
```typescript
// Tab "Descargas" en Configuración debe:
// 1. Mostrar resumen de estadísticas
// 2. Link a /downloads
// 3. Accesos rápidos a secciones más usadas

// Tab "Guías" en Configuración debe:
// 1. Mostrar resumen de estadísticas
// 2. Link a /guides
// 3. Accesos rápidos a secciones más usadas
```

### Aseguradoras:
```typescript
// Al agregar aseguradora desde Descargas:
// Abrir wizard completo de Aseguradoras
// (el mismo que existe en Configuración)

// Crear:
// 1. Nombre
// 2. Logo (upload a Storage)
// 3. Estado (activa/inactiva)
// 4. Mapeos de Comisiones
// 5. Mapeos de Morosidad
// 6. Rutas mínimas en Descargas
```

---

## 📊 ENDPOINTS API

### GUÍAS:

#### GET /api/guides/sections
```typescript
// Retorna: guide_sections con count de files
Response: {
  sections: [{
    id, name, display_order,
    files_count, has_new_files
  }]
}
```

#### GET /api/guides/[section]/files
```typescript
// Retorna: archivos de una sección
Response: {
  section: { id, name },
  files: [{
    id, name, file_url, created_at,
    is_new, created_by_name
  }]
}
```

#### POST /api/guides/files/upload
```typescript
Request: FormData {
  name, file, section_id,
  mark_as_new, duplicate_in?, link_changes?
}
Response: { success, file_id, linked_ids? }
```

#### PUT /api/guides/files/[id]
```typescript
// Rename, replace, move
Request: { action, ...params }
Response: { success }
```

#### DELETE /api/guides/files/[id]
```typescript
// Si tiene links, preguntar confirmación
Response: { success, affected_links }
```

#### GET /api/guides/search?q=...
```typescript
// Búsqueda global
Response: {
  results: [{
    id, name, file_url, section_name,
    is_new, relevance_score
  }]
}
```

### DESCARGAS:

#### GET /api/downloads/tree
```typescript
// Árbol completo de navegación
Response: {
  generales: {
    auto: {
      insurers: [{ id, name, logo }],
      sections: [{ id, name }]
    },
    ...
  },
  personas: { ... }
}
```

#### GET /api/downloads/files
```typescript
// Query params: scope, type, insurer, section
Response: {
  files: [{
    id, name, file_url, created_at,
    is_new, created_by_name
  }]
}
```

#### POST /api/downloads/files/upload
```typescript
// Igual que guías
```

#### GET /api/downloads/search?q=...
```typescript
// Búsqueda con tags
Response: {
  results: [{
    id, name, file_url,
    scope, policy_type, insurer_name, section_name,
    is_new, relevance_score
  }]
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Base de Datos ✅
- [x] Crear migración SQL
- [x] Tablas guide_sections, guide_files, guide_file_links
- [x] Tablas download_sections, download_files, download_file_links
- [x] RLS policies
- [x] Triggers
- [x] Datos iniciales (7 secciones de guías)

### Fase 2: Endpoints API
- [ ] GUÍAS: CRUD secciones
- [ ] GUÍAS: CRUD archivos
- [ ] GUÍAS: Búsqueda global
- [ ] DESCARGAS: CRUD secciones
- [ ] DESCARGAS: CRUD archivos
- [ ] DESCARGAS: Búsqueda global
- [ ] Upload a Supabase Storage

### Fase 3: Componentes Core
- [ ] SearchModal (reutilizable)
- [ ] UploadFileModal (reutilizable)
- [ ] FileActions (reutilizable)
- [ ] Badge "Nuevo" (reutilizable)

### Fase 4: Guías
- [ ] /guides - Índice secciones
- [ ] /guides/[section] - Lista PDFs
- [ ] GuidesMainClient
- [ ] SectionsList
- [ ] FilesList

### Fase 5: Descargas
- [ ] /downloads - Ramos
- [ ] /downloads/[scope] - Tipos
- [ ] /downloads/[scope]/[type] - Aseguradoras
- [ ] /downloads/[scope]/[type]/[insurer] - Secciones
- [ ] /downloads/[scope]/[type]/[insurer]/[section] - PDFs
- [ ] DownloadsMainClient
- [ ] TypesList
- [ ] InsurersList
- [ ] RequirementsGuide

### Fase 6: Integraciones
- [ ] Conectar con Pendientes (deeplinks)
- [ ] Actualizar Configuración (tabs Descargas/Guías)
- [ ] Notificaciones (campanita)
- [ ] Duplicado sincronizado

### Fase 7: Testing
- [ ] Master: CRUD completo
- [ ] Broker: readonly
- [ ] Mobile responsive
- [ ] Búsqueda global
- [ ] Upload/download
- [ ] Duplicado sincronizado
- [ ] Badges "Nuevo"

---

## 📝 NOTAS DE IMPLEMENTACIÓN

### Supabase Storage:
```typescript
// Buckets:
- guides-pdfs (public)
- downloads-pdfs (public)
- insurer-logos (public)

// Upload:
const { data, error } = await supabase.storage
  .from('guides-pdfs')
  .upload(`${sectionId}/${fileName}`, file);

// Get public URL:
const { data } = supabase.storage
  .from('guides-pdfs')
  .getPublicUrl(filePath);
```

### Constants:
```typescript
// lib/downloads/constants.ts
export const POLICY_TYPES = {
  generales: [
    { key: 'auto', label: 'Auto', order: 1 },
    { key: 'incendio', label: 'Incendio', order: 2 },
    // ...
  ],
  personas: [
    { key: 'vida_assa', label: 'VIDA ASSA', order: 1, featured: true },
    // ...
  ]
};

export const REQUIREMENTS = {
  auto: [
    'Cédula / Pasaporte',
    'Licencia de conducir',
    // ...
  ],
  vida_assa: [
    'Activos y Pasivos (opcional)',
  ]
};
```

---

**ARQUITECTURA LISTA - INICIAR IMPLEMENTACIÓN** 🚀

**Estimación:** ~40-50 horas de desarrollo completo
**Archivos a crear:** ~30-35 archivos
**Líneas de código:** ~5,000-6,000 líneas
