-- Tighten restaurant profile write grants after fiscal fields moved behind Pro.
-- Anonymous clients should not write restaurant profiles at all.
-- Authenticated restaurants can write only basic/free profile fields directly.

begin;

revoke insert, update, delete
on table public.restaurant_profiles
from anon;

revoke insert, update, delete
on table public.restaurant_profiles
from authenticated;

grant insert (
  id,
  name,
  description,
  logo_url,
  banner_url,
  address,
  phone,
  categories,
  is_active,
  latitude,
  longitude,
  table_count,
  waiters,
  business_hours,
  updated_at
)
on table public.restaurant_profiles
to authenticated;

grant update (
  name,
  description,
  logo_url,
  banner_url,
  address,
  phone,
  categories,
  is_active,
  latitude,
  longitude,
  table_count,
  waiters,
  business_hours,
  updated_at
)
on table public.restaurant_profiles
to authenticated;

notify pgrst, 'reload schema';

commit;
