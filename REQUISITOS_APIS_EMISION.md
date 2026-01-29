# REQUISITOS COMPLETOS - APIs de Emisión

## FEDPA SEGUROS - Emisión de Póliza

### Endpoint
POST /api/emitirpoliza
Authorization: Bearer {token}

### CLIENTE - Campos Requeridos

| Campo | Tipo | Obligatorio | Formato/Valores | Ejemplo |
|-------|------|-------------|-----------------|---------|
| PrimerNombre | String | ✅ Sí | Texto | "Juan" |
| PrimerApellido | String | ✅ Sí | Texto | "Pérez" |
| SegundoNombre | String | ❌ No | Texto | "Carlos" |
| SegundoApellido | String | ❌ No | Texto | "López" |
| Identificacion | String | ✅ Sí | Cédula/RUC/Pasaporte | "8-123-4567" |
| FechaNacimiento | String | ✅ Sí | dd/mm/yyyy | "15/03/1985" |
| Sexo | String | ✅ Sí | M o F | "M" |
| Ocupacion | Number | ❌ No | Código ocupación | 1 |
| Direccion | String | ✅ Sí | Texto | "Calle 50, Panamá" |
| Telefono | Number | ✅ Sí | Solo números | 2551234 |
| Celular | Number | ✅ Sí | Solo números | 65551234 |
| Email | String | ✅ Sí | Email válido | "cliente@email.com" |
| esPEP | Number | ✅ Sí | 0=No, 1=Sí | 0 |
| Acreedor | String | ❌ No | Banco acreedor | "Banco General" |

### VEHÍCULO - Campos Requeridos

| Campo | Tipo | Obligatorio | Formato/Valores | Ejemplo |
|-------|------|-------------|-----------------|---------|
| Uso | String | ✅ Sí | Código de uso | "10" (Particular) |
| Marca | String | ✅ Sí | Código marca | "4" (Toyota) |
| Modelo | String | ✅ Sí | Código modelo | "10" (Corolla) |
| Ano | String | ✅ Sí | Año YYYY | "2022" |
| Motor | String | ✅ Sí | Número motor | "ABC123456" |
| Placa | String | ✅ Sí | Placa vehículo | "ABC-1234" |
| MesVencimientoPlaca | String | ❌ No | Mes 1-12 | "12" |
| Vin | String | ✅ Sí | VIN | "1HGBH41JXMN109186" |
| Color | String | ✅ Sí | Color | "Rojo" |
| Pasajero | Number | ✅ Sí | Capacidad pasajeros | 5 |
| Puerta | Number | ✅ Sí | Número de puertas | 4 |
| sumaAsegurada | Number | ❌ No | Valor en USD | 15000 |

### DOCUMENTOS - Requeridos

| Documento | Nombre Exacto | Obligatorio | Formatos |
|-----------|---------------|-------------|----------|
| Cédula/Pasaporte | `documento_identidad` | ✅ Sí | PDF, JPG, PNG |
| Licencia Conducir | `licencia_conducir` | ✅ Sí | PDF, JPG, PNG |
| Registro Vehicular | `registro_vehicular` | ✅ Sí | PDF, JPG, PNG |

**Proceso Upload:**
1. POST /api/subirdocumentos (form-data con archivos)
2. Retorna `idDoc` (ej: "Doc-asEHNVIAam")
3. Usar `idDoc` en emisión

### PÓLIZA

| Campo | Tipo | Obligatorio | Notas |
|-------|------|-------------|-------|
| Plan | Number | ✅ Sí | Código del plan cotizado |
| idDoc | String | ✅ Sí | ID de documentos subidos |
| PrimaTotal | Number | ❌ No | Prima total a pagar |

---

## INTERNACIONAL DE SEGUROS - Emisión de Póliza

### Endpoint
POST /EmisorExterno/ActualizarDatosCotizacion
GET /EmisorExterno/EmitirCotizacion

### CLIENTE - Campos Requeridos

| Campo | Tipo | Obligatorio | Formato/Valores | Ejemplo |
|-------|------|-------------|-----------------|---------|
| vRifNombre | String | ✅ Sí | Nombre completo | "Juan Pérez" |
| vRifCedula | String | ✅ Sí | Cédula | "8-123-4567" |
| vEmail | String | ✅ Sí | Email | "cliente@email.com" |
| vTelefono | String | ✅ Sí | Teléfono | "555-1234" |
| vDireccion | String | ✅ Sí | Dirección | "Calle 50" |

### VEHÍCULO - Campos Requeridos

