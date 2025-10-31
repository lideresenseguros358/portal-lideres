# 🔍 ANÁLISIS: Inspección Vehicular con Fotos - INTERNACIONAL

**Fecha:** Octubre 31, 2025  
**Estado:** ⚠️ NO IMPLEMENTADO - Requiere Información

---

## 🎯 SITUACIÓN ACTUAL

### ✅ LO QUE TENEMOS:

**Componente de Inspección:**
- `/components/cotizadores/VehicleInspection.tsx`
- Captura 10 fotos del vehículo:
  1. Vista Frontal
  2. Vista Trasera
  3. Lateral Izquierdo
  4. Lateral Derecho
  5. Registro Vehicular
  6. Motor Abierto
  7. Asientos
  8. Kilometraje
  9. Llave del Vehículo
  10. Tablero

**Formato de captura:**
```typescript
interface InspectionPhoto {
  id: string;          // Ej: 'frontal', 'trasera'
  name: string;        // Ej: 'Vista Frontal'
  file: File;          // Archivo de imagen
  preview: string;     // Base64 para preview
}
```

**Flujo ACTUAL de emisión:**
```
Step 1: Seleccionar plan de pago
  ↓
Step 2: Completar datos de emisión
  ↓
Step 3: Capturar fotos de inspección ← AQUÍ SE CAPTURAN
  ↓
Step 4: Información de pago (tarjeta)
  ↓
Step 5: Revisar y confirmar
  ↓
Step 6: Emitir póliza
```

---

## ❌ EL PROBLEMA

**Las fotos NO se envían a INTERNACIONAL:**

En `/app/cotizadores/emitir/page.tsx` líneas 107-129:
```typescript
// Emisión con API de INTERNACIONAL
const emisionResponse = await fetch('/api/is/auto/emitir', {
  body: JSON.stringify({
    vIdPv: selectedPlan._idCotizacion,
    vnrodoc: emissionData?.cedula,
    // ... otros datos
    paymentToken,
    // ❌ NO SE ENVÍAN LAS FOTOS
  }),
});
```

**Las fotos se capturan pero se guardan solo en estado local:**
```typescript
const [inspectionPhotos, setInspectionPhotos] = useState<any[]>([]);
// ↑ Nunca se usan en la emisión
```

---

## ❓ PREGUNTAS CRÍTICAS

### 1. ¿INTERNACIONAL tiene API para subir fotos?

**Posibles escenarios:**

**A. SÍ tienen API de upload:**
```
POST /api/upload/documentos
{
  idCotizacion: "xxx",
  tipo: "inspeccion_vehicular",
  fotos: [
    { tipo: "frontal", archivo: base64 },
    { tipo: "trasera", archivo: base64 },
    ...
  ]
}
```

**B. Las fotos se envían en la emisión:**
```
POST /api/cotizaemisorauto/getemision
{
  vIdPv: "xxx",
  // ... otros datos
  fotos: [base64Array]
}
```

**C. NO tienen API - Manual:**
- Las fotos se guardan solo en nuestro sistema
- INTERNACIONAL las solicita por email/portal
- Proceso manual posterior

---

### 2. ¿En qué formato aceptan las fotos?

**Opciones:**
- Base64 en JSON
- FormData multipart/form-data
- URLs de archivos subidos previamente
- Formato propietario de IS

---

### 3. ¿Cuándo se deben subir?

**Opciones:**
- **Antes de cotizar** (para validar condición del vehículo)
- **Antes de emitir** (durante el flujo de emisión)
- **Después de emitir** (como anexo a la póliza)

---

## 🔍 LO QUE NECESITAMOS VERIFICAR

### PASO 1: Revisar documentación de IS

**Buscar en la documentación:**
- ¿Existe endpoint de upload de fotos/documentos?
- ¿Qué formato acepta?
- ¿Qué campos son requeridos?
- ¿Hay límite de tamaño/cantidad?
- ¿Retorna algún ID de referencia?

---

### PASO 2: Consultar con INTERNACIONAL

**Preguntas específicas:**

1. **¿Tienen API para subir fotos de inspección vehicular?**
   - Sí / No

2. **Si SÍ, ¿cuál es el endpoint?**
   - URL completa
   - Método (POST, PUT)

3. **¿Qué formato de datos acepta?**
   - JSON con base64
   - FormData multipart
   - Otro

4. **¿Cuándo se deben subir las fotos?**
   - Antes de cotizar
   - Antes de emitir
   - Después de emitir

5. **¿Qué datos adicionales requiere cada foto?**
   - ID de cotización
   - Tipo de foto (frontal, trasera, etc.)
   - Marca/modelo del vehículo
   - Otros metadatos

