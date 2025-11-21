# GUÍA RÁPIDA PARA SOLUCIONAR LOS CONTADORES

## 🚨 PROBLEMA ACTUAL

1. **Historial de Quincenas:** Contadores errados (no muestra $10,681.22)
2. **Acumulado (YTD):** No muestra ninguna cifra

---

## ✅ SOLUCIÓN EN 3 PASOS

### **PASO 1: Insertar Datos de Reportes en Supabase**

Ve a **Supabase Dashboard** → **SQL Editor** y ejecuta:

```sql
-- Ver aseguradoras disponibles
SELECT id, name FROM insurers ORDER BY name;

-- Insertar reportes
INSERT INTO comm_imports (insurer_id, period_label, total_amount, is_life_insurance) VALUES
  ((SELECT id FROM insurers WHERE name = 'ASSA' LIMIT 1), 'Q1 - Nov. 2025', 4108.37, false),
  ((SELECT id FROM insurers WHERE name = 'SURA' LIMIT 1), 'Q1 - Nov. 2025', 1244.54, false),
  ((SELECT id FROM insurers WHERE name ILIKE '%VIVIR%' LIMIT 1), 'Q1 - Nov. 2025', 424.53, true),
  ((SELECT id FROM insurers WHERE name ILIKE '%INTERNACIONAL%' LIMIT 1), 'Q1 - Nov. 2025', 1043.01, false),
  ((SELECT id FROM insurers WHERE name = 'FEDPA' LIMIT 1), 'Q1 - Nov. 2025', 1754.25, false),
  ((SELECT id FROM insurers WHERE name ILIKE '%ANCON%' LIMIT 1), 'Q1 - Nov. 2025', 1295.97, false),
  ((SELECT id FROM insurers WHERE name = 'BANESCO' LIMIT 1), 'Q1 - Nov. 2025', 36.65, false),
  ((SELECT id FROM insurers WHERE name ILIKE '%REGIONAL%' LIMIT 1), 'Q1 - Nov. 2025', 511.92, false),
  ((SELECT id FROM insurers WHERE name = 'OPTIMA' LIMIT 1), 'Q1 - Nov. 2025', 172.59, false),
  ((SELECT id FROM insurers WHERE name = 'ACERTA' LIMIT 1), 'Q1 - Nov. 2025', 89.39, false);
```

**Verificar:**
```sql
SELECT SUM(total_amount) FROM comm_imports;
-- Debe mostrar: 10681.22
```

---

### **PASO 2: Verificar Broker LISSA Existe**

```sql
-- Ver si existe
SELECT id, name, email FROM brokers WHERE email = 'contacto@lideresenseguros.com';
```

**Si NO existe, créalo:**
```sql
INSERT INTO brokers (name, email, percent_default, status) 
VALUES ('LISSA', 'contacto@lideresenseguros.com', 0, 'active');
```

---

### **PASO 3: Refrescar la Aplicación**

1. Ve a `/commissions` → **Historial de Quincenas**
2. Abre la **consola del navegador (F12)** → Tab "Console"
3. Busca los logs que dicen: `📊 DEBUG - comm_imports:`
4. Verifica que muestre:
   ```
   count: 10
   total: 10681.22
   expected: 10681.22
   ```

---

## 📊 QUÉ ESPERAR VER

### **Historial de Quincenas:**

```
┌─────────────────────────────────────────┐
│ Total Comisiones Importadas             │
│ $10,681.22 ✅                          │
├─────────────────────────────────────────┤
│ Total Pagado a Corredores               │
│ $X,XXX.XX (suma netos externos)         │
├─────────────────────────────────────────┤
│ Ganancia Oficina                        │
│ $X,XXX.XX (positivo)                    │
└─────────────────────────────────────────┘
```

### **Acumulado (YTD):**

- Total Anual: Suma de todos los meses
- Gráficas con datos reales
- Distribución por aseguradora con valores

---

## 🔍 LOGS DE DEBUG PARA VERIFICAR

**En la consola del navegador verás:**

```
📊 DEBUG - comm_imports: {
  count: 10,
  total: 10681.22,
  expected: 10681.22
}

📊 Quincena XXXXX: {
  total_imported: 10681.22,
  total_paid_external: XXXX.XX,
  officeBrokerNet: XXX.XX,
  total_office_profit: XXXX.XX,
  brokerTotalsCount: X,
  officeBrokerId: "xxxx-xxxx-xxxx"
}
```

**Si ves:**
- `count: 0` → Los reportes NO se insertaron correctamente
- `total: 0` → Los montos están en cero o null
- `officeBrokerId: undefined` → El broker LISSA no existe

---

## ⚠️ PROBLEMAS COMUNES Y SOLUCIONES

### **Problema 1: Alguna aseguradora no existe**

**Error:** `NULL value returned for one or more insurers`

**Solución:** Crear la aseguradora faltante
```sql
INSERT INTO insurers (name, status) VALUES ('NOMBRE_ASEGURADORA', 'active');
```

### **Problema 2: Total sigue en 0**

**Causa:** Los registros tienen `total_amount = NULL`

**Solución:** Verificar los datos insertados
```sql
SELECT * FROM comm_imports WHERE total_amount IS NULL;

-- Actualizar si es necesario
UPDATE comm_imports SET total_amount = 4108.37 WHERE insurer_id = (SELECT id FROM insurers WHERE name = 'ASSA');
```

### **Problema 3: YTD sin datos**

**Causa:** No hay datos en `comm_items` con fechas del año actual

**Verificar:**
```sql
SELECT 
  COUNT(*) as total_items,
  EXTRACT(YEAR FROM created_at) as year,
  SUM(gross_amount) as total
FROM comm_items
WHERE EXTRACT(YEAR FROM created_at) = 2024
GROUP BY EXTRACT(YEAR FROM created_at);
```

**Si no hay datos:** Necesitas tener comisiones registradas en `comm_items` para el año actual.

---

## 🎯 CHECKLIST DE VERIFICACIÓN

- [ ] Ejecuté el INSERT en Supabase
- [ ] `SELECT SUM(total_amount) FROM comm_imports` = 10681.22
- [ ] Broker LISSA existe en tabla `brokers`
- [ ] Refresqué la página de Historial
- [ ] Vi los logs de debug en consola (F12)
- [ ] Total Importado muestra $10,681.22
- [ ] Ganancia Oficina es positiva
- [ ] YTD muestra datos en las gráficas

---

## 📞 SI AÚN NO FUNCIONA

**Copia y envía estos datos:**

1. **Resultado de:**
   ```sql
   SELECT COUNT(*), SUM(total_amount) FROM comm_imports;
   ```

2. **Broker LISSA:**
   ```sql
   SELECT id, name, email FROM brokers WHERE email = 'contacto@lideresenseguros.com';
   ```

3. **Datos de quincenas:**
   ```sql
   SELECT 
     id, 
     period_start, 
     period_end, 
     status,
     (SELECT COUNT(*) FROM fortnight_broker_totals WHERE fortnight_id = fortnights.id) as brokers_count
   FROM fortnights 
   WHERE status = 'PAID'
   ORDER BY period_end DESC
   LIMIT 3;
   ```

4. **Logs de consola:** Copia los logs que aparecen con `📊 DEBUG`

---

## 🎉 RESULTADO ESPERADO FINAL

Una vez que todo funcione:

- ✅ Historial muestra $10,681.22 en Total Importado
- ✅ Ganancia Oficina es positiva (incluye LISSA)
- ✅ YTD muestra gráficas con datos reales
- ✅ No hay mocks ni datos hardcodeados
- ✅ Los cálculos son correctos
