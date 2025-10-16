# Configuración del Bucket "avatar" en Supabase Storage

## Problema
El sistema de fotos de perfil requiere un bucket de storage llamado "avatar" en Supabase, pero puede no estar configurado correctamente.

## Pasos para configurar el bucket

### 1. Crear el Bucket

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **Storage** en el menú lateral
3. Click en **"New bucket"**
4. Nombre del bucket: `avatar`
5. Marca como **Public** (para que las fotos sean accesibles públicamente)
6. Click en **"Create bucket"**

### 2. Configurar las Políticas de Seguridad (RLS Policies)

El bucket necesita las siguientes políticas:

#### Política 1: Permitir subida de archivos (INSERT)
```sql
-- Nombre: "Users can upload their own avatar"
-- Operation: INSERT
-- Policy:
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Política 2: Permitir actualización de archivos (UPDATE)
```sql
-- Nombre: "Users can update their own avatar"
-- Operation: UPDATE
-- Policy:
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Política 3: Permitir eliminación de archivos (DELETE)
```sql
-- Nombre: "Users can delete their own avatar"
-- Operation: DELETE
-- Policy:
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Política 4: Permitir lectura pública (SELECT)
```sql
-- Nombre: "Public can view avatars"
-- Operation: SELECT
-- Policy:
CREATE POLICY "Public can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatar');
```

### Alternativa simplificada (Si las políticas anteriores fallan)

Si las políticas anteriores no funcionan, puedes usar estas más simples:

```sql
-- INSERT: Usuarios autenticados pueden subir a su carpeta
CREATE POLICY "Users upload avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatar');

-- UPDATE: Usuarios autenticados pueden actualizar
CREATE POLICY "Users update avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatar');

-- DELETE: Usuarios autenticados pueden eliminar
CREATE POLICY "Users delete avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatar');

-- SELECT: Todos pueden leer
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatar');
```

### 3. Configurar el Bucket como Público

1. En la lista de buckets, encuentra "avatar"
2. Click en el menú de 3 puntos (...)
3. Selecciona **"Make public"**
4. Confirma la acción

### 4. Verificar la configuración

Para verificar que todo funciona:

1. Ve a `/account` en tu aplicación
2. Abre la consola del navegador (F12)
3. Intenta subir una foto de perfil
4. Revisa los logs en la consola:
   - Si ves "🔄 Subiendo avatar..." → El proceso inició
   - Si ves "✅ Upload exitoso" → El archivo se subió correctamente
   - Si ves "❌ Error de upload" → Revisa el mensaje de error

### Errores Comunes

#### Error: "Bucket not found"
- **Solución**: El bucket "avatar" no existe. Créalo siguiendo el paso 1.

#### Error: "new row violates row-level security policy"
- **Solución**: Las políticas RLS no están configuradas. Añade las políticas del paso 2.

#### Error: "The resource already exists"
- **Solución**: El archivo ya existe. El código usa `upsert: true` para sobrescribir.

### 5. Estructura de archivos

Los avatares se guardan con el siguiente formato:
```
avatar/
  ├── {user_id}_{timestamp}.jpg
  ├── {user_id}_{timestamp}.png
  └── ...
```

Donde:
- `{user_id}` = ID del usuario en la tabla profiles
- `{timestamp}` = Unix timestamp para evitar conflictos de caché

### 6. Configuración adicional (Opcional)

Para mejorar el rendimiento, puedes configurar:

1. **Transformaciones de imagen**: Ya incluidas en el código con:
   - width: 300px
   - height: 300px
   - quality: 80

2. **Límites de archivo**:
   - Tamaño máximo: 2MB (configurado en el código)
   - Tipos permitidos: image/* (jpg, png, gif, webp, etc.)

## Verificación Final

Después de configurar todo, prueba:

1. ✅ Subir una foto nueva
2. ✅ Ver la foto en el perfil
3. ✅ Cambiar la foto (debe eliminar la anterior)
4. ✅ Eliminar la foto
5. ✅ Recargar la página (la foto debe persistir)

## Logs Detallados

El código incluye logs detallados en la consola:

```
🔄 Subiendo avatar: { fileName, fileSize, fileType, userId }
🗑️ Eliminando avatar anterior: oldFileName
📤 Iniciando upload a bucket "avatar"...
✅ Upload exitoso: uploadData
🔗 Public URL generada: publicUrl
✅ Perfil actualizado en BD
🔄 Recargando perfil...
✅ Proceso completo exitoso
```

Si algo falla, busca el log con el emoji ❌ para ver el error específico.
