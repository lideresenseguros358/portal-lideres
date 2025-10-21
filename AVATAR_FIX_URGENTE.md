# 🚨 SOLUCIÓN URGENTE: Foto de Perfil No Se Guarda

## Problema Identificado

La foto de perfil no se está guardando porque:
1. ❌ El bucket `avatar` NO está creado en Supabase Storage
2. ❌ Las políticas RLS (Row Level Security) NO están configuradas
3. ❌ Sin políticas, Supabase bloquea cualquier intento de subir archivos

## Solución Inmediata

### PASO 1: Ir al Dashboard de Supabase
1. Abre tu proyecto en https://supabase.com/dashboard
2. Ve a **SQL Editor** (en el menú lateral izquierdo)
3. Haz clic en **New query**

### PASO 2: Copiar y Ejecutar Este SQL

Copia TODO el contenido del archivo:
```
supabase/migrations/20251017_create_avatar_bucket.sql
```

O copia esto directamente:

```sql
-- Migration: Create avatar storage bucket and policies
-- Description: Creates the avatar bucket for profile photos with proper RLS policies

-- =====================================================
-- STEP 1: Create the bucket
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatar',
  'avatar',
  true,
  2097152, -- 2MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- =====================================================
-- STEP 2: Drop existing policies if any
-- =====================================================
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public access" ON storage.objects;

-- =====================================================
-- STEP 3: Create RLS policies
-- =====================================================

-- Policy 1: Users can upload their own avatar
CREATE POLICY "Avatar upload policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (name ~ ('^' || auth.uid()::text || '_'))
  )
);

-- Policy 2: Users can update their own avatar
CREATE POLICY "Avatar update policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (name ~ ('^' || auth.uid()::text || '_'))
  )
)
WITH CHECK (
  bucket_id = 'avatar' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (name ~ ('^' || auth.uid()::text || '_'))
  )
);

-- Policy 3: Users can delete their own avatar
CREATE POLICY "Avatar delete policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (name ~ ('^' || auth.uid()::text || '_'))
  )
);

-- Policy 4: Anyone can view avatars (public read access)
CREATE POLICY "Avatar public access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatar');
```

### PASO 3: Ejecutar
1. Haz clic en **Run** (botón verde)
2. Deberías ver el mensaje: "Success. No rows returned"

### PASO 4: Verificar
Ejecuta esta query para confirmar:

```sql
-- Verificar bucket
SELECT * FROM storage.buckets WHERE id = 'avatar';

-- Verificar políticas
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%Avatar%';
```

Deberías ver:
- ✅ 1 bucket llamado 'avatar' (público, límite 2MB)
- ✅ 4 políticas (upload, update, delete, public access)

## ¿Por Qué Sucedió Esto?

El bucket `avatar` debe crearse **manualmente** en Supabase porque:
- Las migraciones de Next.js solo afectan las tablas de PostgreSQL
- Los buckets de Storage son una característica separada
- Requieren configuración manual o CLI de Supabase

## Después de Aplicar la Migración

Una vez ejecutado el SQL:
1. ✅ La foto de perfil se guardará correctamente
2. ✅ Los usuarios podrán subir/actualizar/eliminar sus avatares
3. ✅ Los avatares serán públicamente visibles
4. ✅ Límite de 2MB por imagen
5. ✅ Solo imágenes permitidas (jpg, png, gif, webp)

## Prueba Final

1. Ve a `/account` en tu aplicación
2. Haz clic en "Cambiar foto"
3. Selecciona una imagen
4. Deberías ver: "✅ Foto de perfil actualizada correctamente"
5. La foto debe aparecer inmediatamente en el círculo

## Logs de Diagnóstico

El código ya tiene logs detallados. Abre la consola del navegador (F12) para ver:
- 🔄 "Subiendo avatar: ..."
- 📤 "Iniciando upload a bucket 'avatar'..."
- ✅ "Upload exitoso"
- 🔗 "Public URL generada"
- ✅ "Perfil actualizado en BD"
- ✅ "Proceso completo exitoso"

Si ves errores como:
- ❌ "Bucket not found" → El bucket no existe (ejecutar PASO 2)
- ❌ "policy" → Las políticas RLS no están configuradas (ejecutar PASO 2)
- ❌ "permission denied" → Las políticas están mal configuradas (ejecutar PASO 2)

---

**Creado:** 2025-10-17  
**Prioridad:** 🔴 URGENTE  
**Estado:** Requiere acción manual en Supabase Dashboard
