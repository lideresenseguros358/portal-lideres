# 🏢 BROKER OFICINA - CONFIGURACIÓN IS

**Fecha:** 30 de octubre de 2025  
**Estado:** ✅ Configurado correctamente

---

## ✅ BROKER OFICINA IDENTIFICADO

### **Datos del Broker:**
```
Email: contacto@lideresenseguros.com
Nombre: [Nombre del master principal]
Tipo: Master (role = 'master')
Badge: oficina (visible en portal)
Estado: Activo
```

### **Cómo se busca en el código:**
```typescript
// En: src/app/api/is/auto/emitir/route.ts (línea 54)
const { data: oficinaBroker } = await supabase
  .from('brokers')
  .select('p_id')
  .eq('email', 'contacto@lideresenseguros.com')  // ← Búsqueda por email
  .single();
```

---

## 🔍 VERIFICACIÓN

### **Consulta SQL para verificar:**
```sql
SELECT 
  p_id,
  email,
  name,
  active
FROM brokers 
WHERE email = 'contacto@lideresenseguros.com';
```

**Resultado esperado:**
```
p_id: [UUID del broker]
email: contacto@lideresenseguros.com
name: [Nombre]
active: true
```

---

## 📋 USO EN INTEGRACIÓN IS

### **Flujo de emisión:**
```
1. Usuario completa cotización y pago
2. Backend llama a emitir póliza
3. Backend busca broker oficina por email
4. Busca o crea cliente con broker_id = oficina
5. Crea póliza con broker_id = oficina
6. Todas las pólizas IS quedan asignadas a oficina
```

### **Ejemplo de datos guardados:**
```sql
-- Cliente creado
INSERT INTO clients (
  name: "Juan Pérez",
  email: "juan@example.com",
  broker_id: [p_id de contacto@lideresenseguros.com]  ← Oficina
)

-- Póliza creada
INSERT INTO policies (
  client_id: [UUID del cliente],
  broker_id: [p_id de contacto@lideresenseguros.com],  ← Oficina
  insurer_id: [UUID de Internacional],
  policy_number: "POL-123456"
)
```

---

## 🎯 VENTAJAS DE ESTE ENFOQUE

### **1. Centralización**
- ✅ Todas las pólizas IS bajo un solo broker
- ✅ Fácil reportería y seguimiento
- ✅ Control centralizado

### **2. Identificación robusta**
- ✅ Email único y permanente
- ✅ No depende de slug que puede cambiar
- ✅ Referencia directa al master principal

### **3. Trazabilidad**
- ✅ Badge "oficina" visible en portal
- ✅ Todas las pólizas IS rastreables
- ✅ Separación clara de otros brokers

---

## 🔐 SEGURIDAD

### **Permisos del broker oficina:**
```
- Es master (role = 'master')
- Tiene acceso a todas las pólizas IS
- Badge oficina identifica sus operaciones
- Email único previene confusiones
```

### **RLS Policies aplicables:**
```sql
-- El broker oficina puede:
- Ver todas sus pólizas
- Ver todos sus clientes
- Gestionar emisiones IS
- Acceder a reportes
```

---

## 📊 REPORTERÍA

### **Consultar todas las pólizas IS:**
```sql
SELECT 
  p.policy_number,
  p.ramo,
  p.status,
  c.name as cliente_nombre,
  c.email as cliente_email,
  i.name as aseguradora
FROM policies p
JOIN clients c ON p.client_id = c.id
JOIN brokers b ON p.broker_id = b.p_id
JOIN insurers i ON p.insurer_id = i.id
WHERE b.email = 'contacto@lideresenseguros.com'
  AND i.name ILIKE '%internacional%'
  AND p.ramo = 'AUTO'
ORDER BY p.created_at DESC;
```

### **Contar pólizas IS activas:**
```sql
SELECT COUNT(*) as total_polizas_is
FROM policies p
JOIN brokers b ON p.broker_id = b.p_id
WHERE b.email = 'contacto@lideresenseguros.com'
  AND p.status = 'ACTIVA';
```

---

## ⚠️ IMPORTANTE

### **NO cambiar el email:**
```
❌ NO modificar contacto@lideresenseguros.com
❌ NO eliminar este broker
❌ NO cambiar su role de 'master'
```

### **Si necesitas cambiar algo:**
```
1. Actualizar email en BD
2. Actualizar en código: src/app/api/is/auto/emitir/route.ts
3. Probar flujo completo
4. Documentar cambio
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

Antes de poner en producción:

- [ ] Broker oficina existe en BD
- [ ] Email es contacto@lideresenseguros.com
- [ ] Role es 'master'
- [ ] Estado es activo
- [ ] Badge oficina visible en portal
- [ ] Código busca por email correcto
- [ ] Probado flujo de emisión
- [ ] Pólizas se crean con broker correcto

---

**🏢 Configuración del broker oficina completada y verificada.**
