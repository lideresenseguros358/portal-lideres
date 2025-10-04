# MÓDULO MOROSIDAD - PROGRESO DE IMPLEMENTACIÓN

**Fecha:** 2025-10-03  
**Estado:** 🚧 En Progreso - Estructura Base Completa

---

## ✅ COMPLETADO

### 1. Side Menu Actualizado
- ✅ Agregado icono `FaExclamationTriangle` para Morosidad
- ✅ Menú MASTER: "Morosidad" después de "Cheques"
- ✅ Menú BROKER: "Morosidad" después de "Pendientes"
- **Archivo:** `src/components/shell/SideMenu.tsx`

### 2. Estructura de Archivos Creada
- ✅ Página principal: `src/app/(app)/delinquency/page.tsx`
- ✅ Server Actions: `src/app/(app)/delinquency/actions.ts`
- ✅ Componente principal: `src/components/delinquency/DelinquencyMainClient.tsx`
- ✅ Tab Resumen: `src/components/delinquency/SummaryTab.tsx`
- ✅ Tab Importar: `src/components/delinquency/ImportTab.tsx`
- ✅ Tab Detalle: `src/components/delinquency/DetailTab.tsx`

### 3. Base de Datos - Migración SQL
- ✅ Creada: `migrations/create_delinquency_table.sql`
- ✅ Tabla con 13 columnas + timestamps
- ✅ Índices para performance
- ✅ RLS habilitado con políticas
- ✅ Buckets: due_soon, current, 1-30, 31-60, 61-90, +90

### 4. Funcionalidades Implementadas

#### Server Actions (actions.ts)
- ✅ `actionGetDelinquencySummary()` - Resumen por aseguradora/broker
- ✅ `actionGetDelinquencyRecords()` - Registros detallados
- ✅ `actionImportDelinquency()` - Importar datos con reemplazo automático
- ✅ `actionGetActiveInsurers()` - Aseguradoras activas
- ✅ `actionGetBrokers()` - Lista de brokers

#### Tab Resumen (SummaryTab.tsx)
- ✅ Cards de buckets con colores diferenciados
- ✅ Filtros por Aseguradora y Broker (Master)
- ✅ Fecha de corte visible en pill
- ✅ Total general destacado
- ✅ Mobile-first responsive (grid 1/2/3 columnas)
- ✅ Loading states y empty states

#### Tab Importar (ImportTab.tsx)
- ✅ Upload de archivos: .xlsx, .xls, .csv, .pdf, .jpg, .png
- ✅ Parser de Excel con XLSX
- ✅ Parser de CSV
- ✅ Validaciones de campos requeridos
- ✅ Mensaje de éxito: "Import realizado correctamente sin errores"
- ✅ Link a configurar mapeo en Aseguradoras
- ✅ Instrucciones claras

#### Tab Detalle (DetailTab.tsx)
- ✅ Tabla desktop completa con 12 columnas
- ✅ Cards mobile con expand/collapse
- ✅ Modal de búsqueda centrado
- ✅ Filtros por Aseguradora/Broker
- ✅ Link a Base de Datos por póliza
- ✅ Bucket +90 destacado en rojo
- ✅ Solo muestra deudas > 0

### 5. Branding y UI/UX

#### Colores Corporativos
- ✅ Azul #010139 - headers, títulos
- ✅ Oliva #8AAA19 - acentos, botones secundarios
- ✅ Rojo - bucket +90 días
- ✅ Colores por bucket: azul, verde, amarillo, naranja, rojo, rojo oscuro

#### Componentes
- ✅ Cards con shadow-lg
- ✅ Gradientes en headers (from-gray-50 to-gray-100)
- ✅ Tablas con hover:bg-gray-50
- ✅ Botones con transiciones suaves
- ✅ Loading con spinner corporativo

#### Mobile-First
- ✅ Grid responsive en resumen (1/2/3 cols)
- ✅ Tabs con flex-col en mobile
- ✅ Tabla oculta en mobile, cards expandibles
- ✅ Modal de búsqueda responsive
- ✅ Sin overflow horizontal
- ✅ Touch-friendly

---

## 🚧 PENDIENTE

### 1. Schema de Base de Datos
- ⏳ Ejecutar migración `create_delinquency_table.sql` en Supabase
- ⏳ Regenerar tipos TypeScript con: `npx supabase gen types typescript`
- ⏳ Actualizar `src/lib/database.types.ts`

