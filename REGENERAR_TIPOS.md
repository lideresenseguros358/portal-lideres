# La tabla YA EXISTE - Solo Regenera los Tipos

## El Problema
La tabla `insurer_contacts` ya existe en Supabase pero `database.types.ts` está desactualizado.

## Solución: Regenerar Tipos TypeScript

### Opción 1: CLI de Supabase (Recomendado)
```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/lib/database.types.ts
```

Donde `TU_PROJECT_ID` lo encuentras en:
- Supabase Dashboard > Settings > General > Reference ID

### Opción 2: Desde Supabase Dashboard
1. Ve a Supabase Dashboard
2. Settings > API
3. Busca "Generate TypeScript Types"
4. Copia todo el contenido generado
5. Pega en `src/lib/database.types.ts` (reemplazar todo)

### Después de regenerar:
```bash
npm run typecheck
```

Debería pasar sin errores.

## ⚠️ NO ejecutes el SQL
El archivo `SQL_INSURER_CONTACTS.sql` no es necesario porque la tabla ya existe.
