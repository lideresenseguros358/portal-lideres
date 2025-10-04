# Roadmap Completo: Módulo Configuración

**Fecha**: 2025-10-04  
**Alcance**: 8 tabs completas + Responsive + Uppercase + Features  
**Estimación**: 25-35 horas de desarrollo + testing

---

## Estado Actual

### Archivos Identificados (9 archivos)
1. `ConfigMainClient.tsx` (Main container)
2. `GeneralTab.tsx` (Notificaciones, % Comisión)
3. `InsurersTab.tsx` (Wizard aseguradoras, mapeos)
4. `CommissionsTab.tsx` (Toggles notificaciones)
5. `CasesTab.tsx` (SLA, Requisitos, Kanban)
6. `DownloadsTab.tsx` (Botón ver descargas)
7. `GuidesTab.tsx` (Secciones, Nueva guía)
8. `AgendaTab.tsx` (Toggles eventos)
9. `DelinquencyTab.tsx` (Configuración morosidad)

**Complejidad**: EXTREMADAMENTE ALTA  
**Archivos a modificar**: 9 archivos (estimado ~15,000 líneas)

---

## Tareas Requeridas por Tab

### 1. **GeneralTab** (4-5 horas)

#### Toggles de Notificaciones Responsive
```tsx
// Desktop: inline
<div className="flex items-center justify-between">

// Mobile: stack
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
```

#### % Comisión: Agregar/Eliminar
- [ ] Estado array: `const [percentOptions, setPercentOptions] = useState<number[]>([]);`
- [ ] Botón "+" agregar nuevo porcentaje
- [ ] Botón "X" eliminar porcentaje
- [ ] Validación: no duplicados, entre 0-100
- [ ] Persistir en BD (tabla `config_general`)
- [ ] Revalidación de paths

#### Uppercase
- [ ] Labels de notificaciones
- [ ] Inputs de texto (si hay)

---

### 2. **InsurersTab** (8-10 horas) ⚠️ COMPLEJO

#### Títulos Adaptativos
```tsx
<h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#010139]">
```

#### Wizard Completo de Aseguradoras
**Steps**:
1. Nombre aseguradora (uppercase)
2. Logo (upload a Supabase Storage)
3. Activar/Desactivar morosidad (toggle)
4. Contactos (array, agregar/eliminar)
5. Mapeos comisiones (columns mapping)
6. Mapeos morosidad (columns mapping)

**Implementación**:
```tsx
const [step, setStep] = useState(1);
const [wizardData, setWizardData] = useState({
  name: '',
  logo_url: '',
  delinquency_enabled: false,
  contacts: [],
  commission_mapping: {},
  delinquency_mapping: {}
});
```

**Upload Logo**:
```typescript
const handleLogoUpload = async (file: File) => {
  const { supabaseClient } = await import('@/lib/supabase/client');
  const client = supabaseClient();
  
  // Path: insurers/{insurer_id}/logo.png
  const { data, error } = await client.storage
    .from('insurers')
    .upload(`${insurerId}/logo.png`, file, {
      cacheControl: '3600',
      upsert: true
    });
    
  if (data) {
    const { data: urlData } = client.storage
      .from('insurers')
      .getPublicUrl(data.path);
    return urlData.publicUrl;
  }
};
```

#### Botón "Probar Mapeo" Responsive
```tsx
<button className="w-full sm:w-auto px-6 py-3 ...">
  Probar Mapeo
</button>
```

---

### 3. **CommissionsTab** (1-2 horas)

#### Toggles Responsive
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
  <label className="text-sm font-semibold text-gray-700">
    Notificar nueva quincena
  </label>
  <Switch checked={...} onCheckedChange={...} />
</div>
```

---

### 4. **CasesTab (Trámites)** (5-6 horas)

#### SLA: Actualizar Valores
```tsx
<input
  type="number"
  value={slaConfig.days}
  onChange={(e) => updateSLA('days', parseInt(e.target.value))}
  className="..."
/>
<button onClick={saveSLA}>Guardar SLA</button>
```

#### Tabla Maestra de Requisitos
```tsx
// Columna con word-wrap
<td className="px-4 py-2 max-w-xs">
  <div className="truncate" title={fullText}>
    {truncatedText}
  </div>
</td>

// O con Tooltip (Radix UI)
<Tooltip>
  <TooltipTrigger>
    <span className="truncate">{text}</span>
  </TooltipTrigger>
  <TooltipContent>{fullText}</TooltipContent>
</Tooltip>
```

#### Vista Kanban: Toggle Funcional
```tsx
<Switch 
  checked={viewMode === 'kanban'}
  onCheckedChange={(checked) => {
    setViewMode(checked ? 'kanban' : 'table');
    // Persistir preferencia en localStorage
    localStorage.setItem('cases_view', checked ? 'kanban' : 'table');
  }}
