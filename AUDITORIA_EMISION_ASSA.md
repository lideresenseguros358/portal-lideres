# 📋 AUDITORÍA Y PLAN DE RECONSTRUCCIÓN - EMISIÓN ESTILO ASSA

## 🔍 ESTADO ACTUAL DEL SISTEMA

### Arquitectura Actual (WIZARD CON STEPS)
```
/cotizadores/emitir?step=payment         → PaymentPlanSelector
/cotizadores/emitir?step=emission-data   → EmissionDataForm
/cotizadores/emitir?step=inspection      → VehicleInspection
/cotizadores/emitir?step=payment-info    → CreditCardInput
/cotizadores/emitir?step=review          → FinalQuoteSummary
```

**❌ PROBLEMA:** Cada step es una página separada con navegación por URL. No es la UX de ASSA.

### Componentes Existentes

**✅ EmissionDataForm.tsx**
- Campos: 17 campos del cliente + vehículo
- Upload: 3 documentos (cédula, licencia, registro)
- Estado: Completo pero disperso

**⚠️ VehicleInspection.tsx**
- SVG básico del auto (pequeño)
- 10 fotos en grid (no sobre el auto)
- NO replica UX de ASSA

**✅ PaymentPlanSelector.tsx**
- Slider emojis funcionando
- Cálculo cuotas OK

---

## 🎯 NUEVA ARQUITECTURA (ESTILO ASSA)

### UNA SOLA PÁGINA CON SECCIONES

```
/cotizadores/emitir
  └─> EmissionPage (NUEVA)
       ├─> Sección 1: Selección Plan Pago
       ├─> Sección 2: Datos del Asegurado ⚠️ PENDIENTE
       ├─> Sección 3: Datos del Vehículo ⚠️ PENDIENTE
       ├─> Sección 4: Documentos del Cliente ⚠️ PENDIENTE
       ├─> Sección 5: Inspección Vehicular ✔️ COMPLETA
       ├─> Sección 6: Declaración de Veracidad ⚠️ PENDIENTE
       └─> Sección 7: Resumen y Confirmar
```

### Estados de Sección

```typescript
interface SectionState {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'complete';
  canEdit: boolean;
  canAccess: boolean;
}
```

**Reglas:**
- Solo UNA sección activa a la vez
- No puedes avanzar sin completar la anterior
- Secciones completadas muestran ✔️ verde
- Secciones pendientes muestran ⚠️ rojo/amarillo
- Click en sección completa → expandir/editar

---

## 📦 COMPONENTES A CREAR

### 1. EmissionPage.tsx (NUEVO)
**Responsabilidad:** Orquestar todas las secciones

```tsx
- Estado global de todas las secciones
- Scroll automático a sección activa
- Validación antes de avanzar
- Guardar progreso en sessionStorage
- Lógica multi-aseguradora
```

### 2. EmissionSection.tsx (NUEVO)
**Responsabilidad:** Wrapper reutilizable para cada sección

```tsx
Props:
  - title: string
  - subtitle?: string
  - icon: ReactNode
  - status: 'pending' | 'in-progress' | 'complete'
  - canAccess: boolean
  - onComplete: () => void
  - children: ReactNode

Features:
  - Header con estado visual
  - Colapsable cuando está completa
  - Bloqueo visual cuando no se puede acceder
  - Animación suave al expandir/colapsar
```

### 3. InsuredDataSection.tsx (NUEVO)
**Responsabilidad:** Datos completos del asegurado

```tsx
Campos (iOS-friendly):
  - Primer Nombre (required)
  - Segundo Nombre (optional)
  - Primer Apellido (required)
  - Segundo Apellido (optional)
  - Cédula/Pasaporte (required, con QR scanner)
  - Fecha Nacimiento (required, date picker mobile)
  - Sexo (required, radio buttons M/F)
  - Email (required, type="email")
  - Teléfono (required, mask format)
  - Celular (required, mask format)
  - Dirección (required, textarea)
  - PEP (checkbox con tooltip)
  - Acreedor (optional, condicional)
```

### 4. VehicleDataSection.tsx (NUEVO)
**Responsabilidad:** Datos del vehículo

```tsx
Campos:
  - Placa (required)
  - VIN/Chasis (required)
  - Motor (required)
  - Color (required)
  - Pasajeros (required, select 2-9)
  - Puertas (required, select 2-5)
  
Pre-filled desde quoteData:
  - Marca, Modelo, Año, Valor
```

