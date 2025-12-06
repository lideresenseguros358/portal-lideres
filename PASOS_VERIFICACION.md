# 📋 PASOS DE VERIFICACIÓN - USER REQUESTS

## 🎯 Objetivo
Verificar que el flujo completo de solicitudes de nuevos usuarios funciona de principio a fin.

---

## ⚙️ PASO 1: EJECUTAR SCRIPT SQL (OBLIGATORIO)

### 1.1 Abrir Supabase Dashboard
1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto: **portal-lideres**
3. En el menú izquierdo, click en **SQL Editor**

### 1.2 Ejecutar Script de Fix
1. Abre el archivo: `migrations/fix_user_requests_rls.sql`
2. **Copia TODO el contenido** (Ctrl+A, Ctrl+C)
3. En Supabase SQL Editor:
   - Click en **"New query"**
   - Pega el contenido (Ctrl+V)
   - Click en **"RUN"** (o F5)

### 1.3 Verificar Resultado
Deberías ver mensajes como:
```
NOTICE: ✅ RLS HABILITADO en user_requests
NOTICE: ✅ Se encontraron 4 políticas RLS (correcto)
```

Si ves errores, revísalos cuidadosamente.

### 1.4 Ejecutar Script de Verificación
1. Abre el archivo: `migrations/verify_user_requests_setup.sql`
2. **Copia TODO el contenido**
3. En Supabase SQL Editor (nueva query):
   - Pega el contenido
   - Click en **"RUN"**

### 1.5 Revisar Resultado de Verificación
Debes ver al final:
```
🎉 ✅ TODO ESTÁ CORRECTAMENTE CONFIGURADO
👉 El formulario /new-user debería funcionar correctamente
👉 Master puede aprobar/rechazar solicitudes
```

Si ves `⚠️ HAY PROBLEMAS`, revisa qué línea falló.

---

## 🧪 PASO 2: TEST DE FORMULARIO PÚBLICO

### 2.1 Abrir Navegador en Modo Incógnito
- Chrome: Ctrl+Shift+N
- Firefox: Ctrl+Shift+P
- Edge: Ctrl+Shift+N

**¿Por qué incógnito?** Para simular un usuario NO autenticado (público).

### 2.2 Ir al Formulario
1. URL: `http://localhost:3000/new-user`
2. Deberías ver: **"Solicitud de acceso al portal"**
3. **Paso 1/3: Credenciales**

### 2.3 Llenar Paso 1 - Credenciales

```
📧 Email:          test@example.com
🔒 Contraseña:     123456
🔒 Confirmar:      123456
```

- Click **"Siguiente"** →
- Debe avanzar a Paso 2/3

### 2.4 Llenar Paso 2 - Datos Personales

```
👤 Nombre completo:       Juan Pérez
🆔 Cédula:                8-123-4567
📅 Fecha de nacimiento:   01/01/1990
📞 Teléfono:              6000-0000
📋 Licencia (opcional):   LIC-123
```

- Click **"Siguiente"** →
- Debe avanzar a Paso 3/3

### 2.5 Llenar Paso 3 - Datos Bancarios ACH

```
🏦 Banco:                 Selecciona "Banco General" o cualquier otro
💳 Tipo de cuenta:        Selecciona "Ahorro (04)" o "Corriente (03)"
🔢 Número de cuenta:      1234567890
👤 Titular:               JUAN PEREZ
```

**TIP:** Marca el checkbox "Copiar mi nombre como titular" si el titular es el mismo que el solicitante.

- Click **"Enviar Solicitud"**

### 2.6 Resultado Esperado

✅ **SI FUNCIONA:**
```
Mensaje verde: "✅ Solicitud enviada exitosamente. Espera la aprobación del Master."
Después de 3 segundos → Redirige automáticamente a /login
```

❌ **SI FALLA:**
```
Mensaje rojo con el error específico
```

