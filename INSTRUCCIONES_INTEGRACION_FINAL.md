# 📝 INSTRUCCIONES PARA INTEGRACIÓN FINAL (5% restante)

## Estado Actual: 95% Completado

Todo el backend y componentes están listos. Solo falta conectar el componente `CaseProgressBar` en las vistas.

---

## 🎯 OPCIÓN 1: Integración Completa con Progreso Real

### Paso 1: Actualizar CasesMainClient para cargar progreso

**Archivo:** `src/components/cases/CasesMainClient.tsx`

```typescript
// Agregar al fetch de casos:
const { data: casesData } = await actionGetCases(filters);

// Luego cargar progreso para cada caso (en paralelo):
const casesWithProgress = await Promise.all(
  casesData.map(async (caseItem) => {
    const progressRes = await fetch(`/api/cases/progress?case_id=${caseItem.id}`);
    const progressData = await progressRes.json();
    return {
      ...caseItem,
      progress: progressData.progress,
    };
  })
);

setCases(casesWithProgress);
```

### Paso 2: Actualizar CasesList para usar CaseProgressBar

**Archivo:** `src/components/cases/CasesList.tsx`

```typescript
// En el import:
import CaseProgressBar from './CaseProgressBar';

// Reemplazar líneas 262-277 (la barra de progreso actual) con:
{caseItem.progress ? (
  <CaseProgressBar
    caseId={caseItem.id}
    progress={caseItem.progress}
    variant="compact"
    editable={userRole === 'master'}
    onProgressUpdate={onRefresh}
  />
) : (
  // Fallback si no hay progreso configurado
  <div className="text-xs text-gray-500">
    Sin progreso configurado
  </div>
)}
```

### Paso 3: Integrar en Detalle de Caso

**Archivo:** `src/components/cases/CaseDetailClient.tsx`

```typescript
// Agregar estado:
const [progress, setProgress] = useState(null);

// En useEffect, cargar progreso:
useEffect(() => {
  const loadProgress = async () => {
    const res = await fetch(`/api/cases/progress?case_id=${caseId}`);
    const data = await res.json();
    if (data.success) {
      setProgress(data.progress);
    }
  };
  loadProgress();
}, [caseId]);

// Agregar sección de progreso ANTES del checklist:
{progress && (
  <div className="mb-6">
    <CaseProgressBar
      caseId={caseId}
      progress={progress}
      variant="full"
      editable={userProfile.role === 'master'}
      onProgressUpdate={() => {
        // Recargar progreso
        loadProgress();
      }}
    />
  </div>
)}
```

---

## 🎯 OPCIÓN 2: Mantener Progreso Simplificado (Recomendado inicialmente)

Si prefieres mantener el sistema actual más simple y agregar el progreso detallado después:

### Dejar CasesList como está
- La barra actual funciona bien basada en estados
- Es más simple y no requiere queries adicionales

### Solo agregar progreso detallado en el detalle del caso
- Cuando el usuario hace click en "Ver Detalle"
- Ahí mostrar el progreso completo con pasos configurables

**Archivo:** `src/components/cases/CaseDetailClient.tsx`

Agregar solo en la vista de detalle:

```typescript
// Importar
import CaseProgressBar from './CaseProgressBar';
import { useState, useEffect } from 'react';

// Cargar progreso
const [progress, setProgress] = useState(null);

useEffect(() => {
  const loadProgress = async () => {
    try {
      const res = await fetch(`/api/cases/progress?case_id=${caseId}`);
      const data = await res.json();
      if (data.success && data.progress) {
        setProgress(data.progress);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };
  loadProgress();
}, [caseId]);

// Mostrar (buscar donde está el checklist y agregar ANTES):
<div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 mb-6">
  <h2 className="text-xl font-bold text-[#010139] mb-4">
    Progreso del Trámite
  </h2>
  {progress ? (
    <CaseProgressBar
      caseId={caseId}
      progress={progress}
      variant="full"
      editable={userProfile.role === 'master'}
      onProgressUpdate={() => loadProgress()}
    />
  ) : (
    <div className="text-center py-8 text-gray-500">
      <p>Sin configuración de pasos para este tipo de trámite</p>
      <p className="text-xs mt-2">
        Master puede configurar pasos en /config
      </p>
    </div>
  )}
</div>
```

---

## 📋 Botón Descargar Formularios en Checklist

**Archivo:** `src/components/cases/CaseDetailClient.tsx`

En la sección donde se muestra el checklist, modificar para agregar botón de descarga:

