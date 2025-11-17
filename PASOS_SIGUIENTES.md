# 🎯 PASOS SIGUIENTES - GUÍA COMPLETA

## ✅ Lo que Ya Sabemos

Basado en tu verificación, encontramos que **los emails en tus datos son INCORRECTOS**. Los brokers existen, pero con emails diferentes:

| Email en tus datos | Email REAL en BD | Broker |
|-------------------|------------------|---------|
| angelicaramos@lideresenseguros.com | yiraramos@lideresenseguros.com | YIRA RAMOS |
| kathrinaguirre@lideresenseguros.com | kathrin.aguirre@hotmail.com | KATHRIN AGUIRRE |
| soniaarenas@lideresenseguros.com | soniaa0154@outlook.com | SONIA ARENAS |

---

## 📋 Plan de Acción (2 Opciones)

### OPCIÓN A: Script Automático (RECOMENDADO) ⚡

**Más rápido y sin errores**

#### Paso 1: Obtener TODOS los emails reales

```sql
-- En Supabase SQL Editor, ejecuta:
-- Archivo: OBTENER_TODOS_LOS_EMAILS_REALES.sql
```

Esto te dará una tabla con:
- `email_incorrecto`: El que tienes en tus datos
- `nombre_broker_real`: Nombre del broker
- `email_correcto`: El email que debes usar

#### Paso 2: Actualizar el script Python

1. Abre `corregir_emails_import.py`
2. En la sección `EMAIL_CORRECTIONS`, completa todos los emails:

```python
EMAIL_CORRECTIONS = {
    # ✅ Ya confirmados
    'angelicaramos@lideresenseguros.com': 'yiraramos@lideresenseguros.com',
    'kathrinaguirre@lideresenseguros.com': 'kathrin.aguirre@hotmail.com',
    'soniaarenas@lideresenseguros.com': 'soniaa0154@outlook.com',
    
    # ⚠️ Completa con los resultados del PASO 1:
    'ediscastillo@lideresenseguros.com': 'EMAIL_REAL_AQUI',
    'lissethvergara@lideresenseguros.com': 'EMAIL_REAL_AQUI',
    # ... etc para los 17 restantes
}
```

#### Paso 3: Ejecutar el script

```powershell
# En tu terminal (PowerShell):
cd C:\Users\Samud\portal-lideres
python corregir_emails_import.py
```

**Output esperado:**
```
🔍 Leyendo EJECUTAR_IMPORT.sql...
✅ 3,443 registros encontrados
🔧 Corrigiendo emails...
✅ 1,247 correcciones aplicadas
💾 Generando EJECUTAR_IMPORT_CORREGIDO.sql...
✅ Archivo generado: EJECUTAR_IMPORT_CORREGIDO.sql
```

#### Paso 4: Ejecutar el import corregido

```sql
-- En Supabase SQL Editor:
-- 1. Abre EJECUTAR_IMPORT_CORREGIDO.sql
-- 2. Copia TODO el contenido
-- 3. Ejecuta
-- ⏱️ Espera 30-60 segundos
-- ✅ Revisa los resultados
```

---

### OPCIÓN B: Manual con Excel 📝

**Si prefieres hacerlo manualmente**

#### Paso 1: Obtener emails reales

Ejecuta `OBTENER_TODOS_LOS_EMAILS_REALES.sql` en Supabase y anota los resultados.

#### Paso 2: Volver a tu Excel/CSV original

Abre el archivo Excel/CSV que usaste para crear el JSON.

#### Paso 3: Find & Replace (Ctrl + H)

Para cada email incorrecto:
1. Find: `angelicaramos@lideresenseguros.com`
2. Replace: `yiraramos@lideresenseguros.com`
3. Click "Replace All"
4. Repite para los 20 emails

#### Paso 4: Regenerar JSON

- Usa: https://www.convertcsv.com/csv-to-json.htm
- Pega tu CSV corregido
- Copia el JSON resultante

#### Paso 5: Actualizar EJECUTAR_IMPORT.sql

Reemplaza el JSON entre `$$[...]$$` con tu nuevo JSON.

#### Paso 6: Ejecutar en Supabase

```sql
-- Ejecuta el EJECUTAR_IMPORT.sql actualizado
```

---

## 🎯 Resumen Ultra-Rápido

```bash
# 1. Obtener emails correctos
   → Ejecuta OBTENER_TODOS_LOS_EMAILS_REALES.sql en Supabase

# 2A. Script automático (RECOMENDADO)
   → Completa EMAIL_CORRECTIONS en corregir_emails_import.py
   → python corregir_emails_import.py
   → Ejecuta EJECUTAR_IMPORT_CORREGIDO.sql en Supabase

# 2B. Manual
   → Find & Replace en Excel
   → Regenera JSON
   → Actualiza EJECUTAR_IMPORT.sql
   → Ejecuta en Supabase
```

---

## ⚠️ IMPORTANTE

**ANTES de ejecutar el import:**
1. ✅ Actualiza la función SQL ejecutando `BULK_IMPORT_CLIENTES.sql` (corrige el error de ambigüedad)
2. ✅ Corrige TODOS los emails (no dejes ninguno sin mapear)
3. ✅ Verifica que el JSON esté bien formado

---

## 📞 ¿Necesitas Ayuda?

Si al ejecutar `OBTENER_TODOS_LOS_EMAILS_REALES.sql` obtienes resultados que no sabes cómo interpretar, **pega los resultados aquí** y te ayudo a crear el mapeo completo.

---

## ✅ Checklist Final

- [ ] Ejecutar BULK_IMPORT_CLIENTES.sql en Supabase (corrige error SQL)
- [ ] Ejecutar OBTENER_TODOS_LOS_EMAILS_REALES.sql
- [ ] Anotar todos los mapeos email_incorrecto → email_correcto
- [ ] Opción A: Actualizar y ejecutar corregir_emails_import.py
- [ ] Opción B: Find & Replace manual en Excel y regenerar JSON
- [ ] Ejecutar import corregido en Supabase
- [ ] Verificar resultados
- [ ] 🎉 ¡Celebrar!

---

## 📊 Próximo Status

Después de ejecutar `OBTENER_TODOS_LOS_EMAILS_REALES.sql`, muéstrame los resultados y te preparo:
1. El diccionario completo para el script Python
2. O la lista completa de Find & Replace para Excel

**¿Cuál opción prefieres? (A: Script automático / B: Manual)**
