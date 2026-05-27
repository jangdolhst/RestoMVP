-- Restrict anonymous Data API access for public restaurant listings.
-- Run this in the Supabase SQL Editor after confirming RLS policies are already enabled.

begin;

revoke select on table public.restaurant_profiles from anon;

grant select (
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
  business_hours
) on table public.restaurant_profiles to anon;

notify pgrst, 'reload schema';

commit;
