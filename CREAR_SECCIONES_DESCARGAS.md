# Crear Secciones de Descargas para Aseguradoras

**Fecha:** 2025-10-27  
**Objetivo:** Poblar automáticamente las secciones de trámites para todas las aseguradoras

---

## 🎯 ¿QUÉ HACE EL SCRIPT?

Crea automáticamente **todas las secciones de trámites** para cada aseguradora activa en el sistema. Esto permite que los usuarios puedan subir PDFs organizados por:

- **Aseguradora** (ASSA, IFS, etc.)
- **Tipo de Póliza** (Auto, Salud, Vida, etc.)
- **Trámite** (Emisión, Renovación, Endoso, etc.)

---

## 📋 TRÁMITES CREADOS

Para **cada aseguradora** y **cada tipo de póliza**, se crean estas secciones:

1. **Emisión** - Documentos para emitir nueva póliza
2. **Renovación** - Documentos para renovar póliza existente  
3. **Endoso** - Documentos para modificar póliza
4. **Cancelación** - Documentos para cancelar póliza
5. **Reclamos** - Documentos para procesar reclamos
6. **Otros Trámites** - Documentos varios

---

## 🏢 TIPOS DE PÓLIZA

El script crea secciones para estos tipos:

- **Auto** - Seguros vehiculares
- **Salud** - Seguros de salud/gastos médicos
- **Vida** - Seguros de vida
- **Hogar** - Seguros residenciales
- **Comercial** - Seguros comerciales/empresariales

---

## 📊 TOTAL DE SECCIONES

**Por aseguradora:**
- 5 tipos de póliza × 6 trámites = **30 secciones**

**Ejemplo con 10 aseguradoras:**
- 10 aseguradoras × 30 secciones = **300 secciones totales**

---

## 🚀 CÓMO EJECUTAR EL SCRIPT

### **1. Verificar variables de entorno**

Asegúrate de tener configurado `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### **2. Ejecutar el script**

```bash
npx ts-node scripts/seed/seed_download_sections.ts
```

### **3. Ver el progreso**

```
🚀 Iniciando creación de secciones de descargas...

✅ Encontradas 10 aseguradoras activas:
   - ASSA
   - IFS
   - WW MEDICAL
   - FEDPA
   ...

📁 Procesando ASSA...
   ✅ Completado para ASSA

📁 Procesando IFS...
   ✅ Completado para IFS

...

═══════════════════════════════════════
📊 RESUMEN:
   ✅ Secciones creadas: 300
   ⏭️  Secciones existentes (omitidas): 0
   📁 Aseguradoras procesadas: 10
═══════════════════════════════════════

🎉 ¡Proceso completado exitosamente!
```

---

## 📁 ESTRUCTURA CREADA

Después de ejecutar el script, la estructura en la base de datos será:

```
download_sections
├── ASSA
│   ├── Auto
│   │   ├── Emisión - Auto
│   │   ├── Renovación - Auto
│   │   ├── Endoso - Auto
│   │   ├── Cancelación - Auto
│   │   ├── Reclamos - Auto
│   │   └── Otros Trámites - Auto
│   ├── Salud
│   │   ├── Emisión - Salud
│   │   ├── Renovación - Salud
│   │   └── ...
│   └── Vida, Hogar, Comercial...
├── IFS
│   └── (misma estructura)
└── WW MEDICAL
    └── (misma estructura)
```

---

## 🌐 FLUJO DE USO DESPUÉS DEL SCRIPT

### **Para Master:**

1. **Ir a `/downloads`** en el portal
2. **Seleccionar Scope:** Broker/Master
3. **Seleccionar Tipo:** Auto, Salud, Vida, etc.
4. **Seleccionar Aseguradora:** ASSA, IFS, etc.
5. **Seleccionar Trámite:** Emisión, Renovación, etc.
6. **Subir PDF:** Click "Subir Archivo"
7. **Llenar info:** Nombre, descripción
8. **Guardar:** El archivo se guarda en esa sección

### **Para Broker:**

1. **Ir a `/downloads`**
2. **Navegar por:** Tipo → Aseguradora → Trámite
3. **Ver PDFs disponibles**
4. **Descargar** los que necesite

---

## 🔍 EJEMPLO DE NAVEGACIÓN

```
/downloads
└── Scope: Broker
    └── Tipo: Auto
        └── Aseguradora: ASSA
            ├── Emisión - Auto
            │   ├── 📄 Formulario_Emisión_Auto_2024.pdf
            │   └── 📄 Lista_Requisitos_Auto.pdf
            ├── Renovación - Auto
            │   └── 📄 Formulario_Renovación_Auto.pdf
            ├── Endoso - Auto
            │   └── 📄 Solicitud_Endoso_Auto.pdf
            └── Reclamos - Auto
                ├── 📄 Formulario_Reclamo_Auto.pdf
                └── 📄 Documentos_Requeridos_Reclamo.pdf
