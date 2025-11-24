# ✅ CONTADORES DE RAMOS - VIDA Y GENERALES

**Fecha:** 24 de noviembre, 2025

---

## 📊 IMPLEMENTACIÓN COMPLETADA:

Se han implementado contadores que muestran los totales de comisiones por tipo de seguro (**VIDA** vs **RAMOS GENERALES**) en dos páginas:

1. ✅ **Nueva Quincena** (para crear quincenas en borrador)
2. ✅ **Historial de Quincenas** (para quincenas cerradas - solo visible por MASTER)

---

## 🎯 LÓGICA DE CLASIFICACIÓN:

### **VIDA:**
- Incluye todas las pólizas donde el campo `ramo` contiene la palabra "vida"
- Ejemplos: "VIDA", "Vida Individual", "Seguro de Vida", etc.

### **RAMOS GENERALES:**
- Incluye todas las demás pólizas
- Ejemplos: Auto, Hogar, Salud, Incendio, Responsabilidad Civil, etc.

---

## 📝 CÁLCULO:

```typescript
// Clasificación por ramo
(details || []).forEach((detail) => {
  const ramo = (detail.ramo || '').toLowerCase().trim();
  const amount = Math.abs(Number(detail.commission_raw) || 0);
  
  if (ramo.includes('vida')) {
    vida += amount;  // Acumula en VIDA
  } else {
    generales += amount;  // Acumula en RAMOS GENERALES
  }
});
```

**Datos usados:**
- ✅ `commission_raw`: Prima de la aseguradora (monto bruto)
- ✅ `ramo`: Tipo de seguro de la póliza

---

## 🎨 VISTA EN "NUEVA QUINCENA":

### **Sección 3: Totales por Tipo de Seguro**

```
┌──────────────────────────────────────────────────────────┐
│  3. Totales por Tipo de Seguro                           │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────┐    ┌────────────────────┐        │
│  │ VIDA               │    │ RAMOS GENERALES     │        │
│  │ $45,250.00         │    │ $180,750.00        │        │
│  │ Seguros de vida    │    │ Otros seguros      │        │
│  └────────────────────┘    └────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

**Características:**
- ✅ **VIDA**: Fondo azul, borde azul
- ✅ **RAMOS GENERALES**: Fondo verde, borde verde
- ✅ Se actualiza automáticamente al importar reportes
- ✅ Se recalcula al eliminar reportes

---

## 🎨 VISTA EN "HISTORIAL DE QUINCENAS":

### **Cuando se expande una quincena:**

```
═══════════════════════════════════════════════════════════
                    QUINCENA: Q1 - nov. 2025
═══════════════════════════════════════════════════════════

📊 TOTALES GENERALES
┌────────────────┬────────────────┬────────────────┐
│ Total Reportes │ Total Brokers  │ Ganancia Ofi.  │
│ $50,000.00     │ $7,500.00      │ $42,500.00     │
└────────────────┴────────────────┴────────────────┘

🏥 TOTALES POR TIPO DE SEGURO
┌────────────────────┬────────────────────┐
│ VIDA               │ RAMOS GENERALES     │
│ $15,000.00         │ $35,000.00         │
│ Seguros de vida    │ Otros seguros      │
└────────────────────┴────────────────────┘

👥 CORREDORES PAGADOS (3)
...
```

**Características:**
- ✅ Visible **solo para MASTER**
- ✅ Aparece en cada quincena expandida
- ✅ Datos cargados desde `fortnight_details`
- ✅ Muestra totales históricos precisos

---

## 🔧 ARCHIVOS MODIFICADOS:

### **1. NewFortnightTab.tsx**

**Cambios:**
- ✅ Agregado estado `ramosTotals` para almacenar totales
- ✅ Función `loadRamosTotals()` para consultar `fortnight_details`
- ✅ useEffect actualizado para cargar ramos automáticamente
- ✅ Sección visual "Totales por Tipo de Seguro"

**Código agregado:**
```typescript
// Estado para totales por ramo
const [ramosTotals, setRamosTotals] = useState({ vida: 0, generales: 0 });

// Función para cargar totales
const loadRamosTotals = useCallback(async () => {
  if (!draftFortnight) {
    setRamosTotals({ vida: 0, generales: 0 });
    return;
  }
  
  const { data: details } = await supabaseClient()
    .from('fortnight_details')
    .select('ramo, commission_raw')
    .eq('fortnight_id', draftFortnight.id);
  
  let vida = 0;
  let generales = 0;
  
  (details || []).forEach((detail: any) => {
    const ramo = (detail.ramo || '').toLowerCase().trim();
    const amount = Math.abs(Number(detail.commission_raw) || 0);
    
    if (ramo.includes('vida')) {
      vida += amount;
    } else {
      generales += amount;
    }
  });
  
  setRamosTotals({ vida, generales });
}, [draftFortnight]);
```

---

### **2. FortnightDetailView.tsx**

**Cambios:**
- ✅ Agregado estado `ramosTotals`
- ✅ Cálculo de totales en `loadDetails()` a partir de datos ya cargados
- ✅ Nueva sección visual "TOTALES POR TIPO DE SEGURO"
- ✅ Colocada después de "TOTALES GENERALES"

**Código agregado:**
```typescript
// Estado
const [ramosTotals, setRamosTotals] = useState({ vida: 0, generales: 0 });