### 5. ClientDocumentsSection.tsx (NUEVO)
**Responsabilidad:** Upload documentos (NO sobre el auto)

```tsx
Documentos en LISTA vertical:
  1. Documento de Identidad (Cédula o Pasaporte)
     - Upload/Cámara
     - Tooltip: "Debe verse completo, legible y vigente"
     - Preview thumbnail
     - Estado: Pendiente ⚠️ / Completo ✔️
     
  2. Licencia de Conducir
     - Upload/Cámara
     - Tooltip: "Debe estar vigente"
     - Preview thumbnail
     - Estado: Pendiente ⚠️ / Completo ✔️
     
  3. Registro Vehicular / Tarjeta de Circulación
     - Upload/Cámara
     - Tooltip: "Debe coincidir con datos del vehículo"
     - Preview thumbnail
     - Estado: Pendiente ⚠️ / Completo ✔️

Features:
  - Drag & drop
  - Click para seleccionar
  - Botón cámara (mobile)
  - Validación: max 5MB, formatos JPG/PNG/PDF
  - Preview con opción de cambiar
```

### 6. VehicleInspectionSection.tsx (RECONSTRUIR)
**Responsabilidad:** Inspección visual estilo ASSA

```tsx
Layout:
  ┌─────────────────────────────┐
  │   DIBUJO AUTO MÁS GRANDE    │
  │   (icono vectorial realista)│
  │                             │
  │   ┌─┐ Frontal              │
  │   │F│                       │
  │   └─┘                       │
  │                             │
  │ ┌─┐           ┌─┐          │
  │ │LI           LD│           │
  │ └─┘           └─┘           │
  │                             │
  │   ┌─┐ Motor                │
  │   │M│                       │
  │   └─┘                       │
  │                             │
  │   ┌─┐ Tablero              │
  │   │T│                       │
  │   └─┘                       │
  │                             │
  │   ┌─┐ Trasera              │
  │   │TR                       │
  │   └─┘                       │
  └─────────────────────────────┘

BOTONES SOBRE EL AUTO:
  1. Frontal (en frente del dibujo)
  2. Trasera (atrás del dibujo)
  3. Lateral Izquierdo (lado izq)
  4. Lateral Derecho (lado der)
  5. Motor (sobre capó)
  6. Tablero (centro del auto)

BOTONES FUERA DEL AUTO (lista debajo):
  7. Foto VIN/Chasis
     Tooltip: "Generalmente debajo puerta conductor
               o en compartimiento motor. Debe
               leerse claramente."

Features:
  - Botones grandes, claramente visibles
  - Parpadeo suave en el pendiente actual
  - Tooltip guiado (desktop hover, mobile tap)
  - Estado visual: naranja pendiente, verde completo
  - Secuencial: hasta no completar foto actual, no avanza
  - Preview foto tomada en miniatura
```

### 7. InspectionReportGenerator.ts (NUEVO)
**Responsabilidad:** Generar PDF automático

```tsx
Usar: jsPDF o react-pdf

Estructura:
  - Logo Líderes en Seguros
  - Título: "INFORME DE INSPECCIÓN DE VEHÍCULO"
  - Fecha automática
  - Datos del cliente (de InsuredDataSection)
  - Datos del vehículo (de VehicleDataSection)
  - Grid de fotos de inspección (thumbnails)
  - Todas las secciones marcadas ✔️
  - Inspector: "Líderes en Seguros - Portal Self Service"
  - Firma digital automática

Output:
  - PDF Blob para enviar en payload FEDPA
  - Guardado local para auditoría
```

### 8. TruthDeclarationSection.tsx (NUEVO)
**Responsabilidad:** Declaración legal obligatoria

```tsx
Layout:
  ┌────────────────────────────────────┐
  │ ☑ Declaro que la información      │
  │   suministrada es veraz y correcta│
  │                                    │
  │ ▼ Leer declaración completa        │
  └────────────────────────────────────┘

Al expandir:
  ┌────────────────────────────────────┐
  │ DECLARACIÓN DE VERACIDAD           │
  │                                    │
  │ Declaro bajo juramento que:        │
  │ - Toda información es verídica     │
  │ - Soy consciente que información   │
  │   falsa puede anular la póliza     │
  │ - Acepto términos y condiciones    │
  │ - Conforme a legislación panameña  │
  │                                    │
  │ ▲ Ocultar declaración              │
  └────────────────────────────────────┘

Features:
  - Checkbox GRANDE, fácil de tocar
  - Texto colapsable (NO modal)
  - Click expandir → smooth scroll
  - Formal pero no alarmista
  - No avanza sin checkbox marcado
```

