# 📋 FORMATOS DE NÚMEROS DE PÓLIZA POR ASEGURADORA

## 📚 Índice
1. [ASSA](#1-assa)
2. [ANCON](#2-ancon)
3. [INTERNACIONAL](#3-internacional)
4. [SURA](#4-sura)
5. [BANESCO](#5-banesco)
6. [MB, FEDPA, REGIONAL, OPTIMA, ALIADO](#6-mb-fedpa-regional-optima-aliado)
7. [PALIG](#7-palig)
8. [ACERTA](#8-acerta)
9. [MAPFRE](#9-mapfre)
10. [UNIVIVIR](#10-univivir)
11. [ASSISTCARD, VUMI, IFS](#11-assistcard-vumi-ifs)
12. [WW MEDICAL](#12-ww-medical)
13. [MERCANTIL](#13-mercantil)
14. [GENERAL](#14-general)

---

## 1. ASSA

### 📝 Estructura de Inputs
- **Cantidad:** 3 inputs
- **Input 1:** Numérico (2 dígitos)
- **Input 2:** Dropdown texto
  - Opciones: `A`, `B`, `BR`, `BC`, `BG`, `BI`, `BV`, `G`, `GC`, `GG`, `T`
- **Input 3:** Numérico (5 dígitos)

### 🔗 Unión
Todo junto **SIN guiones**, **SIN espacios**.

### ✅ Ejemplo Válido
```
Input 1: 02
Input 2: BR
Input 3: 12345
Resultado: 02BR12345
```

### ❌ Ejemplos Incorrectos
```
02-BR-12345  ❌ (tiene guiones)
02 BR 12345  ❌ (tiene espacios)
2BR12345     ❌ (falta cero inicial)
```

### 💾 Formato BD
```
02BR12345
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- Buscar exactamente lo registrado completo
- Match exacto: `02BR12345`
- No remover ceros ni normalizar

### 📌 Notas Especiales
- No permitir guiones ni espacios
- Mantener ceros a la izquierda
- Dropdown debe tener solo las opciones listadas

---

## 2. ANCON

### 📝 Estructura de Inputs
- **Cantidad:** 3 inputs numéricos
- **Input 1:** Numérico (4 dígitos)
- **Input 2:** Numérico (5 dígitos) ⭐ **Este es el número real**
- **Input 3:** Numérico (2 dígitos)

### 🔗 Unión
Con guiones: `input1-input2-input3`

### ✅ Ejemplo Válido
```
Input 1: 0220
Input 2: 00678
Input 3: 01
Resultado: 0220-00678-01
```

### ❌ Ejemplos Incorrectos
```
220-678-1    ❌ (faltan ceros)
0220006781   ❌ (sin guiones)
```

### 💾 Formato BD
```
0220-00678-01
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- **Usar SOLO el segundo input (input del medio)**
- Búsqueda: `00678` o `678` (con/sin ceros)
- Los demás números se ignoran

**Ejemplo de búsqueda:**
```
Póliza completa: 0220-00678-01
Parser busca: 678 o 00678
Ignora: 0220 y 01
```

### 📌 Notas Especiales
- ⚠️ El número real de póliza es SOLO el segundo input
- Los inputs 1 y 3 pueden variar entre documentos
- Importante documentar esto al usuario

---

## 3. INTERNACIONAL

### 📝 Estructura de Inputs
- **Cantidad:** 3 inputs numéricos
- **Input 1:** Numérico
- **Input 2:** Numérico
- **Input 3:** Numérico

### 🔗 Unión
Con guiones, pero **REORDENADO**: `input2-input1-input3`

### 🔄 Normalización
1. Remover ceros a la izquierda de cada input
2. Reordenar: input2 - input1 - input3
3. Unir con guiones

### ✅ Ejemplo Válido
```
Usuario ingresa:
Input 1: 030
Input 2: 001
Input 3: 00098767

Normalización:
Input 1: 030 → 30
Input 2: 001 → 1
Input 3: 00098767 → 98767

Reordenamiento: input2-input1-input3
Resultado: 1-30-98767
```

### ❌ Ejemplos Incorrectos
```
030-001-00098767  ❌ (sin normalizar)
1-98767-30        ❌ (orden incorrecto)
```

### 💾 Formato BD
```
1-30-98767
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- Buscar tal cual el formato normalizado
- Match: `1-30-98767`
- Los documentos pueden venir con ceros: `001-030-00098767`
- El parser debe normalizar antes de comparar

### 📌 Notas Especiales
- ⚠️ **CASO MÁS DIFÍCIL**
- Obligatorio transformar antes de guardar
- El orden NO es el orden ingresado
- Usuario ve: 030-001-00098767
- BD guarda: 1-30-98767

---

## 4. SURA

### 📝 Estructura de Inputs
- **Cantidad:** 1 solo input
- **Tipo:** Alfanumérico (texto, números y guiones)

### 🔗 Unión
N/A (un solo campo)

### ✅ Ejemplos Válidos
```
04123456897
0234-2234-12345
SURA-2024-001
```

### ❌ Ejemplos Incorrectos
```
(ninguno, acepta cualquier formato)
```

### 💾 Formato BD
```
04123456897
0234-2234-12345
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- Buscar exactamente lo ingresado
- Match exacto sin transformaciones

### 📌 Notas Especiales
- Formato libre
- No normalizar ni transformar

---

## 5. BANESCO

### 📝 Estructura de Inputs
- **Cantidad:** 4 inputs numéricos
- **Input 1:** Numérico (1 dígito)
- **Input 2:** Numérico (1 dígito)
- **Input 3:** Numérico (8 dígitos) ⭐ **Parte importante**
- **Input 4:** Numérico (1 dígito) ⚠️ **Ignorar en búsquedas**

### 🔗 Unión
Con guiones: `input1-input2-input3-input4`

### ✅ Ejemplo Válido
```
Input 1: 1
Input 2: 1
Input 3: 10001234
Input 4: 0
Resultado: 1-1-10001234-0
```

### ❌ Ejemplos Incorrectos
```
1110001234     ❌ (sin guiones)
01-01-10001234-0  ❌ (ceros innecesarios)
```

### 💾 Formato BD
```
1-1-10001234-0
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- **Usar solo los primeros 3 inputs**
- Búsqueda: `1-1-10001234`
- **El 4to input debe ignorarse**

**Ejemplo de búsqueda:**
```
Póliza completa: 1-1-10001234-0
Parser busca: 1-1-10001234
Ignora: último dígito (0)
```

### 📌 Notas Especiales
- ⚠️ El cuarto input varía entre documentos
- Puede causar falsos negativos si se incluye
- Solo primeros 3 inputs son confiables

---

## 6. MB, FEDPA, REGIONAL, OPTIMA, ALIADO

**Regla compartida entre estas 5 aseguradoras**

### 📝 Estructura de Inputs
- **Cantidad:** 4 inputs numéricos
- **Input 1:** Numérico (2 dígitos)
- **Input 2:** Numérico (2 dígitos)
- **Input 3:** Numérico (6 dígitos) ⭐ **Este es el número real**
- **Input 4:** Numérico (1 dígito) ⚠️ **Ignorar en búsquedas**

### 🔗 Unión
Con guiones: `input1-input2-input3-input4`

### ✅ Ejemplo Válido
```
Input 1: 02
Input 2: 01
Input 3: 123456
Input 4: 4
Resultado: 02-01-123456-4
```

### ❌ Ejemplos Incorrectos
```
02011234564  ❌ (sin guiones)
2-1-123456-4 ❌ (faltan ceros)
```

### 💾 Formato BD
```
02-01-123456-4
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- **Usar únicamente el tercer input**
- Búsqueda: `123456`
- Ignora inputs 1, 2 y 4

**Ejemplo de búsqueda:**
```
Póliza completa: 02-01-123456-4
Parser busca: 123456
Ignora: 02, 01 y 4
```

**Si parser detecta números con guiones:**
```
Documento: "02-01-123456-4"
Parser toma: tercer bloque = 123456
```

### 📌 Notas Especiales
- ⚠️ Inputs 1, 2 y 4 NO son confiables
- Suelen variar entre documentos
- Solo el tercer bloque es consistente
- Aplica a: MB, FEDPA, REGIONAL, OPTIMA, ALIADO

---

## 7. PALIG

### 📝 Estructura de Inputs
- **Cantidad:** 1 único input
- **Tipo:** Alfanumérico (texto, números y guiones)

### 🔗 Unión
N/A (un solo campo)

### ✅ Ejemplos Válidos
```
680882
4239-1234
PAL-2024-001
```

### ❌ Ejemplos Incorrectos
```
(ninguno, acepta cualquier formato)
```

### 💾 Formato BD
```
680882
4239-1234
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- Buscar exactamente lo escrito
- Match exacto sin transformaciones

### 📌 Notas Especiales
- Formato libre
- No normalizar

---

## 8. ACERTA

### 📝 Estructura de Inputs
- **Cantidad:** 3 inputs numéricos
- **Input 1:** Numérico (2 dígitos) ⚠️ **Ignorar en búsquedas**
- **Input 2:** Numérico (9 dígitos) ⭐ **Este es el número real**
- **Input 3:** Numérico (1 dígito) ⚠️ **Ignorar en búsquedas**

### 🔗 Unión
Con guiones: `input1-input2-input3`

### ✅ Ejemplo Válido
```
Input 1: 10
Input 2: 100001234
Input 3: 0
Resultado: 10-100001234-0
```

### ❌ Ejemplos Incorrectos
```
10100001234  ❌ (sin guiones)
10-1234-0    ❌ (input 2 incompleto)
```

### 💾 Formato BD
```
10-100001234-0
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- **Usar solo el segundo input**
- Búsqueda: `100001234`
- Ignora inputs 1 y 3

**Ejemplo de búsqueda:**
```
Póliza completa: 10-100001234-0
Parser busca: 100001234
Ignora: 10 y 0
```

### 📌 Notas Especiales
- ⚠️ Inputs 1 y 3 deben ignorarse
- Solo el input 2 es confiable

---

## 9. MAPFRE

### 📝 Estructura de Inputs
- **Cantidad:** 1 único input
- **Tipo:** Alfanumérico (texto, números y guiones)

### 🔗 Unión
N/A (un solo campo)

### ✅ Ejemplos Válidos
```
021234455666
MAP-2024-001
12345-67890
```

### ❌ Ejemplos Incorrectos
```
(ninguno, acepta cualquier formato)
```

### 💾 Formato BD
```
021234455666
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- Buscar tal cual
- Match exacto

### 📌 Notas Especiales
- Formato libre
- No normalizar

---

## 10. UNIVIVIR

### 📝 Estructura de Inputs
- **Cantidad:** 3 inputs numéricos
- **Input 1:** Numérico (2 dígitos) ⚠️ **Ignorar en búsquedas**
- **Input 2:** Numérico (2 dígitos) ⚠️ **Ignorar en búsquedas**
- **Input 3:** Numérico (5 dígitos) ⭐ **Este es el número real**

### 🔗 Unión
Con guiones: `input1-input2-input3`

### ✅ Ejemplo Válido
```
Input 1: 01
Input 2: 09
Input 3: 12345
Resultado: 01-09-12345
```

### ❌ Ejemplos Incorrectos
```
010912345  ❌ (sin guiones)
1-9-12345  ❌ (faltan ceros)
```

### 💾 Formato BD
```
01-09-12345
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- **Usar únicamente el tercer input**
- Búsqueda: `12345`
- Ignora inputs 1 y 2

**Ejemplo de búsqueda:**
```
Póliza completa: 01-09-12345
Parser busca: 12345
Ignora: 01 y 09
```

### 📌 Notas Especiales
- ⚠️ Primeros dos inputs varían
- Evita falsos positivos ignorándolos
- Solo el tercer input es confiable

---

## 11. ASSISTCARD, VUMI, IFS

**Regla compartida entre estas 3 aseguradoras**

### 📝 Estructura de Inputs
- **Cantidad:** 1 único input
- **Tipo:** Alfanumérico (texto, números y guiones)

### 🔗 Unión
N/A (un solo campo)

### ✅ Ejemplos Válidos
```
123445566
ASS-2024-001
987-654-321
```

### ❌ Ejemplos Incorrectos
```
(ninguno, acepta cualquier formato)
```

### 💾 Formato BD
```
123445566
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- Buscar exactamente como fue escrito
- Match exacto

### 📌 Notas Especiales
- Formato libre
- Aplica a: ASSISTCARD, VUMI, IFS
- No normalizar

---

## 12. WW MEDICAL

### 📝 Estructura de Inputs
- **Cantidad:** 3 inputs (mixto: texto y números)
- **Input 1:** Texto (2-4 caracteres, ej: WP69)
- **Input 2:** Numérico (2 dígitos)
- **Input 3:** Numérico (6 dígitos)

### 🔗 Unión
Con guiones: `input1-input2-input3`

### ✅ Ejemplo Válido
```
Input 1: WP69
Input 2: 16
Input 3: 123456
Resultado: WP69-16-123456
```

### ❌ Ejemplos Incorrectos
```
WP6916123456  ❌ (sin guiones)
wp69-16-123456  ❌ (minúsculas)
WP-69-16-123456  ❌ (separación incorrecta)
```

### 💾 Formato BD
```
WP69-16-123456
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- Buscar la combinación completa
- Match: `WP69-16-123456`
- Sensible a mayúsculas en el prefijo

### 📌 Notas Especiales
- ⚠️ Mezcla letras con números
- El prefijo puede variar (WP, WM, etc.)
- Mantener mayúsculas en prefijo

---

## 13. MERCANTIL

### 📝 Estructura de Inputs
- **Cantidad:** 3 inputs numéricos
- **Input 1:** Numérico (1 dígito)
- **Input 2:** Numérico (1 dígito)
- **Input 3:** Numérico (3-6 dígitos)

### 🔗 Unión
Con guiones: `input1-input2-input3`

### ✅ Ejemplo Válido
```
Input 1: 2
Input 2: 8
Input 3: 123
Resultado: 2-8-123
```

### ❌ Ejemplos Incorrectos
```
28123  ❌ (sin guiones)
02-08-123  ❌ (ceros innecesarios)
```

### 💾 Formato BD
```
2-8-123
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- Buscar exactamente lo ingresado completo
- Match: `2-8-123`

### 📌 Notas Especiales
- No agregar ceros a la izquierda
- Input 3 puede variar en longitud

---

## 14. GENERAL

### 📝 Estructura de Inputs
- **Cantidad:** 3 inputs (mixto: texto y números)
- **Input 1:** Texto/Numérico
- **Input 2:** Texto/Numérico
- **Input 3:** Texto/Numérico

### 🔗 Unión
Con guiones: `input1-input2-input3`

### ✅ Ejemplos Válidos
```
AUTO-123456-2025
GEN-2024-001
12-34-567
```

### ❌ Ejemplos Incorrectos
```
AUTO1234562025  ❌ (sin guiones)
```

### 💾 Formato BD
```
AUTO-123456-2025
```

### 🔍 Reglas del Parser
**Para Comisiones/Morosidad:**
- Buscar la cadena completa tal cual
- Match exacto: `AUTO-123456-2025`

### 📌 Notas Especiales
- Formato muy flexible
- Puede contener prefijos textuales
- Mantener tal cual se ingresa

---

## 📊 RESUMEN DE PARSERS

### Búsqueda por Input Específico

| Aseguradora | Input a Usar | Ejemplo Completo | Parser Busca |
|-------------|-------------|------------------|--------------|
| **ANCON** | Input 2 (medio) | 0220-00678-01 | 678 o 00678 |
| **BANESCO** | Inputs 1-3 | 1-1-10001234-0 | 1-1-10001234 |
| **MB/FEDPA/REGIONAL/OPTIMA/ALIADO** | Input 3 | 02-01-123456-4 | 123456 |
| **ACERTA** | Input 2 (medio) | 10-100001234-0 | 100001234 |
| **UNIVIVIR** | Input 3 | 01-09-12345 | 12345 |

### Búsqueda Completa (Sin Transformación)

- ASSA
- SURA
- PALIG
- MAPFRE
- ASSISTCARD, VUMI, IFS
- WW MEDICAL
- MERCANTIL
- GENERAL

### Búsqueda con Normalización

- **INTERNACIONAL**: Normalizar ceros y reordenar antes de buscar

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### Funciones Necesarias

```typescript
// Normalizar según aseguradora
normalizePolicyNumber(insurer: string, parts: string[]): string

// Parser para búsqueda en comisiones/morosidad
getPolicySearchTerm(insurer: string, policyNumber: string): string

// Validar formato
validatePolicyFormat(insurer: string, parts: string[]): boolean
```

### Ejemplos de Uso

```typescript
// INTERNACIONAL
normalizePolicyNumber('INTERNACIONAL', ['030', '001', '00098767'])
// → '1-30-98767'

getPolicySearchTerm('ANCON', '0220-00678-01')
// → '678'

getPolicySearchTerm('MB', '02-01-123456-4')
// → '123456'
```

---

Este documento sirve como base para:
1. ✅ Componente de ayuda visual (PolicyNumberInput)
2. ✅ Funciones de normalización
3. ✅ Parsers de comisiones/morosidad
4. ✅ Validaciones de formato
5. ✅ Documentación para usuarios