### 2. Configuración en Aseguradoras
- ⏳ Agregar toggle "Activar import de morosidad" por aseguradora
- ⏳ Configurar mapeo de campos en Aseguradoras > Morosidad
- ⏳ Actualizar Aseguradoras > Pruebas para aceptar múltiples formatos

### 3. Lógica de Negocio Avanzada
- ⏳ Reloj de 60 días → deuda = 0 automática
- ⏳ Reloj de 90 días → notificación a Broker
- ⏳ Notificación a Master si Broker no responde
- ⏳ Opción de borrar clientes inactivos desde Base de datos

### 4. OCR para PDF/Imágenes
- ⏳ Integrar pipeline OCR existente
- ⏳ Lectura de PDF con Tesseract/similar
- ⏳ Lectura de imágenes JPG/PNG

### 5. Deep Links
- ⏳ Link desde Morosidad → Base de datos (póliza/cliente)
- ⏳ Link desde Base de datos → Comisiones (quincenas)

### 6. Testing
- ⏳ Typecheck completo
- ⏳ Build exitoso
- ⏳ Pruebas en navegador
- ⏳ Pruebas mobile

---

## 📋 CARACTERÍSTICAS IMPLEMENTADAS

### ✅ Roles y Permisos
- **Master:** Importar, ver todo, filtrar por aseguradora/broker
- **Broker:** Solo vista de su cartera

### ✅ Importación
- Formatos: .xlsx, .csv, .xls (funcional)
- Formatos: .pdf, .jpg, .png (pendiente OCR)
- Reemplazo automático de pólizas existentes
- Asignación de broker_id desde Base de datos

### ✅ Visualización
- **Resumen:** Cards por bucket + total
- **Detalle:** Tabla/cards con todos los buckets
- **Filtros:** Aseguradora, Broker, Búsqueda

### ✅ Reglas de Negocio
- Solo muestra deudas > 0
- Última importación visible
- Sin histórico mensual

---

## 🎨 DISEÑO MOBILE-FIRST

### Breakpoints
```css
Mobile: < 768px    - Cards expandibles, 1 columna
Tablet: 768-1024px - 2 columnas
Desktop: > 1024px  - 3 columnas, tabla completa
```

### Componentes Responsive
- ✅ Tabs: flex-col → flex-row
- ✅ Filtros: grid 1 → 2 cols
- ✅ Buckets: grid 1 → 2 → 3 cols
- ✅ Tabla: oculta → mostrada
- ✅ Cards: siempre visible en mobile

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
src/
├── app/(app)/delinquency/
│   ├── page.tsx               # Página principal
│   └── actions.ts             # Server actions
│
├── components/delinquency/
│   ├── DelinquencyMainClient.tsx  # Componente principal con tabs
│   ├── SummaryTab.tsx             # Resumen por buckets
│   ├── ImportTab.tsx              # Importar reportes
│   └── DetailTab.tsx              # Detalle por póliza
│
└── components/shell/
    └── SideMenu.tsx           # ✅ Actualizado con "Morosidad"

migrations/
└── create_delinquency_table.sql   # Migración de tabla
```

---

## 🔄 SIGUIENTES PASOS

1. **Ejecutar migración SQL** en Supabase Dashboard
2. **Regenerar tipos TypeScript** 
3. **Correr typecheck y build**
4. **Implementar toggle en Aseguradoras**
5. **Conectar OCR para PDF/imágenes**
6. **Implementar relojes de inactividad**
7. **Testing completo en navegador**

---

## 📝 NOTAS TÉCNICAS

### Mapeo de Campos
Por ahora usa mapeo hardcodeado en ImportTab.tsx línea 129-137:
```typescript
policy_number: row['policy_number'] || row['N° Póliza'] || row['Poliza']
client_name: row['client_name'] || row['Cliente'] || row['Nombre']
due_soon: row['due_soon'] || row['Por Vencer']
// ... etc
```

**TODO:** Obtener mapeo desde configuración de aseguradora

### Performance
- Índices en: insurer_id, broker_id, policy_number, total_debt
- Índice compuesto: (insurer_id, policy_number)
- Filtrado server-side
- Solo carga deudas > 0

---

**Módulo Morosidad - Base implementada con mobile-first y branding consistente** ✅
