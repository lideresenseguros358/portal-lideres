# ✅ SCRIPT CORREGIDO: bulk-import-final.mjs

## 🔧 Corrección Aplicada

**Archivo modificado:** `scripts/bulk-import-final.mjs`

### Línea 40 agregada:
```javascript
.replace(/-/g, ' '); // Convertir guiones en espacios
```

---

## 📋 Lógica del Script (YA CORRECTA)

### 1. **Normalización de Nombres** ✅
```javascript
function normalizar(texto) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Quitar acentos
    .replace(/ñ/g, 'n')                // ñ → n
    .replace(/Ñ/g, 'N')                // Ñ → N
    .replace(/-/g, ' ');               // guiones → espacios ✅
}
```

**Ejemplos:**
- `"González-López"` → `"Gonzalez Lopez"` ✅
- `"María José"` → `"Maria Jose"` ✅
- `"Juan-Carlos"` → `"Juan Carlos"` ✅

### 2. **Cálculo de Porcentajes** ✅

**Líneas 286-297:**

```javascript
let percentToUse = 100;

// Si es VIDA + ASSA → 100%
if (policyType === 'VIDA' && insurerName === 'ASSA') {
  percentToUse = 100;
  percentOverride = 100;
} else if (percentOverride != null) {
  percentToUse = percentOverride;
} else {
  percentToUse = brokerPercents.get(brokerId) || 100;
}
```

**Lógica:**
1. ✅ VIDA en ASSA → 100%
2. ✅ Si existe `percent_override` en la póliza → usar ese
3. ✅ Si no → usar `percent_default` del broker

---

## 🚀 Cómo Ejecutar

### Prerequisitos:
1. Archivo CSV en: `public/total_reportes_por_aseguradora.csv`
2. Archivo Excel en: `public/Base de datos clientes lissa.xlsx`
3. Variables de entorno en `.env.local`

### Comando:
```bash
node scripts/bulk-import-final.mjs
```

### El script hará:
1. Limpiar datos existentes (fortnights, comm_items, etc.)
2. Importar reportes de aseguradoras
3. Importar clientes y pólizas del Excel
4. Crear comm_items con cálculos correctos
5. Generar totales por quincena

---

## 📊 Qué se importa

### Del CSV (reportes):
- Totales por aseguradora
- Crea `comm_imports`

### Del Excel (clientes):
- Hoja: "Comisiones Julio - Nov 2024"
- Columnas esperadas:
  - Policy Number
  - Insurer Name
  - Insured Name (cliente)
  - Broker Email
  - Commission Raw
  - Policy Type
  - Start Date
  - Renewal Date

---

## ⚠️ Notas Importantes

### Códigos ASSA (DIFERENTE)
Los "códigos ASSA" mencionados son para **otra funcionalidad**:
- Tabla: `brokers.assa_code`
- Se cargan en líneas 67-80 del script
- Se usan para identificar reportes específicos de ASSA
- **NO afectan el cálculo de comisiones de clientes**

### Comisiones de Clientes
Para las comisiones del Excel:
- ✅ VIDA en ASSA → 100%
- ✅ Resto → `percent_default` del broker
- ✅ Nombres normalizados (guiones → espacios)

---

## ✅ Verificación

Después de ejecutar:

```sql
-- Ver ejemplos de nombres normalizados
SELECT name FROM clients WHERE name LIKE '% %' LIMIT 20;

-- Ver cálculos de VIDA ASSA
SELECT 
  ci.policy_number,
  ci.insured_name,
  p.ramo,
  i.name as aseguradora,
  ci.commission_raw,
  ci.gross_amount,
  p.percent_override
FROM comm_items ci
JOIN policies p ON p.policy_number = ci.policy_number
JOIN insurers i ON i.id = ci.insurer_id
WHERE p.ramo = 'VIDA' AND i.name = 'ASSA'
LIMIT 10;
```

**Verificar:**
- ✅ Nombres sin guiones (convertidos a espacios)
- ✅ VIDA ASSA tiene `percent_override = 100`
- ✅ `gross_amount` es el 100% del `commission_raw`

---

## 🎯 Listo para Usar

El script ya está corregido y listo para ejecutar.

**Solo falta:**
1. Tener los archivos CSV y Excel en `public/`
2. Ejecutar el script
3. Verificar resultados
