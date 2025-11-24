# ✅ CORRECCIÓN - CONTADORES RAMOS CON is_life_insurance

**Fecha:** 24 de noviembre, 2025

---

## 🐛 PROBLEMA IDENTIFICADO:

Los contadores de VIDA y RAMOS GENERALES estaban calculando incorrectamente:

**ANTES (❌):**
- Sumaban `commission_raw` de cada póliza individual
- Clasificaban por campo `ramo` (texto)
- No usaban la columna `is_life_insurance` de `comm_imports`
- Sumaban primas, no ganancia de oficina

---

## ✅ SOLUCIÓN CORRECTA:

### **Lógica implementada:**

1. **Obtener imports** de la quincena desde `comm_imports`
2. **Para cada import**, calcular:
   ```
   Ganancia Oficina = total_amount - Σ(comisiones de brokers)
   ```
3. **Clasificar según `is_life_insurance`:**
   - Si `is_life_insurance = true` → sumar a **VIDA**
   - Si `is_life_insurance = false` → sumar a **RAMOS GENERALES**

---

## 📊 FÓRMULA CORRECTA:

```typescript
Para cada comm_import:
  Total Reporte = import.total_amount
  Total Comisiones Brokers = Σ(comm_items.net_amount del import)
  Ganancia Oficina = Total Reporte - Total Comisiones Brokers
  
  Si import.is_life_insurance == true:
    VIDA += Ganancia Oficina
  Si import.is_life_insurance == false:
    RAMOS GENERALES += Ganancia Oficina
```

---

## 💡 EJEMPLO PRÁCTICO:

### **Import 1: ASSA Vida (is_life_insurance = true)**
```
Total Reporte: $50,000
Comisiones Brokers: $7,500
Ganancia Oficina: $50,000 - $7,500 = $42,500
→ VIDA += $42,500 ✅
```

### **Import 2: MAPFRE Auto (is_life_insurance = false)**
```
Total Reporte: $30,000
Comisiones Brokers: $4,500
Ganancia Oficina: $30,000 - $4,500 = $25,500
→ RAMOS GENERALES += $25,500 ✅
```

### **Import 3: SURA Hogar (is_life_insurance = false)**
```
Total Reporte: $20,000
Comisiones Brokers: $3,000
Ganancia Oficina: $20,000 - $3,000 = $17,000
→ RAMOS GENERALES += $17,000 ✅
```

**Resultado:**
```
VIDA: $42,500 ✅
RAMOS GENERALES: $42,500 ✅
Total: $85,000
```

---

## 🎯 CHECKBOX EN IMPORTACIÓN:

### **En ImportForm.tsx:**

El checkbox aparece cuando se importa un reporte:

```tsx
{insurers.find(i => i.id === selectedInsurer)?.name === 'ASSA' && (
  <div className="field checkbox-field">
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={isLifeInsurance}
        onChange={(e) => setIsLifeInsurance(e.target.checked)}
      />
      <span>¿Es seguro de vida?</span>
    </label>
  </div>
)}
```

**Características:**
- ✅ Solo aparece para aseguradora **ASSA** (por ahora)
- ✅ Se puede expandir para otras aseguradoras
- ✅ El valor se guarda en `comm_imports.is_life_insurance`

---

## 🔧 ARCHIVOS MODIFICADOS:

### **1. NewFortnightTab.tsx**

**ANTES (❌):**
```typescript
// Sumaba commission_raw de fortnight_details
const { data: details } = await supabaseClient()
  .from('fortnight_details')
  .select('ramo, commission_raw')
  
if (ramo.includes('vida')) {
  vida += amount;
}
```

**AHORA (✅):**
```typescript
// Obtiene imports con is_life_insurance
const { data: imports } = await supabaseClient()
  .from('comm_imports')
  .select('id, total_amount, is_life_insurance')
  .eq('period_label', draftFortnight.id);

// Para cada import, calcula ganancia de oficina
for (const imp of imports || []) {
  const { data: items } = await supabaseClient()
    .from('comm_items')
    .select('net_amount')
    .eq('import_id', imp.id);
  
  const totalComisionesBrokers = items.reduce(...);
  const gananciaOficina = totalReporte - totalComisionesBrokers;
  
  if (imp.is_life_insurance) {
    vida += gananciaOficina;
  } else {
    generales += gananciaOficina;
  }
}
```

---

### **2. FortnightDetailView.tsx**