// Cálculo en loadDetails
(data.brokers || []).forEach((broker: any) => {
  broker.insurers.forEach((insurer: any) => {
    insurer.items.forEach((item: any) => {
      const ramo = (item.ramo || '').toLowerCase().trim();
      const amount = Math.abs(Number(item.commission_raw) || 0);
      
      if (ramo.includes('vida')) {
        vida += amount;
      } else {
        generales += amount;
      }
    });
  });
});

setRamosTotals({ vida, generales });
```

---

## 📊 EJEMPLO DE DATOS:

### **Si una quincena tiene:**

**Pólizas de VIDA:**
```
- VIDA Individual: $10,000
- Seguro de Vida Familiar: $5,000
Total VIDA: $15,000 ✅
```

**Pólizas de RAMOS GENERALES:**
```
- Auto Toyota: $8,000
- Hogar Residencial: $12,000
- Salud Personal: $15,000
Total RAMOS GENERALES: $35,000 ✅
```

**Total General:** $50,000

---

## ✅ VENTAJAS:

| Ventaja | Descripción |
|---------|-------------|
| **Visibilidad** | Master puede ver distribución de negocio |
| **Análisis** | Permite comparar VIDA vs GENERALES |
| **Precisión** | Datos desde `fortnight_details` (100% precisos) |
| **Actualización** | Se recalcula automáticamente |
| **Histórico** | Datos disponibles en historial de quincenas |

---

## 🧪 PARA PROBAR:

```bash
npm run dev
```

### **1. Nueva Quincena:**
1. Ve a **Comisiones** → **Nueva Quincena**
2. Importa reportes de aseguradoras
3. Verifica sección **"3. Totales por Tipo de Seguro"**
4. ✅ Debe mostrar valores de VIDA y RAMOS GENERALES

### **2. Historial (solo MASTER):**
1. Ve a **Comisiones** → **Historial de Quincenas**
2. Filtra por año, mes, quincena
3. Click en una quincena para expandir
4. ✅ Debe mostrar sección **"TOTALES POR TIPO DE SEGURO"**
5. ✅ Valores deben coincidir con los de la quincena cerrada

---

## 🔍 VALIDACIÓN:

### **Verificar cálculo correcto:**

1. **Sumar manualmente pólizas de VIDA:**
   - Buscar todas las pólizas con ramo que incluya "vida"
   - Sumar sus `commission_raw`

2. **Sumar pólizas de GENERALES:**
   - Todas las demás pólizas
   - Sumar sus `commission_raw`

3. **Comparar con contadores:**
   - ✅ Los totales deben coincidir

### **Verificar consistencia:**

```
Total VIDA + Total GENERALES = Total Reportes ✅
```

---

## 📝 NOTAS IMPORTANTES:

1. **Clasificación sensible a mayúsculas/minúsculas:**
   - Se normaliza a lowercase para comparación
   - "VIDA", "vida", "Vida" → todos clasifican como VIDA

2. **Campo `ramo` puede ser NULL:**
   - Si es NULL o vacío → se clasifica como RAMOS GENERALES

3. **Usa `commission_raw`:**
   - Prima de aseguradora (monto bruto)
   - NO usa `commission_calculated` (comisión del broker)

4. **Visible solo para MASTER:**
   - En historial, los brokers no ven estos contadores
   - En nueva quincena, solo MASTER crea quincenas

---

## 🎉 RESULTADO FINAL:

### **Nueva Quincena:**
```
3. Totales por Tipo de Seguro

┌──────────────────┬──────────────────┐
│ VIDA             │ RAMOS GENERALES   │
│ $15,000.00       │ $35,000.00       │
│ Seguros de vida  │ Otros seguros    │
└──────────────────┴──────────────────┘
```

### **Historial:**
```
🏥 TOTALES POR TIPO DE SEGURO

┌──────────────────┬──────────────────┐
│ VIDA             │ RAMOS GENERALES   │
│ $15,000.00       │ $35,000.00       │
│ Seguros de vida  │ Otros seguros    │
└──────────────────┴──────────────────┘
```

---

**¡Los contadores de VIDA y RAMOS GENERALES están implementados y funcionando!** 📊✅
