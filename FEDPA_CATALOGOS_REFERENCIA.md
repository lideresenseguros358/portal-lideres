# FEDPA - Catálogos de Referencia

## Endpoints de Catálogos

Base URL: `https://wscanales.segfedpa.com/EmisorFedpa.Api/api/Polizas`

Credenciales: `Usuario=SLIDERES&Clave=lider836`

---

## 1. LÍMITES

**Endpoint:** `/consultar_limites_externos?Usuario=SLIDERES&Clave=lider836`

**Total:** 28 límites

**Estructura:**
- `CODCOBERTURA`: 1 (Lesiones), 2 (Propiedad), 3 (Gastos Médicos)
- `IDLIMITE`: ID único del límite
- `LIMITE`: Valor en formato string (ej: "10,000.00/20,000.00")

**Coberturas:**

### CODCOBERTURA 1 - Lesiones Corporales (7 límites)
- 1: "10,000.00/20,000.00"
- 2: "100,000.00/300,000.00"
- 3: "20,000.00/40,000.00"
- 4: "25,000.00/50,000.00"
- 5: "5,000.00/10,000.00"
- 6: "50,000.00/100,000.00"
- 7: "50,000.00/50,000.00"

### CODCOBERTURA 2 - Daños a la Propiedad (7 límites)
- 8: "10,000.00"
- 9: "100,000.00"
- 10: "15,000.00"
- 11: "20,000.00"
- 12: "25,000.00"
- 13: "5,000.00"
- 14: "50,000.00"

### CODCOBERTURA 3 - Gastos Médicos (14 límites)
- 0: "0/0"
- 15: "1,000.00/5,000.00"
- 16: "10,000.00/50,000.00"
- 17: "2,000.00/10,000.00"
- 18: "5,000.00/25,000.00"
- 19: "5,000.00/35,000.00"
- 20: "5,000.00/40,000.00"
- 21: "5,000.00/75,000.00"
- 22: "500.00/1,000.00"
- 23: "500.00/2,500.00"
- 25: "15,000.00/10,000.00"
- 26: "3,000.00/3,000.00"
- 27: "2,500.00/12,500.00"

---

## 2. PLANES

**Endpoint:** `/consultar_planes_cc_externos?Usuario=SLIDERES&Clave=lider836`

**Total:** 33 planes (algunos duplicados con múltiples usos)

**Estructura:**
- `PLAN`: ID del plan
- `NOMBREPLAN`: Nombre descriptivo
- `USO`: Código de uso asociado

**Planes Principales:**

### Cobertura Completa (CC)
- 411: CC PARTICULAR - WEB SERVICES (Uso: 10)
- 413: CC COMERCIAL HASTA 4 TONELADAS (Uso: 52)
- 443: CC TAXI - WEB SERVICES (Uso: 21)
- 434: CC TURISMO (Uso: 29)
- 435: CC COLEGIAL (Uso: 22C)
- 461: CC 3,000 A 19,999.99 - WEB SERVICES (Uso: 10)
- 462: CC 20,000 A 60,000 - WEB SERVICES (Uso: 10)
- 463: CC 60,001 A 150,000 - WEB SERVICES (Uso: 10)
- 464: EQUIPO PESADO CC - WEB SERVICES (Usos: 43, 47, 45)
- 474: CC WTW EXCLUSIVO SUZUKI (Uso: 10)

### Daños a Terceros (DT)
- 426: DT PARTICULARES (Uso: 10)
- 412: DT COMERCIAL HASTA 4 TONELADAS (Uso: 20)
- 414: DT COMERCIAL MULA (Uso: 43)
- 416: DT TAXI (Uso: 21)
- 417: DT TAXI COBERTURAS SOAT - WEB SERVICES (Uso: 21)
- 418: DT MOTO (Uso: 11)
- 422: DT COMERCIAL CAMIONES PESADOS (Uso: 47)
- 427: DT HASTA 15 PASAJEROS (Uso: 27)
- 428: DT BUSES 31 PASAJEROS O MAS (Uso: 31)
- 429: DT BUSES DE 16 A 30 PASAJEROS (Uso: 22)
- 433: DT TURISMO (Uso: 29)
- 436: DT COLEGIAL (Uso: 22C)
- 459: RC PARTICULARES - WTW - EXCL. TALLERES (Uso: 10)

### Asiento (Por Pasajero)
- 430: DT ASIENTO BUSES 16 A 30 PASAJEROS (Uso: 22)
- 431: DT ASIENTO 0 A 15 PASAJEROS (Uso: 27)
- 432: DT ASIENTO BUSES 31+ PASAJEROS (Uso: 31)
- 438: ASIENTO TAXI L.A. (Uso: 21)
- 439: ASIENTO TAXI L.B. (Uso: 21)
- 440: ASIENTO COLEGIAL (Uso: 22C)
- 441: ASIENTO MULA/CAMIONES PESADOS (Uso: 47)
- 442: ASIENTO COMERCIAL (Uso: 20)

---

## 3. BENEFICIOS

**Endpoint:** `/consultar_beneficios_planes_externos?Usuario=SLIDERES&Clave=lider836`

**Total:** 143 beneficios

**Estructura:**
- `PLAN`: ID del plan
- `BENEFICIOS`: Descripción del beneficio (string)

**Beneficios Comunes:**
- Asistencia Médica Telefónica 24 Horas
- Asistencia Vial (1 evento/año gasolina-batería-llantas)
- Endoso FEDPA PACK (303-2466)
- Inspección IN SITU
- Servicios de Grúa hasta $150 (2 eventos)
- Llamadas Ilimitadas Nacionales/Internacionales

