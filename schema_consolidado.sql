-- ==========================================
-- SCHEMA CONSOLIDADO: RESTO MVP (Multi-Tenant)
-- ==========================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Eliminar tablas existentes para recrear el esquema limpio
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS extras CASCADE;
DROP TABLE IF EXISTS restaurant_profiles CASCADE;

-- 1. Tabla de Suscripciones (Stripe)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- 2. Tabla de Categorías
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Extras
CREATE TABLE extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3b. Tabla de Perfiles de Restaurante (Marketplace)
CREATE TABLE restaurant_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  logo_url TEXT,
  banner_url TEXT,
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  categories TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  fiscal_number TEXT DEFAULT '',
  tax_included BOOLEAN DEFAULT false,
  tax_rate NUMERIC(5, 2) DEFAULT 0,
  business_hours JSONB DEFAULT '{"open": "09:00", "close": "22:00", "is_manually_closed": false}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Productos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  ingredients TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Órdenes
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number INTEGER,
  client_name TEXT NOT NULL,
  table_name TEXT,
  phone TEXT,
  type TEXT NOT NULL CHECK (type IN ('online', 'local')),
  total NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente_cocina' CHECK (status IN ('pendiente_confirmacion', 'pendiente_cocina', 'listo', 'pagado', 'cancelado')),
  confirmation_code CHAR(4),
  order_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda rápida por token de seguimiento
CREATE INDEX idx_orders_order_token ON orders (order_token);

-- 6. Tabla de Detalles de la Orden (Order Items)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10, 2) NOT NULL,
  ingredients TEXT,
  modifications JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_profiles ENABLE ROW LEVEL SECURITY;

-- PERFILES DE RESTAURANTE
-- Público puede ver perfiles activos (marketplace)
CREATE POLICY "Perfiles públicos visibles" ON restaurant_profiles
  FOR SELECT USING (is_active = true);
-- Dueños pueden ver su perfil (incluso inactivo)
CREATE POLICY "Dueños ven su perfil" ON restaurant_profiles
  FOR SELECT USING (auth.uid() = id);
-- Dueños gestionan su perfil
CREATE POLICY "Dueños gestionan su perfil" ON restaurant_profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- SUSCRIPCIONES
-- Dueños: Pueden leer su propia suscripción, pero no modificarla (eso lo hace el webhook)
CREATE POLICY "Dueños pueden ver su suscripción" ON subscriptions
  FOR SELECT USING (auth.uid() = tenant_id);
-- El webhook de Stripe usará el Service Role de Supabase para hacer INSERT/UPDATE, el cual se salta el RLS.

-- CATEGORÍAS
-- Dueños: Pueden hacer todo con sus categorías
CREATE POLICY "Dueños pueden gestionar sus categorías" ON categories
  FOR ALL USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);
-- Clientes: Pueden ver cualquier categoría (se filtra en frontend por tenant_id)
CREATE POLICY "Clientes pueden ver categorías" ON categories
  FOR SELECT USING (true);

-- EXTRAS
-- Dueños: Pueden gestionar sus extras
CREATE POLICY "Dueños pueden gestionar sus extras" ON extras
  FOR ALL USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);
-- Clientes: Pueden ver extras
CREATE POLICY "Clientes pueden ver extras" ON extras
  FOR SELECT USING (true);

-- PRODUCTOS
-- Dueños: Pueden hacer todo con sus productos
CREATE POLICY "Dueños pueden gestionar sus productos" ON products
  FOR ALL USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);
-- Clientes: Pueden ver cualquier producto
CREATE POLICY "Clientes pueden ver productos" ON products
  FOR SELECT USING (true);

-- ÓRDENES
-- Dueños: Pueden ver y actualizar sus órdenes
CREATE POLICY "Dueños pueden gestionar sus órdenes" ON orders
  FOR ALL USING (auth.uid() = tenant_id) WITH CHECK (auth.uid() = tenant_id);
-- Clientes sin cuenta crean pedidos via RPC public.create_public_order().
-- No se permite INSERT anonimo directo para evitar manipulacion de precios/totales.

-- DETALLES DE ÓRDENES (ORDER ITEMS)
-- Dueños: Pueden gestionar detalles si la orden les pertenece
CREATE POLICY "Dueños pueden gestionar items" ON order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.tenant_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.tenant_id = auth.uid())
  );
