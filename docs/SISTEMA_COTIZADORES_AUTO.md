# Sistema de Cotizadores de Seguros de Auto

**Fecha:** 29 de octubre de 2025  
**Versión:** 1.0  
**Módulo:** Cotizadores (/quotes)

## 🎯 Resumen Ejecutivo

Sistema completo de cotización y emisión de seguros de auto con dos flujos principales:
1. **Daños a Terceros** - Tarifas fijas, emisión directa
2. **Cobertura Completa** - Cotización dinámica vía API, emisión con fotos

---

## 📁 Estructura de Archivos

```
src/
├── app/(app)/quotes/
│   ├── page.tsx                    # Landing: Selector Daños a Terceros vs Cobertura Completa
│   ├── third-party/
│   │   ├── page.tsx                # Comparador de tarifas (5 aseguradoras)
│   │   └── issue/
│   │       └── [plan]/page.tsx     # Formulario de emisión
│   └── comprehensive/
│       ├── quote/page.tsx          # Formulario cotización
│       ├── results/page.tsx        # Resultados de cotización
│       └── issue/
│           └── [plan]/page.tsx     # Formulario de emisión + fotos
├── components/quotes/
│   ├── ThirdPartyComparison.tsx    # Grid de comparación de planes
│   ├── ThirdPartyIssuanceForm.tsx  # Formulario emisión Daños a Terceros
│   ├── ComprehensiveQuoteForm.tsx  # Formulario cotización Cobertura Completa
│   ├── ComprehensiveResults.tsx    # Resultados cotización
│   ├── ComprehensiveIssuanceForm.tsx # Formulario emisión Cobertura Completa
│   └── VehiclePhotosUpload.tsx     # Upload de 6 fotos del vehículo
└── lib/constants/
    └── auto-quotes.ts              # ✅ YA CREADO - Tarifas Daños a Terceros

```

---

## 🚗 MÓDULO 1: DAÑOS A TERCEROS

### **Características**
- ✅ Tarifas fijas predefinidas (archivo `auto-quotes.ts` ya creado)
- ✅ Sin cotización necesaria
- ✅ Comparación directa de 5 aseguradoras
- ✅ Emisión inmediata al seleccionar plan

### **Flujo de Usuario**

```
1. Usuario entra a /quotes
   ↓
2. Selecciona "Daños a Terceros"
   ↓
3. Ve comparador con 5 aseguradoras × 2 planes (Básico/Premium)
   ↓
4. Click en plan deseado → Modal de cuotas (si aplica)
   ↓
5. Confirma → Redirige a /quotes/third-party/issue/[insurer]-[plan]
   ↓
6. Llena formulario de emisión completo
   ↓
7. Submit → Crea caso "EMISION_AUTO" en BD
```

### **Aseguradoras y Planes**

#### 🟦 **INTERNACIONAL de Seguros**
**Plan Básico - B/.154.00/año**
- ✅ Lesiones corporales: 5,000 / 10,000
- ✅ Daños a la propiedad: 5,000
- ✅ Gastos médicos: 500 / 2,500
- ❌ Muerte accidental conductor
- ❌ Muerte accidental pasajeros
- ❌ Gastos funerarios
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ⚠️ Asistencia vial: Conexión
- ⚠️ Grúa: Conexión
- ❌ Asistencia legal
- 💰 **Sin cuotas**

**Plan Premium - B/.183.00/año**
- ✅ Lesiones corporales: 10,000 / 20,000
- ✅ Daños a la propiedad: 10,000
- ✅ Gastos médicos: 2,000 / 10,000
- ❌ Muerte accidental conductor
- ❌ Muerte accidental pasajeros
- ❌ Gastos funerarios
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ✅ Asistencia vial
- ✅ Grúa: Hasta B/.150 o máx 3 eventos/año
- ✅ Asistencia legal
- 💳 **Hasta 3 cuotas con TCR**

#### 🟨 **FEDPA Seguros**
**Plan Básico - B/.115.00/año**
- ✅ Lesiones corporales: 5,000 / 10,000
- ✅ Daños a la propiedad: 5,000
- ❌ Gastos médicos
- ❌ Muerte accidental conductor
- ❌ Muerte accidental pasajeros
- ⚠️ Gastos funerarios: 1,500 (solo conductor)
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ❌ Asistencia vial
- ⚠️ Grúa: Hasta B/.100, máx 1 evento/año
- ✅ Asistencia legal
- 💳 **B/.140 en 2 pagos de B/.70**

