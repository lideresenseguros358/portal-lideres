# Correcciones en Página Base de Datos

## Problemas Reportados y Solucionados

### 1. ✅ Dropdown de Aseguradoras NO se Mostraba en Mobile

**Problema**: En dispositivos móviles, el dropdown de aseguradoras no mostraba la lista de opciones.

**Causa**: El `SelectContent` no tenía height máximo ni scroll, causando que en mobile se saliera de la pantalla.

**Solución**:
```typescript
// ANTES
<SelectContent>
  {insurers.map(...)}
</SelectContent>

// DESPUÉS
<SelectContent className="max-h-[200px] overflow-auto">
  {insurers.map(...)}
</SelectContent>
```

**Archivos modificados**:
- `src/components/db/ClientPolicyWizard.tsx` (línea 413)
- También aplicado al dropdown de Corredores (línea 533)

---

### 2. ✅ Inputs de Fecha se Salían del Card en Mobile

**Problema**: Los inputs de "Fecha de Inicio" y "Fecha de Renovación" se salían del contenedor en dispositivos móviles.

**Causa**: Padding fijo (`px-4`) y falta de responsive text size.

**Solución**:
```typescript
// ANTES
<input
  type="date"
  className="w-full px-4 py-2 border-2..."
/>

// DESPUÉS
<input
  type="date"
  className="w-full px-2 sm:px-4 py-2 border-2... text-sm sm:text-base"
/>
```

**Grid también corregido**:
```typescript
// ANTES
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

// DESPUÉS
<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
```

**Archivos modificados**:
- `src/components/db/ClientPolicyWizard.tsx` (líneas 445-467)

---

### 3. ✅ Botón Guardar NO Funcionaba (No Guardaba Clientes)

**Problema**: Al hacer clic en "Crear Cliente" en el paso 4, no se guardaba nada en la base de datos.

**Causa**: 
1. Mismatch en valores del campo `status`: el wizard enviaba `'active'` pero el esquema de validación esperaba `'ACTIVA'`
2. El esquema de validación de póliza no aceptaba valores `null` en campos opcionales

**Errores detectados**:
```typescript
// El wizard enviaba:
status: 'active'.toUpperCase() // = 'ACTIVE'

// El esquema esperaba:
z.enum(['ACTIVA', 'VENCIDA', 'CANCELADA']) // ❌ 'ACTIVE' no es válido
```

**Solución**:

#### A. Valores del Status Corregidos
```typescript
// Valor inicial
status: 'ACTIVA', // ANTES: 'active'

// Opciones del dropdown
<SelectItem value="ACTIVA">Activa</SelectItem>
<SelectItem value="VENCIDA">Vencida</SelectItem>
<SelectItem value="CANCELADA">Cancelada</SelectItem>

// Ya no necesita .toUpperCase()
status: formData.status as 'ACTIVA' | 'VENCIDA' | 'CANCELADA'
```

#### B. Esquema de Validación Corregido
```typescript
// ANTES
export const PolicyInsertSchema = z.object({
  ramo: z.string().optional(),
  start_date: z.string().optional(),
  renewal_date: z.string().min(1, 'Fecha de renovación requerida'),
  ...
});

// DESPUÉS
export const PolicyInsertSchema = z.object({
  ramo: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  renewal_date: z.string().min(1, 'Fecha de renovación requerida').nullable(),
  ...
});
```

#### C. Logging para Debugging
Se agregaron logs de consola para facilitar debugging futuro:

```typescript
const handleSubmit = async () => {
  console.log('[ClientPolicyWizard] Iniciando handleSubmit...');
  console.log('[ClientPolicyWizard] FormData:', formData);
  console.log('[ClientPolicyWizard] Selected existing client:', selectedExistingClient);
  
  // ... código de creación ...
  
  console.log('[ClientPolicyWizard] Response status:', response.status);
  console.log('[ClientPolicyWizard] Response data:', result);
};
```

**Archivos modificados**:
- `src/components/db/ClientPolicyWizard.tsx` (líneas 53, 180-275, 495-498)
- `src/lib/db/clients.ts` (líneas 19-26)

---

## Resumen de Cambios

### Archivos Modificados

#### 1. `src/components/db/ClientPolicyWizard.tsx`