-- Clientes sin cuenta crean items via RPC public.create_public_order().
-- No se permite INSERT anonimo directo.


-- ==========================================
-- REALTIME
-- ==========================================
-- Habilitar REALTIME para la tabla de órdenes (necesario para la cocina)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ==========================================
-- TRIGGERS (AUTOMATIZACIÓN)
-- ==========================================

-- Trigger para crear una suscripción en 'unpaid' automáticamente cuando un usuario se registra
-- Ahora delegamos el control de la prueba gratuita a Stripe
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (tenant_id, status)
  VALUES (new.id, 'unpaid');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Bloquear acceso público a la función (solo ejecutable como trigger)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Eliminar el trigger si existe para evitar errores al recrear
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear el trigger en auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger para auto-crear perfil de restaurante al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_restaurant_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.restaurant_profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_restaurant_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_restaurant_profile();

-- Trigger para autogenerar número de orden secuencial diario por restaurante (tenant)
CREATE OR REPLACE FUNCTION set_next_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = 0 THEN
    SELECT COALESCE(MAX(order_number), 0) + 1
    INTO NEW.order_number
    FROM orders
    WHERE tenant_id = NEW.tenant_id
      AND created_at::date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE EXECUTE ON FUNCTION set_next_order_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_next_order_number ON orders;
CREATE TRIGGER trg_set_next_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_next_order_number();

-- ==========================================
-- RPC: SEGUIMIENTO DE PEDIDOS POR TOKEN
-- ==========================================
-- RPC: CREACION PUBLICA DE PEDIDOS
-- Clientes sin cuenta crean pedidos sin poder fijar precios/totales desde consola.

CREATE OR REPLACE FUNCTION public.create_public_order(
  p_tenant_id UUID,
  p_client_name TEXT,
  p_phone TEXT,
  p_items JSONB
)
RETURNS TABLE (
  id UUID,
  order_number INTEGER,
  order_token UUID,
  confirmation_code TEXT,
  total NUMERIC,
  restaurant_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant_phone TEXT;
  v_order_id UUID;
  v_order_number INTEGER;
  v_order_token UUID := gen_random_uuid();
  v_confirmation_code TEXT;
  v_clean_phone TEXT;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_product RECORD;
  v_quantity INTEGER;
  v_mods JSONB;
  v_mod JSONB;
  v_mod_name TEXT;
  v_clean_mods JSONB;
  v_extra RECORD;
  v_extra_total NUMERIC;
  v_items_payload JSONB := '[]'::jsonb;
  v_item_count INTEGER;
  v_chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
BEGIN
  SELECT rp.phone
  INTO v_restaurant_phone
  FROM public.restaurant_profiles rp
  WHERE rp.id = p_tenant_id
    AND rp.is_active = true
    AND COALESCE((rp.business_hours->>'is_manually_closed')::boolean, false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'restaurant_not_available';
  END IF;

  v_clean_phone := left(trim(COALESCE(p_phone, '')), 32);
  IF length(regexp_replace(v_clean_phone, '[^0-9]', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.tenant_id = p_tenant_id
      AND o.phone = v_clean_phone
      AND o.created_at >= (NOW() - INTERVAL '15 seconds')
  ) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_items';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 50 THEN
    RAISE EXCEPTION 'invalid_item_count';
  END IF;

  SELECT string_agg(substr(v_chars, (floor(random() * length(v_chars)) + 1)::integer, 1), '')
  INTO v_confirmation_code
  FROM generate_series(1, 4);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT p.id, p.name, p.price, p.ingredients
    INTO v_product
    FROM public.products p
    WHERE p.id = (v_item->>'product_id')::uuid
      AND p.tenant_id = p_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_product';
    END IF;

    v_quantity := LEAST(99, GREATEST(1, COALESCE(NULLIF(v_item->>'quantity', '')::integer, 1)));
    v_mods := COALESCE(v_item->'modifications', '[]'::jsonb);
    IF jsonb_typeof(v_mods) <> 'array' THEN
      v_mods := '[]'::jsonb;
    END IF;

    v_clean_mods := '[]'::jsonb;
    v_extra_total := 0;

    FOR v_mod IN
      SELECT value
      FROM jsonb_array_elements(v_mods) WITH ORDINALITY AS mods(value, ord)
      WHERE ord <= 20
    LOOP
      v_mod_name := left(trim(COALESCE(v_mod->>'name', '')), 80);
      IF v_mod_name = '' THEN
        CONTINUE;
      END IF;

      IF v_mod->>'type' = 'extra' THEN
        SELECT e.name, e.price
        INTO v_extra
        FROM public.extras e
        WHERE e.tenant_id = p_tenant_id
          AND lower(e.name) = lower(v_mod_name)
        ORDER BY e.created_at DESC
        LIMIT 1;

        IF FOUND THEN
          v_extra_total := v_extra_total + COALESCE(v_extra.price, 0);
          v_clean_mods := v_clean_mods || jsonb_build_array(jsonb_build_object(
            'type', 'extra',
            'name', v_extra.name,
            'price', v_extra.price
          ));
        END IF;
      ELSIF v_mod->>'type' = 'remove' THEN
        v_clean_mods := v_clean_mods || jsonb_build_array(jsonb_build_object(
          'type', 'remove',
          'name', v_mod_name,
          'price', 0
        ));
      END IF;
    END LOOP;

    v_total := v_total + ((COALESCE(v_product.price, 0) + v_extra_total) * v_quantity);
    v_items_payload := v_items_payload || jsonb_build_array(jsonb_build_object(
      'product_name', v_product.name,
      'quantity', v_quantity,
      'price', v_product.price,
      'ingredients', v_product.ingredients,
      'modifications', v_clean_mods
    ));
  END LOOP;

  INSERT INTO public.orders (
    tenant_id,
    client_name,
    table_name,
    phone,
    type,
    total,
    status,
    confirmation_code,
    order_token
  )
  VALUES (
    p_tenant_id,
    left(trim(COALESCE(p_client_name, 'Sin Nombre')), 80),
    'Online',
    v_clean_phone,
    'online',
    v_total,
    'pendiente_confirmacion',
    v_confirmation_code,
    v_order_token
  )
  RETURNING orders.id, orders.order_number
  INTO v_order_id, v_order_number;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items_payload)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_name,
      quantity,
      price,
      ingredients,
      modifications
    )
    VALUES (
      v_order_id,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'price')::numeric,
      v_item->>'ingredients',
      v_item->'modifications'
    );
  END LOOP;

  RETURN QUERY SELECT
    v_order_id,
    v_order_number,
    v_order_token,
    v_confirmation_code,
    v_total,
    COALESCE(v_restaurant_phone, '');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, JSONB) TO anon;