**Beneficios Premium (Plan 411, 474 - Suzuki):**
- Atención expedita en un solo taller
- Cobertura extraterritorial hasta Costa Rica
- Servicio Emergencia GMI
- Muerte accidental conductor $500
- "Entregue las llaves"
- Reembolso diario por robo/hurto
- Defensa penal hasta $2,000
- Auto alquiler 10 días
- Descuento 50% mujer / 30% otros (mín $300)
- RC auto sustituto
- Pérdida objetos personales $100/evento
- 100% reembolso deducible sin culpa
- Vehículos nuevos: 100% valor 1er año

---

## 4. USOS

**Endpoint:** `/consultar_uso_externos?Usuario=SLIDERES&Clave=lider836`

**Total:** 15 usos

**Códigos y Descripciones:**
- `10`: AUTO PARTICULAR
- `11`: MOTO
- `20`: COMERCIAL
- `21`: TAXI
- `22`: BUSES (16-30 PASAJEROS)
- `22C`: BUSES COLEGIALES
- `23`: CAMION/PANEL/PICKUP
- `27`: BUS (0-15 PASAJEROS)
- `29`: TURISMO
- `31`: BUS (31 O MAS PASAJEROS)
- `43`: MULA
- `45`: CABEZAL
- `47`: CAMIONES PESADOS
- `52`: COMERCIAL LIVIANO
- `53`: COMERCIAL MEDIANO

---

## 5. NÚMERO DE PÓLIZA

**Endpoint:** `/get_nropoliza?Usuario=SLIDERES&Clave=lider836`

Genera número de póliza único para emisión.

**Respuesta:**
```json
{
  "NroPoliza": "XXXXXXXX"
}
```

---

## 6. COTIZACIÓN

**Endpoint:** `/get_cotizacion`

**Método:** POST

**Body (JSON):**
```json
{
  "Ano": 2019,
  "Uso": "10",
  "CantidadPasajeros": 5,
  "SumaAsegurada": "25000",
  "CodLimiteLesiones": "1",
  "CodLimitePropiedad": "7",
  "CodLimiteGastosMedico": "16",
  "EndosoIncluido": "S",
  "CodPlan": "342",
  "CodMarca": "HYU",
  "CodModelo": "GRAND i10",
  "Nombre": "carlos",
  "Apellido": "m",
  "Cedula": "8-098-987",
  "Telefono": "09231245",
  "Email": "R@YGROUP.COM",
  "Usuario": "prueba",
  "Clave": "123"
}
```

**Notas Importantes:**
- `SumaAsegurada`: **DEBE SER STRING** (no number)
- `EndosoIncluido`: "S" = Sí, "N" = No (incluye deducible bajo)
- `CodMarca` y `CodModelo`: Strings libres (FEDPA no valida catálogo)

---

## 7. EMISIÓN

**Endpoint:** `/crear_poliza_auto_cc_externos`

**Método:** POST (multipart/form-data)

**Parámetros:**
- `data`: JSON con datos de póliza
- Archivos adjuntos (cédula, licencia, registro)

**JSON Structure:**
```json
{
  "FechaHora": "2020-12-28 19:25:10 PM",
  "Monto": "100.00",
  "Aprobada": "S",
  "NroTransaccion": "P-1",
  "FechaAprobada": "2020-12-28 19:25:10 PM",
  "Ramo": "04",
  "SubRamo": "07",
  "IdCotizacion": "82",
  "NroPoliza": "8888888",
  "FechaDesde": "2020-12-28",
  "FechaHasta": "2021-12-28",
  "Opcion": "A",
  "Usuario": "PRUEBA",
  "Clave": "1234",
  "Entidad": [{
    "Juridico": "N",
    "PrimerNombre": "JOSE",
    "PrimerApellido": "TORRES",
    "DocumentoIdentificacion": "CED",
    "Cedula": "8-987-82",
    "FechaNacimiento": "2000-06-28",
    "Sexo": "M",
    "CodPais": "999",
    "CodProvincia": "999",
    "CodCorregimiento": "999",
    "Email": "M@HOTMIAL.COM",
    "TelefonoOficina": "12412412",
    "Direccion": "PANAMA",
    "IdVinculo": "1"
  }],
  "Auto": {
    "CodMarca": "AJAX",
    "CodModelo": "AJ01",
    "Ano": "2017",
    "Placa": "1231231",
    "Chasis": "1313342424",
    "Motor": "42342344234",
    "Color": "AZUL"
  }
}
```

---

## Mapeo de Deducibles

### EndosoIncluido = "S" (Deducible BAJO)
- Uso particular (10): $100-$300
- Uso comercial: $500-$1000

### EndosoIncluido = "N" (Deducible ESTÁNDAR)
- Según plan y suma asegurada

---

## Uso en Cotizador

1. **Cargar catálogos** al inicio (caché 24h)
2. **Seleccionar Uso** → Filtrar planes disponibles
3. **Seleccionar Plan** → Mostrar beneficios
4. **Configurar Límites** según cobertura
5. **Cotizar** con datos completos
6. **Mostrar resultado** con desglose prima

---

## Cache Strategy

- **TTL:** 24 horas
- **Storage:** localStorage
- **Actualización:** Manual o automática
- **Endpoint:** `/api/fedpa/catalogos`
