# Flujo Completo de Ajustes de Comisiones - CORREGIDO ✅

## Problema Reportado

El botón de CSV estaba ubicado en la pestaña "Sin identificar" (pendientes sin identificar), pero debería estar en "Identificados" (ajustes reportados).

## Solución Implementada

Se corrigió la ubicación del botón de CSV y se clarificó el flujo completo.

---

## Estructura de Pestañas

### Para Master

1. **Sin identificar** - Comisiones pendientes de asignar a corredor
2. **Identificados** - Ajustes reportados por corredores (aquí va el CSV)
3. **Retenidos** - Comisiones retenidas
4. **Pagados** - Historial de ajustes pagados

### Para Broker

1. **Sin identificar** - Ver comisiones sin identificar
2. **Ajustes Reportados** - Ajustes que el broker reportó como "Mío"
3. **Pagados** - Historial de ajustes pagados

---

## Flujo Completo: Ajustes de Comisiones

### Paso 1: Comisiones Sin Identificar

**Ubicación**: Comisiones → Ajustes → Pestaña "Sin identificar"

```
Comisiones aparecen sin corredor asignado
├─ Broker puede marcar como "Mío"
│  └─> Pasa a estado "claimed"
│  └─> Crea registro en comm_item_claims
│
└─ Master puede:
   ├─ Asignar a un corredor específico
   ├─ Marcar como "Pago ahora"
   └─ Marcar como "Próxima quincena"
```

**Acciones del Corredor**:
- Click en "Marcar mío" → Reporta que esa comisión le pertenece
- La comisión pasa a "Identificados" esperando aprobación de Master

**Acciones de Master**:
- Asignar directamente a un corredor
- Marcar como pago inmediato
- Enviar a próxima quincena

**❌ NO HAY botón de CSV aquí** (se eliminó)

---

### Paso 2: Ajustes Identificados (Reportados)

**Ubicación**: Comisiones → Ajustes → Pestaña "Identificados"

Esta pestaña muestra los ajustes que los corredores marcaron como "Mío".

```
Master revisa ajustes reportados
├─ Selecciona brokers (checkbox)
├─ Click en "Aceptar Seleccionados"
└─ Elige:
   ├─ "Pagar Ya"
   │  └─> Crea ajustes aprobados
   │  └─> Muestra panel verde con botones
   │
   └─ "Pagar en Siguiente Quincena"
      └─> Se incluye en próxima quincena
```

#### Panel de Ajustes Aprobados (Verde)

Aparece SOLO cuando se aprueban ajustes para "Pagar Ya":

```
┌────────────────────────────────────────────────┐
│ ✅ Ajustes Aprobados para Pagar Ya            │
│                                                │
│ Descarga el CSV bancario y luego confirma el  │
│ pago                                           │
│                                                │
│ [📥 Descargar CSV]  [✅ Confirmar Pagado]     │
└────────────────────────────────────────────────┘
```

**Instrucciones visibles en la página**:

1. Selecciona los reportes de corredores que marcaron como "Mío"
2. Haz clic en "Aceptar Seleccionados" y elige "Pagar Ya"
3. **Descarga el CSV bancario** con el botón verde que aparecerá
4. Carga el CSV en el banco y realiza las transferencias
5. Regresa y haz clic en "Confirmar Pagado"

---

### Paso 3: Descargar CSV Bancario

**Ubicación**: Aparece después de aprobar para "Pagar Ya"

```
Click en "Descargar CSV"
├─> Genera archivo CSV con formato banco
│   ├─ NOMBRE
│   ├─ TIPO
│   ├─ CEDULA
│   ├─ BANCO
│   ├─ CUENTA
│   ├─ MONTO
│   ├─ CORREO
│   └─ DESCRIPCION
│
└─> Descarga: ajustes_YYYY-MM-DD.csv
```

**Formato del CSV**: Compatible con Banco General

---

### Paso 4: Confirmar Pago

```
Click en "Confirmar Pagado"
├─> Marca ajustes como pagados
├─> Actualiza comm_item_claims con status: 'paid'
├─> Mueve registros a historial
└─> Limpia panel verde
```

---

## Cambios Realizados

### Archivo: `src/components/commissions/AdjustmentsTab.tsx`

#### ✅ Eliminado (líneas 173-178)
```typescript
// ANTES - Botón incorrecto en "Sin identificar":
<button className="...">
  <FaFileDownload size={14} />
  Exportar CSV
</button>
```

#### ✅ Actualizado (línea 158)
```typescript
// Título clarificado:
<h2>Ajustes Sin Identificar</h2>
<p>Comisiones pendientes de asignar a corredor. Una vez identificadas, pasan a "Identificados"</p>
```