```typescript
// Cargar requisitos configurados (hacer esto una vez al inicio):
const [requirements, setRequirements] = useState([]);

useEffect(() => {
  const loadRequirements = async () => {
    if (!caseData?.policy_type) return;
    
    const res = await fetch(
      `/api/config/requirements?ramo=${caseData.policy_type}`
    );
    const data = await res.json();
    if (data.success) {
      setRequirements(data.requirements);
    }
  };
  loadRequirements();
}, [caseData?.policy_type]);

// En cada item del checklist, buscar si tiene formulario vinculado:
{checklistItems.map((item) => {
  const requirement = requirements.find(
    req => req.standard_name === item.standardName
  );
  
  return (
    <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <input
        type="checkbox"
        checked={item.completed}
        onChange={() => handleToggleChecklistItem(item.id)}
        className="mt-1 w-5 h-5 text-[#8AAA19]"
      />
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{item.label}</span>
          
          {/* Badge de tipo */}
          {requirement && (
            <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
              requirement.requirement_type === 'DOCUMENTO'
                ? 'bg-green-100 text-green-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              {requirement.requirement_type === 'DOCUMENTO' ? '📄' : '📋'}
            </span>
          )}
          
          {item.required && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
              Obligatorio
            </span>
          )}
        </div>
        
        {/* Botón descargar si es FORMULARIO vinculado */}
        {requirement?.requirement_type === 'FORMULARIO' && 
         requirement?.linked_download_file && (
          <button
            onClick={() => handleDownloadForm(requirement.linked_download_file)}
            className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-semibold flex items-center gap-1"
          >
            📋 Descargar formulario
          </button>
        )}
      </div>
    </div>
  );
})}

// Función para descargar:
const handleDownloadForm = async (fileId: string) => {
  try {
    // Obtener URL del archivo
    const res = await fetch(`/api/downloads/files/${fileId}`);
    const data = await res.json();
    if (data.success && data.file_url) {
      window.open(data.file_url, '_blank');
      toast.success('Abriendo formulario...');
    }
  } catch (error) {
    toast.error('Error al descargar formulario');
  }
};
```

---

## 🎯 RECOMENDACIÓN

**Para completar rápido (30 min):**

1. ✅ Agregar progreso detallado SOLO en vista de detalle de caso
   - Más simple
   - No requiere modificar queries existentes
   - Usuario lo ve cuando hace click en "Ver Detalle"

2. ✅ Agregar badges y botón descargar en checklist
   - Mejora UX inmediatamente
   - Broker ve claramente qué es DOCUMENTO vs FORMULARIO
   - Puede descargar formularios directamente

**Para implementación completa futura:**

3. ⏳ Agregar progreso en lista de casos (requiere más cambios)
   - Requiere modificar fetch de casos
   - Agregar queries de progreso
   - Más complejo pero más visual

---

## ✅ ARCHIVOS A MODIFICAR

**Mínimo (Opción 2):**
1. `src/components/cases/CaseDetailClient.tsx` - Agregar CaseProgressBar variant="full"
2. `src/components/cases/CaseDetailClient.tsx` - Agregar botones descargar formularios

**Completo (Opción 1):**
1. `src/components/cases/CasesMainClient.tsx` - Cargar progreso en query
2. `src/components/cases/CasesList.tsx` - Usar CaseProgressBar variant="compact"
3. `src/components/cases/CaseDetailClient.tsx` - Usar CaseProgressBar variant="full"
4. `src/components/cases/CaseDetailClient.tsx` - Agregar botones descargar formularios

---

## 📊 RESULTADO ESPERADO

**Con Opción 2 (Mínimo):**

**Vista Detalle:**
```
┌─────────────────────────────────────────┐
│ Progreso del Trámite                    │
│                                          │
│ [■■■■□] 4/5 pasos • 80% completado     │
│ Paso actual: Emisión en aseguradora     │
│ En proceso desde hace 2 días            │
│                                          │
│ ← Anterior  |  Siguiente → (Master)     │
└─────────────────────────────────────────┘

Documentos requeridos:
□ 📄 Cédula del asegurado (DOCUMENTO)
□ 📋 Formulario AUTO [📋 Descargar formulario]
□ 📄 Fotos de inspección (DOCUMENTO)
```

**Con Opción 1 (Completo):**

**Vista Lista:**
```
┌────────────────────────────────────┐
│ Cliente: Juan Pérez                │
│ ASSA • EMISION                     │
│ [■■■■□] 4/5 pasos                 │
│ Emisión en aseguradora             │
└────────────────────────────────────┘
```

---

## 🚀 ESTADO FINAL

**Ya implementado (95%):**
- ✅ Sistema tipos requisitos
- ✅ APIs completas
- ✅ Componente CaseProgressBar
- ✅ Inicialización automática
- ✅ Base de datos lista

**Falta implementar (5%):**
- ⏳ Integrar CaseProgressBar en vistas (copiar/pegar código de arriba)
- ⏳ Botones descargar formularios (copiar/pegar código de arriba)

**Tiempo estimado:** 15-30 minutos de copiar/pegar e integrar.

El sistema está funcional y listo. Solo falta la integración visual final.
