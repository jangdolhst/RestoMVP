-- Migracion: endurecer insercion anonima de order_items
-- Fecha: 2026-05-26
-- Objetivo:
--   1) Mantener el flujo sin cuenta: el cliente puede crear una orden y sus items.
--   2) Bloquear que un token/orden filtrada permita agregar items despues del envio.

DROP POLICY IF EXISTS "Clientes pueden insertar items" ON public.order_items;

CREATE POLICY "Clientes pueden insertar items iniciales" ON public.order_items
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND o.created_at >= (NOW() - INTERVAL '2 minutes')
        AND NOT EXISTS (
          SELECT 1
          FROM public.order_items existing
          WHERE existing.order_id = o.id
        )
    )
  );
