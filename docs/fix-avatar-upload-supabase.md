# 🔧 Fix: Sistema de Avatares en Supabase

## 📋 Problema Reportado
La foto de perfil no se estaba actualizando ni guardando en el storage de Supabase.

---

## 🐛 Problemas Encontrados

### **1. Nombre Incorrecto del Bucket**
**Antes:** Usaba `'avatars'` (plural)  
**Después:** Cambiado a `'avatar'` (singular)

```typescript
// ANTES
.from('avatars')

// DESPUÉS
.from('avatar')
```

### **2. Faltaba Opción de Upsert**
El código original no sobrescribía archivos existentes, causando errores de duplicados.

```typescript
// ANTES
.upload(filePath, file);

// DESPUÉS
.upload(filePath, file, {
  cacheControl: '3600',
  upsert: true  // ← Sobrescribe archivos existentes
});
```

### **3. No Validaba Archivos**
No había validación de tamaño ni tipo de archivo.

### **4. Manejo Pobre de Errores**
No había logs de debugging ni mensajes claros de error.

### **5. Estructura de Nombres Compleja**
Usaba timestamps innecesarios que generaban muchos archivos.

---

## ✅ Mejoras Implementadas

### **1. Validación de Archivos**

```typescript
// Validar tamaño máximo: 2MB
if (file.size > 2 * 1024 * 1024) {
  setError("El archivo es muy grande. Máximo 2MB");
  return;
}

// Validar tipo de archivo
if (!file.type.startsWith('image/')) {
  setError("Solo se permiten imágenes");
  return;
}
```

### **2. Nombre de Archivo Simplificado**

**Antes:** `{user_id}_{timestamp}.{ext}` → Múltiples archivos por usuario  
**Después:** `{user_id}.{ext}` → Un solo archivo por usuario

```typescript
const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
const fileName = `${user.id}.${fileExt}`;
```

### **3. Limpieza de Archivos Antiguos**

```typescript
// Eliminar avatar anterior antes de subir nuevo
if (avatarUrl) {
  const oldPath = avatarUrl.split('/').pop();
  if (oldPath) {
    await supabase.storage
      .from('avatar')
      .remove([oldPath]);
  }
}
```

### **4. Upload con Upsert**

```typescript
const { error: uploadError, data: uploadData } = await supabase.storage
  .from('avatar')
  .upload(filePath, file, {
    cacheControl: '3600',
    upsert: true  // ← Sobrescribe si existe
  });
```

### **5. Logging de Debugging**

```typescript
console.log('Subiendo avatar:', { 
  fileName, 
  fileSize: file.size, 
  fileType: file.type 
});

if (uploadError) {
  console.error('Error de upload:', uploadError);
}

console.log('Upload exitoso:', uploadData);
console.log('Public URL:', publicUrl);
```

### **6. Recarga Automática del Perfil**

```typescript
// Después de actualizar, recargar perfil
await loadProfile();
```

### **7. Mensajes de Usuario Mejorados**

```typescript
setSuccess("✅ Foto de perfil actualizada correctamente");
```

### **8. Reset del Input File**

```typescript
// Limpiar input para permitir re-selección del mismo archivo
e.target.value = '';
```

---

## 🗄️ Configuración de Supabase Storage

### **Paso 1: Crear el Bucket**

1. Ve a **Storage** en Supabase Dashboard
2. Click en **"New bucket"**
3. Configuración:
   - **Name:** `avatar`
   - **Public:** ✅ Sí (para que las URLs sean públicas)
   - **File size limit:** 2 MB
   - **Allowed MIME types:** `image/*`

### **Paso 2: Configurar Políticas RLS (Row Level Security)**

Ejecuta estos SQL statements en el SQL Editor de Supabase:

```sql
-- Política para UPLOAD (subida)
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para UPDATE (actualización)
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatar' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para DELETE (eliminación)
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política para SELECT (lectura pública)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatar');
```

### **Paso 3: Verificar Configuración**