**Cambio:**
- ✅ Usa nuevo endpoint `/api/commissions/imports-by-fortnight`
- ✅ Obtiene imports con ganancia de oficina ya calculada
- ✅ Clasifica por `is_life_insurance`

**Código:**
```typescript
const importsResponse = await fetch(
  `/api/commissions/imports-by-fortnight?fortnight_id=${fortnightId}`
);

const importsData = await importsResponse.json();

for (const imp of importsData.imports || []) {
  if (imp.is_life_insurance) {
    vida += imp.office_profit || 0;
  } else {
    generales += imp.office_profit || 0;
  }
}
```

---

### **3. Nuevo API Endpoint**

**Archivo:** `src/app/api/commissions/imports-by-fortnight/route.ts`

**Función:**
- ✅ Obtiene imports de una quincena
- ✅ Para cada import, calcula:
  - `total_amount`
  - `broker_commissions` (suma de net_amount)
  - `office_profit` (total - comisiones)
  - `is_life_insurance`
- ✅ Retorna array de imports con ganancia calculada

---

## 📊 ESTRUCTURA DE RESPUESTA:

```json
{
  "ok": true,
  "imports": [
    {
      "id": "uuid1",
      "total_amount": 50000,
      "broker_commissions": 7500,
      "office_profit": 42500,
      "is_life_insurance": true
    },
    {
      "id": "uuid2",
      "total_amount": 30000,
      "broker_commissions": 4500,
      "office_profit": 25500,
      "is_life_insurance": false
    }
  ]
}
```

---

## ✅ VALIDACIÓN:

### **Verificar cálculos:**

```
1. Suma de VIDA + RAMOS GENERALES = Ganancia Oficina Total ✅

2. Para cada import:
   office_profit = total_amount - Σ(net_amount) ✅

3. Clasificación correcta según checkbox ✅
```

---

## 🧪 PARA PROBAR:

```bash
npm run dev
```

### **1. Nueva Quincena:**

1. **Importa un reporte de ASSA:**
   - ✅ Verifica que aparezca checkbox "¿Es seguro de vida?"
   - ✅ Marca el checkbox si es vida
   - ✅ Deja sin marcar si no es vida

2. **Importa más reportes:**
   - ✅ ASSA Vida (checkbox marcado)
   - ✅ MAPFRE Auto (sin checkbox, false por defecto)
   - ✅ SURA Hogar (sin checkbox, false por defecto)

3. **Verifica contadores:**
   - ✅ VIDA debe mostrar ganancia de imports con `is_life_insurance=true`
   - ✅ RAMOS GENERALES debe mostrar ganancia de imports con `is_life_insurance=false`
   - ✅ Suma debe = Ganancia Oficina total

### **2. Historial:**

1. **Expande una quincena cerrada:**
   - ✅ Contadores deben reflejar los imports históricos
   - ✅ Clasificación según `is_life_insurance` guardado

---

## 📝 NOTAS IMPORTANTES:

1. **Checkbox actualmente solo para ASSA:**
   - Se puede expandir a otras aseguradoras editando condición
   - Por defecto es `false` si no se marca

2. **Usa Ganancia de Oficina, NO primas:**
   - Correcto: Total Report - Comisiones Brokers
   - Incorrecto: Suma de commission_raw

3. **Campo en BD:**
   - Tabla: `comm_imports`
   - Campo: `is_life_insurance` (boolean, nullable)
   - Default: `false`

4. **Histórico:**
   - Los imports ya guardados conservan su valor
   - Puedes editar si es necesario (requiere query SQL)

---

## 🎉 RESULTADO FINAL:

### **Nueva Quincena:**
```
3. Totales por Tipo de Seguro

┌──────────────────┬──────────────────┐
│ VIDA             │ RAMOS GENERALES   │
│ $42,500.00       │ $42,500.00       │
│ Seguros de vida  │ Otros seguros    │
└──────────────────┴──────────────────┘

Ganancia Oficina Total: $85,000 ✅
VIDA + GENERALES: $85,000 ✅ (coincide)
```

### **Historial:**
```
🏥 TOTALES POR TIPO DE SEGURO

┌──────────────────┬──────────────────┐
│ VIDA             │ RAMOS GENERALES   │
│ $42,500.00       │ $42,500.00       │
│ Seguros de vida  │ Otros seguros    │
└──────────────────┴──────────────────┘
```

---

**¡Los contadores ahora usan is_life_insurance y calculan ganancia de oficina correctamente!** ✅📊
