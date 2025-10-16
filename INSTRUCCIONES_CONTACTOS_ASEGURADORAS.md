# Instrucciones: Implementar Contactos de Aseguradoras

## ⚠️ IMPORTANTE: Orden de Pasos

Debes seguir estos pasos **EN ORDEN** para que funcione correctamente:

## Paso 1: Crear la Tabla en Supabase (SQL)

1. Ve a tu proyecto en **Supabase Dashboard**
2. Navega a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido del archivo `SQL_INSURER_CONTACTS.sql`
5. Ejecuta el SQL (botón Run o Ctrl+Enter)
6. Verifica que aparezca el mensaje "Success. No rows returned"

### Verificación
Para verificar que la tabla fue creada:
```sql
SELECT * FROM public.insurer_contacts LIMIT 1;
```

## Paso 2: Regenerar los Tipos de TypeScript

Después de crear la tabla, debes regenerar los tipos para que TypeScript reconozca la nueva tabla:

### Opción A: Usando el CLI de Supabase (Recomendado)
```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/lib/database.types.ts
```

### Opción B: Manualmente desde Supabase Dashboard
1. Ve a **Settings** > **API** en Supabase Dashboard
2. Copia tu Project ID
3. Ve a **Database** > **Tables**
4. Click en el botón de 3 puntos (...) > **Generate TypeScript Types**
5. Copia el contenido generado
6. Reemplaza el contenido de `src/lib/database.types.ts`

### Opción C: Si tienes Supabase instalado localmente
```bash
npm run db:types
```
(Solo si tienes este script configurado en package.json)

## Paso 3: Verificar la Compilación

Una vez regenerados los tipos, verifica que compile:

```bash
npm run typecheck
```

Si hay errores, significa que los tipos no se regeneraron correctamente. Repite el Paso 2.

## Paso 4: Probar la Funcionalidad

1. Inicia el servidor de desarrollo:
```bash
npm run dev
```

2. Ve a **Aseguradoras** > Selecciona una aseguradora > Tab de **Contactos**

3. Prueba:
   - ✅ Agregar un contacto nuevo
   - ✅ Editar un contacto existente
   - ✅ Eliminar un contacto
   - ✅ Ver la lista de contactos

## Estructura de la Tabla `insurer_contacts`

```sql
CREATE TABLE insurer_contacts (
    id UUID PRIMARY KEY,
    insurer_id UUID NOT NULL REFERENCES insurers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Campos del Contacto

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | TEXT | ✅ Sí | Nombre completo del contacto |
| `position` | TEXT | ❌ No | Cargo o posición en la aseguradora |
| `phone` | TEXT | ❌ No | Teléfono de contacto |
| `email` | TEXT | ❌ No | Correo electrónico |
| `notes` | TEXT | ❌ No | Notas adicionales |

## Permisos (RLS Policies)

Las políticas de seguridad configuradas son:

1. **SELECT**: Todos los usuarios autenticados pueden ver contactos
2. **INSERT**: Solo usuarios con rol "master" pueden crear contactos
3. **UPDATE**: Solo usuarios con rol "master" pueden editar contactos  
4. **DELETE**: Solo usuarios con rol "master" pueden eliminar contactos

## Funcionalidades Implementadas

### En el Cliente (ContactsTab.tsx)
- ✅ Formulario para agregar contacto con validación
- ✅ Lista de contactos con información completa
- ✅ Edición inline de contactos
- ✅ Eliminación con confirmación
- ✅ Campos en mayúsculas automáticamente (nombre, cargo, notas)
- ✅ Email en minúsculas automáticamente
- ✅ Estados de carga
- ✅ Mensajes de éxito/error con toast
- ✅ Diseño responsive (mobile-friendly)

### En el Servidor (actions.ts)
- ✅ `actionGetInsurerContacts`: Obtener todos los contactos de una aseguradora
- ✅ `actionCreateInsurerContact`: Crear nuevo contacto
- ✅ `actionUpdateInsurerContact`: Actualizar contacto existente
- ✅ `actionDeleteInsurerContact`: Eliminar contacto
- ✅ Validación de permisos (solo Master)
- ✅ Manejo de errores

## Solución de Problemas

### Error: "Argument of type '\"insurer_contacts\"' is not assignable..."
**Causa**: Los tipos de TypeScript no están actualizados.
**Solución**: Ejecuta el Paso 2 para regenerar los tipos.

### Error: "relation \"public.insurer_contacts\" does not exist"
**Causa**: La tabla no fue creada en Supabase.
**Solución**: Ejecuta el Paso 1 para crear la tabla.

### Error: "new row violates row-level security policy"
**Causa**: Tu usuario no tiene rol "master" o las políticas RLS no se aplicaron.
**Solución**: 
1. Verifica que ejecutaste todo el SQL (incluye las políticas)
2. Verifica que tu usuario tiene `role = 'master'` en la tabla `profiles`

### Los contactos no aparecen después de agregarlos
**Causa**: Puede ser un problema de caché.
**Solución**: 
1. Recarga la página (F5)
2. Verifica en Supabase Dashboard que el contacto se guardó
3. Revisa la consola del navegador por errores

## Archivos Modificados/Creados

1. ✅ `SQL_INSURER_CONTACTS.sql` - Script SQL para crear la tabla
2. ✅ `src/app/(app)/insurers/actions.ts` - Actions del servidor
3. ✅ `src/components/insurers/editor/ContactsTab.tsx` - Componente del UI
4. ⏳ `src/lib/database.types.ts` - **Debes regenerar este archivo**

## Próximos Pasos

Una vez completados todos los pasos, el sistema de contactos estará completamente funcional y podrás:

1. Gestionar contactos para cada aseguradora
2. Tener un directorio organizado de personas de contacto
3. Consultar rápidamente información de contacto
4. Mantener notas sobre cada contacto

## Resumen del Flujo

```
1. Ejecutar SQL en Supabase
   ↓
2. Regenerar tipos TypeScript
   ↓
3. Verificar compilación (npm run typecheck)
   ↓
4. Iniciar dev server (npm run dev)
   ↓
5. Probar funcionalidad en el navegador
```

¡Listo! Una vez completados estos pasos, la funcionalidad de contactos estará totalmente operativa.
