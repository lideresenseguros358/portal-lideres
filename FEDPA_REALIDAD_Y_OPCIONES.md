# 🔍 FEDPA - Realidad vs Expectativa

## ❌ PROBLEMA IDENTIFICADO

La API de FEDPA que tienes **NO sirve** para lo que necesitas.

---

## 📋 LO QUE TIENES

### **APIs de FEDPA Configuradas:**

```
✅ EmisorPlan (2024)
   - Generar token
   - Consultar planes
   - Subir documentos
   - Emitir pólizas nuevas

✅ Emisor Externo (2021)
   - Consultar límites
   - Generar cotización
   - Crear póliza nueva
```

**Credenciales:**
- Usuario: `lider836`
- Clave: `lider836`
- Corredor: `836`
- URLs: `https://wscanales.segfedpa.com/`

---

## ❌ LO QUE NO TIENES

### **APIs que NO EXISTEN en FEDPA:**

```
❌ Consultar póliza existente por número
❌ Obtener datos de cliente de póliza emitida
❌ Buscar historial de pólizas
❌ API de consulta de datos
```

**Las APIs de FEDPA son solo para EMISIÓN, no para CONSULTA.**

---

## 🎯 TU NECESIDAD REAL

Quieres:
1. Leer todas tus pólizas de la BD
2. Para cada póliza con datos faltantes (email, teléfono, fechas)
3. Consultar esos datos en FEDPA
4. Actualizar tu BD automáticamente

**Esto NO es posible con las APIs actuales de FEDPA.**

---

## ✅ SOLUCIONES REALES

### **Opción 1: Acceso SQL Directo a FEDPA** 🔐

Contacta a FEDPA y solicita:

```
✅ Credenciales de solo lectura a su BD
✅ Host de SQL Server
✅ Nombre de base de datos
✅ Tablas disponibles
```

**Entonces sí podrías:**

```sql
-- Conectar directo a SQL Server de FEDPA
SELECT 
  p.policy_number,
  c.name,
  c.national_id,
  c.email,
  c.phone,
  p.start_date,
  p.renewal_date
FROM fedpa.policies p
JOIN fedpa.clients c ON c.id = p.client_id
WHERE p.policy_number IN ('AUTO-123', 'VIDA-456', ...)
```

**Script que necesitarías:**
```typescript
// Conectar a SQL Server de FEDPA
const fedpaDb = new SqlClient({
  host: 'fedpa-sql-server.com',
  user: 'lider836_readonly',
  password: '...',
  database: 'FEDPA_PROD',
});

// Consultar en lotes
const results = await fedpaDb.query(`
  SELECT * FROM policies 
  WHERE policy_number IN (?)
`, [policyNumbers]);

// Actualizar tu BD
await supabase.from('clients').update({
  email: results[0].client_email,
  phone: results[0].client_phone,
  ...
});
```

---

### **Opción 2: Export Periódico desde FEDPA** 📊

Solicita a FEDPA:

```
✅ Export CSV mensual de todas las pólizas
✅ Con campos: policy_number, client_name, email, phone, dates
✅ Automatizado por email o FTP
```

**Proceso:**
1. FEDPA te envía CSV cada mes
2. Importas a una tabla temporal
3. Cruzas con tus pólizas
4. Actualizas campos vacíos

**Script de importación:**
```typescript
// Leer CSV de FEDPA
const fedpaData = await parseCSV('fedpa_export.csv');

// Cruzar y actualizar
for (const row of fedpaData) {
  await supabase
    .from('policies')
    .update({
      start_date: row.start_date,
      renewal_date: row.renewal_date,
    })
    .eq('policy_number', row.policy_number)
    .is('start_date', null); // Solo si está vacío
}
```

---

### **Opción 3: Mantener Datos al Emitir (Preventivo)** 💾

Para FUTURAS pólizas que emitas vía FEDPA:

**Actualiza tu flujo de emisión:**

```typescript
// ANTES (solo guardas número)
const emitida = await emitirPolizaFedpa(data);
await guardarPoliza({
  policy_number: emitida.nroPoliza,
});

// DESPUÉS (guardas todo)
const emitida = await emitirPolizaFedpa(data);
await guardarPoliza({
  policy_number: emitida.nroPoliza,
  client_email: data.email,        // ✅ Guardar
  client_phone: data.telefono,     // ✅ Guardar
  start_date: data.fechaInicio,    // ✅ Guardar
  renewal_date: data.fechaRenovacion, // ✅ Guardar
  insurer_id: data.aseguradora,    // ✅ Guardar
  ramo: data.ramo,                 // ✅ Guardar
});
```

