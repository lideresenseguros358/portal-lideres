# Dashboard Overview

## Data helpers
- **`getFortnightStatus()`**: usa `fortnights` y `fortnight_broker_totals` para obtener la última quincena pagada y la quincena abierta opcional.
- **`getNetCommissions()`**: reutiliza `getFortnightStatus()` para exponer montos netos de quincena pagada y abierta.
- **`getAnnualNet()`**: suma `production.pma_neto` del año actual (filtrado por `broker_id` si el rol es `broker`).
- **`getPendingCases()`**: cuenta checklist `case_checklist` con `label = 'FALTA_DOC'` y casos `cases.section = 'SIN_CLASIFICAR'`. Incluye fallback TODO si las tablas no existen.
- **`getYtdComparison()`**: agrega `production.pma_neto` por mes para el año actual y el anterior.
- **`getRankingTop5()`**: agrega producción anual por `broker_id`, consulta nombres en `brokers` y limita montos visibles al corredor actual.
- **`getContestProgress()`**: suma producción para las ventanas Convivio (ene–ago) y ASSA (ene–dic); obtiene metas de `app_settings` y calcula porcentaje.
- **`getMiniCalendar()`**: trae eventos creados por el usuario y en los que participa (`events`, `event_attendees`).

## App settings
- **`convivio_target_ytd`**: valor numérico esperado (JSON o number) para meta del Convivio LISSA.
- **`assa_target_ytd`**: valor numérico esperado para meta del Concurso ASSA.
  - *Fallback*: si la clave no existe o no es numérica, se usa `0` y se muestra tooltip TODO.

## Limitaciones
- **Pendientes**: si las tablas `cases` o `case_checklist` no están disponibles, `getPendingCases()` devuelve `{ faltaDoc: 0, sinClasificar: 0 }` con TODO en código.
- **Ranking**: requiere nombres en `brokers.name`; si falta, se muestra cadena vacía y se podría enriquecer desde otra fuente en el futuro.
- **Concursos**: los porcentajes dependen de metas configuradas; sin metas el donut permanece en 0 % con tooltip de TODO.