6. **¿Hay validaciones?**
   - Tamaño máximo por foto
   - Cantidad máxima de fotos
   - Formatos permitidos (JPG, PNG, HEIC)

7. **¿Retorna algún ID o confirmación?**
   - ID de documento
   - URL de acceso
   - Confirmación de recepción

---

## 📋 IMPLEMENTACIONES POSIBLES

### ESCENARIO A: IS tiene API de Upload

**Si INTERNACIONAL tiene API para subir fotos:**

#### 1. Crear servicio de upload

**Archivo:** `/lib/is/upload.service.ts`

```typescript
export interface UploadFotoRequest {
  idCotizacion: string;
  tipoFoto: string; // 'frontal', 'trasera', etc.
  archivo: string;  // Base64
  nombreArchivo: string;
}

export async function subirFotoInspeccion(
  request: UploadFotoRequest,
  env: ISEnvironment
): Promise<{ success: boolean; idDocumento?: string; error?: string }> {
  // TODO: Usar endpoint real de IS
  const response = await isPost(
    '/api/upload/inspeccion', // Endpoint a confirmar
    {
      id_cotizacion: request.idCotizacion,
      tipo_documento: 'INSPECCION_VEHICULAR',
      tipo_foto: request.tipoFoto,
      archivo_base64: request.archivo,
      nombre_archivo: request.nombreArchivo,
    },
    env
  );
  
  return {
    success: response.success,
    idDocumento: response.data?.id_documento,
    error: response.error,
  };
}
```

#### 2. Modificar flujo de emisión

**En `/app/cotizadores/emitir/page.tsx`:**

```typescript
const handleConfirmEmission = async () => {
  // 1. Subir fotos ANTES de emitir
  toast.loading('Subiendo fotos de inspección...');
  
  const uploadPromises = inspectionPhotos.map(async (photo) => {
    // Convertir File a Base64
    const base64 = await fileToBase64(photo.file);
    
    return subirFotoInspeccion({
      idCotizacion: selectedPlan._idCotizacion,
      tipoFoto: photo.id,
      archivo: base64,
      nombreArchivo: photo.file.name,
    });
  });
  
  const uploadResults = await Promise.all(uploadPromises);
  
  const failed = uploadResults.filter(r => !r.success);
  if (failed.length > 0) {
    toast.error(`Error subiendo ${failed.length} foto(s)`);
    return;
  }
  
  toast.success('Fotos subidas correctamente');
  
  // 2. Emitir póliza normalmente
  const emisionResponse = await fetch('/api/is/auto/emitir', {
    // ... resto del código
  });
};
```

#### 3. Crear endpoint API

**Archivo:** `/app/api/is/upload/inspeccion/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const {
    idCotizacion,
    tipoFoto,
    archivoBase64,
    nombreArchivo,
    environment = 'development',
  } = body;
  
  // Validaciones
  if (!idCotizacion || !archivoBase64) {
    return NextResponse.json(
      { success: false, error: 'Faltan datos requeridos' },
      { status: 400 }
    );
  }
  
  // Subir a API de IS
  const result = await subirFotoInspeccion({
    idCotizacion,
    tipoFoto,
    archivo: archivoBase64,
    nombreArchivo,
  }, environment);
  
  return NextResponse.json(result);
}
```

---

### ESCENARIO B: NO tienen API - Guardar en Supabase

**Si INTERNACIONAL NO tiene API, guardamos en nuestro sistema:**

#### 1. Guardar en Supabase Storage

```typescript
import { supabaseClient } from '@/lib/supabase/client';

async function guardarFotosInspeccion(
  policyId: string,
  fotos: InspectionPhoto[]
): Promise<string[]> {
  const uploadedUrls: string[] = [];
  
  for (const foto of fotos) {
    const fileName = `${policyId}/${foto.id}-${Date.now()}.jpg`;
    
    // Subir a Supabase Storage
    const { data, error } = await supabaseClient
      .storage
      .from('inspection-photos')
      .upload(fileName, foto.file, {
        contentType: 'image/jpeg',
      });
    
    if (error) {
      console.error(`Error subiendo ${foto.name}:`, error);
      continue;
    }
    
    // Obtener URL pública
    const { data: urlData } = supabaseClient
      .storage
      .from('inspection-photos')
      .getPublicUrl(fileName);
    
    uploadedUrls.push(urlData.publicUrl);
  }
  
  return uploadedUrls;
}
```

#### 2. Guardar referencias en BD

```typescript
// Crear tabla inspection_photos
await supabase
  .from('inspection_photos')
  .insert({
    policy_id: policyId,
    photo_type: foto.id,
    photo_url: url,
    uploaded_at: new Date().toISOString(),
  });
```

