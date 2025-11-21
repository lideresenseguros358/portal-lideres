# 📋 PLANTILLA CSV - BULK UPLOAD DE COMISIONES QUINCENA

**QUINCENA:** 1-15 Noviembre 2025 (CERRADA)

## 📄 FORMATO DEL CSV

### **Columnas Obligatorias (5):**

| Columna | Descripción | Ejemplo | Notas |
|---------|-------------|---------|-------|
| `policy_number` | Número de póliza | `12B34565` | Identificador único (usado para buscar póliza existente) |
| `client_name` | Nombre del cliente | `ALEXIS CONCEPCION ALVEO GONZALEZ` | Nombre completo |
| `insurer_name` | Nombre de aseguradora | `ASSA` | Debe existir en BD (ASSA, FEDPA, SURA, etc.) |
| `broker_email` | Email del corredor | `amariar23@gmail.com` | Dejar **vacío** si no identificado → va a Ajustes |
| `commission_amount` | Monto BRUTO | `22.7` | Se aplicará porcentaje del broker automáticamente |

### **Columnas Opcionales (3):**

| Columna | Descripción | Ejemplo | Notas |
|---------|-------------|---------|-------|
| `policy_type` | Tipo de póliza | `VIDA` | **IMPORTANTE:** `VIDA` en ASSA = 100% de comisión |
| `start_date` | Fecha inicio | `02/06/2025` | Formato DD/MM/YYYY o DD-MM-YYYY |
| `renewal_date` | Fecha renovación | `02/06/2026` | Formato DD/MM/YYYY o DD-MM-YYYY |

**TOTAL: 8 columnas** (5 obligatorias + 3 opcionales)

---

## 📄 EJEMPLO DE CSV

```csv
policy_number,client_name,insurer_name,broker_email,policy_type,commission_amount,start_date,renewal_date
12B34565,ALEXIS CONCEPCION ALVEO GONZALEZ,ASSA,amariar23@gmail.com,VIDA,22.7,02/06/2025,02/06/2026
14B57241,CARLOS ALCIBIADES GUERRA CASTILLO,ASSA,amariar23@gmail.com,VIDA,3.3,03/10/2025,03/10/2026
06-55-1317797-2,MONTALVO VILLEGAS RIASCO,FEDPA,amariar23@gmail.com,,11.37,09-02-2025,09-02-2026
14B30686,NIDIA NORIS BATISTA BUSTAMANTE DE MORENO,ASSA,,VIDA,2.1,28/04/2025,28/04/2026
15B102979,GRUPO COMERCIAL DON LUIS S.A,ASSA,,,8,02/09/2025,02/09/2026
```

**Notas del ejemplo:**
- Fila 1-2: Pólizas VIDA en ASSA → Se aplicará 100% de comisión automáticamente
- Fila 3: Póliza sin `policy_type` → Se usa porcentaje por defecto del broker
- Fila 4: Sin `broker_email` → Va a Ajustes como "no identificado"
- Fila 5: Sin `broker_email` ni `policy_type` → Va a Ajustes, porcentaje por defecto

---

## 🔄 FLUJO DE PROCESAMIENTO

### **Paso 1: Validación del CSV**
- ✅ Verifica que existan las columnas obligatorias
- ✅ Valida formato de montos (números decimales)
- ✅ Valida formato de fechas (YYYY-MM-DD)
- ✅ Identifica filas con datos faltantes

### **Paso 2: Identificación de Clientes**
El sistema intenta identificar clientes existentes en este orden:

1. **Por `policy_number` + `insurer_name`** → Si la póliza existe, usa ese cliente
2. **Por `client_name`** (coincidencia exacta) → Si el nombre coincide

**Si el cliente NO existe:**
- ✅ Se crea nuevo cliente en la BD con el nombre proporcionado
- ✅ Se crea la póliza vinculada a ese cliente

**Nota:** Como no tienes cédula ni email del cliente en la mayoría de casos, el sistema se basa principalmente en nombres y pólizas.

### **Paso 3: Identificación de Pólizas**
El sistema busca pólizas por:

1. **`policy_number` + `insurer_name`**
2. **`client_id` + `insurer_name` + `ramo`**

**Si la póliza NO existe:**
- ✅ Se crea nueva póliza
- ✅ Se vincula al cliente (existente o nuevo)

### **Paso 4: Asignación de Broker**
El sistema usa `broker_email` como **KEY principal** para asignar el broker:

1. **Si `broker_email` tiene valor:**
   - Busca en tabla `brokers` por email
   - Si existe → Trae nombre completo del broker y asigna automáticamente
   - Si NO existe → Se marca como "pendiente de identificar"

