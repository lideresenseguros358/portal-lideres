# 📦 SISTEMA DE BULK UPLOAD DE COMISIONES - RESUMEN EJECUTIVO

**QUINCENA:** 1-15 Noviembre 2025 (CERRADA/PAID)

---

## 🎯 ¿QUÉ ES?

Un sistema para subir comisiones de la **primera quincena de noviembre 2025** mediante un archivo CSV, automatizando:
- ✅ Creación de clientes y pólizas nuevos (si no existen)
- ✅ Actualización de pólizas existentes
- ✅ Asignación automática a brokers por email
- ✅ **Cálculo automático de comisión neta** aplicando porcentaje del broker
- ✅ **Regla especial VIDA en ASSA** → 100% de comisión
- ✅ Manejo de comisiones sin identificar (van a Ajustes)

---

## 📋 COLUMNAS DEL CSV (SIMPLIFICADO)

### **5 Columnas Obligatorias:**
```
policy_number, client_name, insurer_name, broker_email, commission_amount
```

### **2 Columnas Opcionales:**
```
start_date, renewal_date
```

**TOTAL: 7 columnas** (solo las que realmente tienes disponibles)

### **📌 NOTAS IMPORTANTES:**

- **`broker_email`**: Se usa como KEY para buscar el broker en la BD y traer su nombre automáticamente
  - Si el email existe → Se asigna el broker
  - Si está vacío o no existe → Va a "Ajustes" para asignación manual

---

## 🔄 FLUJO AUTOMÁTICO

```
CSV Upload
   │
   ├──> 1. VALIDAR CSV
   │    ├─ Verificar columnas obligatorias
   │    ├─ Validar formato de montos
   │    └─ Validar formato de fechas
   │
   ├──> 2. IDENTIFICAR CLIENTES
   │    ├─ Por policy_number existente → Usa ese cliente
   │    ├─ Por client_name (coincidencia exacta)
   │    └─ [NO EXISTE] → CREAR NUEVO ✅
   │
   ├──> 3. IDENTIFICAR PÓLIZAS
   │    ├─ Por policy_number + insurer_name
   │    └─ [NO EXISTE] → CREAR NUEVA ✅
   │
   ├──> 4. ASIGNAR BROKER (por broker_email como KEY)
   │    ├─ Buscar broker en BD por email
   │    ├─ Si existe → Traer nombre y asignar automáticamente
   │    └─ Si está vacío o no existe → NULL (va a Ajustes) ⚠️
   │
   └──> 5. CREAR COMISIÓN
        ├─ fortnight_id
        ├─ policy_id
        ├─ broker_id (o NULL)
        ├─ amount
        └─ metadata
```

---

## 📊 EJEMPLO PRÁCTICO

### **Entrada: CSV con 150 filas**

```csv
policy_number,client_name,insurer_name,broker_email,commission_amount,start_date,renewal_date
POL-001,Juan Pérez,ASSA,carlos@broker.com,150.50,2024-11-01,2025-11-01
POL-002,María López,Mapfre,luis@broker.com,200.00,2024-11-01,2025-11-01
POL-003,Pedro Gómez,Fedpa,,100.00,,
POL-004,Ana Torres,Oceánica,yira@broker.com,120.00,2024-11-01,
...
```

**Notas del ejemplo:**
- Fila 1-2: Tienen todos los datos → procesamiento completo
- Fila 3: Sin broker ni fechas → irá a "Ajustes" para asignación manual
- Fila 4: Sin renewal_date → se acepta, las fechas son opcionales

### **Resultado: Procesamiento Automático**

```
✅ Procesadas: 145 comisiones
❌ Errores: 5 (aseguradora no encontrada, monto inválido)

📦 Nuevos:
   - 23 clientes creados
   - 35 pólizas creadas
   
📋 Asignación:
   - 133 brokers identificados automáticamente
   - 12 sin identificar (van a Ajustes)
```

---

## ⚠️ COMISIONES SIN IDENTIFICAR

Las comisiones sin broker aparecen en la **sección de Ajustes**:

```
┌────────────────────────────────────────────────────────┐
│ 📋 COMISIONES PENDIENTES DE ASIGNACIÓN                │
├────────────────────────────────────────────────────────┤
│ POL-003  │  Pedro Gómez  │  ASSA  │  $100.00          │
│ ☐ Es Mío (reclama esta comisión)                      │
├────────────────────────────────────────────────────────┤
│ POL-007  │  Ana López    │  Mapfre│  $75.50           │
│ ☐ Es Mío                                               │
└────────────────────────────────────────────────────────┘
```

**Brokers pueden:**
1. Marcar "Es Mío"
2. Sistema actualiza automáticamente
3. Comisión aparece en su listado

---

## 🛠️ IMPLEMENTACIÓN TÉCNICA

### **Archivos a Crear:**

1. **Backend - Upload Endpoint**
   ```
   /src/app/(app)/commissions/bulk-upload/route.ts
   ```

