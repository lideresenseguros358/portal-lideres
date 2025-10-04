# Migraciones SQL Requeridas

**Fecha**: 2025-10-04  
**Módulo**: Agenda - LINK LISSA Recurrente

---

## Tabla: config_agenda

Esta tabla almacena la configuración de LINK LISSA recurrente por usuario.

### SQL para crear la tabla

```sql
-- Crear tabla config_agenda
CREATE TABLE IF NOT EXISTS config_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lissa_recurring_link text,
  lissa_meeting_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_config_agenda_user_id 
ON config_agenda(user_id);

-- RLS Policies
ALTER TABLE config_agenda ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden ver su propia configuración
CREATE POLICY "Users can view their own agenda config"
ON config_agenda
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden insertar su propia configuración
CREATE POLICY "Users can insert their own agenda config"
ON config_agenda
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden actualizar su propia configuración
CREATE POLICY "Users can update their own agenda config"
ON config_agenda
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden eliminar su propia configuración
CREATE POLICY "Users can delete their own agenda config"
ON config_agenda
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_config_agenda_updated_at 
BEFORE UPDATE ON config_agenda
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
```

---

## Cómo aplicar la migración

### Opción 1: Supabase Dashboard (Recomendado)
1. Ir a https://supabase.com/dashboard
2. Seleccionar el proyecto
3. Ir a **SQL Editor**
4. Copiar y pegar el SQL completo
5. Click **Run**
6. Verificar en **Table Editor** que la tabla `config_agenda` existe

### Opción 2: CLI de Supabase
```bash
# Crear archivo de migración
supabase migration new create_config_agenda_table

# Editar el archivo generado y pegar el SQL
# Luego aplicar
supabase db push
```

### Opción 3: SQL directo (psql)
```bash
psql -h your-db-host -U postgres -d your-database -f migration.sql
```

---

## Verificación

Después de aplicar la migración:

```sql
-- Verificar que la tabla existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'config_agenda';

-- Verificar estructura
\d config_agenda

-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'config_agenda';

-- Test de insert
INSERT INTO config_agenda (user_id, lissa_recurring_link, lissa_meeting_code)
VALUES (auth.uid(), 'https://meet.lissa.pa/test', 'TEST-123');

-- Test de select
SELECT * FROM config_agenda WHERE user_id = auth.uid();
```

---

## Datos de ejemplo (Opcional)

Para poblar con datos de prueba:

```sql
-- Insertar configuración de ejemplo para usuario de prueba
INSERT INTO config_agenda (user_id, lissa_recurring_link, lissa_meeting_code)
VALUES 
  ('uuid-del-usuario-test', 'https://meet.lissa.pa/sala-lideres', 'SALA-LIDERES-123');
```

---

## Rollback

Si necesitas revertir la migración:

```sql
-- Eliminar tabla (cuidado: esto borra todos los datos)
DROP TABLE IF EXISTS config_agenda CASCADE;

-- Solo deshabilitar RLS (mantener datos)
ALTER TABLE config_agenda DISABLE ROW LEVEL SECURITY;
```

---

## Estado Actual

- [ ] Migración creada (este archivo)
- [ ] SQL probado localmente
- [ ] Migración aplicada en desarrollo
- [ ] Verificación completada
- [ ] Migración aplicada en staging
- [ ] Migración aplicada en producción

---

**Nota**: Una vez aplicada la migración, el código ya implementado funcionará automáticamente:
- `actionGetLissaConfig()` - Leerá la configuración
- `actionSaveLissaConfig()` - Guardará/actualizará la configuración
- Checkbox en EventFormModal - Autocompleta link y código
- Configuración en AgendaTab - Guarda y carga valores

---

**Prioridad**: MEDIA  
**Tiempo estimado**: 5-10 minutos para aplicar  
**Impacto**: LINK LISSA funcionará al 100% después de aplicar