-- Permite a clientes sin sesión consultar sus pedidos usando tokens secretos.
-- SECURITY DEFINER: ejecuta con privilegios del creador para bypasear RLS.
-- Solo expone campos públicos (sin tenant_id ni datos internos).

CREATE OR REPLACE FUNCTION get_orders_by_tokens(tokens UUID[])
RETURNS TABLE (
  id UUID,
  order_number INTEGER,
  client_name TEXT,
  status TEXT,
  total NUMERIC,
  created_at TIMESTAMPTZ,
  order_token UUID,
  restaurant_name TEXT,
  restaurant_address TEXT,
  restaurant_latitude NUMERIC,
  restaurant_longitude NUMERIC,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  safe_tokens UUID[];
BEGIN
  -- Limitar y normalizar entrada para reducir superficie de abuso.
  SELECT COALESCE(array_agg(DISTINCT tkn), '{}'::UUID[])
  INTO safe_tokens
  FROM (
    SELECT tkn
    FROM unnest(COALESCE(tokens, '{}'::UUID[])) AS tkn
    WHERE tkn IS NOT NULL
    LIMIT 20
  ) limited_tokens;

  IF COALESCE(array_length(safe_tokens, 1), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.order_number,
    o.client_name,
    o.status,
    o.total,
    o.created_at,
    o.order_token,
    COALESCE(rp.name, '') AS restaurant_name,
    COALESCE(rp.address, '') AS restaurant_address,
    rp.latitude AS restaurant_latitude,
    rp.longitude AS restaurant_longitude,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'price', oi.price
      ))
      FROM public.order_items oi WHERE oi.order_id = o.id),
      '[]'::jsonb
    ) AS items
  FROM public.orders o
  LEFT JOIN public.restaurant_profiles rp ON rp.id = o.tenant_id
  WHERE o.order_token = ANY(safe_tokens)
    AND o.created_at >= (NOW() - INTERVAL '7 days')
  ORDER BY o.created_at DESC
  LIMIT 50;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_orders_by_tokens(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_orders_by_tokens(UUID[]) TO anon;
