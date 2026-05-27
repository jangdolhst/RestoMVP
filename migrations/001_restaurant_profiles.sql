-- ==========================================
-- MIGRACIÓN: restaurant_profiles + Storage bucket
-- ==========================================

-- 1. Crear tabla de perfiles de restaurante
CREATE TABLE IF NOT EXISTS restaurant_profiles (
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

-- 2. RLS
ALTER TABLE restaurant_profiles ENABLE ROW LEVEL SECURITY;

-- Cualquier persona puede VER los perfiles activos (para el marketplace)
CREATE POLICY "Perfiles públicos visibles" ON restaurant_profiles
  FOR SELECT USING (is_active = true);

-- Dueños pueden ver su propio perfil aunque no esté activo
CREATE POLICY "Dueños ven su perfil" ON restaurant_profiles
  FOR SELECT USING (auth.uid() = id);

-- Dueños pueden insertar/actualizar/eliminar SOLO su perfil
CREATE POLICY "Dueños gestionan su perfil" ON restaurant_profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. Trigger: Crear perfil vacío cuando un usuario se registra
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

-- Bloquear acceso público a la función
REVOKE EXECUTE ON FUNCTION public.handle_new_restaurant_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_restaurant_profile();

-- 4. Storage bucket (ejecutar manualmente en Dashboard o via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('restaurant-media', 'restaurant-media', true);

-- Políticas de Storage:
-- No crear SELECT publico sobre storage.objects: los buckets publicos sirven URLs directas sin permitir listado.
-- CREATE POLICY "Autenticados suben media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'restaurant-media' AND auth.role() = 'authenticated');
-- CREATE POLICY "Dueños actualizan su media" ON storage.objects FOR UPDATE USING (bucket_id = 'restaurant-media' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Dueños eliminan su media" ON storage.objects FOR DELETE USING (bucket_id = 'restaurant-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Crear perfiles para usuarios existentes que aún no tengan perfil
INSERT INTO restaurant_profiles (id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT id FROM restaurant_profiles)
ON CONFLICT (id) DO NOTHING;
