# Sistema de Cotizadores - Progreso de Implementación

**Fecha:** 30 de octubre de 2025  
**Estado:** En Progreso - 60% Completado

## ✅ COMPLETADO

### 1. **Constantes y Datos** (100%)
- ✅ `src/lib/constants/auto-quotes.ts`
  - 5 aseguradoras con planes básico y premium
  - Todas las tarifas fijas
  - Información de cuotas
  - Labels de coberturas

### 2. **Páginas Landing y Navegación** (100%)
- ✅ `/quotes` - Landing principal con selector de cobertura
  - Cards de Daños a Terceros y Cobertura Completa
  - Diseño mobile-first
  - Colores corporativos aplicados
  
- ✅ `/quotes/third-party` - Página comparador
  - Header con descripción
  - Componente ThirdPartyComparison integrado
  - Info footer con guías

### 3. **Componentes de UI** (100%)
- ✅ `ThirdPartyComparison.tsx` (300+ líneas)
  - Vista desktop: Tabla comparativa de 5×2 planes
  - Vista mobile: Cards expandibles
  - Modal de cuotas
  - Iconos ✓/✗ para coberturas
  - Branding corporativo completo

- ✅ `ThirdPartyIssuanceForm.tsx` (600+ líneas)
  - Formulario de 3 pasos con wizard
  - Paso 1: Datos personales (8 campos + validaciones)
  - Paso 2: Datos del vehículo (10 campos + validaciones)
  - Paso 3: Datos del conductor (checkbox "mismo que contratante")
  - Validaciones inline
  - Auto-fill de conductor
  - Indicador visual de progreso
  - Responsive completo

## 🔨 PENDIENTE

### 4. **Página de Emisión** (Falta crear)
```
src/app/(app)/quotes/third-party/issue/page.tsx
```

**Debe:**
- Leer parámetros `insurer` y `plan` de URL
- Buscar datos de la aseguradora desde AUTO_THIRD_PARTY_INSURERS
- Renderizar ThirdPartyIssuanceForm
- Manejar submit → crear caso en BD

### 5. **Server Action** (Falta crear)
```
src/app/(app)/quotes/actions.ts
```

**Función:** `actionCreateQuoteCase(data: FormData, insurerData, planData)`

**Debe:**
- Crear registro en tabla `cases` con:
  - `section`: 'RAMOS_GENERALES'
  - `status`: 'PENDIENTE_REVISION'
  - `management_type`: 'EMISION_AUTO'
  - `policy_type`: 'AUTO'
  - `client_name`: `${firstName} ${lastName}`
  - `insurer_id`: buscar en tabla insurers por nombre
  - `premium`: annualPremium
  - `client_data`: JSON con todo el formData
  - `notes`: `Cotización desde portal - Daños a Terceros`

- Enviar notificación al broker asignado
- Return: `{ ok: true, caseId: string }` o `{ ok: false, error: string }`

### 6. **Flujo Cobertura Completa** (Skeleton)

#### 6.1 Página Cotización
```
src/app/(app)/quotes/comprehensive/page.tsx
```

**Formulario simplificado:**
- Nombre + Apellido
- Fecha de nacimiento
- Estado civil
- Suma asegurada
- Límites: Lesiones, Daños, Gastos médicos
- Marca, Modelo, Año

**Submit:** Mock API call → redirige a `/quotes/comprehensive/results`

#### 6.2 Página Resultados (Skeleton)
```
src/app/(app)/quotes/comprehensive/results/page.tsx
```

**Mostrar:**
- 5 aseguradoras con primas "calculadas"
- Banner: "🚧 Cotización preliminar - API en integración"
- Botón "Seleccionar" → redirige a emisión

#### 6.3 Página Emisión + Fotos
```
src/app/(app)/quotes/comprehensive/issue/page.tsx
```

**Reutilizar:**
- ThirdPartyIssuanceForm (todos los campos)
- **AGREGAR:** VehiclePhotosUpload (6 fotos obligatorias)

**Fotos requeridas:**
1. Frontal
2. Trasera
3. Lateral izquierda
4. Lateral derecha
5. Tablero (kilometraje)
6. Serial del motor

---

## 📂 Estructura de Archivos Actual

