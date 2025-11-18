# 🔧 FIX: Expedientes - Previsualización, Descarga y Eliminación

## 📍 Problema Reportado

En la página **Base de Datos → Expedientes de Clientes**:

1. ❌ **No permite previsualizar** archivos adjuntos (aunque se cargan)
2. ❌ **No permite descargar** fácilmente
3. ❌ **Eliminar** no era claro (función existía pero no era intuitiva)

---

## ✅ Solución Implementada

**Archivo modificado:** `src/components/expediente/ExpedienteManager.tsx`

### **1. Modal de Previsualización** ← NUEVO

#### **Características:**
- **PDFs**: Se muestran en un iframe interno
- **Imágenes**: Se muestran con zoom y alta calidad
- **Otros archivos**: Mensaje informativo con botón de descarga

#### **Código agregado:**
```tsx
const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; type: string } | null>(null);
const [loadingPreview, setLoadingPreview] = useState(false);

const handlePreview = async (doc: ExpedienteDocument) => {
  setLoadingPreview(true);
  try {
    const result = await getExpedienteDocumentUrl(doc.file_path);
    if (result.ok && result.url) {
      setPreviewDoc({
        url: result.url,
        name: doc.file_name,
        type: doc.mime_type || ''
      });
    }
  } finally {
    setLoadingPreview(false);
  }
};
```

#### **Modal de Previsualización:**
```tsx
{previewDoc && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
      {/* Header con botón de descarga */}
      <div className="bg-gradient-to-r from-[#010139] to-[#020270] px-5 py-4">
        <h3>Previsualización</h3>
        <a href={url} download>Descargar</a>
        <button onClick={cerrar}>×</button>
      </div>

      {/* Contenido según tipo */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {previewDoc.type.includes('pdf') ? (
          <iframe src={url} className="w-full h-full min-h-[600px]" />
        ) : previewDoc.type.includes('image') ? (
          <img src={url} className="max-w-full max-h-full object-contain" />
        ) : (
          <div>No se puede previsualizar - Botón de descarga</div>
        )}
      </div>
    </div>
  </div>
)}
```

---

### **2. Función de Descarga Mejorada** ← MODIFICADO

#### **Antes:**
```typescript
const handleDownload = async (doc: ExpedienteDocument) => {
  const result = await getExpedienteDocumentUrl(doc.file_path);
  if (result.ok && result.url) {
    window.open(result.url, '_blank'); // Solo abre en nueva pestaña
  }
};
```
❌ **Problema:** Solo abre el archivo, no lo descarga directamente

#### **Ahora:**
```typescript
const handleDownload = async (doc: ExpedienteDocument) => {
  try {
    const result = await getExpedienteDocumentUrl(doc.file_path);
    if (result.ok && result.url) {
      // Crear elemento link para FORZAR descarga
      const link = document.createElement('a');
      link.href = result.url;
      link.download = doc.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Descargando documento...');
    }
  } catch (error) {
    toast.error('Error al descargar documento');
  }
};
```
✅ **Ahora:** Descarga directamente el archivo con el nombre original

---

### **3. Botones de Acción Separados** ← MEJORADO

#### **Antes (1 botón):**
```tsx
<button onClick={() => handleDownload(doc)}>
  <FaEye /> {/* Ojo - confuso */}
</button>
{!readOnly && (
  <button onClick={() => handleDelete(doc.id)}>
    <FaTrash />
  </button>
)}
```
❌ **Confuso:** Un solo botón para "ver/descargar"

#### **Ahora (3 botones claros):**
```tsx
<button 
  onClick={() => handlePreview(doc)}
  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
  title="Previsualizar"
>
  <FaEye size={14} />
</button>

<button 
  onClick={() => handleDownload(doc)}
  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
  title="Descargar"
>
  <FaDownload size={14} />
</button>

{!readOnly && (
  <button 
    onClick={() => handleDelete(doc.id)}
    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
    title="Eliminar"
  >
    <FaTrash size={14} />
  </button>
)}
```

✅ **Claro:** 
- 👁️ **Azul** = Previsualizar (abre modal)
- 📥 **Verde** = Descargar (descarga directa)
- 🗑️ **Rojo** = Eliminar (con confirmación)

---

## 🎨 Diseño del Modal de Previsualización

### **Header:**
```
┌─────────────────────────────────────────────────────────┐
│ 👁️ Previsualización                    📥 Descargar  ✕ │
│ nombre_archivo.pdf                                      │
└─────────────────────────────────────────────────────────┘
```

### **Para PDFs:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [iframe con el PDF completo]                          │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### **Para Imágenes:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              [Imagen a tamaño real]                     │
│           (centrada y responsive)                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### **Para Otros Archivos:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    📄                                    │
│     No se puede previsualizar este tipo de archivo     │
│                                                         │
│              [📥 Descargar Archivo]                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Usuario

### **1. Previsualizar Documento:**
```
1. Usuario ve documento en expediente
2. Click en botón 👁️ (azul)
3. Modal se abre con previsualización
4. Opciones en el modal:
   - Ver contenido (PDF/imagen)
   - Descargar desde modal
   - Cerrar modal
```

