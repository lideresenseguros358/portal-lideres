# ✅ BULK IMPORT - CORRECCIONES FINALES

## 🔴 Problemas Corregidos

### 1. **Comisiones no aparecen en historial de quincenas**
**Causa:** `comm_items` se insertaban sin `created_at`, tomando la fecha actual en lugar de la fecha de la quincena.

**Solución:** Agregar `created_at: '2025-11-15T23:59:59.000Z'` a todas las inserciones de `comm_items`.

### 2. **Caracteres especiales y acentos**
**Causa:** Función `normalizar()` no eliminaba todos los caracteres especiales.

**Solución:** Mejorar normalización:
```javascript
function normalizar(texto) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/-/g, ' ')              // Guiones → espacios
    .replace(/[^a-zA-Z0-9 ]/g, '')   // Eliminar caracteres especiales
    .replace(/\s+/g, ' ')            // Múltiples espacios → uno solo
    .trim();
}
```

### 3. **Policies no se crean**
**Confirmación:** El script está correcto. Solo crea policies para registros con `broker_email` válido.
- ✅ Con broker → crea `client` + `policy` + `comm_item`
- ✅ Sin broker → crea solo `pending_item` (para ajustes)

---

## 📝 Cambios Aplicados

### **Archivo:** `scripts/bulk-import-completo.mjs`

#### **1. Normalización mejorada (línea 32-44)**
```javascript
function normalizar(texto) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/-/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')   // ← NUEVO
    .replace(/\s+/g, ' ')            // ← NUEVO
    .trim();
}
```

#### **2. Comisiones con created_at (línea 364-375)**
```javascript
const { error } = await supabase
  .from('comm_items')
  .insert({
    import_id: importRecord.id,
    broker_id: brokerId,
    policy_number: policyNumber,
    insured_name: clientNameNormalized,
    insurer_id: insurerId,
    gross_amount: grossAmount,
    created_at: '2025-11-15T23:59:59.000Z'  // ← NUEVO
  });
```

#### **3. Códigos ASSA con created_at (línea 487-497)**
```javascript
const { error } = await supabase
  .from('comm_items')
  .insert({
    import_id: importRecord.id,
    broker_id: brokerId,
    policy_number: code,
    insured_name: `Código ASSA: ${code}`,
    insurer_id: assaId,
    gross_amount: amount,
    created_at: '2025-11-15T23:59:59.000Z'  // ← NUEVO
  });
```

#### **4. Códigos ASSA huérfanos con created_at (línea 510-520)**
```javascript
const { error } = await supabase
  .from('comm_items')
  .insert({
    import_id: importRecord.id,
    broker_id: lissaBrokerId,
    policy_number: code,
    insured_name: `Código ASSA Huérfano: ${code}`,
    insurer_id: assaId,
    gross_amount: amount,
    created_at: '2025-11-15T23:59:59.000Z'  // ← NUEVO
  });
```

---

## 🚀 Cómo Ejecutar

### **1. Preparar datos:**
Colocar en `public/`:
- `plantilla_comisiones_quincena.csv`
- `plantilla_codigos_assa.csv`
- `total_reportes_por_aseguradora.csv`

### **2. Verificar broker_email:**
```sql
-- Ver emails correctos de brokers:
SELECT 
  b.id,
  b.name as broker_name,
  p.email
FROM brokers b
JOIN profiles p ON p.id = b.profile_id
WHERE b.active = true
ORDER BY b.name;
```

### **3. Ejecutar script:**
```bash
node scripts/bulk-import-completo.mjs
```

### **4. Verificar resultados:**
```sql
-- Ver comisiones creadas:
SELECT 
  ci.policy_number,
  ci.insured_name,
  ci.gross_amount,
  ci.created_at,
  b.name as broker_name,
  i.name as insurer_name
FROM comm_items ci
JOIN brokers b ON b.id = ci.broker_id
JOIN insurers i ON i.id = ci.insurer_id
WHERE ci.created_at >= '2025-11-01'
  AND ci.created_at <= '2025-11-15'
ORDER BY ci.created_at DESC
LIMIT 20;

-- Ver clientes y policies creadas:
SELECT 
  c.name as cliente,
  COUNT(p.id) as num_policies,
  b.name as broker
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
LEFT JOIN brokers b ON b.id = c.broker_id
GROUP BY c.id, c.name, b.name
ORDER BY c.name;
```

---

## ✅ Resultado Esperado

### **En UI - Historial de Comisiones:**
1. ✅ Aparece quincena: **Q1 - Nov. 2025**
2. ✅ Al expandir: muestra totales por broker
3. ✅ Al hacer clic en broker: muestra aseguradoras
4. ✅ Al expandir aseguradora: muestra pólizas

### **En Base de Datos:**
1. ✅ **clients**: Clientes con nombres normalizados
2. ✅ **policies**: Pólizas con `client_id` y `broker_id`
3. ✅ **comm_items**: Comisiones con `created_at` en rango de quincena
4. ✅ **pending_items**: Registros sin broker asignado

---

## 🔍 Troubleshooting

### **No aparecen quincenas:**
```bash
# Limpiar caché:
rm -rf .next
npm run dev
# En navegador: Ctrl + Shift + R
```

### **No se crean policies:**
- Verificar que `broker_email` en CSV coincida EXACTAMENTE con email en `profiles`
- Registros sin broker van a `pending_items` (es correcto)

### **Caracteres raros en nombres:**
- La normalización ahora elimina todos los caracteres especiales
- Solo quedan: letras, números y espacios

---

## 📊 Fecha de Quincena

**Actual:** Q1 Nov 2025 (01/11/2025 - 15/11/2025)

**Para cambiar:**
1. Líneas 634-635: `period_start` y `period_end`
2. Líneas 374, 496, 519: `created_at` (debe estar dentro del rango)

```javascript
// Ejemplo para Q2 Nov 2025:
period_start: '2025-11-16',
period_end: '2025-11-30',
created_at: '2025-11-30T23:59:59.000Z'
```

---

## ✅ Build Verificado

```bash
npm run typecheck
✅ Sin errores
```

**¡Todo listo para ejecutar!** 🚀