### 9. FinalSummarySection.tsx (MODIFICAR)
**Responsabilidad:** Resumen completo + botón emitir

```tsx
Mostrar:
  - Plan de pago seleccionado
  - Datos del asegurado (resumidos)
  - Datos del vehículo (resumidos)
  - Documentos adjuntos (✔️ 3/3)
  - Inspección completa (✔️ 6/6 fotos)
  - Declaración aceptada (✔️)
  - Prima total a pagar
  
Botón:
  "Emitir Póliza" (grande, prominente)
  - Loading state al procesar
  - Deshabilitado si falta algo
```

---

## 🎨 DISEÑO UX/UI

### Colores de Estado

```css
/* Pendiente */
.status-pending {
  border-color: #f59e0b; /* Amber */
  background: #fffbeb;
}

/* En Progreso */
.status-in-progress {
  border-color: #3b82f6; /* Blue */
  background: #eff6ff;
}

/* Completo */
.status-complete {
  border-color: #8AAA19; /* Brand Green */
  background: #f0f9e8;
}

/* Bloqueado */
.status-locked {
  border-color: #d1d5db; /* Gray */
  background: #f9fafb;
  opacity: 0.6;
  cursor: not-allowed;
}
```

### Iconos de Estado

```tsx
⚠️  Pendiente (amber)
🔵 En progreso (blue)
✅  Completo (green)
🔒 Bloqueado (gray)
```

### Transiciones

```css
/* Expandir/Colapsar sección */
.section-content {
  transition: max-height 0.3s ease-out,
              opacity 0.3s ease-out;
}

/* Parpadeo suave inspección */
@keyframes pulseSoft {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

/* Scroll suave a sección */
behavior: smooth;
scroll-margin-top: 100px;
```

---

## 📱 MOBILE-FIRST REQUIREMENTS

### iOS-Friendly Inputs

```tsx
// SIEMPRE usar estos estilos
className="text-base min-h-[44px] px-4 border-2 rounded-lg"

// Date picker
<input 
  type="date"
  className="text-base min-h-[44px]"
  style={{ fontSize: '16px' }} // Evita zoom iOS
/>

// Select
<select className="text-base min-h-[44px] px-4">

// Textarea
<textarea className="text-base min-h-[88px] px-4 py-3">
```

### Touch Targets

```css
/* Mínimo 44x44px para botones */
.btn-touch {
  min-width: 44px;
  min-height: 44px;
  padding: 12px 16px;
}

/* Checkbox grande */
.checkbox-large {
  width: 24px;
  height: 24px;
  margin: 8px;
}
```

### Tooltips Responsive

```tsx
// Desktop: hover
// Mobile: tap para mostrar/ocultar

<Tooltip
  content="..."
  trigger="click" // Mobile
  triggerHover={true} // Desktop
  position="auto" // Nunca salir de pantalla
/>
```

---

## 🔄 LÓGICA MULTI-ASEGURADORA

### Configuración por Aseguradora

```typescript
interface InsurerConfig {
  id: 'fedpa' | 'internacional' | 'assa';
  requiresPEP: boolean;
  requiresAccreedor: boolean;
  documentsRequired: string[];
  inspectionPhotosMin: number;
  generatesInspectionPDF: boolean;
}

const INSURER_CONFIGS: Record<string, InsurerConfig> = {
  fedpa: {
    requiresPEP: true,
    requiresAccreedor: true,
    documentsRequired: ['cedula', 'licencia', 'registro'],
    inspectionPhotosMin: 6,
    generatesInspectionPDF: true,
  },
  internacional: {
    requiresPEP: false,
    requiresAccreedor: false,
    documentsRequired: ['cedula', 'licencia', 'circulacion'],
    inspectionPhotosMin: 8,
    generatesInspectionPDF: false,
  },
};
```

### Emisión Unificada

```typescript
// emitir/page.tsx
async function emitPolicy(data: EmissionData, insurer: string) {
  const config = INSURER_CONFIGS[insurer];
  
  // 1. Validar según config
  validateByInsurer(data, config);
  
  // 2. Generar PDF si aplica
  if (config.generatesInspectionPDF) {
    const pdf = await generateInspectionReport(data);
    data.inspectionPDF = pdf;
  }
  
  // 3. Llamar adapter específico
  switch(insurer) {
    case 'fedpa':
      return await emitFedpa(data);
    case 'internacional':
      return await emitIS(data);
    default:
      throw new Error('Aseguradora no soportada');
  }
}
```