2. **Backend - Processing Logic**
   ```
   /src/lib/commissions/bulk-processor.ts
   ```

3. **Frontend - Upload Modal**
   ```
   /src/components/commissions/BulkUploadModal.tsx
   ```

4. **Frontend - Preview Table**
   ```
   /src/components/commissions/BulkPreviewTable.tsx
   ```

5. **Frontend - Unidentified Section**
   ```
   /src/components/commissions/UnidentifiedCommissionsTab.tsx
   ```

---

## 📝 TABLAS DE BASE DE DATOS

### **Tablas que se Crean/Actualizan:**

```sql
-- Clientes nuevos
INSERT INTO clients (name, national_id, email, phone, ...)

-- Pólizas nuevas
INSERT INTO policies (policy_number, client_id, insurer_id, ...)

-- Comisiones de la quincena
INSERT INTO fortnight_commissions (
  fortnight_id,
  policy_id,
  broker_id,  -- puede ser NULL
  amount,
  status,
  metadata
)

-- Logs de procesamiento
INSERT INTO import_logs (
  fortnight_id,
  filename,
  total_rows,
  processed,
  errors,
  created_at
)
```

---

## 🎨 UI FLOW

```
┌─────────────────────────────────────────┐
│ [Comisiones] → [Nueva Quincena]         │
│                                          │
│  ┌────────────────────────────────┐    │
│  │ 📦 Bulk Upload                 │    │
│  │                                 │    │
│  │ [Descargar Plantilla CSV]      │    │
│  │                                 │    │
│  │ [Seleccionar Archivo]          │    │
│  │                                 │    │
│  │ [Subir y Validar]              │    │
│  └────────────────────────────────┘    │
│                                          │
│  ↓ Validación                           │
│                                          │
│  ┌────────────────────────────────┐    │
│  │ ✅ 145 filas válidas            │    │
│  │ ❌ 5 errores                    │    │
│  │                                 │    │
│  │ [Ver Preview]                  │    │
│  └────────────────────────────────┘    │
│                                          │
│  ↓ Preview                              │
│                                          │
│  ┌────────────────────────────────┐    │
│  │ Tabla con preview de datos     │    │
│  │ - Clientes nuevos (verde)      │    │
│  │ - Pólizas nuevas (azul)        │    │
│  │ - Sin broker (naranja)         │    │
│  │                                 │    │
│  │ [Confirmar Importación]        │    │
│  └────────────────────────────────┘    │
│                                          │
│  ↓ Procesamiento                        │
│                                          │
│  ┌────────────────────────────────┐    │
│  │ 🎉 Importación Completada       │    │
│  │                                 │    │
│  │ 23 clientes nuevos              │    │
│  │ 35 pólizas nuevas               │    │
│  │ 145 comisiones registradas      │    │
│  │ 12 pendientes de asignar        │    │
│  │                                 │    │
│  │ [Ir a Ajustes] [Ver Quincena]  │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 🔐 VALIDACIONES Y REGLAS

### **Validación Pre-Upload:**
- ✅ Archivo es CSV
- ✅ Columnas obligatorias presentes
- ✅ Al menos 1 fila de datos

### **Validación Durante Procesamiento:**
- ✅ Montos son números válidos
- ✅ Fechas en formato correcto
- ✅ Aseguradoras existen en BD
- ✅ No duplicados en la misma quincena

### **Regla de Duplicados:**
```
IF EXISTS (
  fortnight_id + policy_number + insurer_name
) THEN
  UPDATE commission
ELSE
  INSERT commission
END
```

---

## 📈 BENEFICIOS

1. **Ahorro de Tiempo**
   - ❌ Antes: 150 comisiones = 2-3 horas manualmente
   - ✅ Ahora: 150 comisiones = 5 minutos

2. **Menos Errores**
   - Validación automática
   - Identificación inteligente
   - Creación automática de registros

3. **Flexibilidad**
   - Clientes nuevos se crean
   - Pólizas nuevas se vinculan
   - Brokers sin identificar se manejan

4. **Trazabilidad**
   - Log de cada importación
   - Historial de cambios
   - Auditoría completa

---

## 🚀 PRÓXIMOS PASOS PARA IMPLEMENTAR

1. ✅ **Leer documentación** (este archivo)
2. ⏳ **Crear backend** (endpoint + lógica)
3. ⏳ **Crear frontend** (modal + preview)
4. ⏳ **Probar con datos de prueba**
5. ⏳ **Importar quincena real**

---

## 💡 NOTAS IMPORTANTES

- El CSV debe estar en **UTF-8**
- Fechas siempre en formato **YYYY-MM-DD**
- Montos SIN símbolos ($, comas)
- Emails y nombres de brokers deben coincidir con BD
- Las comisiones sin broker NO se pierden, van a Ajustes

---

**¿Listo para implementar?** 
👉 Revisa el archivo `PLANTILLA_COMISIONES_QUINCENA.md` para más detalles técnicos.
