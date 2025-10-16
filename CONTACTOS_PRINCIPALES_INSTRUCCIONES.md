# Instrucciones: Contactos Principales de Aseguradoras

## 📋 Resumen de Cambios

Se implementó la funcionalidad de **contactos principales** para aseguradoras con las siguientes características:

### ✨ Características Implementadas

1. **Campo is_primary en la base de datos**
   - Marca un contacto como el principal de la aseguradora
   - Solo puede haber un contacto principal por aseguradora (controlado por trigger)

2. **Visualización en Flip Cards**
   - La parte trasera del flip card muestra el contacto principal
   - Muestra nombre, cargo, teléfono y email del contacto principal
   - Si no hay contacto principal, muestra mensaje apropiado

3. **Botón "Ver +" en Flip Card**
   - Muestra la cantidad total de contactos: "Ver + (X)"
   - Abre modal con listado completo de contactos
   - Color corporativo: #8AAA19

4. **Modal de Gestión de Contactos**
   - Se puede cerrar clickeando fuera del modal
   - Tamaño optimizado (max-w-3xl)
   - Branding establecido (#010139 y #8AAA19)
   - Funcionalidades completas:
     * Ver listado completo de contactos
     * Agregar nuevo contacto
     * Editar contactos existentes
     * Eliminar contactos
     * Marcar contacto como principal (icono de estrella)

5. **Diseño Consistente**
   - Colores corporativos: #010139 (azul profundo) y #8AAA19 (oliva)
   - Transiciones suaves (duration-200)
   - Iconos de React Icons
   - Responsive design

---

## 🚀 Pasos de Instalación

### Paso 1: Ejecutar el SQL en Supabase

1. Ve a tu proyecto en **Supabase Dashboard**
2. Navega a **SQL Editor**
3. Abre el archivo `ADD_PRIMARY_CONTACT_FIELD.sql`
4. Copia y pega el contenido completo
5. Ejecuta el SQL (botón Run o Ctrl+Enter)
6. Verifica que aparezca "Success. No rows returned"

**¿Qué hace este SQL?**
- Agrega la columna `is_primary` a la tabla `insurer_contacts`
- Crea un índice para optimizar consultas
- Crea un trigger que asegura solo un contacto principal por aseguradora
- Cuando marcas un contacto como principal, automáticamente desmarca los demás

### Paso 2: Regenerar los Tipos de TypeScript

Después de ejecutar el SQL, regenera los tipos:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/lib/database.types.ts
```

**Importante:** Reemplaza `TU_PROJECT_ID` con tu ID real de Supabase.

### Paso 3: Verificar la Compilación

```bash
npm run typecheck
```

Si hay errores, repite el Paso 2.

### Paso 4: Iniciar el Servidor

```bash
npm run dev
```

---

## 🧪 Pruebas

Una vez iniciado el servidor, prueba lo siguiente:

### 1. Vista de Flip Cards
- Ve a **Aseguradoras**
- Click en cualquier card para voltearla
- Verifica que muestra "Contacto Principal" en el reverso
- Si no hay contacto principal, debe decir "No hay contacto principal"
- Click en "Ver + (X)" para abrir el modal

### 2. Modal de Contactos
- Verifica que el modal se abre correctamente
- Click fuera del modal → debe cerrarse
- Click en la X → debe cerrarse

### 3. Agregar Contacto
- Click en "Agregar Contacto"
- Llena el formulario (nombre es requerido)
- Click en "Guardar"
- Verifica que aparece en la lista
- Verifica que se actualiza el contador en el botón "Ver + (X)"

### 4. Editar Contacto
- Click en el icono de editar (lápiz)
- Modifica los campos
- Click en "Guardar"
- Verifica que los cambios se guardaron

### 5. Marcar como Principal
- Click en el icono de estrella vacía
- Verifica que se marca como "Principal" (estrella llena)
- Cierra el modal y voltea el card
- Verifica que ahora muestra ese contacto en el reverso
- Vuelve a abrir el modal y marca otro contacto como principal
- Verifica que solo uno está marcado (el anterior se desmarcó automáticamente)

### 6. Eliminar Contacto
- Click en el icono de basura
- Confirma la eliminación
- Verifica que desaparece de la lista

---

## 📁 Archivos Creados/Modificados

### Nuevos Archivos
1. ✅ `ADD_PRIMARY_CONTACT_FIELD.sql` - Script SQL para agregar el campo is_primary
2. ✅ `src/components/insurers/ContactsModal.tsx` - Modal de gestión de contactos
3. ✅ `CONTACTOS_PRINCIPALES_INSTRUCCIONES.md` - Este archivo

### Archivos Modificados
1. ✅ `src/app/(app)/insurers/actions.ts`
   - Agregado: `actionSetPrimaryContact()` para establecer contacto principal

2. ✅ `src/app/(app)/insurers/page.tsx`
   - Actualizado para cargar contactos con cada aseguradora
   - Incluye el campo is_primary

3. ✅ `src/components/insurers/InsurersList.tsx`
   - Actualizado para mostrar contacto principal en flip card
   - Agregado botón "Ver +" con contador
   - Integrado ContactsModal

4. ✅ `src/components/insurers/editor/ContactsTab.tsx`
   - Actualizada interfaz Contact para incluir is_primary

5. ✅ `src/components/insurers/ContactsModal.tsx`
   - Actualizada interfaz Contact para incluir is_primary

---

## 🔧 Estructura de Datos

### Campo is_primary

```sql
is_primary BOOLEAN DEFAULT false
```

- Tipo: Boolean
- Default: false
- Solo puede haber un contacto con is_primary = true por aseguradora
- Controlado automáticamente por trigger de base de datos

### Trigger: ensure_single_primary_contact()

Cuando se marca un contacto como principal:
1. Encuentra todos los contactos de la misma aseguradora
2. Desmarca todos los demás (is_primary = false)
3. Marca solo el nuevo contacto como principal (is_primary = true)

---

## 🎨 Diseño y UX

### Colores Utilizados
- **Azul profundo (#010139):** Títulos, headers, elementos principales
- **Oliva (#8AAA19):** Botones primarios, hover states, contacto principal
- **Amarillo/Naranja:** Destacado del contacto principal (gradiente)
- **Grises:** Información secundaria, borders

### Iconos
- ⭐ FaStar: Contacto principal activo
- ☆ FaRegStar: Marcar como principal
- 👁️ FaEye: Ver todos los contactos
- ✏️ FaEdit: Editar contacto
- 🗑️ FaTrash: Eliminar contacto
- ➕ FaPlus: Agregar contacto
- 💾 FaSave: Guardar cambios
- ❌ FaTimes: Cerrar/Cancelar

### Interacciones
- **Modal:** Se cierra clickeando fuera o en la X
- **Transiciones:** Suaves, 200ms duration
- **Hover States:** Cambios de color corporativos
- **Estados de Carga:** Loading spinner en operaciones async
- **Validación:** Nombre es campo requerido

---

## ⚠️ Notas Importantes

1. **Permisos:** Solo usuarios con rol "master" pueden:
   - Agregar contactos
   - Editar contactos
   - Eliminar contactos
   - Establecer contacto principal

2. **Contacto Principal Único:** El trigger de base de datos garantiza que solo haya un contacto principal por aseguradora automáticamente.

3. **Actualización Automática:** Cuando se cambia el contacto principal en el modal, al cerrar el modal se recarga la página para mostrar los cambios en los flip cards.

4. **Validación de Campos:**
   - Nombre: Obligatorio, en mayúsculas
   - Cargo: Opcional, en mayúsculas
   - Teléfono: Opcional
   - Email: Opcional, en minúsculas
   - Notas: Opcional, en mayúsculas

---

## 🐛 Solución de Problemas

### Error: "Object literal may only specify known properties, and 'is_primary' does not exist"
**Causa:** Los tipos de TypeScript no están actualizados.
**Solución:** Ejecuta el Paso 2 (regenerar tipos).

### El contacto principal no se muestra en el flip card
**Causa:** Puede ser que no hay contacto marcado como principal.
**Solución:** 
1. Abre el modal de contactos
2. Click en la estrella de un contacto para marcarlo como principal
3. Cierra el modal
4. Voltea el card nuevamente

### El modal no se cierra clickeando fuera
**Causa:** JavaScript no está funcionando correctamente.
**Solución:** 
1. Revisa la consola del navegador por errores
2. Recarga la página (F5)

### "Solo Master puede..." error
**Causa:** Tu usuario no tiene rol "master".
**Solución:** Verifica en Supabase que tu usuario en la tabla `profiles` tiene `role = 'master'`.

---

## ✅ Checklist de Verificación

Antes de considerar la implementación completa, verifica:

- [ ] SQL ejecutado en Supabase correctamente
- [ ] Tipos TypeScript regenerados
- [ ] `npm run typecheck` pasa sin errores
- [ ] Servidor de desarrollo iniciado sin errores
- [ ] Flip cards muestran contacto principal correctamente
- [ ] Botón "Ver +" abre el modal
- [ ] Modal se cierra clickeando fuera
- [ ] Se puede agregar un nuevo contacto
- [ ] Se puede editar un contacto existente
- [ ] Se puede eliminar un contacto
- [ ] Se puede marcar contacto como principal (estrella)
- [ ] Solo un contacto puede ser principal a la vez
- [ ] El contacto principal se muestra en el flip card después de marcarlo

---

## 🎉 Resultado Final

Una vez completados todos los pasos, tendrás:

1. **Flip Cards Mejorados:** Muestran el contacto principal con toda su información
2. **Modal Funcional:** Gestión completa de contactos con diseño corporativo
3. **Experiencia Optimizada:** Fácil identificar y gestionar el contacto principal
4. **Diseño Consistente:** Siguiendo el branding establecido del portal

¡Disfruta de la nueva funcionalidad! 🚀