**Plan Premium - B/.150.00/año**
- ✅ Lesiones corporales: 5,000 / 10,000
- ✅ Daños a la propiedad: 10,000
- ✅ Gastos médicos: 500 / 2,500
- ⚠️ Muerte accidental conductor: 5,000
- ❌ Muerte accidental pasajeros
- ✅ Gastos funerarios: 1,500
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ✅ Asistencia vial
- ✅ Grúa: Hasta B/.150, máx 2 eventos/año
- ✅ Asistencia legal
- 💳 **B/.182.61 en 2 pagos de B/.91.31**

#### 🟥 **MAPFRE Panamá**
**Plan Básico - B/.155.00/año**
- ✅ Lesiones corporales: 5,000 / 10,000
- ✅ Daños a la propiedad: 5,000
- ❌ Gastos médicos
- ❌ Muerte accidental conductor
- ❌ Muerte accidental pasajeros
- ❌ Gastos funerarios
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ❌ Asistencia vial
- ❌ Grúa
- ✅ Asistencia legal
- 💰 **Sin cuotas**

**Plan Premium - B/.199.00/año**
- ✅ Lesiones corporales: 5,000 / 10,000
- ✅ Daños a la propiedad: 5,000
- ❌ Gastos médicos
- ⚠️ Muerte accidental conductor: 5,000 / 25,000
- ❌ Muerte accidental pasajeros
- ✅ Gastos funerarios: 1,500
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ✅ Asistencia vial
- ✅ Grúa: Hasta B/.150, máx 2 eventos/año
- ✅ Asistencia legal
- 💰 **Sin cuotas**

#### 🟩 **ASSA Seguros**
**Plan Básico - B/.150.00/año**
- ✅ Lesiones corporales: 5,000 / 10,000
- ✅ Daños a la propiedad: 5,000
- ❌ Gastos médicos
- ❌ Muerte accidental conductor
- ❌ Muerte accidental pasajeros
- ❌ Gastos funerarios
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ❌ Asistencia vial
- ❌ Grúa
- ✅ Asistencia legal
- 💰 **Sin cuotas**
- 💳 **Más económico con tarjeta de crédito**

**Plan Premium - B/.195.00/año**
- ✅ Lesiones corporales: 10,000 / 20,000
- ✅ Daños a la propiedad: 10,000
- ✅ Gastos médicos: 2,000 / 10,000
- ⚠️ Muerte accidental conductor: 10,000
- ⚠️ Muerte accidental pasajeros: 10,000 / 50,000
- ✅ Gastos funerarios: 1,500
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ✅ Asistencia vial
- ✅ Grúa: Hasta B/.150, máx 3 eventos/año
- ✅ Asistencia legal
- 💰 **Sin cuotas**
- 💳 **Más económico con tarjeta de crédito**

#### 🟦 **ANCÓN Seguros**
**Plan Básico - B/.221.86/año**
- ✅ Lesiones corporales: 5,000 / 10,000
- ✅ Daños a la propiedad: 10,000
- ✅ Gastos médicos: 1,000 / 5,000
- ❌ Muerte accidental conductor
- ❌ Muerte accidental pasajeros
- ❌ Gastos funerarios
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ❌ Asistencia vial
- ✅ Grúa: Hasta B/.150/evento
- ✅ Asistencia legal
- 💰 **Sin cuotas**

**Plan Premium - B/.236.33/año**
- ✅ Lesiones corporales: 10,000 / 20,000
- ✅ Daños a la propiedad: 10,000
- ✅ Gastos médicos: 2,000 / 10,000
- ❌ Muerte accidental conductor
- ❌ Muerte accidental pasajeros
- ❌ Gastos funerarios
- ✅ Asistencia en accidentes
- ✅ Ambulancia
- ✅ Asistencia vial
- ✅ Grúa: Hasta B/.150/evento
- ✅ Asistencia legal
- 💰 **Sin cuotas**

### **Formulario de Emisión - Daños a Terceros**

#### **Sección 1: Datos Personales del Contratante**
```typescript
{
  firstName: string;          // Nombre
  lastName: string;           // Apellido
  nationalId: string;         // Cédula o Pasaporte
  address: string;            // Dirección residencia
  email: string;              // Correo electrónico
  occupation: string;         // Ocupación
  maritalStatus: string;      // Estado civil (dropdown)
  birthDate: string;          // Fecha de nacimiento (date picker)
}
```

