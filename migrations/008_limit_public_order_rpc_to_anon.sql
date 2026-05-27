-- Migracion: limitar RPC de creacion publica a anon
-- Fecha: 2026-05-26

REVOKE EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB) TO anon;
