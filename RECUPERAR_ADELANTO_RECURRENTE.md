# 🔧 Recuperar Adelanto Recurrente Perdido

## Problema
El adelanto recurrente "Abono auto (Recurrente Q1)" de Luis Quiros desapareció de **Deudas Activas** y quedó solo en **Descuentos**.

## Solución - Pasos a Seguir

### Opción 1: Recuperación Automática (Recomendada)

1. **Abre la consola del navegador** (F12)
2. **Ve a la pestaña "Console"**
3. **Copia y pega este código completo:**

```javascript
// PASO 1: Buscar adelantos recurrentes perdidos
fetch('/commissions/recover-recurring')
  .then(r => r.json())
  .then(data => {
    console.log('═══════════════════════════════════════════════');
    console.log('📋 ADELANTOS RECURRENTES EN DESCUENTOS:');
    console.log('═══════════════════════════════════════════════');
    
    if (data.ok && data.data.length > 0) {
      // Buscar el de Luis Quiros "Abono auto"
      const luisAdvance = data.data.find(adv => 
        adv.brokers?.name?.includes('Luis') && 
        adv.reason?.includes('Abono auto')
      );
      
      if (luisAdvance) {
        console.log('✅ ENCONTRADO:');
        console.log('   ID:', luisAdvance.id);
        console.log('   Motivo:', luisAdvance.reason);
        console.log('   Broker:', luisAdvance.brokers?.name);
        console.log('   Monto actual:', luisAdvance.amount);
        console.log('   Status:', luisAdvance.status);
        console.log('');
        console.log('🔄 RECUPERANDO ADELANTO...');
        
        // PASO 2: Recuperar automáticamente
        return fetch('/commissions/recover-recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ advanceId: luisAdvance.id })
        });
      } else {
        console.log('❌ No se encontró el adelanto de Luis Quiros');
        console.log('📋 Adelantos encontrados:');
        data.data.forEach(adv => {
          console.log(`   - ${adv.reason} (${adv.brokers?.name})`);
        });
      }
    } else {
      console.log('ℹ️ No se encontraron adelantos recurrentes en Descuentos');
    }
  })
  .then(r => r ? r.json() : null)
  .then(result => {
    if (result) {
      console.log('');
      console.log('═══════════════════════════════════════════════');
      if (result.ok) {
        console.log('✅ ¡ADELANTO RECUPERADO EXITOSAMENTE!');
        console.log('═══════════════════════════════════════════════');
        console.log('');
        console.log('🔄 Recargando página en 2 segundos...');
        setTimeout(() => location.reload(), 2000);
      } else {
        console.error('❌ ERROR AL RECUPERAR:', result.error);
        console.log('═══════════════════════════════════════════════');
      }
    }
  })
  .catch(err => {
    console.error('❌ Error:', err);
  });
```

4. **Presiona Enter**
5. **Espera 2 segundos** - La página se recargará automáticamente
6. **Verifica** que el adelanto aparezca en **Deudas Activas**

---

### Opción 2: Recuperación Manual (Si la Opción 1 no funciona)

#### Paso 1: Buscar el adelanto
```javascript
fetch('/commissions/recover-recurring')
  .then(r => r.json())
  .then(data => {
    console.log('Adelantos recurrentes encontrados:');
    console.table(data.data);
  });
```

#### Paso 2: Copiar el ID del adelanto de Luis Quiros
Busca en la tabla el adelanto "Abono auto (Recurrente Q1)" y copia su **ID completo**.

#### Paso 3: Recuperar manualmente
```javascript
// Reemplaza ADVANCE_ID_AQUI con el ID que copiaste
fetch('/commissions/recover-recurring', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ advanceId: 'ADVANCE_ID_AQUI' })
})
.then(r => r.json())
.then(result => {
  console.log('Resultado:', result);
  if (result.ok) {
    console.log('✅ Recuperado!');
    location.reload();
  }
});
```

---

## ¿Qué hace el script?

1. **Busca** todos los adelantos recurrentes que están marcados como PAID (en Descuentos)
2. **Encuentra** específicamente el de "Abono auto" de Luis Quiros
3. **Resetea** el adelanto a su monto original
4. **Cambia** el status a PENDING
5. **Marca** is_recurring = true
6. **Recarga** la página

---

## Resultado Esperado

Después de ejecutar el script, el adelanto debería:
- ✅ Aparecer en **Deudas Activas**
- ✅ Mostrar su monto recurrente original
- ✅ Mantener su historial de pagos completo
- ✅ Tener el badge 🔁 RECURRENTE

---

## ¿Qué pasa con los pagos anteriores?

**¡No se pierden!** El historial de pagos se mantiene en la tabla `advance_logs`. Puedes verlo haciendo clic en el botón de **Historial** del adelanto.

---

## Prevención Futura

El sistema ahora tiene logging detallado que mostrará en consola si un adelanto recurrente no tiene `is_recurring` configurado correctamente cuando se intenta pagar.