**Errores Comunes:**
- "Email y contraseña son requeridos" → Revisa que llenaste todos los campos
- "Debe seleccionar un banco" → Selecciona un banco del dropdown
- "Ya existe una solicitud pendiente con este email" → Usa otro email
- "Error al crear solicitud" → Revisa la consola del navegador (F12)

### 2.7 Verificar en Supabase

1. Supabase Dashboard → **Table Editor**
2. Selecciona tabla: **user_requests**
3. Deberías ver **una nueva fila** con:
   - email: test@example.com
   - status: **pending**
   - bank_route: código del banco seleccionado
   - bank_account_no: 1234567890
   - tipo_cuenta: "03" o "04"
   - nombre_completo_titular: JUAN PEREZ
   - created_at: timestamp reciente

✅ **Si ves la fila, el POST funcionó correctamente.**

---

## 👨‍💼 PASO 3: TEST DE APROBACIÓN (MASTER)

### 3.1 Cerrar Modo Incógnito

Ahora necesitas autenticarte como Master.

### 3.2 Login como Master

1. Ve a `http://localhost:3000/login`
2. Ingresa credenciales de un usuario con **role='master'**
3. Login

### 3.3 Ir a Página de Solicitudes

1. URL: `http://localhost:3000/requests`
2. O busca en el menú: **"Solicitudes"** o similar

### 3.4 Verificar Lista de Pendientes

✅ **Deberías ver:**
- Card **"Pendientes"** con número **1** (o más si hay otras)
- **Tabla** con la solicitud de "Juan Pérez"
- **Datos visibles:**
  - Nombre: Juan Pérez
  - Email: test@example.com
  - Cédula: 8-123-4567
  - Teléfono: 6000-0000
  - Datos bancarios ACH
- **Botones:**
  - 🟢 **"Aprobar"** (verde)
  - 🔴 **"Rechazar"** (rojo)

❌ **Si NO ves nada:**
- Verifica que hay una fila en `user_requests` con status='pending'
- Verifica que tu usuario tiene role='master' en tabla `profiles`
- Revisa la consola del navegador (F12) para errores

### 3.5 Test: APROBAR Solicitud

1. Click en botón **"Aprobar"** (verde)

2. **Modal debe abrirse** mostrando:
   - Información Personal (nombre, email, cédula, teléfono)
   - Datos Bancarios ACH (banco, tipo cuenta, número, titular)
   - Dropdown **"Rol"**: broker (por defecto)
   - Dropdown **"% Comisión"**: 82% (0.82) por defecto

3. **Selecciona:**
   - Rol: **broker**
   - % Comisión: **82% (0.82)** (o el que prefieras)

4. Click **"Confirmar Aprobación"**

5. **Loading spinner** debe aparecer brevemente

6. **Resultado Esperado:**
   ```
   ✅ Toast verde: "Usuario aprobado y creado exitosamente"
   ✅ Modal se cierra automáticamente
   ✅ La solicitud desaparece de la lista de pendientes
   ✅ Card "Pendientes" ahora muestra: 0
   ✅ Card "Aprobadas" ahora muestra: 1
   ```

### 3.6 Verificar en Supabase (CRÍTICO)

#### Tabla: auth.users
```sql
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'test@example.com';
```

✅ **Debe existir:**
- id: [uuid]
- email: test@example.com
- email_confirmed_at: [timestamp] ← DEBE estar confirmado

#### Tabla: profiles
```sql
SELECT id, email, full_name, role, broker_id 
FROM profiles 
WHERE email = 'test@example.com';
```

✅ **Debe existir:**
- id: [uuid] (mismo que auth.users)
- email: test@example.com
- full_name: Juan Pérez
- **role: broker** ← IMPORTANTE
- **broker_id: [uuid]** (mismo que id) ← IMPORTANTE

#### Tabla: brokers
```sql
SELECT 
  id, p_id, name, email, national_id, 
  bank_route, bank_account_no, tipo_cuenta, beneficiary_name, 
  percent_default, active
FROM brokers 
WHERE email = 'test@example.com';
```

