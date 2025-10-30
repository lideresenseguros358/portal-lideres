-- ============================================================
-- CREAR BROKER OFICINA PARA IS
-- Este broker se asigna automáticamente a todas las pólizas de IS
-- ============================================================

-- Insertar broker oficina si no existe
INSERT INTO brokers (
  slug,
  name,
  active,
  p_id
)
VALUES (
  'oficina',
  'Oficina',
  true,
  gen_random_uuid()
)
ON CONFLICT (slug) DO NOTHING;

-- Comentario
COMMENT ON COLUMN brokers.slug IS 'Slug único del broker. "oficina" se usa para IS';