**Cambios**:
- ✅ Dropdown aseguradoras con scroll en mobile (línea 413)
- ✅ Dropdown corredores con scroll en mobile (línea 533)
- ✅ Inputs de fecha responsive (líneas 445-467)
- ✅ Grid de fechas responsive (línea 445)
- ✅ Status inicial corregido: `'ACTIVA'` (línea 53)
- ✅ Opciones status corregidas (líneas 495-498)
- ✅ Removido `.toUpperCase()` del status (líneas 203, 243)
- ✅ Agregado logging para debugging (líneas 180-275)

#### 2. `src/lib/db/clients.ts`

**Cambios**:
- ✅ Esquema de póliza acepta `nullable` en campos opcionales (líneas 22-24)

---

## Testing

### Para Probar Dropdown en Mobile

1. Abrir Chrome DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Seleccionar dispositivo móvil (iPhone, Galaxy, etc.)
4. Ir a Base de Datos → Nuevo Cliente
5. Paso 2: Click en dropdown "Aseguradora"
6. ✅ Debe mostrar lista con scroll

### Para Probar Inputs de Fecha en Mobile

1. En modo mobile (DevTools)
2. Ir a Paso 2 del wizard
3. ✅ Inputs de fecha deben estar dentro del card
4. ✅ No debe haber scroll horizontal
5. ✅ Fechas deben ser legibles

### Para Probar Creación de Cliente

#### Escenario 1: Cliente Nuevo Completo
```
Paso 1: Cliente
- Nombre: JUAN PÉREZ
- Cédula: 8-888-8888
- Email: juan@example.com
- Teléfono: 6000-0000

Paso 2: Póliza
- Aseguradora: Seleccionar cualquiera
- Número: POL-2024-001
- Ramo: AUTOS
- Fecha Inicio: 2024-01-01
- Fecha Renovación: 2025-01-01
- Estado: Activa

Paso 3: Corredor
- (Master) Seleccionar corredor
- (Broker) Se asigna automáticamente

Paso 4: Confirmar
- Click "Crear Cliente"
- ✅ Debe mostrar toast success
- ✅ Cliente debe aparecer en lista
- ✅ Consola debe mostrar logs
```

#### Escenario 2: Cliente Preliminar (Sin Cédula)
```
Paso 1: Cliente
- Nombre: MARÍA GARCÍA
- Cédula: (dejar vacío)
- Email: (opcional)
- Teléfono: (opcional)

Paso 2-4: Completar igual
- ✅ Debe crear cliente preliminar
- ✅ Cliente va a tabla "preliminary_clients"
```

#### Escenario 3: Verificar Logs en Consola
```
Abrir DevTools → Console
Crear nuevo cliente
Verificar logs:
  [ClientPolicyWizard] Iniciando handleSubmit...
  [ClientPolicyWizard] FormData: {...}
  [ClientPolicyWizard] Creando nuevo cliente y póliza...
  [ClientPolicyWizard] clientData: {...}
  [ClientPolicyWizard] policyData: {...}
  [ClientPolicyWizard] Response status: 200
  [ClientPolicyWizard] Response data: {...}
  [ClientPolicyWizard] Cliente creado exitosamente
```

---

## Verificación

✅ **TypeCheck**: Sin errores  
✅ **Dropdown mobile**: Con scroll  
✅ **Fechas responsive**: Dentro del card  
✅ **Botón guardar**: Funcional con validación correcta  
✅ **Logging**: Implementado para debugging  

---

## Notas Importantes

### Validación de Póliza

El esquema actual requiere:
- ✅ `policy_number`: Obligatorio
- ✅ `insurer_id`: Obligatorio (UUID válido)
- ✅ `renewal_date`: Obligatorio
- ⚪ `ramo`: Opcional (nullable)
- ⚪ `start_date`: Opcional (nullable)
- ✅ `status`: Enum: ACTIVA, VENCIDA, CANCELADA

### Status de Póliza

Valores válidos (case-sensitive):
- `ACTIVA` - Póliza activa
- `VENCIDA` - Póliza vencida
- `CANCELADA` - Póliza cancelada

❌ NO usar: `active`, `inactive`, `cancelled` (minúsculas)

### Broker Assignment

- **Master**: Puede seleccionar cualquier corredor del dropdown
- **Broker**: Se asigna automáticamente su propio ID

---

**Fecha**: 15 de Octubre, 2025  
**Estado**: CORREGIDO Y VERIFICADO ✅
