# CORRECCIÓN FINAL: Normalización de Nombres y Códigos ASSA al 100%

## Problema 1: Normalización de Nombres

**❌ Anterior (INCORRECTO):**
- Guiones (-) se eliminaban completamente
- "González-López" → "GONZALEZLOPEZ"

**✅ Correcto:**
- Guiones (-) deben convertirse en espacios
- "González-López" → "GONZALEZ LOPEZ"

## Problema 2: Códigos ASSA al 100%

**❌ Anterior (INCORRECTO):**
- Solo VIDA en ASSA iba al 100%

**✅ Correcto:**
Los siguientes casos van al 100% (sin aplicar `percent_default`):

1. **VIDA en ASSA** → 100%
2. **Códigos ASSA asignados al broker** → 100%
   - Tabla: `brokers.assa_code`
   - Si el `policy_number` coincide con el `assa_code` del broker Y la aseguradora es ASSA → 100%

## Lógica Correcta de Porcentajes

```sql
-- Variables
DECLARE
  v_broker_assa_code TEXT;
  v_policy_number TEXT := 'PJ750-4'; -- Ejemplo
  v_insurer_name TEXT := 'ASSA';
  v_policy_type TEXT := 'VIDA';
  v_percentage NUMERIC;
  v_broker_id UUID;

BEGIN
  -- Obtener código ASSA del broker
  SELECT assa_code INTO v_broker_assa_code 
  FROM brokers 
  WHERE id = v_broker_id;
  
  -- Determinar porcentaje
  IF (v_insurer_name = 'ASSA' AND v_policy_type = 'VIDA') THEN
    -- Caso 1: VIDA en ASSA siempre 100%
    v_percentage := 1.0;
    
  ELSIF (v_insurer_name = 'ASSA' AND v_policy_number = v_broker_assa_code) THEN
    -- Caso 2: Código ASSA del broker siempre 100%
    v_percentage := 1.0;
    
  ELSIF v_broker_id IS NOT NULL THEN
    -- Caso 3: Aplicar porcentaje default del broker
    SELECT percent_default INTO v_percentage FROM brokers WHERE id = v_broker_id;
    
  ELSE
    -- Sin broker = 0%
    v_percentage := 0;
  END IF;
  
  -- Calcular neto
  v_net_amount := v_gross_amount * v_percentage;
END;
```

## Ejemplos

### Ejemplo 1: VIDA en ASSA
```
Aseguradora: ASSA
Tipo: VIDA
Broker: Juan (percent_default = 0.70)
Código ASSA del broker: PJ750-4
Póliza: 12B34565

→ Porcentaje: 100% (porque es VIDA en ASSA)
```

### Ejemplo 2: Código ASSA del Broker
```
Aseguradora: ASSA
Tipo: AUTO
Broker: Juan (percent_default = 0.70)
Código ASSA del broker: PJ750-4
Póliza: PJ750-4

→ Porcentaje: 100% (porque la póliza coincide con su código ASSA)
```

### Ejemplo 3: Otra Póliza en ASSA
```
Aseguradora: ASSA
Tipo: AUTO
Broker: Juan (percent_default = 0.70)
Código ASSA del broker: PJ750-4
Póliza: 14B57241

→ Porcentaje: 70% (aplica percent_default porque no es VIDA ni su código ASSA)
```

### Ejemplo 4: Otra Aseguradora
```
Aseguradora: FEDPA
Tipo: AUTO
Broker: Juan (percent_default = 0.70)
Póliza: 06-55-1317797-2

→ Porcentaje: 70% (aplica percent_default)
```

## Archivos a Regenerar

1. ✅ `normalize-names-CORREGIDO.sql` - Función SQL corregida
2. ✅ `bulk-upload-comisiones-CORREGIDO-template.sql` - Template con lógica correcta
3. ⏳ `bulk-upload-comisiones.sql` - Regenerar con script TypeScript

## Query para Verificar Códigos ASSA de Brokers

```sql
-- Ver brokers con códigos ASSA asignados
SELECT 
  b.id,
  b.name,
  b.email,
  b.assa_code,
  b.percent_default
FROM brokers b
WHERE b.assa_code IS NOT NULL
ORDER BY b.name;
```

## Flujo de Regeneración del Bulk Import

1. Modificar script generador TypeScript para incluir:
   - Normalización correcta de nombres (guiones → espacios)
   - Lógica de códigos ASSA al 100%
   
2. Regenerar el archivo bulk-upload-comisiones.sql

3. Ejecutar en Supabase

## Próximos Pasos

1. [ ] Ejecutar `normalize-names-CORREGIDO.sql` para crear función
2. [ ] Modificar generador TypeScript del bulk
3. [ ] Regenerar bulk-upload-comisiones.sql
4. [ ] Verificar con queries de prueba
5. [ ] Ejecutar bulk corregido
