# 🔍 NECESITO INFORMACIÓN URGENTE

## EL PROBLEMA

Hay INCONSISTENCIA en el código sobre `percent_default`:

### En `BrokerDetailClient.tsx` línea 47:
```typescript
percent_default: result.data.percent_default || 0.82  // ← DECIMAL
```

### En IMPORT `actions.ts` línea 160:
```typescript
const grossAmount = commissionRaw * (percent / 100);  // ← Divide /100
```

## ⚠️ SI PERCENT_DEFAULT = 0.82 (DECIMAL):
```
$10.00 * (0.82 / 100) = $10.00 * 0.0082 = $0.082 ❌
```

## ✅ SI PERCENT_DEFAULT = 82 (ENTERO):
```
$10.00 * (82 / 100) = $10.00 * 0.82 = $8.20 ✅
```

---

## 📝 NECESITO QUE HAGAS ESTO:

1. Abre Supabase
2. Tabla `brokers`
3. Busca TU broker (el que estás probando)
4. **¿QUÉ VALOR EXACTO tiene `percent_default`?**
   - ¿Es `0.82`? (decimal)
   - ¿O es `82`? (entero)

---

## 🔧 UNA VEZ QUE ME DIGAS:

Si es **0.82** (decimal):
```typescript
// NO dividir por 100
comisión = monto * percent_default
// $10.00 * 0.82 = $8.20 ✅
```

Si es **82** (entero):
```typescript
// SÍ dividir por 100
comisión = monto * (percent_default / 100)
// $10.00 * (82 / 100) = $8.20 ✅
```

---

## ⏰ MIENTRAS TANTO

He agregado console.logs. Cuando envíes un reporte:

1. Abre consola del navegador (F12)
2. Busca: `===== CREAR REPORTE AJUSTE =====`
3. **Copia TODO lo que salga ahí y envíamelo**

Eso me dirá exactamente qué valor tiene en la BD.

---

**POR FAVOR ENVÍAME:**
1. El valor de `percent_default` de tu tabla brokers en Supabase
2. Los console.logs cuando crees un reporte

CON ESO PUEDO ARREGLARLO EN 30 SEGUNDOS.
