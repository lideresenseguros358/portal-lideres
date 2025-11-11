# 🚀 Actualización Masiva de Brokers - Instrucciones

## ✅ Estado Actual
- ✅ `beneficiary_id` **eliminado** de database.types.ts (cédula del titular - no requerida)
- ✅ `beneficiary_name` **MANTENIDO** (nombre del titular - CRUCIAL para ACH)
- ✅ Migraciones de constraint ejecutadas
- ✅ Código TypeScript actualizado
- ✅ Extensión `unaccent` habilitada
- ✅ SQL listo con 84 brokers

---

## 📋 PASOS A EJECUTAR

### **1. Ir a Supabase SQL Editor**
https://supabase.com/dashboard/project/kwhwcjwtmopljhncbcvi/sql

### **2. Copiar y Pegar SQL**
Abrir: `EJECUTAR_ESTE_SQL.sql`
- Copiar TODO el contenido
- Pegar en Supabase SQL Editor
- Click **RUN**

### **3. Ver Resultados**
El script mostrará:
- ✅ Lista de brokers actualizados
- ❌ Lista de brokers no encontrados (si hay alguno)
- 📊 Tabla final con estado ACH de cada broker

---

## 📊 Qué se Actualiza

### **Datos del Broker (tabla `brokers`):**
- `name` - Nombre completo
- `phone` - Teléfono
- `national_id` - Cédula del broker
- `assa_code` - Código ASSA
- `license_no` - Número de licencia
- `percent_default` - Porcentaje de comisión

### **Datos Bancarios ACH:**
- `bank_route` - Código del banco (71=General, 22=Banistmo, etc.)
- `bank_account_no` - Número de cuenta (solo dígitos)
- `tipo_cuenta` - Código: `03`=Corriente, `04`=Ahorro
- `nombre_completo` - Titular ACH (MAYÚSCULAS sin acentos, max 22 chars)
- `beneficiary_name` - Nombre para cheque/pago (MAYÚSCULAS sin acentos, max 22 chars)

### **Conversiones Automáticas:**
✅ "BANCO GENERAL" → código `71`
✅ "Cuenta de ahorros" → código `04`
✅ "Cuenta corriente" → código `03`
✅ Números de cuenta limpios (solo dígitos)
✅ Titulares en MAYÚSCULAS sin acentos

---

## 🔑 KEY de Actualización

**EMAIL** - Hace match entre `temp_broker_data` → `profiles` → `brokers`

**Brokers sin datos bancarios** (se actualizan solo datos personales):
- DIANA CANDANEDO
- FABIAN CANDANEDO
- HERMINIO ARCIA
- LILIANA SAMUDIO
- LISSA
- REINA PEDRESCHI
- SOBIANTH PINEDA

---

## ✅ Verificación Post-Ejecución

### 1. Revisar logs del script
Debe mostrar algo como:
```
✅ aprescott@prescottyasociados.com
✅ amariar23@gmail.com
...
========================================
✅ Actualizados: 84
❌ No encontrados: 0
========================================
```

### 2. Revisar tabla de resultados
Al final aparece una tabla con:
- Nombre
- Email
- Datos bancarios
- Columna `ach_ok`: ✅ si está completo, ⚠️ si faltan datos

### 3. Verificar en la app
- Ir a `/brokers`
- Abrir un broker
- Verificar que los datos se actualizaron correctamente

---

## ⚠️ IMPORTANTE

1. **NO ejecutar en producción sin backup**
2. **Revisar los logs** del script para ver si todos los emails coincidieron
3. Si algún email no se encuentra, revisar manualmente en Supabase
4. Los brokers sin datos bancarios solo actualizarán datos personales

---

## 📝 Después de Ejecutar

### Regenerar Types (opcional)
Si ves errores de tipos después:
```bash
npx supabase gen types typescript --project-id 'kwhwcjwtmopljhncbcvi' --schema public > src/lib/database.types.ts
```

### Verificar Compilación
```bash
npm run typecheck
npm run build
```

---

## 🆘 Troubleshooting

### Error: "function unaccent does not exist"
Ejecutar primero en Supabase:
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Error: "table ach_banks does not exist"
Las foreign keys fallarán pero la data se actualiza igual. No es crítico.

### Algunos brokers no se actualizan
- Verificar que el email en CSV coincida EXACTAMENTE con el de `profiles`
- Ejecutar query para ver emails reales:
```sql
SELECT p.email, b.name FROM brokers b JOIN profiles p ON b.p_id = p.id;
```

---

## 📞 Contacto

Si algo falla, revisar:
1. Logs del SQL en Supabase
2. Console del navegador
3. Tabla `profiles` para verificar emails

**¡Listo para ejecutar! 🚀**