#### **Sección 2: Generales del Vehículo**
```typescript
{
  plateNumber: string;        // Número de placa
  brand: string;              // Marca (dropdown)
  model: string;              // Modelo
  year: number;               // Año del vehículo
  vin: string;                // Número VIN
  motorNumber: string;        // Número de motor
  color: string;              // Color del vehículo
  transmission: string;       // Tipo de transmisión (Manual/Automático)
  occupants: number;          // Cantidad de ocupantes
  plateRenewalMonth: number;  // Mes de renovación de placa (1-12)
}
```

#### **Sección 3: Datos del Conductor Principal**
```typescript
{
  sameAsContractor: boolean;  // Checkbox "El mismo que el contratante"
  // Si false, solicitar:
  driverFirstName: string;
  driverLastName: string;
  driverNationalId: string;
  driverBirthDate: string;
}
```

---

## 🛡️ MÓDULO 2: COBERTURA COMPLETA

### **Características**
- Cotización dinámica vía API (skeleton por ahora)
- 5 aseguradoras: ASSA, ANCÓN, MAPFRE, FEDPA, INTERNACIONAL
- Requiere fotos del vehículo para emisión
- Límites personalizados de cobertura

### **Flujo de Usuario**

```
1. Usuario entra a /quotes
   ↓
2. Selecciona "Cobertura Completa"
   ↓
3. Llena formulario de cotización (datos básicos)
   ↓
4. Submit → Llama API → Muestra resultados de 5 aseguradoras
   ↓
5. Selecciona plan → Redirige a /quotes/comprehensive/issue/[insurer]-[plan]
   ↓
6. Llena formulario completo + sube 6 fotos del vehículo
   ↓
7. Submit → Crea caso "EMISION_AUTO" con fotos adjuntas
```

### **Formulario de Cotización - Cobertura Completa**

#### **Datos del Cliente (Simplificado)**
```typescript
{
  firstName: string;
  lastName: string;
  birthDate: string;
  maritalStatus: string;
}
```

#### **Datos del Vehículo**
```typescript
{
  insuredAmount: number;      // Suma asegurada
  // Límites de coberturas
  bodilyInjuryLimit: string;  // Lesiones corporales (ej: "10,000 / 20,000")
  propertyDamageLimit: string; // Daños a la propiedad
  medicalExpensesLimit: string; // Gastos médicos
  // Generales
  brand: string;
  model: string;
  year: number;
}
```

### **Formulario de Emisión - Cobertura Completa**

Incluye TODO lo de Daños a Terceros MÁS:

#### **Sección 4: Fotos del Vehículo (6 requeridas)**

Basado en el sistema de casos/pendientes, las 6 fotos son:

```typescript
const REQUIRED_VEHICLE_PHOTOS = [
  {
    name: 'frontal',
    label: '📷 Foto Frontal',
    description: 'Vista completa frontal del vehículo',
    required: true,
  },
  {
    name: 'trasera',
    label: '📷 Foto Trasera',
    description: 'Vista completa trasera del vehículo',
    required: true,
  },
  {
    name: 'lateral_izquierda',
    label: '📷 Foto Lateral Izquierda',
    description: 'Vista lateral completa del lado izquierdo',
    required: true,
  },
  {
    name: 'lateral_derecha',
    label: '📷 Foto Lateral Derecha',
    description: 'Vista lateral completa del lado derecho',
    required: true,
  },
  {
    name: 'tablero',
    label: '📷 Foto del Tablero',
    description: 'Vista del tablero mostrando kilometraje',
    required: true,
  },
  {
    name: 'serial_motor',
    label: '📷 Foto Serial del Motor',
    description: 'Número de serial del motor visible',
    required: true,
  },
];
```

**Validaciones:**
- Formato: JPG, JPEG, PNG
- Tamaño máximo: 5MB por foto
- Todas las 6 fotos son obligatorias
- Preview antes de submit

---

## 📱 UI/UX - Mobile First

### **Comparador de Daños a Terceros**

