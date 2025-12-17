# Instrucciones: Ejecutar Migración SQL del Módulo BANCO

## Opción 1: Supabase CLI (Recomendado)

```bash
# Desde la raíz del proyecto
npx supabase db push
```

## Opción 2: SQL Editor en Supabase Dashboard

1. Ve a: https://supabase.com/dashboard/project/kwhwcjwtmopljhncbcvi/editor
2. Copia el contenido completo de: `supabase/migrations/20241217_banco_conciliacion.sql`
3. Pega en el SQL Editor
4. Click en "Run" para ejecutar

## Opción 3: Archivo Local

```bash
# Si tienes acceso directo a la BD
psql -h <host> -U postgres -d postgres -f supabase/migrations/20241217_banco_conciliacion.sql
```

## Verificar que las Tablas se Crearon

Ejecuta en SQL Editor:

```sql
-- Verificar que existen las 5 tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'bank_cutoffs',
    'bank_transfers_comm',
    'bank_groups',
    'bank_group_transfers',
    'bank_group_imports'
  );
```

Debe retornar 5 filas.

## Después de Ejecutar la Migración

1. **Reinicia el servidor de desarrollo:**
   ```bash
   # Ctrl+C para detener
   npm run dev
   ```

2. **Intenta importar un corte bancario**

3. **Revisa los logs en consola del navegador (F12)**
   - Si las tablas existen: verás `[BANCO] ✅ Corte creado exitosamente`
   - Si no existen: verás `TABLA NO EXISTE: Ejecuta la migración SQL primero`

## Troubleshooting

### Error: "relation 'bank_cutoffs' does not exist"
- ✅ **Solución:** La migración no se ejecutó. Ejecuta cualquiera de las opciones arriba.

### Error: "permission denied for table bank_cutoffs"
- ✅ **Solución:** Las políticas RLS están activas. Asegúrate de estar logueado como usuario MASTER.

### Error: "duplicate key value violates unique constraint"
- ✅ **Solución:** Ya existe un corte con esas fechas. Cambia las fechas de inicio/fin.

## Contacto

Si después de ejecutar la migración sigue sin funcionar:
1. Revisa los logs en consola del navegador (F12)
2. Copia el mensaje de error completo
3. Reporta el error con los logs
