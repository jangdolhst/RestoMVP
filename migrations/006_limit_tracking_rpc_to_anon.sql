-- Migracion: limitar RPC de tracking a clientes anonimos
-- Fecha: 2026-05-26
-- Los clientes no tienen cuenta; no hace falta exponer este SECURITY DEFINER a authenticated.

REVOKE EXECUTE ON FUNCTION public.get_orders_by_tokens(UUID[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_orders_by_tokens(UUID[]) TO anon;
