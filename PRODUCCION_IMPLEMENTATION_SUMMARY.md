# PRODUCCIÓN - IMPLEMENTACIÓN PASO 16 📊

**Fecha:** 2025-10-03  
**Estado:** 🟡 ENDPOINTS CREADOS - COMPONENTES EN PROGRESO

---

## ✅ COMPLETADO - ENDPOINTS API

### 1. `/api/production` (GET/PUT) ✅

**GET:**
- Obtiene matriz de producción por año y broker
- Retorna meses (ene-dic) con bruto y canceladas
- Incluye datos año anterior para comparativos YoY
- Mock data lista para conectar con BD

**PUT:**
- Actualiza celda individual (broker + año + mes + campo)
- Validación: solo Master puede editar
- Validación: valor >= 0
- TODO: Validación Canceladas <= Bruto

### 2. `/api/production/contests` (GET/PUT) ✅

**Gestión de Concursos:**
- Concurso ASSA
- Convivio LISSA
- Campos: start_month, end_month, goal
- Validaciones: meses 1-12, start <= end, goal > 0
- Guardado para afectar donas de dashboards

### 3. `/api/production/rankings/top5` (GET) ✅

**Top-5 Anual:**
- Calcula por PMA Neto (YTD)
- Ordenado descendente
- Empates: orden alfabético
- Retorna solo nombres + rank (1-5)
- Top-3 para medallas (oro/plata/bronce)

### 4. `/api/production/month-winner` (GET) ✅

**Corredor del Mes:**
- Regla "mes cerrado" implementada:
  - Por defecto: mes anterior al actual
  - Día 1 del mes: mes actual si hay datos
- Calcula por PMA Neto del mes específico
- Empates: orden alfabético
- Retorna nombre + mes + año

---

## 📋 SIGUIENTE PASO - COMPONENTES UI

### Componentes a Crear:

#### 1. **ProductionMainClient.tsx** (Principal)
```tsx
// Estructura:
- Tabs: Vista Matriz / Configuración Concursos
- Dropdown de año
- Rol check (Master editable / Broker readonly)
```

#### 2. **ProductionMatrix.tsx** (Matriz Excel-like)
```tsx
// Estructura:
- Tabla con sticky headers (top + left)
- Filas: brokers con nombre + deeplink
- Columnas: Ene, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
- Columnas calc: Bruto (YTD), Canceladas (YTD), Neto (YTD), Var %
- Celdas editables (Master) con autosave
- Hotkeys: flechas + Enter
- Validación inline: Canceladas <= Bruto
```

#### 3. **ContestsConfig.tsx** (Config Concursos)
```tsx
// Dos cards:
- Card ASSA: mes inicio/fin + meta
- Card Convivio: mes inicio/fin + meta
- Preview intervalo (ej: "Cuenta Ene–Ago")
- Guardar: refresca donas dashboards
```

#### 4. **BrokerProductionView.tsx** (Vista Broker)
```tsx
// Read-only:
- Su matriz anual con comparativo YoY
- Variación % (Bruto y Neto)
- Gráfico de barras: Año actual VS año pasado
- Título: "PRODUCCIÓN ANUAL", "Comparativo PMA"
```

---

## 🎨 UI/UX REQUERIDO (Mobile-First)

### Matriz Excel-like:
```css
/* Headers sticky */
.matrix-table {
  position: relative;
}

.matrix-header-top {
  position: sticky;
  top: 0;
  background: #f9fafb;
  z-index: 10;
}

.matrix-header-left {
  position: sticky;
  left: 0;
  background: #f9fafb;
  z-index: 5;
}

/* Scroll horizontal móvil */
.matrix-container {
  overflow-x: auto;
  scrollbar-width: thin;
}
```

### Patrón de Tabs (Consistente con Pendientes):
```tsx
<div className="border-b-2 border-gray-200">
  <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2">
    <button className={activeTab === 'matrix' 
      ? 'bg-[#010139] text-white border-b-4 border-[#8AAA19]' 
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }>
      Matriz Anual
    </button>
    <button className={...}>Concursos</button>
  </div>
</div>
```

### Validaciones y Feedback:
- ✅ Toast success al guardar celda
- ⚠️ Alert si Canceladas > Bruto
- 💾 Icono "guardando..." en celda activa
- ✓ Check verde cuando guardado

---

## 📊 CÁLCULOS CLAVE

