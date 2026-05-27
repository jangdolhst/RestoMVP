-- Migracion: bloquear listado publico del bucket restaurant-media
-- Fecha: 2026-05-26
-- El bucket puede seguir sirviendo URLs publicas directas sin una policy SELECT amplia.

DROP POLICY IF EXISTS "Público puede ver media" ON storage.objects;
