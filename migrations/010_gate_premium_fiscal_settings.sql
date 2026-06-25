-- Gate premium fiscal settings at the database layer.
-- This prevents authenticated users from updating fiscal fields directly through
-- the Data API unless they pass through the subscription-checked RPC below.

begin;

revoke update (fiscal_number, tax_included, tax_rate)
on table public.restaurant_profiles
from authenticated;

create or replace function public.update_restaurant_fiscal_settings(
  p_fiscal_number text default '',
  p_tax_included boolean default false,
  p_tax_rate numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tax_rate numeric(5, 2);
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.subscriptions
    where tenant_id = v_user_id
      and (
        status in ('active', 'trialing')
        or current_period_end > now()
      )
  ) then
    raise exception 'Active Pro subscription required' using errcode = '42501';
  end if;

  v_tax_rate := greatest(0, least(30, coalesce(p_tax_rate, 0)))::numeric(5, 2);

  update public.restaurant_profiles
  set
    fiscal_number = left(upper(trim(coalesce(p_fiscal_number, ''))), 20),
    tax_included = coalesce(p_tax_included, false),
    tax_rate = v_tax_rate,
    updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'Restaurant profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_restaurant_fiscal_settings(text, boolean, numeric)
from public, anon;

grant execute on function public.update_restaurant_fiscal_settings(text, boolean, numeric)
to authenticated;

notify pgrst, 'reload schema';

commit;