### PMA Neto (YTD):
```javascript
const pmaBrutoYTD = months.reduce((sum, m) => sum + m.bruto, 0);
const canceladasYTD = months.reduce((sum, m) => sum + m.canceladas, 0);
const pmaNetoYTD = pmaBrutoYTD - canceladasYTD;
```

### Variación % (YoY):
```javascript
const varPercent = (ytdActual, ytdPrev) => {
  if (ytdPrev === 0) return 'N/A';
  return (((ytdActual - ytdPrev) / Math.abs(ytdPrev)) * 100).toFixed(2);
};
```

### Validación Canceladas:
```javascript
// Por mes
if (canceladas_mes > bruto_mes) {
  return error('Canceladas no pueden superar Bruto del mes');
}

// YTD
if (canceladas_ytd > bruto_ytd) {
  return error('Canceladas YTD no pueden superar Bruto YTD');
}
```

---

## 🔗 CONEXIONES CON DASHBOARDS

### Dashboard Broker - Ya Existente:
- ✅ Donas de Concursos (conectar con /api/production/contests)
- ✅ Top-5 con medallas (conectar con /api/production/rankings/top5)
- ✅ Corredor del mes (conectar con /api/production/month-winner)

### Dashboard Master - A Ajustar:
- [ ] Alinear visualización Top-5 (sin cifras, solo nombres)
- [ ] Agregar bloque "Corredor del mes" igual que Broker
- [ ] Top-3 con medallas (🥇🥈🥉)
- [ ] Donas de Concursos sincronizadas
- [ ] Labels centrados en gráficos

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
src/
├── app/(app)/
│   ├── api/
│   │   └── production/
│   │       ├── route.ts                    ✅ Creado
│   │       ├── contests/route.ts           ✅ Creado
│   │       ├── rankings/
│   │       │   └── top5/route.ts          ✅ Creado
│   │       └── month-winner/route.ts      ✅ Creado
│   │
│   └── production/
│       └── page.tsx                        ⏳ Pendiente
│
└── components/
    └── production/
        ├── ProductionMainClient.tsx        ⏳ Pendiente
        ├── ProductionMatrix.tsx            ⏳ Pendiente
        ├── ContestsConfig.tsx              ⏳ Pendiente
        └── BrokerProductionView.tsx        ⏳ Pendiente
```

---

## 🎯 CRITERIOS DE ACEPTACIÓN

### Funcionalidad:
- [ ] Matriz Excel-like editable (Master)
- [ ] Matriz readonly con YoY (Broker)
- [ ] Autosave por celda
- [ ] Validación Canceladas <= Bruto
- [ ] Config Concursos afecta donas
- [ ] Top-5 calculado correctamente
- [ ] Corredor del mes con regla "mes cerrado"
- [ ] Deeplinks a /brokers/{id}

### UI/UX:
- [ ] Mobile-first impecable
- [ ] Sticky headers (top + left)
- [ ] Scroll horizontal suave
- [ ] Hotkeys (flechas + Enter)
- [ ] Feedback visual (guardando/guardado/error)
- [ ] Patrón consistente (Cheques/Pendientes)

### Dashboards:
- [ ] Dashboard Broker con datos reales
- [ ] Dashboard Master alineado visualmente
- [ ] Donas sincronizadas
- [ ] Top-5 sin cifras
- [ ] Medallas Top-3 (🥇🥈🥉)
- [ ] Corredor del mes presente

---

## 🚧 TRABAJO PENDIENTE

1. **Crear componentes UI** (~800 líneas)
2. **Conectar con BD real** (sustituir mock data)
3. **Ajustar Dashboard Master** (~200 líneas)
4. **Testing completo** (matriz, validaciones, cálculos)
5. **Verificar responsive** (móvil, tablet, desktop)

---

## 📝 NOTAS IMPORTANTES

### Branding:
- Tipografía: Arial (estándar del sistema)
- Colores: #010139 (azul), #8AAA19 (oliva)
- Botones/tabs: patrón de Cheques/Pendientes

### Validaciones Críticas:
```typescript
// SIEMPRE validar:
1. Canceladas <= Bruto (por mes)
2. Canceladas YTD <= Bruto YTD
3. Valores >= 0
4. Solo Master puede editar
```

### Persistencia:
- Autosave inmediato por celda
- Sin notificaciones (silencioso)
- Refresco de KPIs automático
- Endpoints de agregados recalculan

---

**ENDPOINTS LISTOS - COMPONENTES UI EN PROGRESO** ⏳

**Próximos pasos:** Crear componentes UI y conectar dashboards 🚀