```
src/
├── lib/constants/
│   └── auto-quotes.ts ✅
├── components/quotes/
│   ├── ThirdPartyComparison.tsx ✅
│   ├── ThirdPartyIssuanceForm.tsx ✅
│   ├── ComprehensiveQuoteForm.tsx ❌ (pendiente)
│   ├── ComprehensiveResults.tsx ❌ (pendiente)
│   └── VehiclePhotosUpload.tsx ❌ (pendiente)
└── app/(app)/quotes/
    ├── page.tsx ✅
    ├── actions.ts ❌ (pendiente)
    ├── third-party/
    │   ├── page.tsx ✅
    │   └── issue/
    │       └── page.tsx ❌ (pendiente)
    └── comprehensive/
        ├── page.tsx ❌ (pendiente)
        ├── results/
        │   └── page.tsx ❌ (pendiente)
        └── issue/
            └── page.tsx ❌ (pendiente)
```

---

## 🎯 Próximos Pasos Inmediatos

### **PRIORIDAD ALTA**

1. **Crear `/quotes/third-party/issue/page.tsx`**
   - Integrar ThirdPartyIssuanceForm
   - Leer URL params
   - Manejar submit

2. **Crear `actions.ts`**
   - actionCreateQuoteCase
   - Validaciones de server-side
   - Integración con tabla `cases`

3. **Testing Daños a Terceros**
   - Verificar flujo completo
   - Mobile testing
   - Crear caso de prueba

### **PRIORIDAD MEDIA**

4. **Skeleton Cobertura Completa**
   - Página de cotización simple
   - Resultados con datos mock
   - Mensaje "API en integración"

5. **Upload de Fotos**
   - Reutilizar lógica de casos
   - 6 fotos obligatorias
   - Preview antes de submit

### **PRIORIDAD BAJA**

6. **Integración Real**
   - APIs de aseguradoras
   - Cálculos reales de primas
   - Webhooks de confirmación

---

## 🚀 Comandos de Verificación

```bash
# Verificar tipos
npm run typecheck

# Iniciar dev server
npm run dev

# Rutas para probar:
# http://localhost:3000/quotes
# http://localhost:3000/quotes/third-party
# http://localhost:3000/quotes/third-party/issue?insurer=assa&plan=premium
```

---

## 📝 Notas de Implementación

### **Decisiones de Diseño**

1. **Modal Inline vs Componente**
   - Se usó modal inline en ThirdPartyComparison para evitar dependencias del Modal existente que tenía props diferentes

2. **Validaciones**
   - Frontend: Validaciones inmediatas en cada paso
   - Backend: Validaciones adicionales en server action

3. **Estado del Formulario**
   - useState local en cada componente
   - No se usa Context porque es flujo lineal

4. **Mobile-First**
   - Desktop: Tabla comparativa completa
   - Mobile: Cards apilados con toda la info

### **Colores Aplicados**

```css
Primary (Azul): #010139
Secondary (Verde): #8AAA19
Gradients:
  - from-[#010139] to-[#020270] (azul)
  - from-[#8AAA19] to-[#6d8814] (verde)
```

---

## ⚠️ Pendientes Críticos Antes de Producción

1. ❌ **Validar datos con aseguradoras**
   - Confirmar tarifas actuales
   - Verificar coberturas exactas
   - Actualizar cuotas si cambian

2. ❌ **Crear tabla de cotizaciones** (opcional)
   - Guardar cotizaciones antes de emisión
   - Analytics de conversión
   - Follow-up de cotizaciones no completadas

3. ❌ **Emails automáticos**
   - Confirmación de cotización
   - Recordatorios de emisión pendiente
   - Notificación a brokers

4. ❌ **Panel de administración**
   - Ver cotizaciones pendientes
   - Asignar broker manualmente
   - Exportar reportes

---

## 📈 Métricas de Progreso

| Componente | Estado | Líneas | Testing |
|------------|--------|--------|---------|
| auto-quotes.ts | ✅ | 300 | ✅ |
| Landing page | ✅ | 150 | ✅ |
| Third-party page | ✅ | 100 | ✅ |
| ThirdPartyComparison | ✅ | 310 | ✅ |
| ThirdPartyIssuanceForm | ✅ | 650 | ⏳ |
| Issue page | ❌ | 0 | ❌ |
| Server actions | ❌ | 0 | ❌ |
| Comprehensive (todos) | ❌ | 0 | ❌ |

**Total:** ~1,510 líneas escritas | 60% completado

---

## 🎉 Lo Que Ya Funciona

1. ✅ Landing page con selección de cobertura
2. ✅ Comparación visual de 5 aseguradoras
3. ✅ Modal de opciones de pago (anual vs cuotas)
4. ✅ Formulario completo de 3 pasos
5. ✅ Validaciones frontend
6. ✅ Responsive design mobile-first
7. ✅ Branding corporativo consistente
8. ✅ TypeScript sin errores

---

**Última actualización:** 30 de octubre de 2025, 10:45 AM
**Próxima sesión:** Completar página de emisión y server action
