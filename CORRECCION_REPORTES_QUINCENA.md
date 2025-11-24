# ✅ CORRECCIÓN - Reportes de Historial de Quincenas

## 🐛 PROBLEMAS IDENTIFICADOS:

### **1. Descargar Reporte Completo (Todos los Brokers)**
- ❌ No generaba el detalle con brokers y clientes agrupados por aseguradora
- ❌ Faltaban datos en la estructura

### **2. Descargar por Broker Individual**
- ❌ No generaba PDFs ni Excel
- ❌ Estructura de datos incompatible con funciones de export

---

## ✅ CORRECCIONES REALIZADAS:

### **1. API: `/api/commissions/fortnight-details/route.ts`**

**Cambios:**
- ✅ Agregado `email` del broker a la consulta
- ✅ Agregado `percent_default` del broker
- ✅ Guardado de datos completos en respuesta

```typescript
// ANTES
brokers (id, name)

// DESPUÉS
brokers (id, name, email, percent_default)
```

---

### **2. Componente: `FortnightDetailView.tsx`**

**Cambios:**
- ✅ Creada función `transformBrokerForExport()` para convertir datos
- ✅ Transformación de estructura `insurers.items` → `insurers.policies`
- ✅ Mapeo correcto de campos para export

```typescript
// Nueva función de transformación
const transformBrokerForExport = (broker: any) => {
  return {
    broker_name: broker.broker_name,
    broker_email: broker.broker_email || '',
    percent_default: broker.percent_default || 0,
    total_gross: broker.gross_amount,
    total_net: broker.net_amount,
    insurers: broker.insurers.map((insurer: any) => ({
      insurer_name: insurer.insurer_name,
      total_gross: insurer.total,
      policies: insurer.items.map((item: any) => ({
        policy_number: item.policy_number,
        insured_name: item.client_name,
        gross_amount: item.commission_raw,
        percentage: item.percent_applied,
        net_amount: item.commission_calculated,
      }))
    }))
  };
};
```

**Uso en botones de descarga:**
```typescript
// PDF
onClick={() => {
  const transformedBroker = transformBrokerForExport(downloadBrokerModal.broker);
  exportBrokerToPDF(transformedBroker as any, downloadBrokerModal.label);
  setDownloadBrokerModal(null);
}}

// Excel
onClick={() => {
  const transformedBroker = transformBrokerForExport(downloadBrokerModal.broker);
  exportBrokerToExcel(transformedBroker as any, downloadBrokerModal.label);
  setDownloadBrokerModal(null);
}}
```

---

### **3. Componente: `PreviewTab.tsx`**

**Cambios:**
- ✅ Mejorados logs de debugging
- ✅ Agregados toasts informativos
- ✅ Validación de datos antes de exportar
- ✅ Mejor manejo de errores

```typescript
// Logs mejorados
console.log('[Download] Datos preparados:', {
  brokersCount: result.data.length,
  brokers: result.data.map(b => ({ 
    name: b.broker_name, 
    insurers: b.insurers?.length || 0,
    policiesCount: b.insurers?.reduce((sum, i) => sum + (i.policies?.length || 0), 0) || 0
  })),
  totals
});

// Toasts informativos
toast.info('Cargando detalles de comisiones...');
toast.info(`Generando reporte ${format.toUpperCase()}...`);
toast.success(`Reporte ${format.toUpperCase()} generado correctamente`);
```

---

## 📊 ESTRUCTURA DE DATOS:

### **Formato esperado por funciones de export:**

```typescript
interface BrokerDetail {
  broker_name: string;
  broker_email: string;
  percent_default: number;
  total_gross: number;
  total_net: number;
  insurers: InsurerDetail[];
}

interface InsurerDetail {
  insurer_name: string;
  total_gross: number;
  policies: PolicyDetail[];
}

interface PolicyDetail {
  policy_number: string;
  insured_name: string;
  gross_amount: number;
  percentage: number;
  net_amount: number;
}
```

---

## 🧪 CÓMO PROBAR:

### **1. Descargar Reporte Completo (Todos)**

1. Ve a **Comisiones** → **Historial de Quincenas**
2. Expande una quincena cerrada
3. Click en **"Descargar"** (botón del header de la quincena)
4. Selecciona **PDF** o **Excel**
5. Verificar:
   - ✅ Se genera el archivo
   - ✅ Contiene todos los brokers
   - ✅ Cada broker tiene sus aseguradoras
   - ✅ Cada aseguradora tiene sus pólizas
   - ✅ Totales correctos

