# Actualización Masiva de Brokers - Datos Bancarios ACH

## 📋 Resumen de Cambios

### **1. Campo `beneficiary_id` Eliminado**
- **Motivo:** Banco General NO requiere cédula del titular en archivos ACH .TXT
- **Impacto:** 
  - ❌ Columna `beneficiary_id` eliminada de tabla `brokers`
  - ✅ Solo se usa `nombre_completo` (titular de cuenta)
  - ✅ `national_id` es la cédula del corredor (para identificación interna)

### **2. Campos ACH Requeridos por Banco General**
Para generar archivo .TXT ACH solo se necesitan:
1. `bank_route` - Código de ruta del banco (ej: 71 = Banco General)
2. `bank_account_no` - Número de cuenta (sin espacios/guiones, max 17 dígitos)
3. `tipo_cuenta` - Código: `03` (Corriente) o `04` (Ahorro)
4. `nombre_completo` - Titular de cuenta (MAYÚSCULAS sin acentos, max 22 chars)

### **3. Componentes Actualizados**
- ✅ `BrokerDetailClient.tsx` - Removido campo cédula del titular
- ✅ `actions.ts` (brokers) - Removidas referencias a `beneficiary_id`
- ✅ Exportación CSV - Usa `nombre_completo` en lugar de campos separados

---

## 🚀 Pasos para Ejecutar Actualización Masiva

### **PASO 1: Ejecutar Migraciones SQL en Supabase**

Ejecutar en este orden en **Supabase SQL Editor**:

#### 1.1 Eliminar constraint antiguo de tipo_cuenta
```bash
Archivo: supabase/migrations/20251111_fix_tipo_cuenta_constraint.sql
```
**Qué hace:** Elimina constraint que solo permitía 'Ahorro'/'Corriente', ahora acepta códigos '03'/'04'

#### 1.2 Eliminar columna beneficiary_id
```bash
Archivo: supabase/migrations/20251111_remove_beneficiary_id.sql
```
**Qué hace:** Elimina columna `beneficiary_id` de tabla `brokers`

#### 1.3 Preparar funciones helper y actualizar datos
```bash
Archivo: supabase/migrations/20251111_datos_brokers_actualizar.sql
```
**IMPORTANTE:** Antes de ejecutar, **REEMPLAZAR los datos de ejemplo** con tus datos reales del Excel.

---

### **PASO 2: Preparar Datos del Excel**

Tu Excel debe tener estas columnas:
1. **Email** - Para hacer match con profiles (KEY)
2. **Cédula** - Del corredor (para `national_id`)
3. **Banco** - Nombre del banco (se convierte a código)
4. **Tipo Cuenta** - "Ahorro" o "Corriente" (se convierte a '03'/'04')
5. **Número Cuenta** - Con o sin separadores (se limpia automáticamente)
6. **Titular** - Nombre del titular de cuenta

**Formato SQL esperado:**
```sql
('email@example.com', '8-123-456', 'BANCO GENERAL', 'Ahorro', '4-49-98-751023-5', 'NOMBRE TITULAR')
```

**Conversiones automáticas:**
- ✅ Números de cuenta que empiezan con 3 o 4 → Se agrega '0' al inicio (03..., 04...)
- ✅ Nombres de bancos → Códigos (ej: "BANCO GENERAL" → "71")
- ✅ Tipo cuenta texto → Código (ej: "Ahorro" → "04", "Corriente" → "03")
- ✅ Titular → MAYÚSCULAS sin acentos, max 22 caracteres

**Códigos de Bancos:**
| Banco | Código |
|-------|--------|
| BANCO GENERAL | 71 |
| BANISTMO | 22 |
| BAC | 45 |
| GLOBAL BANK | 41 |
| BANCO NACIONAL | 01 |
| CAJA DE AHORROS | 06 |
| BANESCO | 52 |
| MULTIBANK | 53 |
| CREDICORP | 47 |
| SCOTIABANK | 50 |
| LAFISE | 54 |
| CANAL BANK | 46 |
| ST. GEORGES | 55 |
| MERCANTIL | 48 |

---

### **PASO 3: Editar archivo SQL con tus datos**

Abre el archivo:
```
supabase/migrations/20251111_datos_brokers_actualizar.sql
```

