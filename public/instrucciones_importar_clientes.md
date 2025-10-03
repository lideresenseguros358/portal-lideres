# 📋 Instrucciones para Importar Clientes y Pólizas

## Formato del archivo CSV

El archivo debe ser un CSV con las siguientes columnas (respete el orden y los nombres exactos):

### Columnas Obligatorias ✅

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| **client_name** | Nombre completo del cliente | Juan Pérez / Empresa XYZ S.A. |
| **policy_number** | Número de póliza (único) | POL-2024-001 |
| **insurer_name** | Nombre EXACTO de la aseguradora | ASSA, AIG, MAPFRE |
| **broker_email** | Email del corredor asignado | broker@lideresenseguros.com |

### Columnas Opcionales (pueden dejarse vacías)

| Columna | Descripción | Ejemplo | Nota |
|---------|-------------|---------|------|
| **national_id** | Cédula/Pasaporte/RUC | 8-123-4567 | ⚠️ Requerido para registro oficial |
| **email** | Email del cliente | cliente@email.com | |
| **phone** | Teléfono | 6000-0000 | |
| **address** | Dirección completa | Calle 50, Panamá | |
| **ramo** | Tipo de seguro | Autos, Vida, Incendio | |
| **start_date** | Fecha de inicio | 2024-01-15 | Formato: YYYY-MM-DD |
| **renewal_date** | Fecha de renovación | 2025-01-15 | Formato: YYYY-MM-DD |
| **status** | Estado de la póliza | active, inactive, cancelled | Por defecto: active |
| **percent_override** | % comisión específico | 15.5 | Si vacío, usa el % del broker |

---

## ⚠️ Reglas Importantes

### 1. **Aseguradoras**
- Debe usar el nombre EXACTO como aparece en el sistema
- La aseguradora debe estar activa
- Nombres válidos: ASSA, AIG, MAPFRE, SURA, ACE Seguros, etc.
- ❌ No se crearán aseguradoras automáticamente

### 2. **Broker Email**
- **Master**: Puede usar cualquier email de broker registrado
- **Broker**: Se usa automáticamente su propio email (ignorará el valor del CSV)

### 3. **National ID (Cédula/RUC)**
- ⚠️ **CRÍTICO**: Sin este campo, el cliente queda como **PRELIMINAR**
- Cliente preliminar NO aparece en la base de datos oficial hasta completar este campo
- Una vez agregado el national_id, se activa automáticamente

### 4. **Policy Number**
- Debe ser único en todo el sistema
- Si ya existe, la fila será rechazada
- Formato libre, pero se recomienda: POL-YYYY-NNN

### 5. **Porcentaje de Comisión**
- Si está vacío: usa el porcentaje default del broker
- Si tiene valor: sobrescribe el porcentaje para esa póliza
- Solo Master puede ver/editar este campo

### 6. **Fechas**
- Formato obligatorio: **YYYY-MM-DD**
- Ejemplos válidos: 2024-01-15, 2025-12-31
- ❌ Inválido: 15/01/2024, 01-15-2024

---

## 📝 Ejemplo de CSV Válido

```csv
client_name,national_id,email,phone,address,policy_number,insurer_name,ramo,start_date,renewal_date,status,broker_email,percent_override
Juan Pérez,8-123-4567,juan@email.com,6000-0000,Calle 50,POL-2024-001,ASSA,Autos,2024-01-15,2025-01-15,active,broker@lideresenseguros.com,15.5
María García,E-8-12345,maria@email.com,,,POL-2024-002,AIG,Vida,2024-02-01,2025-02-01,active,broker@lideresenseguros.com,
```

---

## 🔄 Proceso de Importación

1. **Descarga la plantilla** desde el botón "Descargar Plantilla CSV"
2. **Completa los datos** respetando el formato
3. **Sube el archivo** en la página de importación
4. **Revisa el preview**:
   - ✅ Válidos: se procesarán
   - ❌ Con errores: se mostrarán con explicación
5. **Confirma la carga** de los registros válidos
6. **Resultado**:
   - Registros con `national_id`: se crean inmediatamente en la BD
   - Sin `national_id`: quedan como preliminares hasta completar

---

## 🚨 Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Aseguradora no encontrada" | Nombre no coincide exactamente | Verificar nombre en lista de aseguradoras |
| "Póliza ya existe" | policy_number duplicado | Cambiar número o actualizar la existente |
| "Broker no encontrado" | Email no registrado | Verificar email del broker en el sistema |
| "Fecha inválida" | Formato incorrecto | Usar YYYY-MM-DD |
| "Porcentaje inválido" | Valor fuera de rango | Usar valores entre 0.00 y 100.00 |

---

## 💡 Consejos

- **Excel/Google Sheets**: Al guardar, seleccionar "CSV UTF-8 (delimitado por comas)"
- **Encoding**: Guardar en UTF-8 para caracteres especiales (ñ, á, etc.)
- **Campos vacíos**: Dejar la celda vacía, no escribir "NULL" o "-"
- **Múltiples pólizas**: Un cliente puede tener varias filas (una por póliza)
- **Actualización**: Si el cliente ya existe (mismo national_id), se actualizarán sus datos

---

## 📞 Soporte

Si tienes problemas con la importación, contacta al administrador del sistema.
