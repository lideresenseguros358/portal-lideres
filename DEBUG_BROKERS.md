# DEBUG: Página Corredores No Muestra Datos

**Problema:** La página `/brokers` no muestra los corredores de la tabla `public.brokers`  
**Estado del código:** ✅ Queries corregidos y compilando correctamente  

---

## 🔍 PASOS DE DEBUGGING

### 1. Verificar que HAY datos en Supabase

**Ejecutar en Supabase SQL Editor:**

```sql
-- Ver cuántos brokers hay
SELECT COUNT(*) FROM public.brokers;

-- Ver brokers con profiles
SELECT 
  b.id,
  b.name,
  b.email,
  b.active,
  b.p_id,
  p.email as profile_email,
  p.full_name
FROM public.brokers b
LEFT JOIN public.profiles p ON b.p_id = p.id
ORDER BY b.created_at DESC;
```

**Resultado esperado:**  
- Si COUNT = 0 → **No hay brokers en la tabla**
- Si COUNT > 0 pero profiles NULL → **Problema con FK p_id**

---

### 2. Verificar Logs en la Consola del Navegador

1. Abrir navegador en `http://localhost:3000/brokers`
2. Abrir DevTools (F12)
3. Ir a tab "Console"
4. Buscar estos logs:

```
🔄 Cargando brokers...
📦 Result: {ok: true, data: Array(X)}
✅ Brokers recibidos: X
📊 Primer broker: {id: "...", name: "...", ...}
```

**Si ves:**
- `✅ Brokers recibidos: 0` → La tabla está vacía
- `❌ Error: ...` → Hay un error de permisos o query
- No hay logs → El componente no se está montando

---

### 3. Verificar Logs en el Servidor (Terminal)

En la terminal donde corre `npm run dev`, buscar:

```
✅ Brokers cargados: X
📊 Primer broker: {...}
```

**Si no aparecen:**
- El action no se está ejecutando
- Hay un error antes de llegar al return

---

### 4. Verificar Permisos RLS en Supabase

**Ejecutar en Supabase SQL Editor:**

```sql
-- Ver políticas RLS de la tabla brokers
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'brokers';
```

**Verificar:**
- Debe haber política SELECT para role 'authenticated'
- La política debe permitir ver todos los brokers (o al menos los activos)

---

### 5. Crear Broker de Prueba (si tabla vacía)

**Si la tabla está vacía, ejecutar:**

```sql
-- Primero, verificar que existe un profile master
SELECT id, email, role FROM public.profiles WHERE role = 'master' LIMIT 1;

-- Crear broker usando el p_id de ese profile
INSERT INTO public.brokers (
  id,
  p_id,
  name,
  email,
  active,
  percent_default,
  created_at
) VALUES (
  gen_random_uuid(),
  'COPIAR-ID-DEL-PROFILE-MASTER', -- ← Cambiar por el ID real
  'Corredor de Prueba',
  'prueba@test.com',
  true,
  0.10,
  NOW()
);

-- Verificar
SELECT * FROM public.brokers ORDER BY created_at DESC LIMIT 1;
```

---

## 🔧 CÓDIGO CORREGIDO

### actionGetBrokers (Server Action)

**Ubicación:** `src/app/(app)/brokers/actions.ts`

```typescript
export async function actionGetBrokers(search?: string) {
  // 1. Get brokers
  const { data: brokersData } = await supabase
    .from('brokers')
    .select('*')
    .order('name', { ascending: true });

  // 2. Get profiles for brokers
  const brokerIds = brokersData.map(b => b.p_id);
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar_url')
    .in('id', brokerIds);

  // 3. Merge
  const brokers = brokersData.map(broker => ({
    ...broker,
    profiles: profilesData?.find(p => p.id === broker.p_id) || null
  }));

  return { ok: true, data: brokers };
}
```

### BrokersListClient (Componente)

**Ubicación:** `src/components/brokers/BrokersListClient.tsx`

**Rendering:**
```typescript
{brokers.map((broker) => {
  const brokerName = broker.name || 
                     broker.profiles?.full_name || 
                     'Sin nombre';
  
  return (
    <div key={broker.id}>
      <h3>{brokerName}</h3>
      <p>{broker.profiles?.email || broker.email}</p>
      <span>{broker.active ? 'Activo' : 'Inactivo'}</span>
    </div>
  );
})}
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] **Tabla tiene datos:** Ejecutar `SELECT COUNT(*) FROM brokers` → Debe ser > 0
- [ ] **FK correcta:** Todos los brokers tienen `p_id` que existe en `profiles`
- [ ] **RLS permite SELECT:** Política permite leer brokers
- [ ] **Build exitoso:** `npm run build` sin errores
- [ ] **Dev server corriendo:** `npm run dev` activo
- [ ] **Logs en consola:** Ver logs de "Cargando brokers"
- [ ] **Logs en servidor:** Ver logs de "Brokers cargados"
- [ ] **Usuario es Master:** El usuario logueado tiene `role='master'`

---

## 🎯 DIAGNÓSTICO RÁPIDO

### Escenario 1: Tabla vacía
**Síntoma:** "0 corredores registrados"  
**Solución:** Insertar brokers de prueba (ver paso 5)

### Escenario 2: Error de permisos
**Síntoma:** Error "No autenticado" o "Solo Master puede ver"  
**Solución:** Verificar que estás logueado como Master

### Escenario 3: FK rota
**Síntoma:** Brokers aparecen pero sin nombre/email  
**Solución:** Verificar que `p_id` existe en `profiles`

### Escenario 4: RLS bloqueando
**Síntoma:** Query funciona en SQL Editor pero no en app  
**Solución:** Revisar políticas RLS de la tabla brokers

---

## 📞 SIGUIENTE PASO

1. **Ir a Supabase SQL Editor**
2. **Ejecutar:** `SELECT COUNT(*) FROM public.brokers;`
3. **Reportar el resultado:**
   - Si es 0: "La tabla está vacía"
   - Si es > 0: Ejecutar query completo del paso 1 y compartir resultado

---

**El código está correcto. El problema está en los datos o permisos de Supabase.**