Busca la sección:
```sql
FOR broker_data IN 
    SELECT * FROM (VALUES
        -- REEMPLAZAR AQUÍ CON TUS DATOS:
        ('email1@example.com', '8-123-456', 'BANCO GENERAL', 'Ahorro', '4-49-98-751023-5', 'NOMBRE TITULAR 1'),
        ('email2@example.com', '8-789-012', 'BANISTMO', 'Corriente', '3-72-40-016782-0', 'NOMBRE TITULAR 2')
        -- ... agregar más filas
    ) AS data(email, cedula, banco, tipo_cuenta_texto, numero_cuenta, titular)
```

**Reemplaza** las líneas de ejemplo con tus datos reales del Excel.

---

### **PASO 4: Ejecutar y Verificar**

1. **Ejecutar** el SQL de actualización en Supabase
2. **Revisar** el reporte final que mostrará:
   - ✅ Cantidad de registros actualizados
   - ⚠️ Emails no encontrados
   - ❌ Errores
3. **Verificar** la tabla de resultados que muestra estado ACH de cada broker

---

### **PASO 5: Regenerar database.types.ts**

```bash
npx supabase gen types typescript --project-id 'kwhwcjwtmopljhncbcvi' --schema public > src/lib/database.types.ts
```

---

## 🧪 Verificación Final

### 1. Typecheck
```bash
npm run typecheck
```
Debe pasar sin errores ✅

### 2. Build
```bash
npm run build
```
Debe compilar exitosamente ✅

### 3. Probar en Navegador
1. Ir a `/brokers/[id]`
2. Click "Editar"
3. Modificar datos bancarios
4. Guardar
5. Verificar que NO aparece campo "Cédula del titular" ✅
6. Verificar que guarda correctamente ✅

---

## 📊 Query de Verificación

Para ver el estado de todos los brokers:

```sql
SELECT 
    b.name,
    p.email,
    b.national_id as cedula_broker,
    b.bank_route,
    ab.bank_name,
    b.tipo_cuenta,
    act.name as tipo_nombre,
    b.bank_account_no,
    b.nombre_completo as titular,
    CASE 
        WHEN b.bank_route IS NOT NULL 
         AND b.bank_account_no IS NOT NULL 
         AND b.tipo_cuenta IS NOT NULL 
         AND b.nombre_completo IS NOT NULL 
        THEN '✅ LISTO PARA ACH'
        ELSE '❌ FALTAN DATOS'
    END as estado
FROM public.brokers b
JOIN public.profiles p ON b.p_id = p.id
LEFT JOIN public.ach_banks ab ON b.bank_route = ab.route_code
LEFT JOIN public.ach_account_types act ON b.tipo_cuenta = act.code
WHERE b.active = true
ORDER BY estado DESC, b.name;
```

---

## 🔧 Archivos Modificados

### SQL Migrations:
- ✅ `20251111_fix_tipo_cuenta_constraint.sql` - Fix constraint tipo_cuenta
- ✅ `20251111_remove_beneficiary_id.sql` - Eliminar beneficiary_id
- ✅ `20251111_datos_brokers_actualizar.sql` - Actualización masiva (EDITAR CON TUS DATOS)

### Components:
- ✅ `src/components/brokers/BrokerDetailClient.tsx` - Removido campo cédula titular
- ✅ `src/app/(app)/brokers/actions.ts` - Actualizado nullableFields

### Utils:
- ✅ `src/lib/utils/uppercase.ts` - Agregado `broker_type` a exclusión

---

## ⚠️ IMPORTANTE

1. **BACKUP:** Haz backup de la base de datos antes de ejecutar migraciones masivas
2. **TESTING:** Ejecuta primero en un ambiente de prueba si es posible
3. **DATOS:** Verifica que los emails en tu Excel coincidan EXACTAMENTE con los de la BD
4. **FORMATO:** Los números de cuenta se limpian automáticamente (sin espacios/guiones)
5. **MAYÚSCULAS:** Los nombres de titulares se convierten automáticamente a MAYÚSCULAS sin acentos

---

## 📝 Próximos Pasos

Después de esta actualización, puedes:
1. ✅ Generar archivos ACH .TXT con datos completos
2. ✅ Ver estado ACH de cada broker en el dashboard
3. ✅ Validar datos bancarios antes de exportar
4. ✅ Registrar nuevos brokers sin pedir cédula del titular

---

**Fecha:** 2025-11-11
**Versión:** 2.0
**Autor:** Sistema de Actualización Masiva ACH