**Esto previene que falten datos en el futuro.**

---

### **Opción 4: Portal Web de FEDPA (Manual)** 🌐

Si FEDPA tiene un portal web:

1. Ingresar manualmente
2. Buscar póliza por número
3. Copiar datos faltantes
4. Actualizar tu BD

**Pros:**
- ✅ Funciona siempre

**Contras:**
- ❌ Manual y lento
- ❌ No escalable

---

## 🎯 RECOMENDACIÓN

### **Mejor Solución: Opción 1 + Opción 3**

**Para datos HISTÓRICOS (ya existentes):**
1. Solicita acceso SQL de solo lectura a FEDPA
2. Script de sincronización 1 vez
3. Completas todos los vacíos

**Para datos FUTUROS (nuevas emisiones):**
1. Actualiza tu código de emisión
2. Guardas todos los datos al emitir
3. No quedan vacíos

---

## 📞 CONTACTAR A FEDPA

### **Qué solicitar:**

```
Asunto: Solicitud de Acceso SQL para Integración

Estimados FEDPA,

Somos LÍDERES EN SEGUROS (Corredor 836).

Necesitamos acceso de SOLO LECTURA a su base de datos 
para sincronizar información de pólizas emitidas.

Requerimos:
1. Host de SQL Server
2. Credenciales de solo lectura
3. Nombre de base de datos
4. Tablas: policies, clients
5. Documentación de esquema

Alternativamente, un export CSV mensual automatizado.

Propósito: Mantener nuestro CRM actualizado con datos 
de pólizas emitidas vía sus APIs.

Gracias.
```

---

## 🔄 MIENTRAS TANTO (TEMPORAL)

### **Opción 5: Entrada Manual Guiada** 🎯

Crear interfaz para entrada rápida:

```typescript
// Pantalla: "Completar Datos de Póliza"

Póliza: AUTO-12345
Cliente: Juan Pérez

Datos Faltantes:
[ ] Email: ___________________
[ ] Teléfono: ________________
[ ] Fecha Inicio: ____________
[ ] Fecha Renovación: _________

[Consultar en FEDPA Web] [Guardar]
```

**Proceso:**
1. Master abre el portal de FEDPA
2. Busca la póliza
3. Copia los datos
4. Los pega en tu sistema
5. Botón "Guardar" actualiza BD

**Es manual pero:**
- ✅ Funciona ahora
- ✅ No depende de FEDPA
- ✅ Completas las 50-100 pólizas en 1 hora

---

## 📊 COMPARACIÓN DE OPCIONES

| Opción | Tiempo Setup | Costo | Escalable | Recomendado |
|--------|--------------|-------|-----------|-------------|
| SQL Directo | 1 semana | $0 | ✅ Sí | ⭐⭐⭐⭐⭐ |
| CSV Export | 3 días | $0 | ✅ Sí | ⭐⭐⭐⭐ |
| Al Emitir | 1 día | $0 | ✅ Sí | ⭐⭐⭐⭐⭐ |
| Portal Web | 0 | $0 | ❌ No | ⭐⭐ |
| Entrada Manual | 1 hora | Tiempo | ❌ No | ⭐⭐⭐ |

---

## ✅ PLAN DE ACCIÓN RECOMENDADO

### **Inmediato (Esta semana):**
1. ✅ Actualiza código de emisión para guardar todos los datos
2. ✅ Crea interfaz de entrada manual para las pólizas existentes

### **Corto plazo (Este mes):**
3. ⏳ Contacta a FEDPA para acceso SQL o CSV export
4. ⏳ Completa datos faltantes usando la interfaz manual

### **Mediano plazo (Próximos 2 meses):**
5. ⏳ Implementa sincronización SQL si FEDPA aprueba
6. ⏳ Automatiza imports de CSV si FEDPA los provee

---

## 🎯 CONCLUSIÓN

**La integración de "enriquecimiento automático" que creamos NO funcionará** 
porque FEDPA no tiene una API de consulta.

**Necesitas:**
- Acceso SQL directo a FEDPA, O
- Exports CSV periódicos de FEDPA, O
- Entrada manual con interfaz optimizada

**¿Cuál opción prefieres que implemente?**