/>
```

---

### 5. **DownloadsTab** (1 hora)

#### Botón con Label Blanco
```tsx
<button className="... text-white">
  <FaDownload className="text-white" />
  <span className="text-white">Ver descargas</span>
</button>
```

#### Título Adaptativo
```tsx
<h2 className="text-xl sm:text-2xl md:text-3xl ...">
```

---

### 6. **GuidesTab** (3-4 horas)

#### Título Adaptativo
```tsx
<h2 className="text-xl sm:text-2xl md:text-3xl ...">
```

#### Botones Responsive dentro del Card
```tsx
<div className="flex flex-col sm:flex-row gap-3">
  <button className="w-full sm:w-auto ... text-white">
    Ver guías
  </button>
  <button className="w-full sm:w-auto ...">
    Nueva sección
  </button>
</div>
```

#### Lista de Secciones con Conteo Correcto
```tsx
// Verificar query
const { data: sections } = await supabase
  .from('guide_sections')
  .select('*, guides:guides(count)')
  .order('order', { ascending: true });

// Display
{sections.map(section => (
  <div key={section.id}>
    <h3>{section.title}</h3>
    <span>{section.guides[0].count} guías</span>
  </div>
))}
```

**Expected**: 7 secciones  
**Fix**: Verificar BD o query

---

### 7. **AgendaTab** (1-2 horas)

#### Todos los Toggles Responsive
```tsx
<div className="space-y-4">
  {toggleOptions.map(option => (
    <div key={option.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <label>{option.label}</label>
      <Switch {...} />
    </div>
  ))}
</div>
```

---

### 8. **DelinquencyTab (Plantillas)** (3-4 horas)

#### Grid Responsive
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {templates.map(template => (
    <div className="min-w-0 p-4 ...">
      <h3 className="truncate">{template.name}</h3>
      <div className="flex flex-wrap gap-2 mt-2">
        <button className="text-xs px-2 py-1">Editar</button>
        <button className="text-xs px-2 py-1">Eliminar</button>
      </div>
    </div>
  ))}
</div>
```

#### Multifecha: Patrón de Agenda
```tsx
const [dates, setDates] = useState<string[]>([]);

<input
  type="date"
  value={newDate}
  onChange={(e) => setNewDate(e.target.value)}
/>
<button onClick={() => {
  if (newDate && !dates.includes(newDate)) {
    setDates([...dates, newDate].sort());
  }
}}>
  +
</button>

{dates.map(date => (
  <div key={date} className="flex items-center gap-2">
    <span>{date}</span>
    <button onClick={() => setDates(dates.filter(d => d !== date))}>
      X
    </button>
  </div>
))}
```

#### Export ICS Toggle
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
  <label>Permitir exportar ICS</label>
  <Switch checked={allowICS} onCheckedChange={setAllowICS} />
</div>
```

---

## Uppercase en TODO el Módulo

### Inputs a Normalizar (estimado 20-30 campos)
- Nombres de aseguradoras
- Contactos
- Nombres de secciones/guías
- Nombres de plantillas
- Títulos de requisitos
- Notas/Descripciones

### Pattern
```tsx
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';

<input
  onChange={createUppercaseHandler((e) => setState(e.target.value))}
  className={`... ${uppercaseInputClass}`}
/>
```

---

## Testing Requerido

### Por Resolución
- [ ] **360px**: Todos los toggles stacked, botones full-width
- [ ] **768px**: Transición a layout horizontal
- [ ] **1024px**: Layout completo

### Por Funcionalidad
- [ ] Agregar/Eliminar % comisión → Persistir
- [ ] Wizard aseguradoras completo → Guardar en BD
- [ ] Upload logo → Supabase Storage
- [ ] SLA actualizado → Persistir
- [ ] Kanban toggle → Cambiar vista
- [ ] Multifecha → Agregar/Eliminar fechas
- [ ] Todos los toggles → Guardar estado

### Evidencias
Crear capturas en: `/docs/audits/config/`
- `general-tab-before-after.png`
- `insurers-wizard-mobile.png`
- `cases-sla-update.png`
- Etc.

---

## Estimación por Tab

| Tab | Complejidad | Estimación | Prioridad |
|-----|-------------|------------|-----------|
| **InsurersTab** | ALTA | 8-10h | ALTA |
| **CasesTab** | ALTA | 5-6h | MEDIA |
| **GeneralTab** | MEDIA | 4-5h | ALTA |
| **GuidesTab** | MEDIA | 3-4h | BAJA |
| **DelinquencyTab** | MEDIA | 3-4h | MEDIA |
| **CommissionsTab** | BAJA | 1-2h | BAJA |
| **AgendaTab** | BAJA | 1-2h | BAJA |
| **DownloadsTab** | BAJA | 1h | BAJA |

**Total**: 27-38 horas

---

## Orden de Implementación Recomendado

### Fase 1: Quick Wins (3-5 horas)
1. ✅ Toggles responsive en todos los tabs (1-2h)
2. ✅ Títulos adaptativos (30min)
3. ✅ Botones responsive (30min)
4. ✅ Labels en blanco donde se requiere (30min)

### Fase 2: Features Críticas (12-15 horas)
5. ⏳ Wizard aseguradoras completo (8-10h)
6. ⏳ % Comisión agregar/eliminar (2-3h)
7. ⏳ SLA actualizar y persistir (1-2h)

### Fase 3: Features Secundarias (8-10 horas)
8. ⏳ Tabla requisitos con tooltips (2h)
9. ⏳ Kanban toggle funcional (1h)
10. ⏳ Guías: corregir conteo (1h)
11. ⏳ Multifecha en plantillas (2h)
12. ⏳ Uppercase en todos los inputs (2-3h)

### Fase 4: Testing & QA (5-8 horas)
13. ⏳ Testing manual en múltiples resoluciones
14. ⏳ Verificar persistencia de todos los cambios
15. ⏳ Capturas before/after
16. ⏳ Documentación de cambios

---

## Riesgos y Consideraciones

### Wizard Aseguradoras (ALTO RIESGO)
**Complejidad**: Upload a Storage + Múltiples pasos + Validaciones

**Mitigación**:
- Dividir en componentes separados por step
- Validación en cada paso antes de avanzar
- Preview de logo antes de guardar
- Manejo de errores de upload

### Persistencia de Configuraciones (MEDIO RIESGO)
**Problema**: Múltiples tablas, revalidación compleja

**Mitigación**:
- Confirmar estructura de BD antes de implementar
- Usar transacciones cuando sea necesario
- Toast descriptivo de éxito/error
- Revalidación de paths correctos

### Conteo de Guías (BAJO RIESGO)
**Problema**: Query incorrecta o datos inconsistentes

**Mitigación**:
- Verificar query en Supabase dashboard
- Revisar datos en BD manualmente
- Agregar fallback si count es null

---

## Dependencias de BD

### Tablas Involucradas (Verificar)
```sql
-- ¿Existe esta estructura?
config_general {
  percent_options  -- Array de números
  notifications    -- JSON con toggles
}

insurers {
  name
  logo_url         -- URL de Supabase Storage
  delinquency_enabled
  commission_mapping
  delinquency_mapping
}

insurer_contacts {
  insurer_id
  name
  email
  phone
}

cases_config {
  sla_days
  kanban_enabled
}

guide_sections {
  title
  order
  -- Relación con guides
}

templates {
  name
  dates            -- Array?
  export_ics_enabled
}
```

---

## Checklist Pre-Implementación

Antes de empezar:
- [ ] Leer todos los archivos de config/tabs/
- [ ] Verificar schema de BD (todas las tablas config_*)
- [ ] Confirmar estructura de Supabase Storage
- [ ] Entender flujo actual de guardado
- [ ] Identificar todos los toggles existentes
- [ ] Mapear todos los inputs de texto

---

## Estimación Final

### Tiempo de Desarrollo
- **Mínimo**: 25 horas (solo features críticas)
- **Realista**: 30 horas
- **Con buffer**: 35 horas

### Tiempo de Testing
- Manual QA: 4 horas
- Screenshots: 2 horas
- Verificación BD: 2 horas

**Total**: 33-43 horas (6-8 días de trabajo full-time)

---

## Recomendaciones

### Opción A: Implementación Completa
**Pros**: Módulo completamente funcional  
**Contras**: 6-8 días de trabajo  
**Cuándo**: Si hay sprint dedicado completo

### Opción B: Por Fases
**Fase 1** (3-5h): Todos los quick wins responsive  
**Fase 2** (12-15h): Features críticas (Wizard, % Comisión, SLA)  
**Fase 3** (8-10h): Features secundarias

### Opción C: Solo Critical Path
**Estimación**: 10-12 horas  
**Incluye**:
- Wizard aseguradoras (8-10h)
- % Comisión agregar/eliminar (2h)
- Toggles responsive (quick)

**Excluye**: Todo lo demás

---

**Conclusión**: El módulo Configuración es el MÁS COMPLEJO de todo el portal. Requiere trabajo extenso en 8 tabs diferentes, múltiples features nuevas (wizard completo, uploads, etc.), y validaciones críticas. Recomiendo fuertemente dividir en fases y dedicar un sprint completo.

**Estado**: 📋 Roadmap completo | ⏳ Requiere 6-8 días de trabajo | 🎯 Dividir en 3 fases