| Campo | Tipo | Obligatorio | Formato/Valores | Ejemplo |
|-------|------|-------------|-----------------|---------|
| vIdmarca | String | ✅ Sí | Código marca | "4" |
| vIdmodelo | String | ✅ Sí | Código modelo | "10" |
| vAno | String | ✅ Sí | Año | "2022" |
| vValorVehiculo | Number | ✅ Sí | Valor USD | 15000 |
| vPlaca | String | ✅ Sí | Placa | "ABC-1234" |
| vMotor | String | ✅ Sí | Motor | "ABC123" |
| vChasis | String | ✅ Sí | Chasis/VIN | "1HGBH41JXMN109186" |
| vColor | String | ✅ Sí | Color | "Rojo" |
| vPasajeros | Number | ✅ Sí | Capacidad | 5 |

### DOCUMENTOS - Requeridos

| Documento | Obligatorio | Formatos |
|-----------|-------------|----------|
| Cédula/Pasaporte | ✅ Sí | PDF, JPG, PNG |
| Licencia Conducir | ✅ Sí | PDF, JPG, PNG |
| Tarjeta Circulación | ✅ Sí | PDF, JPG, PNG |

### FOTOS INSPECCIÓN VEHICULAR

**Mínimo 8 fotos requeridas:**
1. ✅ Frontal completo
2. ✅ Trasera completo
3. ✅ Lateral izquierdo
4. ✅ Lateral derecho
5. ✅ Tablero/Odómetro
6. ✅ Motor
7. ✅ Interior delantero
8. ✅ Interior trasero

**Especificaciones:**
- Formato: JPG, PNG, WEBP
- Tamaño máximo: 5MB por foto
- Resolución mínima: 800x600px
- Total máximo: 20 fotos

---

## RESUMEN COMPARATIVO

| Aspecto | FEDPA | Internacional |
|---------|-------|---------------|
| **Nombre completo** | PrimerNombre + PrimerApellido (separados) | vRifNombre (completo) |
| **Fecha nacimiento** | ✅ Requerida (dd/mm/yyyy) | ❌ No requerida |
| **Sexo** | ✅ Requerida (M/F) | ❌ No requerida |
| **Teléfonos** | Telefono + Celular (números) | vTelefono (string) |
| **PEP** | ✅ Requerida (0/1) | ❌ No aplica |
| **Pasajeros** | ✅ Requerida | ✅ Requerida (vPasajeros) |
| **Puertas** | ✅ Requerida | ❌ No requerida |
| **Documentos** | 3 (identidad, licencia, registro) | 3 (identidad, licencia, circulación) |
| **Fotos inspección** | ❓ Por confirmar | ✅ Mínimo 8 fotos |
| **Token auth** | ✅ Bearer token | ❌ Usuario/Clave en query |

---

## CAMPOS FALTANTES EN EMISIÓN ACTUAL

### EmissionDataForm.tsx - Agregar:

**Cliente:**
- [ ] Nombre completo (separar primer/segundo nombre y apellidos)
- [ ] Fecha de nacimiento (date picker iOS-friendly)
- [ ] Sexo (radio buttons M/F)
- [ ] Email
- [ ] Teléfono fijo
- [ ] Celular
- [ ] Dirección completa
- [ ] PEP (checkbox con tooltip explicativo)
- [ ] Acreedor (opcional, condicional si tiene financiamiento)

**Vehículo:**
- [ ] Capacidad de pasajeros (selector 2-9)
- [ ] Número de puertas (selector 2-5)
- [ ] Registro vehicular (file upload)

### VehicleInspection.tsx - Verificar:
- [ ] Mínimo 8 fotos obligatorias
- [ ] Nombres descriptivos por foto
- [ ] Validación de formatos (JPG, PNG, WEBP)
- [ ] Validación de tamaño (max 5MB)
- [ ] Preview antes de enviar

---

## CHECKLIST IMPLEMENTACIÓN

### 1. Inputs iOS-Friendly ✅
- [ ] text-base (16px mínimo)
- [ ] py-2.5 o py-3 (44px altura total)
- [ ] px-3 o px-4
- [ ] border-2 visible
- [ ] focus:border-[#8AAA19]

### 2. Formulario Emisión
- [ ] Ampliar EmissionData interface
- [ ] Agregar todos los campos requeridos
- [ ] Validaciones por aseguradora
- [ ] Tooltips explicativos (PEP, Acreedor, etc)
- [ ] Date picker mobile-friendly

### 3. Upload Documentos
- [ ] Componente reutilizable DocumentUpload
- [ ] Validación tipo MIME
- [ ] Validación tamaño
- [ ] Preview de archivos
- [ ] Progress bar

### 4. Inspección Vehicular
- [ ] Guía visual por foto
- [ ] Cámara integrada (mobile)
- [ ] Validación 8 fotos mínimo
- [ ] Reordenamiento de fotos
- [ ] Retomar fotos individuales

### 5. Testing
- [ ] FEDPA DEV: Emisión completa end-to-end
- [ ] IS DEV: Emisión completa end-to-end
- [ ] Mobile: iOS Safari, Chrome Android
- [ ] Desktop: Chrome, Firefox, Edge
