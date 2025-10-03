# Paso 2 — SQL + RLS + Storage (LISSA)
Este paquete contiene:
- `scripts/sql/02_schema_all.sql`   → crea/ajusta tablas base y helpers.
- `scripts/sql/02_rls_all.sql`      → habilita y define políticas RLS.
- `scripts/sql/02_storage_all.sql`  → buckets y políticas de storage.
- `scripts/sql/02_verify_all.sql`   → consultas de verificación.

**Ejecución (en Supabase SQL Editor) en este orden:**
1. `02_schema_all.sql`
2. `02_rls_all.sql`
3. `02_storage_all.sql`
4. `02_verify_all.sql`  (solo lectura)

Notas:
- Roles válidos: `MASTER`, `BROKER`, `OFFICE`. Master se controla por `profiles.role`.
- `profiles.demo_enabled` controla el modo demo (default false).
- Buckets: `avatars` (lectura pública), `descargas` (auth), `pendientes` (auth + rutas por email).
- Este paso no borra datos; es idempotente donde aplica.
