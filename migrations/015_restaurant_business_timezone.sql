BEGIN;

ALTER TABLE public.restaurant_profiles
  ADD COLUMN IF NOT EXISTS business_timezone TEXT NOT NULL DEFAULT 'America/Tijuana';

ALTER TABLE public.restaurant_profiles
  DROP CONSTRAINT IF EXISTS restaurant_profiles_business_timezone_not_blank;

ALTER TABLE public.restaurant_profiles
  ADD CONSTRAINT restaurant_profiles_business_timezone_not_blank
  CHECK (length(trim(business_timezone)) > 0);

UPDATE public.restaurant_profiles
SET business_timezone = CASE
  WHEN longitude BETWEEN -88.8 AND -86.5 AND latitude BETWEEN 17.5 AND 22.8 THEN 'America/Cancun'
  WHEN longitude BETWEEN -118 AND -112 AND latitude BETWEEN 28 AND 33.5 THEN 'America/Tijuana'
  WHEN longitude > -112 AND longitude <= -108 AND latitude BETWEEN 26 AND 33.5 THEN 'America/Hermosillo'
  WHEN longitude BETWEEN -116 AND -104 AND latitude >= 20 AND latitude < 28 THEN 'America/Mazatlan'
  WHEN longitude BETWEEN -118 AND -86 AND latitude BETWEEN 14 AND 33.5 THEN 'America/Mexico_City'
  ELSE COALESCE(NULLIF(business_timezone, ''), 'America/Tijuana')
END
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND (business_timezone IS NULL OR business_timezone = '' OR business_timezone = 'America/Tijuana');

GRANT UPDATE (business_timezone, updated_at)
ON TABLE public.restaurant_profiles TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
