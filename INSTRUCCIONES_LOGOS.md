# 🚀 Instrucciones Rápidas - Logos de Aseguradoras

**IMPORTANTE:** Sigue estos pasos EN ORDEN

---

## ✅ PASO 1: Crear el Bucket (1 minuto)

### **Opción A: Desde Dashboard (Recomendado)**
1. Ir a Supabase Dashboard
2. **SQL Editor**
3. Copiar y pegar este código:

```sql
-- Create storage bucket for insurer logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurer-logos', 
  'insurer-logos', 
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
```

4. **Ejecutar** (Run)

### **Opción B: CLI**
```bash
supabase migration up
```

---

## ✅ PASO 2: Crear las Policies (2 minutos)

### **Opción A: Desde Dashboard UI (Más fácil)**

1. Ir a **Storage** → Click en bucket **insurer-logos**
2. Pestaña **Policies**
3. Click **New Policy** (4 veces, una para cada policy)

**Policy 1:**
- Name: `Public can view insurer logos`
- Allowed operation: `SELECT`
- Policy definition: 
  - Target roles: `public`
  - USING expression: `bucket_id = 'insurer-logos'`

**Policy 2:**
- Name: `Authenticated users can upload`
- Allowed operation: `INSERT`
- Policy definition:
  - Target roles: `authenticated`
  - WITH CHECK expression: `bucket_id = 'insurer-logos'`

**Policy 3:**
- Name: `Authenticated users can update`
- Allowed operation: `UPDATE`
- Policy definition:
  - Target roles: `authenticated`
  - USING expression: `bucket_id = 'insurer-logos'`

**Policy 4:**
- Name: `Authenticated users can delete`
- Allowed operation: `DELETE`
- Policy definition:
  - Target roles: `authenticated`
  - USING expression: `bucket_id = 'insurer-logos'`

### **Opción B: SQL (Solo si tienes Service Role)**

1. Ir a **SQL Editor**
2. **IMPORTANTE:** Activar el toggle "Run as service_role" (esquina superior derecha)
3. Copiar y pegar el contenido de `supabase/storage-policies-insurer-logos.sql`
4. Ejecutar

---

## ✅ PASO 3: Subir los 19 Logos (2-3 minutos)

### **Requisitos previos:**
Asegúrate de tener en `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

### **Ejecutar:**
```bash
node scripts/upload-insurer-logos.mjs
```

### **Esperado:**
```
🚀 Iniciando carga de logos de aseguradoras...
📁 Encontrados 19 logos

📤 Procesando: ASSA.png
   Aseguradora: ASSA
   ✅ Subido a storage
   ✅ Base de datos actualizada
   🔗 URL: https://...

... (19 logos en total)

📊 RESUMEN:
   Total archivos: 19
   ✅ Subidos a storage: 19
   ✅ BD actualizada: 19
   ❌ Fallidos: 0

🎉 ¡Todos los logos fueron subidos y actualizados correctamente!
```

---

## ✅ PASO 4: Verificar (1 minuto)

1. Ir a portal: `/insurers`
2. **Verificar:** Logos aparecen en las cards
3. Click **Editar** en cualquier aseguradora
4. Tab **General**
5. **Verificar:** Logo se muestra con fondo oscuro
6. **Probar:** Cambiar logo (subir otro archivo)
7. **Probar:** Eliminar logo

---

## 🚨 Si algo falla...

### **Error: "42501: must be owner of table objects"**
✅ **Ya corregido** - No intentes crear policies desde migration
→ Usa PASO 2 Opción A (Dashboard UI)

### **Error: "Bucket already exists"**
✅ Está bien - La migración tiene `ON CONFLICT DO UPDATE`
→ Continúa con PASO 2

### **Script falla: "Variables de entorno"**
→ Verifica `.env.local` tiene las 2 variables
→ Reinicia terminal después de agregar variables

### **Logos no se ven en portal**
→ Verifica policies están creadas (PASO 2)
→ Verifica bucket es público
→ Hard refresh (Ctrl+Shift+R)

---

## 📝 Archivos Importantes

```
✅ supabase/migrations/20251030_create_insurers_logos_storage.sql
   → Crea el bucket

✅ supabase/storage-policies-insurer-logos.sql
   → SQL para policies (si usas Opción B)

✅ scripts/upload-insurer-logos.mjs
   → Sube los 19 logos

✅ public/aseguradoras/*.png
   → 19 logos listos

✅ src/components/insurers/editor/GeneralTab.tsx
   → Ya tiene upload integrado
```

---

## 🎯 Resumen Ultra-Rápido

```bash
# 1. Crear bucket (Dashboard > SQL Editor)
[Ejecutar SQL de PASO 1]

# 2. Crear policies (Dashboard > Storage > insurer-logos > Policies)
[Crear 4 policies manualmente - 2 minutos]

# 3. Subir logos
node scripts/upload-insurer-logos.mjs

# 4. Verificar en /insurers
```

**Tiempo total: ~5 minutos**

---

## ✅ Checklist Final

- [ ] Bucket `insurer-logos` creado
- [ ] 4 policies creadas
- [ ] Script ejecutado sin errores
- [ ] 19 logos subidos
- [ ] Logos visibles en `/insurers`
- [ ] Editor permite cambiar logo
- [ ] Editor permite eliminar logo

---

**¡LISTO!** 🎉

Si completaste todos los pasos, el sistema está funcionando al 100%.