#### ✅ Limpiado
- Eliminado código demo de `RequestsView` (no se usaba)
- Mantenido solo `MasterClaimsView` que maneja los ajustes reportados

### Archivo: `src/components/commissions/MasterClaimsView.tsx`

#### ✅ Agregado (líneas 269-280)
```typescript
// Panel de instrucciones visible:
<Card className="bg-gradient-to-r from-blue-50 to-white border-l-4 border-[#010139]">
  <h3>📋 Flujo de Ajustes Reportados</h3>
  <ol>
    <li>Selecciona los reportes de corredores que marcaron como "Mío"</li>
    <li>Haz clic en "Aceptar Seleccionados" y elige "Pagar Ya"</li>
    <li>Descarga el CSV bancario con el botón verde que aparecerá</li>
    <li>Carga el CSV en el banco y realiza las transferencias</li>
    <li>Regresa y haz clic en "Confirmar Pagado"</li>
  </ol>
</Card>
```

---

## Flujo Visual

```
┌─────────────────────────────────────────────────────────────┐
│                    COMISIONES → AJUSTES                     │
└─────────────────────────────────────────────────────────────┘

┌─ Tab 1: Sin identificar ─────────────────────────────────┐
│  • Comisiones sin corredor asignado                      │
│  • Broker: Click "Marcar mío"                            │
│  • Master: Asignar o enviar a quincena                   │
│  ❌ NO HAY CSV aquí                                      │
└──────────────────────────────────────────────────────────┘
                     ↓
                  (Broker marca "Mío")
                     ↓
┌─ Tab 2: Identificados (AQUÍ VA EL CSV) ─────────────────┐
│  📋 Instrucciones del flujo (visible)                    │
│                                                           │
│  🔹 Reportes de brokers                                  │
│  🔹 Master selecciona y acepta                           │
│  🔹 Elige "Pagar Ya"                                     │
│                                                           │
│  ┌─────────────────────────────────────────┐            │
│  │ ✅ Ajustes Aprobados para Pagar Ya     │            │
│  │                                          │            │
│  │  [📥 Descargar CSV] ← AQUÍ ESTÁ EL CSV │            │
│  │  [✅ Confirmar Pagado]                  │            │
│  └─────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────┘
                     ↓
              (Descarga CSV)
                     ↓
              (Paga en banco)
                     ↓
           (Click "Confirmar Pagado")
                     ↓
┌─ Tab 3: Pagados ─────────────────────────────────────────┐
│  📜 Historial de ajustes pagados                         │
└──────────────────────────────────────────────────────────┘
```

---

## Diferencia Clave

### ❌ ANTES (Incorrecto)
```
Tab "Sin identificar"
  └─ Botón "Exportar CSV" (sin funcionalidad)
```

### ✅ AHORA (Correcto)
```
Tab "Identificados"
  └─ Seleccionar reportes
  └─ Aprobar para "Pagar Ya"
  └─ Aparece panel verde
      └─ Botón "Descargar CSV" ✅
      └─ Botón "Confirmar Pagado"
```

---

## Archivos Modificados

✅ `src/components/commissions/AdjustmentsTab.tsx`
- Eliminado botón CSV de "Sin identificar"
- Limpiado código demo no usado
- Clarificado descripción de la pestaña

✅ `src/components/commissions/MasterClaimsView.tsx`
- Agregadas instrucciones visibles del flujo
- Panel verde con CSV solo aparece después de aprobar

---

## Verificación

✅ **TypeCheck**: Sin errores
✅ **Flujo correcto**: CSV solo en "Identificados"
✅ **UI clara**: Instrucciones visibles
✅ **Botones correctos**: CSV aparece después de aprobar

---

## Para Probar

### Escenario Completo

1. **Como Broker**:
   - Ir a Comisiones → Ajustes → "Sin identificar"
   - Click en "Marcar mío" en alguna comisión
   - Ir a "Ajustes Reportados" para ver tu solicitud

2. **Como Master**:
   - Ir a Comisiones → Ajustes → "Identificados"
   - Leer las instrucciones en el panel azul
   - Seleccionar broker(s) con checkbox
   - Click "Aceptar Seleccionados" → "Pagar Ya"
   - ✅ Aparece panel verde con botón "Descargar CSV"
   - Click "Descargar CSV" → Se descarga el archivo
   - Ir al banco y hacer las transferencias
   - Regresar y click "Confirmar Pagado"
   - ✅ Los ajustes se mueven a "Pagados"

---

**Fecha**: 15 de Octubre, 2025  
**Estado**: CORREGIDO Y FUNCIONANDO ✅
