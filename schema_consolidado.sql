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
  order_number SERIAL,
  client_name TEXT NOT NULL,
  table_name TEXT,
  phone TEXT,
  type TEXT NOT NULL CHECK (type IN ('online', 'local')),
  total NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente_cocina' CHECK (status IN ('pendiente_cocina', 'listo', 'pagado')),
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
-- Clientes: Solo pueden insertar órdenes a tenants reales
CREATE POLICY "Clientes pueden insertar órdenes" ON orders
  FOR INSERT WITH CHECK (
    tenant_id IS NOT NULL 
    AND EXISTS (SELECT 1 FROM auth.users WHERE id = tenant_id)
  );

-- DETALLES DE ÓRDENES (ORDER ITEMS)
-- Dueños: Pueden gestionar detalles si la orden les pertenece
CREATE POLICY "Dueños pueden gestionar items" ON order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.tenant_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.tenant_id = auth.uid())
  );
-- Clientes: Pueden insertar items solo si la orden existe
CREATE POLICY "Clientes pueden insertar items" ON order_items
  FOR INSERT WITH CHECK (
    order_id IS NOT NULL 
    AND EXISTS (SELECT 1 FROM orders WHERE id = order_id)
  );


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

-- ==========================================
-- RPC: SEGUIMIENTO DE PEDIDOS POR TOKEN
-- ==========================================
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
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'price', oi.price
      ))
      FROM order_items oi WHERE oi.order_id = o.id),
      '[]'::jsonb
    ) AS items
  FROM orders o
  LEFT JOIN restaurant_profiles rp ON rp.id = o.tenant_id
  WHERE o.order_token = ANY(tokens)
  ORDER BY o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_orders_by_tokens(UUID[]) TO anon, authenticated;