#### **Desktop (>1024px)**
```
┌─────────────────────────────────────────────────────────────┐
│                  Comparador de Daños a Terceros             │
├─────────────────────────────────────────────────────────────┤
│ 🟦 INTERNACIONAL │ 🟨 FEDPA    │ 🟥 MAPFRE  │ 🟩 ASSA │ 🟦 ANCÓN │
│                                                               │
│ Plan Básico      │ Plan Básico │ Plan Básico│Plan Básico│Plan Básico│
│ B/.154          │ B/.115      │ B/.155    │B/.150    │B/.221.86  │
│ ✅ Lesiones 5/10K│ ✅ Lesiones  │ ✅ Lesiones│✅ Lesiones│✅ Lesiones│
│ ✅ Daños 5K      │ ✅ Daños 5K  │ ✅ Daños  │✅ Daños  │✅ Daños 10K│
│ ✅ Gastos méd.   │ ❌ Gastos    │ ❌ Gastos │❌ Gastos │✅ Gastos  │
│ ...              │ ...          │ ...       │...       │...        │
│ [Seleccionar]    │[Seleccionar] │[Select.]  │[Select.] │[Seleccionar]│
│                                                               │
│ Plan Premium     │ Plan Premium │Plan Premium│Plan Premium│Plan Premium│
│ B/.183          │ B/.150      │ B/.199    │B/.195    │B/.236.33  │
│ [Seleccionar]    │[Seleccionar] │[Select.]  │[Select.] │[Seleccionar]│
└─────────────────────────────────────────────────────────────┘
```

#### **Mobile (<768px)**
```
┌──────────────────────────────┐
│ Daños a Terceros             │
├──────────────────────────────┤
│                              │
│ 🟦 INTERNACIONAL de Seguros  │
│ ┌──────────────────────────┐ │
│ │ Plan Básico              │ │
│ │ B/.154.00/año           │ │
│ │                          │ │
│ │ ✅ Lesiones 5/10K        │ │
│ │ ✅ Daños 5K              │ │
│ │ ✅ Gastos méd. 500/2.5K  │ │
│ │ ❌ Muerte conductor      │ │
│ │ ...                      │ │
│ │                          │ │
│ │ [Ver Detalles] [Contratar]│ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ Plan Premium             │ │
│ │ B/.183.00/año           │ │
│ │ 💳 Hasta 3 cuotas TCR    │ │
│ │ [Ver Detalles] [Contratar]│ │
│ └──────────────────────────┘ │
│                              │
│ 🟨 FEDPA Seguros            │
│ [Plans...]                   │
│                              │
│ (scroll continúa...)         │
└──────────────────────────────┘
```

### **Colores Corporativos en Cotizadores**

```css
/* Botón Primario - Contratar/Cotizar */
.btn-primary {
  background: linear-gradient(135deg, #010139 0%, #020270 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s;
}

.btn-primary:hover {
  box-shadow: 0 8px 16px rgba(1, 1, 57, 0.3);
  transform: translateY(-2px);
}

/* Botón Secundario - Ver Detalles */
.btn-secondary {
  background: #8AAA19;
  color: white;
}

.btn-secondary:hover {
  background: #6d8814;
}

/* Cards de Aseguradoras */
.insurer-card {
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s;
}

.insurer-card:hover {
  border-color: #8AAA19;
  box-shadow: 0 4px 12px rgba(138, 170, 25, 0.2);
}

/* Checkmarks y X's */
.coverage-yes {
  color: #10b981; /* Verde */
}

.coverage-no {
  color: #ef4444; /* Rojo */
}

.coverage-partial {
  color: #f59e0b; /* Amarillo */
}
```

---

## 🔗 Integración con Sistema Existente

### **Crear Caso Automáticamente**

Cuando el usuario completa la emisión, el sistema debe:

```typescript
// Crear caso en tabla `cases`
const caseData = {
  section: 'RAMOS_GENERALES',
  status: 'PENDIENTE_REVISION',
  management_type: 'EMISION_AUTO',
  policy_type: coverageType === 'third-party' ? 'AUTO' : 'AUTO_COMPREHENSIVE',
  client_name: `${firstName} ${lastName}`,
  insurer_id: selectedInsurerId,
  policy_number: null, // Se asignará al emitir
  premium: selectedPlan.annualPremium,
  payment_method: paymentMethod,
  client_data: {
    // Guardar toda la info del formulario
    personal: {...},
    vehicle: {...},
    driver: {...}
  },
  notes: `Cotización/Emisión desde portal web - ${coverageType}`,
};

// Si es cobertura completa, adjuntar fotos
if (coverageType === 'comprehensive') {
  // Upload 6 fotos a storage bucket 'pendientes'
  // Crear registros en `case_files` con category: 'inspection'
}
```

