# 🚀 IMPLEMENTACIÓN SISTEMA DE GESTIÓN TIPO NUBE - ESTADO

## ✅ FASE 1: COMPLETADA
**Persistencia gestión de aseguradoras en Descargas**

### Archivos creados/modificados:
- ✅ `/api/downloads/insurers/route.ts` - API completa (GET, POST, DELETE)
- ✅ `InsurersList.tsx` - Actualizado con persistencia real
- ✅ TypeCheck: 0 errores

### Funcionalidades:
- ✅ Agregar aseguradora permanente (persiste en BD)
- ✅ Eliminar aseguradora (con validación de archivos)
- ✅ Loading states y feedback visual
- ✅ Validaciones y manejo de errores

---

## 🔄 FASE 2: EN PROGRESO
**Mover archivos entre carpetas (Guías) y entre aseguradoras (Descargas)**

### Implementación requerida:

#### A. API para mover archivos (Guías)
**Archivo:** `/api/guides/files/route.ts` - Agregar acción `move`

```typescript
// En la función PUT, agregar:
if (action === 'move') {
  const { target_section_id } = params;
  
  // Validar que la sección destino existe
  const { data: targetSection, error: targetError } = await supabase
    .from('guide_sections')
    .select('id')
    .eq('id', target_section_id)
    .single();
    
  if (targetError || !targetSection) {
    return NextResponse.json({ error: 'Carpeta destino no encontrada' }, { status: 404 });
  }
  
  // Mover archivo
  const { data: file, error } = await supabase
    .from('guide_files')
    .update({ section_id: target_section_id })
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return NextResponse.json({ success: true, file });
}
```

#### B. API para mover archivos (Descargas)
**Archivo:** `/api/downloads/files/route.ts` - Agregar acción `move`

```typescript
// Similar a Guías, pero con download_sections y download_files
if (action === 'move') {
  const { target_section_id } = params;
  
  // Validar sección destino
  const { data: targetSection } = await supabase
    .from('download_sections')
    .select('id, scope, policy_type, insurer_id')
    .eq('id', target_section_id)
    .single();
    
  if (!targetSection) {
    return NextResponse.json({ error: 'Sección destino no encontrada' }, { status: 404 });
  }
  
  // Mover archivo
  const { data: file, error } = await supabase
    .from('download_files')
    .update({ section_id: target_section_id })
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return NextResponse.json({ success: true, file });
}
```

#### C. UI Componente para mover (ambos sistemas)
**Agregar botón y modal en:**
- `FolderDocuments.tsx` (Guías)
- `DocumentsList.tsx` (Descargas)

