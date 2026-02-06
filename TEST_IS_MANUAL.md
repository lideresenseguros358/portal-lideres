# TEST MANUAL IS - VERIFICAR ENDPOINTS

## URL Base Correcta
```
https://www.iseguros.com/APIRestIsTester/api
```

## Problema Actual
Error 404 en:
```
https://www.iseguros.com/APIRestIsTester/api/cotizaemisorauto/getgenerarcotizacion/1/8-999-9999/juan/perez/6000-0000/cliente%40example.com/156/2469/30000/2026/14/1
```

## Pasos para Probar en Postman/Thunder Client

### 1. Obtener Token Diario
```
GET https://www.iseguros.com/APIRestIsTester/api/tokens/diario
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Obtener Tipo Planes (para vCodTipoPlan)
```
GET https://www.iseguros.com/APIRestIsTester/api/cotizaemisorauto/gettipoplanes
Authorization: Bearer {token_diario}
```

**Respuesta esperada:**
- DATO: 3 = "Cobertura Completa Comercial"
- DATO: 14 = "Cobertura Completa Comercial" ???
- DATO: 16 = "DAT Comercial"

### 3. Obtener Grupo Tarifa (con vCodTipoPlan del paso anterior)
```
GET https://www.iseguros.com/APIRestIsTester/api/cotizaemisorauto/getgrupotarifa/{vCodTipoPlan}
Authorization: Bearer {token_diario}
```

Ejemplo:
```
GET https://www.iseguros.com/APIRestIsTester/api/cotizaemisorauto/getgrupotarifa/14
```

**Respuesta esperada:**
- DATO: 1 o 2 o 4 (sin decimales)

### 4. Obtener Planes (con vCodTipoPlan)
```
GET https://www.iseguros.com/APIRestIsTester/api/cotizaemisorauto/getplanes
Authorization: Bearer {token_diario}
```

**Respuesta esperada:**
- DATO: vcodplancobertura (códigos de plan)

### 5. Generar Cotización (con TODOS los datos correctos)
```
GET https://www.iseguros.com/APIRestIsTester/api/cotizaemisorauto/getgenerarcotizacion/{vcodtipodoc}/{vnrodoc}/{vnombre}/{vapellido}/{vtelefono}/{vcorreo}/{vcodmarca}/{vcodmodelo}/{vsumaaseg}/{vanioauto}/{vcodplancobertura}/{vcodgrupotarifa}
Authorization: Bearer {token_diario}
```

Ejemplo con datos válidos:
```
GET https://www.iseguros.com/APIRestIsTester/api/cotizaemisorauto/getgenerarcotizacion/1/8-999-9999/juan/perez/60000000/cliente@example.com/156/2469/30000/2026/14/1
```

## Posibles Causas del Error 404

1. **vcodplancobertura incorrecto**: El valor `14` puede no existir para ese tipo de plan
2. **vcodgrupotarifa incorrecto**: El valor `1` puede no corresponder al plan 14
3. **Orden de parámetros**: Puede estar mal el orden (revisar docs)
4. **Endpoint incorrecto**: Verificar si es realmente `getgenerarcotizacion` o tiene otro nombre
5. **Token inválido**: Aunque obtiene 200, el token puede no tener permisos

## Acción Inmediata

**PROBAR MANUALMENTE EN POSTMAN:**
1. Seguir TODOS los pasos en orden
2. Anotar VALORES REALES que retorna cada endpoint
3. Usar esos valores en la cotización final
4. Si funciona, actualizar el código con los valores/lógica correcta

**NO ADIVINAR** - Obtener valores reales de la API
