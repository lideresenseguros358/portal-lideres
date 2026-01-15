-- ============================================
-- FIX: Corregir zona horaria en notificaciones de agenda existentes
-- ============================================
-- Problema: Notificaciones creadas antes del fix muestran hora incorrecta (UTC en lugar de America/Panama)
-- Este script recalcula el event_time y actualiza el body de las notificaciones
-- ============================================

-- Paso 1: Ver notificaciones de agenda afectadas (OPCIONAL - solo para revisar)
-- Descomenta para ver qué notificaciones se van a corregir:
/*
SELECT 
  id,
  title,
  body,
  meta->>'event_time' as hora_actual,
  meta->>'event_date' as fecha,
  created_at
FROM notifications
WHERE notification_type = 'agenda_event'
  AND meta->>'event_time' IS NOT NULL
ORDER BY created_at DESC;
*/

-- Paso 2: Actualizar notificaciones con hora corregida
-- Este UPDATE recalcula event_time desde event_id usando timezone 'America/Panama'
UPDATE notifications n
SET 
  body = CASE 
    WHEN meta->>'event_time' IS NOT NULL THEN
      -- Reconstruir body con hora corregida
      CONCAT(
        meta->>'event_title',
        ' - ',
        CASE 
          WHEN body LIKE '%Nueva fecha:%' THEN 'Nueva fecha: '
          ELSE ''
        END,
        meta->>'event_date',
        ' a las ',
        -- Calcular hora correcta en timezone America/Panama
        TO_CHAR(
          (SELECT start_at AT TIME ZONE 'America/Panama' 
           FROM events 
           WHERE id = (meta->>'event_id')::uuid),
          'HH24:MI'
        )
      )
    ELSE body
  END,
  meta = CASE
    WHEN meta->>'event_time' IS NOT NULL THEN
      -- Actualizar event_time en meta JSON
      jsonb_set(
        meta::jsonb,
        '{event_time}',
        to_jsonb(
          TO_CHAR(
            (SELECT start_at AT TIME ZONE 'America/Panama' 
             FROM events 
             WHERE id = (meta->>'event_id')::uuid),
            'HH24:MI'
          )
        )
      )
    ELSE meta
  END
WHERE notification_type = 'agenda_event'
  AND meta->>'event_time' IS NOT NULL
  AND meta->>'event_id' IS NOT NULL;

-- Paso 3: Verificar corrección (OPCIONAL - descomenta para revisar)
/*
SELECT 
  id,
  title,
  body,
  meta->>'event_time' as hora_corregida,
  meta->>'event_date' as fecha,
  created_at
FROM notifications
WHERE notification_type = 'agenda_event'
  AND meta->>'event_time' IS NOT NULL
ORDER BY created_at DESC;
*/

-- ============================================
-- NOTAS:
-- ============================================
-- - Este script solo afecta notificaciones de tipo 'agenda_event' que tienen event_time
-- - Requiere que el event_id en meta exista en la tabla events
-- - Si el evento fue eliminado, esa notificación no se actualizará
-- - El formato de hora es HH24:MI (24 horas, ej: "10:00")
-- - Las notificaciones futuras ya usarán la hora correcta gracias al fix en el código