Prueba subir un archivo manualmente:
1. Ve a Storage > avatar
2. Click "Upload file"
3. Sube una imagen de prueba
4. Verifica que se puede ver la URL pública

---

## 🔧 Estructura de Archivos en Storage

```
avatar/
├── 00000000-0000-0000-0000-000000000001.jpg  ← Usuario 1
├── 00000000-0000-0000-0000-000000000002.png  ← Usuario 2
├── 00000000-0000-0000-0000-000000000003.jpg  ← Usuario 3
└── ...
```

**Ventajas de esta estructura:**
- ✅ Un solo archivo por usuario (ahorra espacio)
- ✅ Fácil de encontrar (nombre = user ID)
- ✅ Upsert automático (sobrescribe)
- ✅ No acumula archivos viejos

---

## 🔄 Flujo Completo

```
Usuario selecciona imagen
         ↓
Validar tamaño (< 2MB) y tipo (image/*)
         ↓
Obtener user.id del usuario autenticado
         ↓
Generar fileName: {user_id}.{ext}
         ↓
Eliminar avatar anterior (si existe)
         ↓
Upload con upsert=true a bucket 'avatar'
         ↓
Obtener publicUrl del archivo
         ↓
Actualizar profiles.avatar_url en BD
         ↓
Recargar perfil para mostrar nuevo avatar
         ↓
✅ Mostrar mensaje de éxito
```

---

## 🚨 Solución de Problemas

### **Error: "new row violates row-level security policy"**
**Causa:** Las políticas RLS no están configuradas  
**Solución:** Ejecutar los SQL statements del Paso 2

### **Error: "Bucket not found"**
**Causa:** El bucket 'avatar' no existe  
**Solución:** Crear el bucket siguiendo el Paso 1

### **Error: "The resource already exists"**
**Causa:** El archivo ya existe y upsert no está habilitado  
**Solución:** Ya está corregido con `upsert: true`

### **Error: "File size exceeds limit"**
**Causa:** Archivo mayor a 2MB  
**Solución:** Validación del lado del cliente ya implementada

### **Avatar no se muestra después de subir**
**Causa:** URL pública mal formada o permisos incorrectos  
**Solución:** 
1. Verificar que el bucket sea público
2. Verificar política de SELECT
3. Revisar console.log para ver la URL generada

### **Avatar se sube pero no actualiza la UI**
**Causa:** Falta recarga del perfil  
**Solución:** Ya está corregido con `await loadProfile()`

---

## 📱 Archivos Modificados

**Archivo:** `src/app/(app)/account/page.tsx`

**Funciones modificadas:**
1. `handleAvatarUpload` (líneas 159-245)
   - Validación de tamaño y tipo
   - Bucket correcto: 'avatar'
   - Upsert habilitado
   - Logging de debugging
   - Recarga de perfil

2. `handleRemoveAvatar` (líneas 247-292)
   - Bucket correcto: 'avatar'
   - Eliminación del storage
   - Recarga de perfil

---

## ✅ Testing Checklist

Después de configurar Supabase, probar:

- [ ] Subir una imagen nueva (primera vez)
- [ ] Subir una imagen diferente (sobrescribir)
- [ ] Subir archivo muy grande (debe mostrar error)
- [ ] Subir archivo no-imagen (debe mostrar error)
- [ ] Eliminar avatar
- [ ] Verificar que el archivo se elimina del storage
- [ ] Verificar que la UI se actualiza inmediatamente
- [ ] Verificar que el avatar persiste después de recargar página
- [ ] Probar con diferentes formatos (jpg, png, webp)

---

## 🎯 Resultado Esperado

1. ✅ Usuario sube imagen → Aparece inmediatamente
2. ✅ Solo un archivo por usuario en storage
3. ✅ Mensajes claros de éxito/error
4. ✅ Validación de tamaño y tipo
5. ✅ Logs en consola para debugging
6. ✅ Avatar persiste entre sesiones

---

**Fecha:** 2025-10-09  
**Desarrollado por:** Portal Líderes en Seguros  
**Estado:** ✅ Código corregido - Requiere configuración de Supabase