2. **Si `broker_email` está vacío:**
   - Se marca como "pendiente de identificar"
   - La comisión se crea con `broker_id = NULL`

**Ventaja:** Solo necesitas el email del broker, el sistema trae automáticamente el nombre desde la BD.

### **Paso 5: Registro de Comisión**
- ✅ Crea registro en tabla de comisiones de la quincena
- ✅ Vincula: `fortnight_id` + `policy_id` + `broker_id` (si existe)
- ✅ Guarda monto y metadatos

### **Paso 6: Manejo de No Identificados**
Comisiones sin broker asignado:
- ✅ Se crean con `broker_id = NULL`
- ✅ Aparecen en **sección de Ajustes**
- ✅ Los brokers pueden reclamarlos como "Mío"
- ✅ Se actualizan automáticamente al asignar

---

## ⚠️ REGLAS Y VALIDACIONES

### **Duplicados:**
- Si una comisión ya existe para la misma póliza en la misma quincena → **se actualiza**
- Se considera duplicado si: `fortnight_id` + `policy_number` + `insurer_name` coinciden

### **Clientes Nuevos:**
- Requiere: `client_name` + `insurer_name` mínimo
- Opcional pero recomendado: `national_id`, `email`, `phone`
- Se crea automáticamente si no existe

### **Pólizas Nuevas:**
- Requiere: `policy_number` + `insurer_name` + `client_id`
- Se vincula automáticamente al cliente
- Se asigna al broker (si se puede identificar)

### **Aseguradoras:**
- Debe coincidir con nombres en la BD (case-insensitive)
- Ejemplos: `ASSA`, `Mapfre`, `Fedpa`, `Oceánica`
- Si no existe → se reporta como error

---

## 📊 RESULTADO DEL PROCESAMIENTO

Al finalizar, el sistema devuelve:

```json
{
  "ok": true,
  "summary": {
    "total_rows": 150,
    "processed": 145,
    "errors": 5,
    "new_clients": 23,
    "new_policies": 35,
    "commissions_created": 145,
    "unidentified_brokers": 12
  },
  "details": {
    "new_clients": [...],
    "new_policies": [...],
    "errors": [
      { "row": 23, "error": "Aseguradora 'XYZ' no encontrada" },
      ...
    ],
    "unidentified": [
      { "policy": "POL-123", "client": "Juan Pérez", "reason": "Sin broker" },
      ...
    ]
  }
}
```

---

## 🎯 CASOS DE USO

### **Caso 1: Comisión con Broker Identificado**
```csv
policy_number,client_name,insurer_name,broker_email,commission_amount,start_date,renewal_date
POL-123,Juan Pérez,ASSA,carlos@broker.com,150.50,2024-11-01,2025-11-01
```
**Resultado:** 
- ✅ Cliente creado (o encontrado si existe)
- ✅ Póliza creada (o actualizada si existe)
- ✅ Broker asignado por email (trae nombre automáticamente)
- ✅ Comisión registrada con todos los datos

### **Caso 2: Comisión sin Fechas**
```csv
policy_number,client_name,insurer_name,broker_email,commission_amount,start_date,renewal_date
POL-456,María López,Mapfre,luis@broker.com,200.00,,
```
**Resultado:**
- ✅ Cliente creado
- ✅ Póliza creada sin fechas (se aceptan campos vacíos opcionales)
- ✅ Broker asignado
- ✅ Comisión registrada

### **Caso 3: Sin Broker (No Identificado)**
```csv
policy_number,client_name,insurer_name,broker_email,commission_amount,start_date,renewal_date
POL-789,Pedro Gómez,ASSA,,100.00,,
```
**Resultado:**
- ✅ Cliente y póliza procesados
- ⚠️ Broker NULL (sin asignar porque broker_email está vacío)
- ✅ Comisión registrada
- 📋 Aparece en **Ajustes** para que brokers lo reclamen como "Es Mío"

---

## 🚀 PRÓXIMOS PASOS

1. **Preparar CSV** con los datos de la quincena
2. **Subir archivo** en la sección de Comisiones
3. **Revisar preview** con validaciones
4. **Confirmar importación**
5. **Verificar sección Ajustes** para asignar no identificados

---

## 💡 TIPS

- Usa Excel o Google Sheets para preparar el CSV
- Guarda como "CSV UTF-8"
- Verifica que los montos NO tengan símbolos ($, comas)
- Fechas siempre en formato YYYY-MM-DD
- Emails y nombres de brokers deben coincidir exactamente con la BD

---

**Versión:** 1.0
**Fecha:** 20 de Noviembre, 2025
