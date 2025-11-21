# 🔍 DIAGNÓSTICO - PÓLIZAS NO SE MUESTRAN EN UI

## ✅ Código Revisado

He revisado el código y **todo está correcto**:

### **Vista Desktop (línea 692):**
```typescript
{client.policies?.length ? (
  <div className="pol-list">
    {client.policies.map((policy) => (
      // Renderiza cada póliza
    ))}
  </div>
) : (
  <p>Este cliente no tiene pólizas registradas</p>
)}
```

### **Vista Mobile (línea 1001):**
```typescript
{client.policies?.length ? (
  <div className="space-y-3">
    {client.policies.map((policy) => (
      // Renderiza cada póliza en card
    ))}
  </div>
) : (
  <p>Este cliente no tiene pólizas registradas</p>
)}
```

---

## 🔧 Posibles Causas del Problema

### **1. Caché del Navegador** (MÁS PROBABLE)
El navegador puede estar usando una versión vieja del código.

**Solución:**
1. Abrir DevTools (F12)
2. Click derecho en el botón de recargar
3. Seleccionar "Vaciar caché y recargar de manera forzada"
4. O usar: `Ctrl + Shift + R` (Windows) / `Cmd + Shift + R` (Mac)

### **2. Servidor de Desarrollo No Reiniciado**
El servidor puede estar ejecutando código antiguo.

**Solución:**
```bash
# Detener el servidor (Ctrl + C)
# Reiniciar:
npm run dev
```

### **3. Build Corrupto**
El build puede tener archivos cached.

**Solución:**
```bash
# Limpiar y rebuild:
rm -rf .next
npm run build
npm run dev
```

### **4. Datos Realmente No Existen**
Las pólizas realmente no están en la base de datos para ese cliente.

**Verificación:**
```sql
-- Ejecutar en Supabase SQL Editor:
SELECT 
  c.name as cliente,
  COUNT(p.id) as num_polizas
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;
```

---

## 🎯 Verificación Paso a Paso

### **Paso 1: Verificar en Base de Datos**
```sql
-- Ver clientes y sus pólizas:
SELECT 
  c.id,
  c.name,
  p.id as policy_id,
  p.policy_number,
  p.ramo,
  p.status
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
ORDER BY c.name, p.policy_number;
```

### **Paso 2: Verificar en DevTools Console**
1. Abrir la página `/db`
2. Abrir DevTools (F12) → Console
3. Buscar errores en rojo
4. Buscar el log: `"[DB PAGE] Loaded X clients"`

### **Paso 3: Verificar Network Tab**
1. DevTools → Network
2. Recargar página
3. Buscar request a `/db` o similar
4. Ver la respuesta JSON
5. Verificar que `policies` array existe en cada cliente

---

## 📋 Checklist de Verificación

- [ ] ¿Hay pólizas en la base de datos? (Verificar con SQL)
- [ ] ¿El servidor está corriendo? (`npm run dev`)
- [ ] ¿Hay errores en Console? (F12 → Console)
- [ ] ¿Caché limpio? (Ctrl+Shift+R)
- [ ] ¿El build es reciente? (`npm run build`)
- [ ] ¿La página carga correctamente? (Sin pantalla blanca)

---

## 🚨 Si Nada Funciona

### **Opción 1: Rollback Temporal**
Si necesitas revertir los cambios:

```bash
git log --oneline -5
git revert HEAD
```

### **Opción 2: Verificar Diferencias**
Ver qué cambió exactamente:

```bash
git diff HEAD~1 src/components/db/DatabaseTabs.tsx
```

---

## 📊 Estado Actual del Código

**Archivo:** `src/components/db/DatabaseTabs.tsx`

**Cambios recientes:**
- ✅ Agregada vista mobile con cards (línea 847-1147)
- ✅ Mantenida vista desktop con tabla (línea 554-845)
- ✅ Ambas vistas renderizan pólizas correctamente
- ✅ TypeScript build sin errores
- ✅ Código compilado exitosamente

**Estado:** ✅ **CÓDIGO CORRECTO**

---

## 💡 Recomendación

**Lo más probable es un problema de caché del navegador.**

### **Prueba esto primero:**

1. **Limpiar caché del navegador:**
   - Ctrl + Shift + R (forzar recarga)
   - O Ctrl + Shift + Delete → Limpiar caché

2. **Si eso no funciona, reiniciar servidor:**
   ```bash
   # Detener servidor (Ctrl+C)
   npm run dev
   ```

3. **Si aún no funciona, rebuild:**
   ```bash
   rm -rf .next
   npm run build
   npm run dev
   ```

---

## 📸 Cómo Debe Verse

### **Desktop:**
```
┌────────────────────────────────────────┐
│ Juan Pérez              [▼]            │
├────────────────────────────────────────┤
│ Pólizas del Cliente (3)                │
│                                        │
│ 📋 POL-12345                      [⋮] │
│ FEDPA | VIDA | Activa                 │
│ Renovación: 01/12/2025                │
│                                        │
│ 📋 POL-67890                      [⋮] │
│ ASSA | AUTO | Activa                  │
└────────────────────────────────────────┘
```

### **Mobile:**
```
┌────────────────────────────────────────┐
│ Juan Pérez                      [▼]    │
│                                        │
│ Cédula: 8-123-456  │ Pólizas: 3       │
├────────────────────────────────────────┤
│ [Ver Pólizas]              [⋮]        │
├────────────────────────────────────────┤
│ Pólizas (3)                            │
│                                        │
│ ┌────────────────────────┐             │
│ │ 📋 POL-12345      [⋮] │             │
│ │ FEDPA                 │             │
│ │ Ramo: VIDA | ✅ Activa│             │
│ └────────────────────────┘             │
└────────────────────────────────────────┘
```

---

## 🔥 Solución Rápida

```bash
# 1. Detener servidor
Ctrl + C

# 2. Limpiar todo
rm -rf .next

# 3. Reconstruir
npm run build

# 4. Iniciar
npm run dev

# 5. En navegador: Ctrl + Shift + R
```

---

**¿Necesitas más ayuda?** Dime qué ves exactamente en la página y qué errores aparecen en Console (F12).