```typescript
// Estado
const [showMoveModal, setShowMoveModal] = useState(false);
const [movingDoc, setMovingDoc] = useState<Document | null>(null);
const [targetSectionId, setTargetSectionId] = useState('');
const [availableSections, setAvailableSections] = useState([]);

// Handler
const handleMove = async () => {
  if (!movingDoc || !targetSectionId) return;
  
  try {
    const res = await fetch('/api/guides/files', { // o /api/downloads/files
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: movingDoc.id,
        action: 'move',
        params: { target_section_id: targetSectionId }
      })
    });
    
    const data = await res.json();
    if (data.success) {
      toast.success('Archivo movido correctamente');
      setShowMoveModal(false);
      loadDocuments();
      onUpdate?.();
    } else {
      toast.error(data.error || 'Error al mover archivo');
    }
  } catch (error) {
    toast.error('Error al mover archivo');
  }
};

// Botón en lista de archivos (junto a editar/eliminar)
<button
  onClick={() => {
    setMovingDoc(doc);
    loadAvailableSections(); // Cargar carpetas destino
    setShowMoveModal(true);
  }}
  className="px-3 py-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-all"
  title="Mover a otra carpeta"
>
  <FaArrowsAlt size={12} /> {/* Necesita import */}
</button>

// Modal
{showMoveModal && movingDoc && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
      <h3 className="text-lg font-bold text-[#010139] mb-4">
        Mover "{movingDoc.name}"
      </h3>
      
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Selecciona carpeta destino:
      </label>
      
      <select
        value={targetSectionId}
        onChange={(e) => setTargetSectionId(e.target.value)}
        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none mb-4"
      >
        <option value="">-- Selecciona --</option>
        {availableSections
          .filter(s => s.id !== currentSectionId) // No mostrar carpeta actual
          .map(section => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))
        }
      </select>
      
      <div className="flex gap-3">
        <button
          onClick={() => setShowMoveModal(false)}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleMove}
          disabled={!targetSectionId}
          className="flex-1 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#7a9916] transition-all disabled:opacity-50"
        >
          Mover
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 🔄 FASE 3: PENDIENTE
**Implementar drag & drop visual para reordenar**

### Biblioteca recomendada:
- `@dnd-kit/core` (más moderna que react-beautiful-dnd)
- `@dnd-kit/sortable`

### Instalación:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Implementación básica:

```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Componente sorteable
function SortableDocument({ doc, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: doc.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// En componente principal
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

function handleDragEnd(event) {
  const { active, over } = event;
  
  if (active.id !== over.id) {
    setDocuments((items) => {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      
      const newArray = arrayMove(items, oldIndex, newIndex);
      
      // Actualizar orden en BD
      updateDisplayOrders(newArray);
      
      return newArray;
    });
  }
}

// Render
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={documents.map(d => d.id)} strategy={verticalListSortingStrategy}>
    {documents.map(doc => (
      <SortableDocument key={doc.id} doc={doc}>
        {/* Contenido del documento */}
      </SortableDocument>
    ))}
  </SortableContext>
</DndContext>
```

---

## 🔄 FASE 4: PENDIENTE
**Vínculo con Pendientes/Trámites**

### Aclaración necesaria:
El usuario debe especificar exactamente cómo conectar estas páginas.

### Opciones posibles:
1. **Link directo:** Desde Trámites → Descargas (adjuntar documentos)
2. **Compartir documentos:** Reutilizar PDFs de Descargas en Trámites
3. **Referencia:** Mostrar qué documentos de Descargas son requeridos para cada trámite

### Pendiente de confirmar con usuario.

---

## 📋 CHECKLIST COMPLETO

### FASE 1: ✅ COMPLETADA
- [x] API persistir agregar aseguradoras
- [x] API persistir eliminar aseguradoras
- [x] Actualizar UI InsurersList
- [x] Loading states y validaciones
- [x] TypeCheck 0 errores

### FASE 2: ⏳ EN PROGRESO
- [ ] API mover archivos (Guías)
- [ ] API mover archivos (Descargas)
- [ ] UI modal mover (Guías)
- [ ] UI modal mover (Descargas)
- [ ] Cargar carpetas/secciones disponibles
- [ ] Testing funcionalidad mover

### FASE 3: ⏳ PENDIENTE
- [ ] Instalar @dnd-kit
- [ ] Implementar drag & drop (Guías)
- [ ] Implementar drag & drop (Descargas)
- [ ] Actualizar orden en BD al soltar
- [ ] Feedback visual durante drag
- [ ] Testing drag & drop

### FASE 4: ⏳ PENDIENTE
- [ ] Aclarar requerimiento con usuario
- [ ] Diseñar arquitectura de vínculo
- [ ] Implementar conexión
- [ ] Testing integración

### FASE 5: ⏳ VERIFICACIÓN FINAL
- [ ] Testing E2E Guías
- [ ] Testing E2E Descargas
- [ ] Verificar persistencia BD
- [ ] Verificar UX completa
- [ ] Confirmar 100% editable como nube

---

## 🎯 SIGUIENTE PASO

Completar FASE 2: Implementar APIs y UI para mover archivos.