---

## 📋 ORDEN DE IMPLEMENTACIÓN

### Fase 1: Estructura Base (DÍA 1)
1. ✅ Crear EmissionPage.tsx
2. ✅ Crear EmissionSection.tsx wrapper
3. ✅ Implementar estado global de secciones
4. ✅ Testing navegación entre secciones

### Fase 2: Datos (DÍA 2)
5. ✅ InsuredDataSection.tsx (completo, iOS-friendly)
6. ✅ VehicleDataSection.tsx
7. ✅ Validaciones por campo
8. ✅ Testing mobile iOS/Android

### Fase 3: Documentos (DÍA 2)
9. ✅ ClientDocumentsSection.tsx
10. ✅ Upload con preview
11. ✅ Validación formatos/tamaño
12. ✅ Testing upload mobile

### Fase 4: Inspección (DÍA 3)
13. ✅ VehicleInspectionSection.tsx (estilo ASSA)
14. ✅ Dibujo auto grande + botones interactivos
15. ✅ Tooltips guiados
16. ✅ Parpadeo secuencial
17. ✅ Testing cámara mobile

### Fase 5: Legal y PDF (DÍA 3)
18. ✅ TruthDeclarationSection.tsx
19. ✅ InspectionReportGenerator.ts (PDF automático)
20. ✅ Testing generación PDF

### Fase 6: Emisión (DÍA 4)
21. ✅ FinalSummarySection.tsx
22. ✅ Lógica multi-aseguradora
23. ✅ Adapters FEDPA e IS
24. ✅ Testing end-to-end

### Fase 7: Testing Final (DÍA 4)
25. ✅ Testing iOS Safari
26. ✅ Testing Chrome Android
27. ✅ Testing Desktop (Chrome, Firefox, Edge)
28. ✅ Testing emisión FEDPA DEV
29. ✅ Testing emisión IS DEV
30. ✅ Documentación completa

---

## 🎯 RESULTADO FINAL

### UX Esperada

```
Usuario abre /cotizadores/emitir

┌──────────────────────────────────────┐
│ ✅ 1. Plan de Pago (COMPLETO)       │ ← Colapsado, puede editar
│    12 cuotas de $45.00               │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 🔵 2. Datos del Asegurado            │ ← ACTIVA, expandida
│    (EN PROGRESO)                     │
│                                      │
│    [Formulario completo aquí]        │
│                                      │
│    [Botón: Guardar y Continuar]     │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 🔒 3. Datos del Vehículo             │ ← BLOQUEADA
│    (PENDIENTE)                       │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 🔒 4. Documentos del Cliente         │ ← BLOQUEADA
│    (PENDIENTE)                       │
└──────────────────────────────────────┘

... etc
```

### Ventajas

✅ **UX clara:** Usuario ve todo el proceso de un vistazo
✅ **Sin sorpresas:** No hay navegación oculta ni steps confusos
✅ **Mobile-first:** Todo táctil, iOS-friendly, sin zoom
✅ **Reutilizable:** Mismo código para FEDPA, IS, ASSA
✅ **Profesional:** Replica exactamente la UX de ASSA
✅ **Automático:** PDF generado en background, sin fricción
✅ **Validado:** Cada sección valida antes de avanzar

---

## ✅ VALIDACIÓN CONTRA REFERENCIA

**Archivo:** `public/API FEDPA/PROCESO DE EMISION/FOTOS INSPECCION FEDPA Y FORMULARIO.png`

**Requisitos FEDPA cumplidos:**
- ✅ Parte Frontal (botón en dibujo)
- ✅ Parte Trasera (botón en dibujo)
- ✅ Lateral Izquierdo (botón en dibujo)
- ✅ Lateral Derecho (botón en dibujo)
- ✅ Parte Motor (botón en dibujo)
- ✅ Parte Tablero (botón en dibujo)
- ✅ VIN o Chasis (botón fuera, con tooltip explicativo)
- ✅ Formulario de Inspección (generado automático, PDF background)

**Estado visual:** Rojo "Pendiente" → Verde completado (igual que ASSA)

---

FIN DE AUDITORÍA
