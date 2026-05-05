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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- Clientes: Solo pueden insertar órdenes (enviar pedidos)
CREATE POLICY "Clientes pueden insertar órdenes" ON orders
  FOR INSERT WITH CHECK (true);

-- DETALLES DE ÓRDENES (ORDER ITEMS)
-- Dueños: Pueden gestionar detalles si la orden les pertenece
CREATE POLICY "Dueños pueden gestionar items" ON order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.tenant_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.tenant_id = auth.uid())
  );
-- Clientes: Pueden insertar items
CREATE POLICY "Clientes pueden insertar items" ON order_items
  FOR INSERT WITH CHECK (true);


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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar el trigger si existe para evitar errores al recrear
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear el trigger en auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
