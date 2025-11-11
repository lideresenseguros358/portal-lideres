# ❓ PREGUNTA CRÍTICA - Campo para Archivo ACH

## Situación:

Tenemos 2 campos en `brokers`:

1. **`nombre_completo`** - Titular de cuenta bancaria (max 22 chars, MAYÚSCULAS sin acentos)
2. **`beneficiary_name`** - Nombre para cheque/pago (max 22 chars, MAYÚSCULAS sin acentos)

## Casos Reales:

| Broker | nombre_completo (ACH) | beneficiary_name (cheque) |
|--------|----------------------|---------------------------|
| HERICKA GONZALEZ | RAFAEL VIZUETTE | RAFAEL VIZUETTE |
| KAROL VALDES | HAROLD SANMARTIN | HAROLD SANMARTIN |
| JOSE MANUEL FERNANDEZ | DIDIMO SAMUDIO | DIDIMO SAMUDIO |

## Pregunta:

**¿Qué campo debe ir en el archivo .TXT ACH de Banco General en el "Campo 2: Nombre Beneficiario"?**

### Opción A: `nombre_completo`
```
001;RAFAEL VIZUETTE;71;472002215828;04;100.00;C;REF*TXT**PAGO COMISIONES\
```
**Ventaja:** Es el titular real de la cuenta bancaria

### Opción B: `beneficiary_name` 
```
001;RAFAEL VIZUETTE;71;472002215828;04;100.00;C;REF*TXT**PAGO COMISIONES\
```
**Ventaja:** Es el nombre que aparecerá en el comprobante de pago

### Opción C: Depende del caso
- Si la cuenta es del broker mismo → `nombre_completo` = nombre del broker
- Si la cuenta es de otra persona → `nombre_completo` = titular real

## Código Actual:

### Nueva Quincena (`bankACH.ts`):
```typescript
const beneficiaryName = toUpperNoAccents(broker.nombre_completo || broker.name || '');
```

### Ajustes (`adjustments-ach.ts`):
```typescript
const beneficiaryName = toUpperNoAccents((broker as any).nombre_completo || broker.profiles?.full_name || broker.name || '');
```

## Recomendación:

**Creo que debería ser `nombre_completo`** porque:
1. Es el titular REAL de la cuenta bancaria
2. Banco General requiere el nombre del titular para validar la transacción ACH
3. `beneficiary_name` es más para uso interno/referencia

¿Confirmas que `nombre_completo` es correcto para el archivo ACH?
