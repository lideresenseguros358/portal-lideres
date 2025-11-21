# RECUPERAR DATOS PERDIDOS - URGENTE

## 🚨 OPCIONES DE RECUPERACIÓN

### **1. BACKUP AUTOMÁTICO DE SUPABASE (MÁS PROBABLE)**

Supabase hace backups automáticos. Para restaurar:

1. **Ve a tu dashboard de Supabase**
2. **Settings** → **Backup & Restore**
3. **Ve si hay backups disponibles** de las últimas horas
4. **Restaura el backup** más reciente antes de la pérdida

---

### **2. SI HAY LOGS DE TRANSACCIONES**

En Supabase Dashboard:

1. **Database** → **Logs**
2. **Busca los DELETE statements**
3. **Ve qué se borró exactamente**

---

### **3. RECREAR MANUALMENTE LO CRÍTICO**

Si no hay backup, al menos podemos recrear:

#### **A. Reportes de Aseguradoras (comm_imports)**

```sql
INSERT INTO comm_imports (insurer_id, period_label, total_amount) VALUES
  ((SELECT id FROM insurers WHERE name = 'ASSA' LIMIT 1), 'Q1 - Nov. 2025', 4108.37),
  ((SELECT id FROM insurers WHERE name = 'SURA' LIMIT 1), 'Q1 - Nov. 2025', 1244.54),
  ((SELECT id FROM insurers WHERE name ILIKE '%VIVIR%' LIMIT 1), 'Q1 - Nov. 2025', 424.53),
  ((SELECT id FROM insurers WHERE name ILIKE '%INTERNACIONAL%' LIMIT 1), 'Q1 - Nov. 2025', 1043.01),
  ((SELECT id FROM insurers WHERE name = 'FEDPA' LIMIT 1), 'Q1 - Nov. 2025', 1754.25),
  ((SELECT id FROM insurers WHERE name ILIKE '%ANCON%' LIMIT 1), 'Q1 - Nov. 2025', 1295.97),
  ((SELECT id FROM insurers WHERE name = 'BANESCO' LIMIT 1), 'Q1 - Nov. 2025', 36.65),
  ((SELECT id FROM insurers WHERE name ILIKE '%REGIONAL%' LIMIT 1), 'Q1 - Nov. 2025', 511.92),
  ((SELECT id FROM insurers WHERE name = 'OPTIMA' LIMIT 1), 'Q1 - Nov. 2025', 172.59),
  ((SELECT id FROM insurers WHERE name = 'ACERTA' LIMIT 1), 'Q1 - Nov. 2025', 89.39);
```

Esto solo recupera los reportes que me diste.

#### **B. Verificar qué más se perdió**

```sql
-- Ver si quedan datos
SELECT COUNT(*) FROM comm_items;
SELECT COUNT(*) FROM fortnights;
SELECT COUNT(*) FROM brokers;
SELECT COUNT(*) FROM clients;
SELECT COUNT(*) FROM policies;
```

---

### **4. CONTACT SUPABASE SUPPORT**

Si no hay backup visible:

1. **support@supabase.com**
2. **Explica que necesitas restaurar la BD**
3. **Da la hora aproximada** de cuando se perdieron los datos
4. Supabase tiene **Point-in-Time Recovery** para planes pagados

---

## 🔍 DIAGNÓSTICO: QUÉ SE BORRÓ

Ejecuta esto para ver qué tablas están vacías:

```sql
-- Contar registros en tablas críticas
SELECT 
  'comm_items' as tabla, COUNT(*) as registros FROM comm_items
UNION ALL
SELECT 
  'comm_imports' as tabla, COUNT(*) as registros FROM comm_imports
UNION ALL
SELECT 
  'fortnights' as tabla, COUNT(*) as registros FROM fortnights
UNION ALL
SELECT 
  'fortnight_broker_totals' as tabla, COUNT(*) as registros FROM fortnight_broker_totals
UNION ALL
SELECT 
  'brokers' as tabla, COUNT(*) as registros FROM brokers
UNION ALL
SELECT 
  'clients' as tabla, COUNT(*) as registros FROM clients
UNION ALL
SELECT 
  'policies' as tabla, COUNT(*) as registros FROM policies
UNION ALL
SELECT 
  'pending_items' as tabla, COUNT(*) as registros FROM pending_items;
```

---

## ⚠️ LO QUE PUDO HABER PASADO

1. **Si ejecutaste el SQL completo** - Había una línea `-- DELETE FROM comm_imports;` que aunque está comentada, si se ejecutó el archivo completo sin los `--`, se borró
2. **Cascadas en BD** - Si hay foreign keys con `ON DELETE CASCADE`, borrar un registro puede borrar relacionados
3. **Script de Node.js** - Si ejecutaste `update-insurer-reports.mjs` y había un bug

---

## 🎯 ACCIÓN INMEDIATA

1. **NO HAGAS MÁS CAMBIOS EN LA BD**
2. **Ve a Supabase → Backup & Restore AHORA**
3. **Si no hay backup, contacta a Supabase support URGENTE**
4. **Envíame el resultado** del query de diagnóstico

---

## 💾 PREVENCIÓN FUTURA

1. **Activar backups automáticos diarios**
2. **Usar transacciones** para cambios grandes:
   ```sql
   BEGIN;
   -- tus cambios
   -- Si algo sale mal: ROLLBACK;
   -- Si todo bien: COMMIT;
   ```
3. **Probar en una BD de desarrollo primero**

---

## 📞 CONTACTO SUPABASE

- Email: support@supabase.com
- Dashboard: https://app.supabase.com
- Docs: https://supabase.com/docs/guides/platform/backups

**Diles:**
- Project ID
- Hora aproximada de la pérdida
- Qué datos se perdieron
- Solicita Point-in-Time Recovery

---

**EJECUTA EL DIAGNÓSTICO AHORA Y DIME QUÉ VES.**
