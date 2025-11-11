# 📄 Archivo de Prueba para Banco General

## ✅ Archivo Generado: `PRUEBA_BANCO_GENERAL.txt`

### **Características:**

- **Formato:** Exactamente igual al generado por el sistema
- **Separador:** Punto y coma (;)
- **Codificación:** UTF-8 sin BOM
- **Total de registros:** 75 brokers
- **Monto por transacción:** $1.00
- **Monto total:** $75.00

### **Estructura del Archivo:**

Cada línea tiene 8 campos separados por `;`:

```
001;ADOLFO PRESCOTT;71;449987510235;04;1.00;C;REF*TXT**EJEMPLO DE PRUEBA\
```

| Campo | Descripción | Ejemplo | Especificación |
|-------|-------------|---------|----------------|
| 1 | ID Beneficiario | 001 | Secuencial, 3 dígitos con ceros |
| 2 | Nombre Beneficiario | ADOLFO PRESCOTT | MAYÚSCULAS sin acentos, max 22 chars |
| 3 | Ruta Destino | 71 | Código del banco (tabla ach_banks) |
| 4 | Cuenta Destino | 449987510235 | Número de cuenta, solo dígitos |
| 5 | Producto Destino | 04 | 03=Corriente, 04=Ahorro |
| 6 | Monto | 1.00 | Formato: ###0.00 |
| 7 | Tipo Pago | C | C=Crédito, D=Débito |
| 8 | Referencia | REF*TXT**EJEMPLO DE PRUEBA\ | Inicia REF*TXT**, termina \ |

### **Distribución por Banco:**

| Banco | Código | Cantidad | Monto |
|-------|--------|----------|-------|
| BANCO GENERAL | 71 | 61 | $61.00 |
| BAC INTERNACIONAL | 1384 | 1 | $1.00 |
| CAJA DE AHORROS | 770 | 4 | $4.00 |
| GLOBAL BANK | 1151 | 1 | $1.00 |
| SCOTIA BANK | 424 | 1 | $1.00 |
| CREDICORP BANK | 1106 | 2 | $2.00 |
| BANISTMO | 26 | 2 | $2.00 |
| **TOTAL** | | **75** | **$75.00** |

### **Distribución por Tipo de Cuenta:**

| Tipo | Código | Cantidad | Monto |
|------|--------|----------|-------|
| Ahorro | 04 | 72 | $72.00 |
| Corriente | 03 | 3 | $3.00 |
| **TOTAL** | | **75** | **$75.00** |

### **Brokers Excluidos (Sin Datos Bancarios):**

Los siguientes 7 brokers NO aparecen en el archivo porque NO tienen datos bancarios completos:

1. DIANA CANDANEDO
2. FABIAN CANDANEDO
3. HERMINIO ARCIA
4. LILIANA SAMUDIO
5. LISSA
6. REINA PEDRESCHI
7. SOBIANTH PINEDA

**Nota:** Estos brokers necesitan completar sus datos bancarios para poder recibir pagos ACH.

### **Casos Especiales Incluidos:**

✅ **Titulares diferentes del broker:**
- Línea 024: RAFAEL VIZUETTE (cuenta de HERICKA GONZALEZ)
- Línea 035: DIDIMO SAMUDIO (cuenta de JOSE MANUEL FERNANDEZ)
- Línea 036: HAROLD SANMARTIN (cuenta de KAROL VALDES)
- Línea 047: EDILZA QUIROS (cuenta de LUIS QUIROS)

### **Validaciones Aplicadas:**

✅ Nombres en MAYÚSCULAS sin acentos (ñ → N, á → A, etc.)
✅ Números de cuenta solo dígitos (sin guiones ni espacios)
✅ Códigos de banco validados contra tabla ach_banks
✅ Tipo de cuenta solo 03 o 04
✅ Formato de referencia correcto (REF*TXT**...\\)
✅ Monto con 2 decimales

### **Instrucciones para Banco General:**

1. **Asunto del email:** "Validación de Formato ACH - Portal Líderes en Seguros"

2. **Contenido sugerido:**
```
Estimados,

Adjunto archivo de prueba con formato ACH para validación.

Características del archivo:
- 75 transacciones de prueba
- Monto: $1.00 por transacción
- Total: $75.00
- Formato: Texto plano delimitado por punto y coma (;)

Solicito confirmar:
1. ¿El formato es correcto?
2. ¿El sistema lo lee sin errores?
3. ¿Requiere algún ajuste?

Quedo atento a sus comentarios.

Saludos cordiales,
[Tu nombre]
```

3. **Adjuntar:** `PRUEBA_BANCO_GENERAL.txt`

### **Verificación del Archivo:**

✅ UTF-8 sin BOM
✅ Sin encabezados
✅ Sin líneas vacías al final
✅ Cada línea termina correctamente
✅ Caracteres válidos ACH (solo A-Z, 0-9, espacios)
✅ Separador correcto (;)

---

**Fecha de generación:** 2025-11-11
**Versión del sistema:** Portal Líderes v2.0
**Formato:** Banco General ACH Oficial
