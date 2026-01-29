# FEDPA - Diferencias Básico vs Premium

## Endosos de Cobertura Completa

### Plan Básico - Endoso Full Extras (`EndosoIncluido: 'N'`)
Incluye beneficios estándar de cobertura completa.

### Plan Premium - Endoso Porcelana (`EndosoIncluido: 'S'`)
**Mantiene todo lo de Full Extras MÁS las siguientes mejoras:**

1. **Pérdida de efectos personales**
   - Básico: hasta B/. 100
   - Premium: hasta B/. 300
   - ⬆️ **+200% de cobertura**

2. **Auto de alquiler por Colisión/Vuelco**
   - Básico: 10 días
   - Premium: 15 días (cuando vehículo > $30,000 o 4x4)
   - ⬆️ **+50% más días**

3. **Descuento GPS en deducible**
   - Básico: No incluido
   - Premium: 20% descuento en deducibles si vehículo tiene GPS activo al momento de robo total
   - ⬆️ **Ahorro adicional por GPS**

## Opciones de Deducible (A/B/C)

Aplican tanto para Básico como Premium:

- **Opción A** (Deducible Bajo): ~$300 - Prima más alta (~$676)
- **Opción B** (Deducible Medio): ~$450 - Prima equilibrada (~$636)
- **Opción C** (Deducible Alto): ~$608 - Prima más baja (~$609)

*Valores aproximados para referencia. Los valores exactos vienen del API.*

## Precios (Contado vs Tarjeta)

### Descuentos Pronto Pago
El descuento de pronto pago aplica a:
- Pago al contado (1 cuota)
- Pago con ACH/Transferencia
- Pago con tarjeta en algunos casos según políticas FEDPA

### Estructura de Pricing
- **Total con Tarjeta**: Precio estándar para 2-10 cuotas
- **Total al Contado**: Precio con descuento para 1 cuota
- **Diferencia**: Descuento pronto pago

*El API FEDPA devuelve un solo total. El descuento de contado se aplicará en emisión según cantidad de cuotas.*