### **2. Descargar Documento:**
```
1. Usuario ve documento en expediente
2. Click en botón 📥 (verde)
3. Descarga directa automática
4. Toast: "Descargando documento..."
5. Archivo se guarda con nombre original
```

### **3. Eliminar Documento:**
```
1. Usuario ve documento en expediente
2. Click en botón 🗑️ (rojo)
3. Confirmación: "¿Estás seguro de eliminar este documento?"
4. Si confirma:
   - Se elimina de storage
   - Se elimina de base de datos
   - Se actualiza la lista
   - Toast: "Documento eliminado"
```

---

## 📱 Responsive Design

### **Desktop:**
- Modal previsualización: `max-w-5xl` (muy ancho para PDFs)
- Botones en fila horizontal
- iframe de PDF a pantalla completa

### **Mobile:**
- Modal previsualización: `w-full` con padding
- Botones en columna vertical
- iframe responsive con min-height

---

## 🎯 Tipos de Archivo Soportados

### **✅ Previsualización Completa:**
- **PDF** → iframe interno
- **JPG/JPEG** → imagen responsive
- **PNG** → imagen responsive
- **WEBP** → imagen responsive

### **⚠️ Solo Descarga:**
- **Otros formatos** → Mensaje + botón de descarga

---

## 🧪 Cómo Probar

### **1. Ir a Base de Datos:**
```
/db → Clientes → Expandir cliente → Expediente
```

### **2. Subir un Documento (si no hay):**
```
Click "Nuevo Documento"
Seleccionar tipo: CÉDULA/PASAPORTE
Subir archivo PDF o imagen
```

### **3. Probar Previsualización:**
```
Click botón 👁️ (azul) en el documento
✅ Debe abrir modal con el archivo visible
✅ Si es PDF: se ve el contenido
✅ Si es imagen: se ve la imagen
✅ Botón de descargar disponible en el modal
```

### **4. Probar Descarga:**
```
Click botón 📥 (verde) en el documento
✅ Debe iniciar descarga automática
✅ Archivo se descarga con nombre original
✅ Toast: "Descargando documento..."
```

### **5. Probar Eliminación:**
```
Click botón 🗑️ (rojo) en el documento
✅ Debe mostrar confirmación
✅ Si confirma: documento desaparece
✅ Toast: "Documento eliminado"
```

---

## 🔐 Permisos

### **Todos los Usuarios:**
- ✅ Ver expediente
- ✅ Previsualizar documentos
- ✅ Descargar documentos

### **Solo Master (o no readOnly):**
- ✅ Subir documentos
- ✅ Eliminar documentos

### **Broker (readOnly=true):**
- ✅ Ver y previsualizar
- ❌ No puede eliminar

---

## 🎨 Colores y Estilos

### **Botones de Acción:**
```css
/* Previsualizar */
text-blue-600 hover:bg-blue-50

/* Descargar */
text-green-600 hover:bg-green-50

/* Eliminar */
text-red-600 hover:bg-red-50
```

### **Modal:**
```css
/* Backdrop */
bg-black/80 backdrop-blur-sm z-[60]

/* Header */
bg-gradient-to-r from-[#010139] to-[#020270]

/* Contenido */
bg-gray-100 p-4 overflow-auto
```

---

## 📊 Diferencias Antes vs Ahora

### **Antes (Confuso):**
| Acción | Resultado |
|--------|-----------|
| Click ojo 👁️ | Abre en nueva pestaña (no previsualiza) |
| Descargar | No había botón específico |
| Eliminar | Botón existía pero poco claro |

### **Ahora (Claro):**
| Acción | Resultado |
|--------|-----------|
| Click ojo 👁️ | Abre modal con previsualización DENTRO de la app |
| Click descarga 📥 | Descarga directa con nombre original |
| Click eliminar 🗑️ | Confirmación + eliminación + feedback |

---

## ✅ Funcionalidades Agregadas

1. ✅ **Modal de previsualización** completo con:
   - iframe para PDFs
   - viewer para imágenes
   - mensaje para archivos no soportados
   - botón de descarga en el modal

2. ✅ **Descarga directa** forzada:
   - Crea elemento `<a>` temporal
   - Descarga con nombre original
   - Feedback visual (toast)

3. ✅ **Botones separados** con iconos claros:
   - Azul = Ver
   - Verde = Descargar
   - Rojo = Eliminar

4. ✅ **Loading states**:
   - Spinner durante carga de previsualización
   - Botones deshabilitados mientras cargan

5. ✅ **Responsive**:
   - Modal adaptable a mobile/desktop
   - Botones en columna/fila según pantalla

---

## 🎉 Resultado Final

### **Usuario puede ahora:**
- ✅ **Previsualizar** PDFs e imágenes sin salir de la aplicación
- ✅ **Descargar** archivos con un solo click
- ✅ **Eliminar** documentos con confirmación clara
- ✅ Ver feedback visual en cada acción
- ✅ Usar en móvil y desktop sin problemas

---

**Última actualización:** Nov 18, 2025, 4:25pm  
**Estado:** ✅ Completado y funcionando  
**Archivo modificado:** `src/components/expediente/ExpedienteManager.tsx`  
**Líneas añadidas:** ~130 (modal + funciones mejoradas)  
**Botones:** 3 acciones claras (Ver, Descargar, Eliminar)