```

---

## 🗂️ TABLA AFECTADA

### **download_sections**

```sql
CREATE TABLE download_sections (
  id UUID PRIMARY KEY,
  insurer_id UUID REFERENCES insurers(id),
  name VARCHAR NOT NULL,           -- "Emisión - Auto"
  policy_type VARCHAR NOT NULL,    -- "auto", "salud", "vida"
  scope VARCHAR NOT NULL,           -- "broker", "master"
  display_order INT NOT NULL,      -- Orden de visualización
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Ejemplo de registro:**
```sql
{
  id: "uuid-123",
  insurer_id: "assa-uuid",
  name: "Emisión - Auto",
  policy_type: "auto",
  scope: "broker",
  display_order: 1
}
```

---

## ⚙️ CONFIGURACIÓN DEL SCRIPT

### **Modificar Trámites**

Editar array `TRAMITES` en el script:

```typescript
const TRAMITES = [
  { name: 'Emisión', slug: 'emision' },
  { name: 'Renovación', slug: 'renovacion' },
  { name: 'Tu Nuevo Trámite', slug: 'nuevo' }, // ⬅️ Agregar aquí
];
```

### **Modificar Tipos de Póliza**

Editar array `POLICY_TYPES`:

```typescript
const POLICY_TYPES = [
  { type: 'auto', name: 'Auto' },
  { type: 'salud', name: 'Salud' },
  { type: 'tu_tipo', name: 'Tu Tipo' }, // ⬅️ Agregar aquí
];
```

---

## 🔄 RE-EJECUTAR EL SCRIPT

El script es **idempotente**:
- ✅ Detecta secciones existentes
- ⏭️ Las omite (no duplica)
- ✅ Solo crea las faltantes

Puedes ejecutarlo múltiples veces sin problema.

**Salida si ya existen:**
```
📊 RESUMEN:
   ✅ Secciones creadas: 0
   ⏭️  Secciones existentes (omitidas): 300
```

---

## 🆕 AGREGAR NUEVA ASEGURADORA

Cuando se agrega una nueva aseguradora:

1. **Crear aseguradora** en `/insurers/new`
2. **Marcar como activa**
3. **Ejecutar script** nuevamente
4. ✅ Se crean las 30 secciones automáticamente

---

## 🎯 SCOPE: BROKER VS MASTER

**Scope en download_sections:**

- **`scope: 'broker'`** → Visible para todos los brokers
- **`scope: 'master'`** → Solo visible para Master

**Por defecto:** El script crea todo con `scope: 'broker'`

**Para cambiar después:**
```sql
UPDATE download_sections 
SET scope = 'master' 
WHERE name LIKE '%Cancelación%';
```

---

## 📊 VERIFICAR CREACIÓN

### **SQL Query:**

```sql
SELECT 
  i.name as aseguradora,
  ds.policy_type,
  ds.name as tramite,
  ds.scope
FROM download_sections ds
JOIN insurers i ON i.id = ds.insurer_id
ORDER BY i.name, ds.policy_type, ds.display_order;
```

### **Contar secciones por aseguradora:**

```sql
SELECT 
  i.name as aseguradora,
  COUNT(*) as total_secciones
FROM download_sections ds
JOIN insurers i ON i.id = ds.insurer_id
GROUP BY i.name
ORDER BY i.name;
```

**Resultado esperado:**
```
ASSA        | 30
IFS         | 30
WW MEDICAL  | 30
```

---

## 🐛 TROUBLESHOOTING

### **Error: "Missing SUPABASE_SERVICE_ROLE_KEY"**

```bash
# Verificar que .env.local existe
ls -la .env.local

# Verificar contenido
cat .env.local | grep SUPABASE
```

### **Error: "No se encontraron aseguradoras activas"**

```sql
-- Verificar aseguradoras en BD
SELECT name, active FROM insurers;

-- Activar aseguradoras
UPDATE insurers SET active = true;
```

### **Error: "Cannot find module 'dotenv'"**

```bash
npm install dotenv @types/dotenv
```

---

## ✅ CHECKLIST ANTES DE EJECUTAR

- [ ] `.env.local` configurado
- [ ] Variables de entorno correctas
- [ ] Al menos 1 aseguradora activa en BD
- [ ] Conexión a Supabase funcional
- [ ] Permisos de escritura en `download_sections`

---

## 🎉 RESULTADO FINAL

Después de ejecutar el script, el sistema estará listo para:

✅ **Subir PDFs** organizados por aseguradora y trámite  
✅ **Navegar fácilmente** por tipo de póliza  
✅ **Descargar documentos** específicos por trámite  
✅ **Mantener organizado** todo el material de cada aseguradora

---

**¡Todo listo para empezar a subir los PDFs de cada trámite!** 📄🎉