#### 3. Enviar por email a IS

```typescript
// Generar email con enlaces
const emailBody = `
  Inspección vehicular para póliza ${policyNumber}:
  
  Fotos disponibles en:
  ${uploadedUrls.map(url => `- ${url}`).join('\n')}
`;

// Enviar via Zoho o servicio de email
```

---

## 🔄 FLUJO PROPUESTO

### OPCIÓN 1: Con API de IS

```
Usuario captura 10 fotos
  ↓ (guardan en estado local)
Usuario confirma emisión
  ↓
LOOP: Por cada foto
  ├─ Convertir a Base64
  ├─ POST /api/is/upload/inspeccion
  └─ Retorna: { idDocumento }
  ↓
POST /api/is/auto/emitir
  ├─ vIdPv
  ├─ ...otros datos
  └─ idsDocumentos: [id1, id2, ..., id10]
  ↓
✅ Póliza emitida con fotos vinculadas
```

---

### OPCIÓN 2: Sin API de IS

```
Usuario captura 10 fotos
  ↓
Usuario confirma emisión
  ↓
POST /api/is/auto/emitir (sin fotos)
  ↓
✅ Póliza emitida → Retorna policyId
  ↓
LOOP: Por cada foto
  ├─ Upload a Supabase Storage
  ├─ INSERT en tabla inspection_photos
  └─ Retorna: URL pública
  ↓
Enviar email a IS con URLs
  ↓
✅ Fotos disponibles para revisión manual
```

---

## 📊 COMPARACIÓN

| Aspecto | Con API de IS | Sin API de IS |
|---------|--------------|---------------|
| Integración | ✅ Directa | ⚠️ Manual |
| Velocidad | ✅ Automática | ⏳ Requiere revisión |
| Validación | ✅ Inmediata | ❌ Posterior |
| Almacenamiento | ✅ En IS | ⚠️ En Supabase |
| Mantenimiento | ✅ Simple | ⚠️ Complejo |

---

## ✅ RECOMENDACIONES

### PRIORIDAD ALTA:

1. **Contactar a INTERNACIONAL**
   - Preguntar si tienen API de upload
   - Solicitar documentación

2. **Si tienen API:**
   - Implementar servicio de upload
   - Modificar flujo de emisión
   - Probar con fotos reales

3. **Si NO tienen API:**
   - Guardar en Supabase
   - Crear proceso de envío manual
   - Documentar workflow

---

## 🚀 PRÓXIMOS PASOS

1. ✅ Analizar componente de inspección actual
2. ⏳ **Contactar a INTERNACIONAL** - Preguntar sobre API de fotos
3. ⏳ **Obtener documentación** - Si existe el endpoint
4. ⏳ **Implementar integración** - Según respuesta
5. ⏳ **Probar flujo completo** - Con fotos reales

---

## 📝 PREGUNTAS PARA INTERNACIONAL

**Enviar este email a INTERNACIONAL:**

```
Asunto: Consulta - API de Upload de Fotos de Inspección Vehicular

Estimados,

Estamos integrando su API de cotización y emisión de seguros auto 
(cobertura completa) y necesitamos confirmar el proceso para las 
fotos de inspección vehicular.

Preguntas:

1. ¿Tienen un endpoint API para subir fotos de inspección?
   - Si es así, ¿cuál es el endpoint?

2. ¿En qué momento del flujo se deben subir?
   - Antes de cotizar
   - Antes de emitir
   - Después de emitir

3. ¿Qué formato de datos acepta?
   - Base64 en JSON
   - FormData multipart
   - Otro

4. ¿Qué información adicional se requiere por foto?
   - ID de cotización
   - Tipo de foto (frontal, trasera, etc.)
   - Otros metadatos

5. ¿Hay límites técnicos?
   - Tamaño máximo por foto
   - Cantidad máxima de fotos
   - Formatos permitidos

Adjunto lista de las 10 fotos que capturamos:
- Vista Frontal
- Vista Trasera
- Lateral Izquierdo
- Lateral Derecho
- Registro Vehicular
- Motor Abierto
- Asientos
- Kilometraje
- Llave del Vehículo
- Tablero

Agradecemos su pronta respuesta.
```

---

## 🎯 CONCLUSIÓN

**Estado Actual:** ⚠️ Las fotos se capturan pero NO se envían a INTERNACIONAL

**Acción Requerida:** Contactar a INTERNACIONAL para confirmar:
- ¿Tienen API de upload?
- ¿Cómo funciona?

**Tiempo de implementación:**
- Con API de IS: 2-3 horas
- Sin API de IS: 3-4 horas

**Estado:** ⏳ ESPERANDO INFORMACIÓN DE INTERNACIONAL
