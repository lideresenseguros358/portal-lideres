# 🚀 INSTRUCCIONES PARA EJECUTAR EL BULK IMPORT

## ✅ Resumen de lo procesado

- **Total procesado:** 3,443 pólizas
- **Omitidos:** 13 registros (faltaban campos obligatorios)
- **Brokers únicos:** 80
- **Aseguradoras:** 6 (ASSA, FEDPA, ANCON, MAPFRE, SURA, MB SEGUROS)
- **Ramos:** 11 tipos de póliza

### Top 10 Brokers por Volumen:
1. samudiosegurospa@outlook.com - 932 pólizas
2. yanitzajustiniani@lideresenseguros.com - 334 pólizas
3. luisquiros@lideresenseguros.com - 277 pólizas
4. didimosamudio@lideresenseguros.com - 227 pólizas
5. kvseguros13@gmail.com - 220 pólizas (Karol)
6. soniaarenas@lideresenseguros.com - 151 pólizas
7. lucianieto@lideresenseguros.com - 132 pólizas
8. carlosfoot@lideresenseguros.com - 87 pólizas
9. ediscastillo@lideresenseguros.com - 79 pólizas
10. javiersamudio@lideresenseguros.com - 70 pólizas

---

## 📋 PASOS PARA EJECUTAR

### Paso 1: Verificar que la función SQL existe

1. Ve a **Supabase → SQL Editor**
2. Ejecuta este comando para verificar:

```sql
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'bulk_import_clients_policies'
);
```

- Si retorna `true` ✅ → Continúa al Paso 2
- Si retorna `false` ❌ → Ejecuta primero el archivo `BULK_IMPORT_CLIENTES.sql`

---

### Paso 2: Preparar el JSON

1. Abre el archivo: `public\TODA_FINAL_IMPORT_COMPACT.json`
2. **Copia TODO el contenido** (es una sola línea muy larga con el array JSON)

---

### Paso 3: Ejecutar el Import

1. Ve a **Supabase → SQL Editor**
2. Pega este comando:

```sql
SELECT * FROM bulk_import_clients_policies('
[AQUÍ PEGA EL JSON QUE COPIASTE EN EL PASO 2]
'::jsonb);
```

**IMPORTANTE:** 
- El JSON debe estar entre comillas simples `'...'`
- Debe terminar con `'::jsonb);`
- Ejemplo de cómo debe verse:

```sql
SELECT * FROM bulk_import_clients_policies('[{"client_name":"BETZAIDA..."}]'::jsonb);
```

3. Click en **Run** (o F5)

---

### Paso 4: Revisar Resultados

El comando retornará una tabla con:

#### ✅ Registros Exitosos
```
status  | message                                    | details
--------+--------------------------------------------+---------
success | Cliente y póliza creados correctamente     | {...}
```

#### ⚠️ Advertencias (Póliza ya existe)
```
status  | message                                    | details
--------+--------------------------------------------+---------
warning | Cliente creado, póliza ya existía          | {...}
```

#### ❌ Errores
```
status  | message                                    | details
--------+--------------------------------------------+---------
error   | Broker not found with email: xxx@xxx.com   | {...}
error   | Aseguradora no encontrada: XXX             | {...}
```

---

## 🔍 Verificar emails de brokers

**CRÍTICO:** Todos los brokers deben existir en la base de datos antes de ejecutar.

Los siguientes brokers están en tus datos. Verifica que TODOS existan:

### Emails que DEBES verificar existen en BD:
```
samudiosegurospa@outlook.com
yanitzajustiniani@lideresenseguros.com
luisquiros@lideresenseguros.com
didimosamudio@lideresenseguros.com
kvseguros13@gmail.com
minismei@hotmail.com
```

**Para verificar:**
```sql
SELECT email, name 
FROM brokers 
WHERE email IN (
    'samudiosegurospa@outlook.com',
    'yanitzajustiniani@lideresenseguros.com',
    'luisquiros@lideresenseguros.com',
    'kvseguros13@gmail.com',
    'minismei@hotmail.com'
)
ORDER BY email;
```

Si falta alguno, créalo primero en la tabla `brokers`.

---

## 🎯 Notas Importantes

### Duplicados
- La función **detecta pólizas duplicadas** por `policy_number`
- Si la póliza ya existe, crea el cliente pero no duplica la póliza
- Retorna `warning` en lugar de `error`

### Clientes Duplicados
- Si el cliente ya existe (por nombre), usa el existente
- Solo crea nuevo cliente si no existe

### Percent Override
- Se respetan los valores del CSV: 0.5, 0.6, 0.7, 0.8, 0.94, 1.0
- Si es 0, la función usa el porcentaje default del broker

### Fechas
- Todas convertidas a formato ISO (YYYY-MM-DD)
- start_date y renewal_date validadas

---

## 🚨 Si algo falla

### Error: "Broker not found"
**Solución:** Crea el broker faltante en la tabla `brokers` primero.

### Error: "Aseguradora no encontrada"
**Solución:** Verifica que el nombre de la aseguradora existe en tabla `insurers`.
Las aseguradoras en tus datos son:
- ASSA
- FEDPA
- ANCON
- MAPFRE
- SURA
- MB SEGUROS

### Error: "column reference is ambiguous"
**Solución:** Ya está arreglado en `BULK_IMPORT_CLIENTES.sql` (línea 120).

---

## ✅ Después del Import

1. Verifica el número total de pólizas creadas:
```sql
SELECT COUNT(*) FROM policies;
```

2. Verifica clientes nuevos:
```sql
SELECT COUNT(*) FROM clients;
```

3. Verifica por broker:
```sql
SELECT 
    b.name,
    b.email,
    COUNT(p.id) as num_policies
FROM brokers b
LEFT JOIN policies p ON p.broker_id = b.id
GROUP BY b.id, b.name, b.email
ORDER BY num_policies DESC;
```

---

## 📞 ¿Necesitas ayuda?

Si encuentras errores durante la ejecución:
1. Copia el mensaje de error completo
2. Identifica qué registro(s) fallaron
3. Verifica la causa (broker faltante, aseguradora incorrecta, etc.)
4. Corrige y vuelve a ejecutar

**La función es idempotente:** Puedes ejecutarla múltiples veces sin duplicar datos.

---

🎉 **¡Listo para importar 3,443 pólizas!**