✅ **Debe existir:**
- id: [uuid] (mismo que auth.users y profiles)
- p_id: [uuid] (mismo que id)
- name: Juan Pérez
- email: test@example.com
- national_id: 8-123-4567
- **bank_route: [código banco]** ← DEBE existir
- **bank_account_no: 1234567890** ← DEBE existir
- **tipo_cuenta: 03 o 04** ← DEBE existir
- **beneficiary_name: JUAN PEREZ** ← DEBE existir (MAYÚSCULAS sin acentos)
- **percent_default: 0.82** ← Porcentaje seleccionado
- active: true

#### Tabla: user_requests
```sql
SELECT 
  id, email, status, 
  assigned_role, assigned_commission_percent, 
  reviewed_by, reviewed_at 
FROM user_requests 
WHERE email = 'test@example.com';
```

✅ **Debe existir Y estar actualizado:**
- status: **approved** (antes era pending) ← IMPORTANTE
- assigned_role: **broker** ← IMPORTANTE
- assigned_commission_percent: **0.82** ← IMPORTANTE
- reviewed_by: [uuid del master] ← IMPORTANTE
- reviewed_at: [timestamp] ← IMPORTANTE

### 3.7 Test: Login del Nuevo Usuario

1. **Logout** del Master
2. Ve a `/login`
3. **Login con:**
   - Email: test@example.com
   - Password: 123456

4. ✅ **Debe funcionar** y redirigir al dashboard
5. ✅ El usuario debe tener acceso como **broker**

---

## 🗑️ PASO 4: TEST DE RECHAZO (MASTER)

### 4.1 Crear Nueva Solicitud

1. Abre navegador en **modo incógnito**
2. Ve a `http://localhost:3000/new-user`
3. Llena el formulario con **DIFERENTE email**: test2@example.com
4. Envía la solicitud

### 4.2 Login como Master

1. `http://localhost:3000/login` (como Master)
2. Ve a `http://localhost:3000/requests`
3. Deberías ver la **nueva solicitud** de test2@example.com

### 4.3 Rechazar Solicitud

1. Click en botón **"Rechazar"** (rojo)
2. **Confirm dialog** debe aparecer:
   ```
   "¿Estás seguro de rechazar y ELIMINAR esta solicitud? 
    Se borrará permanentemente de la base de datos."
   ```
3. Click **"OK"** para confirmar

4. **Resultado Esperado:**
   ```
   ✅ Toast: "Solicitud rechazada y eliminada"
   ✅ La solicitud desaparece de la lista inmediatamente
   ✅ Card "Pendientes" se actualiza
   ```

### 4.4 Verificar en Supabase

```sql
SELECT * FROM user_requests WHERE email = 'test2@example.com';
```

✅ **Debe retornar: 0 filas** (completamente eliminada)

```sql
SELECT * FROM auth.users WHERE email = 'test2@example.com';
```

✅ **Debe retornar: 0 filas** (nunca se creó el usuario)

```sql
SELECT * FROM brokers WHERE email = 'test2@example.com';
```

✅ **Debe retornar: 0 filas** (nunca se creó el broker)

---

## ✅ CHECKLIST FINAL

Marca cada item después de verificarlo:

### Setup Inicial:
- [ ] Script `fix_user_requests_rls.sql` ejecutado en Supabase
- [ ] Script `verify_user_requests_setup.sql` retorna "TODO ESTÁ CORRECTAMENTE CONFIGURADO"
- [ ] 4 políticas RLS visibles en Supabase

### Test Formulario Público:
- [ ] Formulario /new-user accesible sin login
- [ ] Los 3 pasos se completan sin errores
- [ ] Mensaje de éxito aparece
- [ ] Redirige a /login después de 3 segundos
- [ ] Nueva fila en `user_requests` con status='pending'

