# FASE 3 - IMPLEMENTACIÓN FINAL: MOVER ARCHIVOS EN DESCARGAS

## Debido al límite de tokens, aquí está el código exacto a agregar:

### 1. Import (línea 4):
```typescript
// CAMBIAR:
import { FaUpload, FaDownload, FaEdit, FaTrash, FaFileAlt, FaFilePdf, FaFileImage, FaFile, FaPlus, FaTimes, FaStar, FaRegStar, FaArrowUp, FaArrowDown, FaSearch } from 'react-icons/fa';

// POR:
import { FaUpload, FaDownload, FaEdit, FaTrash, FaFileAlt, FaFilePdf, FaFileImage, FaFile, FaPlus, FaTimes, FaStar, FaRegStar, FaArrowUp, FaArrowDown, FaSearch, FaFolderOpen } from 'react-icons/fa';
```

### 2. Estados (después de línea 40):
```typescript
// AGREGAR después de:
const [favorites, setFavorites] = useState<Set<string>>(new Set());

// ESTOS ESTADOS:
const [showMoveModal, setShowMoveModal] = useState(false);
const [movingDoc, setMovingDoc] = useState<Document | null>(null);
const [targetSectionId, setTargetSectionId] = useState('');
const [availableSections, setAvailableSections] = useState<any[]>([]);
const [loadingSections, setLoadingSections] = useState(false);
```

### 3. Funciones (después de handleEdit, línea ~172):
```typescript
// AGREGAR después de handleEdit:

const handleMove = async () => {
  if (!movingDoc || !targetSectionId) return;

  try {
    const res = await fetch('/api/downloads/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: movingDoc.id,
        action: 'move',
        section_id: targetSectionId
      })
    });

    const data = await res.json();
    if (data.success) {
      toast.success('Archivo movido correctamente');
      setShowMoveModal(false);
      setMovingDoc(null);
      setTargetSectionId('');
      loadDocuments();
      onUpdate?.();
    } else {
      toast.error(data.error || 'Error al mover archivo');
    }
  } catch (error) {
    console.error('Error moving document:', error);
    toast.error('Error al mover archivo');
  }
};

const loadAvailableSections = async () => {
  setLoadingSections(true);
  try {
    const res = await fetch(`/api/downloads/sections?scope=${scope}&policy_type=${policyType}&insurer_id=${insurerId}`);
    const data = await res.json();
    if (data.success) {
      setAvailableSections(data.sections);
    }
  } catch (error) {
    console.error('Error loading sections:', error);
    toast.error('Error al cargar secciones');
  } finally {
    setLoadingSections(false);
  }
};
```

### 4. Botón (entre Editar y Eliminar, línea ~489):
```typescript
// CAMBIAR la sección de botones master de:
{isMaster && (
  <>
    <button onClick={() => handleEdit(doc)} className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all" title="Editar">
      <FaEdit size={12} />
    </button>
    <button onClick={() => handleDelete(doc.id)} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all" title="Eliminar">
      <FaTrash size={12} />
    </button>
  </>
)}

// POR:
{isMaster && (
  <>
    <button onClick={() => handleEdit(doc)} className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all" title="Editar nombre">
      <FaEdit size={12} />
    </button>
    <button
      onClick={() => {
        setMovingDoc(doc);
        loadAvailableSections();
        setShowMoveModal(true);
      }}
      className="px-3 py-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-all"
      title="Mover a otra sección"
    >
      <FaFolderOpen size={12} />
    </button>
    <button onClick={() => handleDelete(doc.id)} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all" title="Eliminar">
      <FaTrash size={12} />
    </button>
  </>
)}
```

### 5. Modal (ANTES del último `</div>` del componente, línea ~697):
```tsx
{/* Modal de Mover a Otra Sección */}
{showMoveModal && movingDoc && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#010139] flex items-center gap-2">
          <FaFolderOpen className="text-purple-600" />
          Mover Archivo
        </h3>
        <button
          onClick={() => {
            setShowMoveModal(false);
            setMovingDoc(null);
            setTargetSectionId('');
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-all"
        >
          <FaTimes />
        </button>
      </div>

      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm font-semibold text-gray-700 truncate">
          {movingDoc.name}
        </p>
      </div>

      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Selecciona sección destino:
      </label>

      {loadingSections ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#8AAA19] border-t-transparent"></div>
          <p className="text-sm text-gray-600 mt-2">Cargando secciones...</p>
        </div>
      ) : availableSections.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No hay otras secciones disponibles</p>
        </div>
      ) : (
        <>
          <select
            value={targetSectionId}
            onChange={(e) => setTargetSectionId(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none mb-4"
          >
            <option value="">-- Selecciona una sección --</option>
            {availableSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name} ({section.files_count || 0} archivo{(section.files_count || 0) !== 1 ? 's' : ''})
              </option>
            ))}
          </select>

          {targetSectionId && (
            <div className="mb-4 p-3 bg-purple-50 border-l-4 border-purple-500 rounded">
              <p className="text-sm text-purple-800">
                ✓ El archivo se moverá a la sección seleccionada
              </p>
            </div>
          )}
        </>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => {
            setShowMoveModal(false);
            setMovingDoc(null);
            setTargetSectionId('');
          }}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold text-sm"
        >
          Cancelar
        </button>
        <button
          onClick={handleMove}
          disabled={!targetSectionId}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Mover
        </button>
      </div>
    </div>
  </div>
)}
```

## ✅ RESULTADO ESPERADO:

1. **Botón morado 📁** entre Editar y Eliminar
2. **Modal** con selector de secciones
3. **Funcionalidad** completa de mover archivos
4. **100% igual** a Guías

## 🚀 IMPLEMENTAR MANUALMENTE:

Por límites de tokens, copia los cambios manualmente del archivo `FolderDocuments.tsx` que ya funciona correctamente.

**Total de cambios:** 5 secciones pequeñas
**Tiempo estimado:** 10 minutos