### **2. Descargar Reporte por Broker**

1. Ve a **Comisiones** → **Historial de Quincenas**
2. Expande una quincena cerrada
3. Expande un broker específico
4. Click en **"Descargar"** (botón del broker)
5. Selecciona **PDF** o **Excel**
6. Verificar:
   - ✅ Se genera el archivo
   - ✅ Contiene datos del broker
   - ✅ Aseguradoras agrupadas
   - ✅ Pólizas listadas correctamente
   - ✅ Totales correctos

---

## 🔍 DEBUGGING:

Si aún hay problemas, revisar la consola del navegador:

```javascript
// Logs que verás:
[Download] Iniciando descarga completa: { fortnightId, format, label }
[Download] Resultado action: { ok: true, dataLength: X }
[Download] Datos preparados: { brokersCount, brokers, totals }
[Download] Reporte generado exitosamente
```

---

## 📝 CONTENIDO DE LOS REPORTES:

### **Reporte Completo (Todos los Brokers):**

**Página 1 - Resumen:**
- Título y período
- Totales generales (importado, pagado, ganancia oficina)
- Tabla resumen por broker

**Páginas siguientes - Detalle por Broker:**
- Header con nombre del broker
- Aseguradoras agrupadas (cada una con su header)
- Tabla de pólizas por aseguradora:
  - Número de póliza
  - Nombre de cliente
  - Monto bruto
  - Porcentaje aplicado
  - Monto neto
- Resumen de totales del broker

### **Reporte Individual (Por Broker):**

**Estructura:**
- Header con logo y nombre del broker
- Email y porcentaje base
- Aseguradoras agrupadas con header visual
- Tabla de pólizas por aseguradora
- Resumen de totales (bruto y neto)
- Descuentos (si aplican)
- Total neto a pagar

---

## ✅ RESULTADOS ESPERADOS:

### **PDF Completo:**
```
📄 reporte_completo_Q1_Noviembre_2024.pdf

Páginas:
1. Resumen general + Tabla de brokers
2-N. Detalle de cada broker con sus aseguradoras y pólizas
```

### **PDF Individual:**
```
📄 comision_Juan_Perez_Q1_Noviembre_2024.pdf

Contenido:
- Datos del broker
- Aseguradora 1
  - Póliza A
  - Póliza B
- Aseguradora 2
  - Póliza C
  - Póliza D
- Resumen de totales
```

### **Excel Completo:**
```
📊 reporte_completo_Q1_Noviembre_2024.xlsx

Hojas:
- Resumen (totales y tabla de brokers)
- Broker 1 (detalle completo)
- Broker 2 (detalle completo)
- ...
```

### **Excel Individual:**
```
📊 comision_Juan_Perez_Q1_Noviembre_2024.xlsx

Hoja única:
- Info del broker
- Detalle por aseguradora
- Totales
```

---

## 🎯 ESTADO FINAL:

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| Descargar Reporte Completo PDF | ✅ Corregido | Incluye todos los brokers agrupados |
| Descargar Reporte Completo Excel | ✅ Corregido | Hoja resumen + hojas por broker |
| Descargar Broker Individual PDF | ✅ Corregido | Transformación de datos implementada |
| Descargar Broker Individual Excel | ✅ Corregido | Transformación de datos implementada |
| Logs de debugging | ✅ Implementados | Facilita troubleshooting |
| Manejo de errores | ✅ Mejorado | Mensajes claros para el usuario |

---

## 🔄 PRÓXIMOS PASOS:

1. **Probar descarga completa** con una quincena real
2. **Probar descarga individual** para varios brokers
3. **Verificar formato PDF** (logo, tablas, totales)
4. **Verificar formato Excel** (todas las hojas)
5. **Confirmar que datos coinciden** con los mostrados en pantalla

---

## 📞 SOPORTE:

Si encuentras algún problema:

1. **Abre la consola** del navegador (F12)
2. **Busca logs** que empiecen con `[Download]`
3. **Copia el error** completo
4. **Verifica** que la quincena tenga datos de comm_items

---

**Fecha de corrección:** 24 de noviembre, 2025
**Archivos modificados:**
- `src/app/api/commissions/fortnight-details/route.ts`
- `src/components/commissions/FortnightDetailView.tsx`
- `src/components/commissions/PreviewTab.tsx`