### Test Aprobación:
- [ ] Master puede ver solicitudes en /requests
- [ ] Botón "Aprobar" abre modal correctamente
- [ ] Modal muestra todos los datos (personales + ACH)
- [ ] Al confirmar, toast de éxito aparece
- [ ] Solicitud desaparece de pendientes
- [ ] Nueva fila en `auth.users` con email confirmado
- [ ] Nueva fila en `profiles` con role='broker'
- [ ] Nueva fila en `brokers` con datos ACH completos
- [ ] Fila en `user_requests` actualizada a status='approved'
- [ ] Nuevo usuario puede hacer login exitosamente

### Test Rechazo:
- [ ] Master puede rechazar solicitud
- [ ] Confirm dialog aparece
- [ ] Toast de "rechazada y eliminada" aparece
- [ ] Solicitud desaparece de la lista
- [ ] Fila en `user_requests` completamente eliminada
- [ ] NO se crea nada en auth.users, profiles, ni brokers

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### ❌ "No autorizado" al enviar solicitud

**Causa:** Políticas RLS no creadas.

**Solución:**
```bash
1. Ejecuta migrations/fix_user_requests_rls.sql en Supabase
2. Verifica con migrations/verify_user_requests_setup.sql
```

### ❌ "Solo Master puede ver solicitudes"

**Causa:** Usuario no tiene role='master'.

**Solución:**
```sql
-- Verificar tu rol
SELECT id, email, role FROM profiles WHERE email = '[TU_EMAIL]';

-- Si es NULL o 'broker', actualizar a master:
UPDATE profiles SET role = 'master' WHERE email = '[TU_EMAIL]';
```

### ❌ Modal de aprobación no abre

**Causa:** JavaScript error o estado incorrecto.

**Solución:**
```
1. Abre DevTools (F12)
2. Ve a pestaña "Console"
3. Busca errores en rojo
4. Si ves "selectedRequest is null", refresca la página
```

### ❌ "Error al crear usuario" al aprobar

**Causa:** Email ya existe en auth.users.

**Solución:**
```sql
-- Verificar si existe
SELECT id, email FROM auth.users WHERE email = 'test@example.com';

-- Si existe, eliminarlo (CUIDADO en producción)
DELETE FROM auth.users WHERE email = 'test@example.com';
```

### ❌ Datos ACH no se guardan en brokers

**Causa:** Campos NULL o mapeo incorrecto.

**Solución:**
```
1. Verifica en Supabase Table Editor que user_requests tiene:
   - bank_route (no NULL)
   - bank_account_no (no NULL)
   - tipo_cuenta (no NULL)
   - nombre_completo_titular (no NULL)

2. Si faltan, el formulario tiene un problema. Verifica que:
   - Seleccionaste un banco del dropdown
   - Seleccionaste tipo de cuenta
   - Llenaste número de cuenta
   - Llenaste nombre titular
```

---

## 📊 RESULTADO ESPERADO AL FINAL

Si todos los tests pasan:

✅ **Formulario público funciona** - Usuarios pueden solicitar acceso sin login
✅ **RLS funciona** - Anonymous puede INSERT, Master puede SELECT/UPDATE/DELETE
✅ **Master puede aprobar** - Crea usuario completo con datos ACH
✅ **Master puede rechazar** - Elimina solicitud sin crear usuario
✅ **Datos ACH correctos** - Banco, cuenta, tipo, titular guardados en brokers
✅ **Nuevo usuario puede login** - Credenciales funcionan correctamente

---

## 🎉 ¡FELICIDADES!

Si llegaste aquí y todos los tests pasaron, el flujo está **100% funcional**.

**Ahora puedes:**
1. Compartir el link `/new-user` con nuevos corredores
2. Revisar solicitudes en `/requests` como Master
3. Aprobar usuarios y asignarles comisiones
4. Los nuevos usuarios tendrán sus datos bancarios ACH listos para pagos

**Archivos de referencia:**
- `FIX_RLS_USER_REQUESTS_COMPLETE.md` - Explicación técnica completa
- `VERIFICACION_FLUJO_COMPLETO.md` - Análisis detallado del código
- `migrations/fix_user_requests_rls.sql` - Script SQL de fix
- `migrations/verify_user_requests_setup.sql` - Script de verificación