### **Notificar al Broker**

- Email automático al broker asignado
- Notificación en campana del portal
- Caso aparece en lista de pendientes

---

## 🎯 Plan de Implementación

### **Fase 1: Daños a Terceros (Prioritario)** ⭐

1. ✅ **Crear constantes** - `auto-quotes.ts` (YA HECHO)
2. **Crear página landing** - `/quotes/page.tsx`
   - Botón "Daños a Terceros"
   - Botón "Cobertura Completa"
3. **Crear comparador** - `ThirdPartyComparison.tsx`
   - Grid responsive de 5 aseguradoras × 2 planes
   - Modal de cuotas al seleccionar
4. **Crear formulario de emisión** - `ThirdPartyIssuanceForm.tsx`
   - 3 secciones (Personal, Vehículo, Conductor)
   - Validaciones
   - Submit → Crear caso

### **Fase 2: Cobertura Completa**

1. **Crear formulario de cotización** - `ComprehensiveQuoteForm.tsx`
2. **Crear skeleton de resultados** - `ComprehensiveResults.tsx`
3. **Crear formulario de emisión** - `ComprehensiveIssuanceForm.tsx`
4. **Integrar upload de fotos** - `VehiclePhotosUpload.tsx`
   - Reutilizar lógica de casos/pendientes
   - 6 fotos obligatorias

### **Fase 3: APIs y Backend**

1. **Endpoint de cotización** - `/api/quotes/comprehensive`
2. **Integración con APIs de aseguradoras** (futuro)
3. **Webhook para actualizaciones de estado**

---

## 📊 Métricas y Analytics

### **Tracking Sugerido**

```typescript
// Event: User views comparison
analytics.track('Quote:ViewComparison', {
  coverageType: 'third-party' | 'comprehensive',
  insurersShown: 5,
});

// Event: User selects plan
analytics.track('Quote:SelectPlan', {
  insurer: 'ASSA',
  plan: 'premium',
  annualPremium: 195.00,
  installmentsAvailable: false,
});

// Event: User completes issuance
analytics.track('Quote:CompleteIssuance', {
  insurer: 'FEDPA',
  coverageType: 'third-party',
  premiumPaid: 150.00,
  paymentMethod: 'installments',
  caseId: 'xxx-xxx-xxx',
});
```

---

## 🚀 Estado Actual

### ✅ **Completado**
- Archivo de constantes con tarifas de Daños a Terceros
- Estructura de datos definida
- Documentación completa del sistema

### 🔨 **Pendiente**
- Crear páginas y rutas
- Desarrollar componentes UI
- Integrar con sistema de casos
- Formularios de emisión
- Upload de fotos para cobertura completa
- APIs de cotización

---

## 💡 Recomendaciones Técnicas

1. **Reutilizar componentes existentes**
   - FormInput de casos
   - FileUpload de casos
   - Modal de base de datos

2. **Estado global con Context**
   ```typescript
   const QuoteContext = {
     coverageType: 'third-party' | 'comprehensive',
     selectedInsurer: string,
     selectedPlan: AutoThirdPartyPlan,
     formData: any,
   };
   ```

3. **Validaciones con Zod**
   ```typescript
   const ThirdPartySchema = z.object({
     firstName: z.string().min(2),
     nationalId: z.string().regex(/^\d{1,2}-\d{1,4}-\d{1,6}$/),
     plateNumber: z.string().regex(/^[A-Z0-9-]+$/),
     // ...
   });
   ```

4. **Mobile-first siempre**
   - Grid responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-5`
   - Botones táctiles: `min-h-[44px]`
   - Texto legible: `text-base md:text-lg`

---

## 📞 Próximos Pasos

1. **Revisar y validar** esta documentación
2. **Priorizar** Daños a Terceros vs Cobertura Completa
3. **Crear estructura** de rutas y páginas
4. **Desarrollar componentes** uno por uno
5. **Integrar** con sistema de casos existente
6. **Testing** mobile y desktop
7. **Deploy** a producción

---

**Estado:** ✅ **DOCUMENTACIÓN COMPLETA - LISTO PARA IMPLEMENTACIÓN**

El archivo `auto-quotes.ts` con todas las tarifas ya está creado. Ahora puedes comenzar a desarrollar los componentes UI siguiendo esta guía completa. 🚀
