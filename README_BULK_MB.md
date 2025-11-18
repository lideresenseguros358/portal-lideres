# ✅ BULK IMPORT MB SEGUROS - LISTO PARA EJECUTAR

## Resumen

He preparado un script completo que importa **14 pólizas de MB SEGUROS** encontradas en TODA_FINAL.csv.

## Datos a Importar

### Por Broker:
- **carlosfoot@lideresenseguros.com**: 6 pólizas
- **samudiosegurospa@outlook.com**: 4 pólizas
- **itzycandanedo@lideresenseguros.com**: 2 pólizas
- **keniagonzalez@lideresenseguros.com**: 1 póliza
- **didimosamudio@lideresenseguros.com**: 1 póliza

### Por Tipo:
- 🚗 AUTO: 8 pólizas
- 🔥 INCENDIO: 2 pólizas
- ❤️ VIDA: 2 pólizas
- 🏠 HOGAR: 1 póliza
- ⚖️ RC: 1 póliza

### Clientes:
- **11 clientes únicos**
- 3 clientes tienen múltiples pólizas

## Cómo Ejecutar

### 1️⃣ Abrir Supabase SQL Editor (30 segundos)
1. Ir a tu proyecto Supabase
2. Click en "SQL Editor" en el menú lateral
3. Click en "New query"

### 2️⃣ Copiar y ejecutar el script (1 minuto)
1. Abrir el archivo: `EJECUTAR_BULK_MB_SEGUROS.sql`
2. Copiar **TODO** el contenido (Ctrl+A, Ctrl+C)
3. Pegar en SQL Editor (Ctrl+V)
4. Click en **"Run"** (o presionar F5)

### 3️⃣ Verificar resultados (30 segundos)
El script mostrará una tabla con 14 filas. **Verifica:**

✅ **Todas las filas deben tener:**
- `success = true`
- `message = "SUCCESS: Cliente y póliza creados"`
- `client_id` y `policy_id` con valores UUID

❌ **Si alguna fila tiene `success = false`:**
- Lee el `message` específico del error
- Puede ser por: broker no existe, póliza duplicada, etc.

## Resultados Esperados

```
success | row_number | client_name                      | policy_number | message
--------|------------|----------------------------------|---------------|---------------------------
true    | 1          | ROSA ANGELA MARTINEZ KANTULE     | 2280          | SUCCESS: Cliente y póliza creados
true    | 2          | UNI LEASING, INC.                | 55683         | SUCCESS: Cliente y póliza creados
true    | 3          | MAXILIANO DAVID PEREZ ANDERSON   | 51026         | SUCCESS: Cliente y póliza creados
...     | ...        | ...                              | ...           | ...
true    | 14         | ANGEL ALBERTO LOPEZ LOPEZ        | 60973         | SUCCESS: Cliente y póliza creados
```

## Verificación Final (Opcional)

Después de la importación, puedes ejecutar este query para ver las pólizas creadas:

```sql
SELECT 
  p.policy_number,
  c.name as client,
  i.name as insurer,
  b.name as broker,
  p.ramo,
  p.start_date,
  p.renewal_date
FROM policies p
JOIN clients c ON p.client_id = c.id
JOIN insurers i ON p.insurer_id = i.id
JOIN brokers b ON p.broker_id = b.id
WHERE i.name = 'MB'
  AND p.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY p.created_at DESC;
```

**Deberías ver las 14 pólizas recién creadas.**

## Notas Importantes

### ✅ Cambio Aplicado
El script actualiza la función `bulk_import_clients_policies` para que:
- "MB SEGUROS" (del CSV) encuentre "MB" (en Supabase)
- Funciona también para otras variaciones de nombres

### 🔄 Clientes Duplicados
Si algún cliente ya existe (por cédula o nombre):
- Se **reutiliza** ese cliente
- Solo se crea la nueva póliza
- Los datos opcionales se actualizan si están vacíos

### ⚠️ Pólizas Duplicadas
Si una póliza ya existe:
- **NO** se crea de nuevo
- Verás error: "Póliza ya existe: [número]"
- Esto es correcto para evitar duplicados

## Archivos Incluidos

1. **EJECUTAR_BULK_MB_SEGUROS.sql** ← Ejecutar este
2. **README_BULK_MB.md** ← Estás aquí
3. **INSTRUCCIONES_MB_SEGUROS.md** ← Guía detallada
4. **RESUMEN_CORRECCION_MB.md** ← Resumen técnico

## Tiempo Total Estimado

⏱️ **2-3 minutos** desde que abres Supabase hasta que termina la importación.

---

## ¿Todo Listo?

✅ **SÍ** - Solo tienes que:
1. Abrir Supabase SQL Editor
2. Copiar/pegar `EJECUTAR_BULK_MB_SEGUROS.sql`
3. Click en Run
4. ¡Listo! 🎉

Si encuentras algún error, revisa el `message` específico de la fila que falló.
