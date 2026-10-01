-- Run this if public.rsvps already exists.
-- Existing rows are kept, including any guest names already stored in guests.
-- New responses store the primary guest only, plus an additional-guest count.
-- There is no maximum party size.
--
-- Attending rows need a primary meal of Veg, Non Veg, or Both in guests[0]
-- before this migration can finish.

do $$
begin
  if exists (
    select 1
    from public.rsvps
    where attendance = 'yes'
      and coalesce(guests->0->>'meal', '') not in ('Veg', 'Non Veg', 'Both')
  ) then
    raise exception 'Attending RSVPs need a primary meal of Veg, Non Veg, or Both before this migration.';
  end if;
end $$;

alter table public.rsvps add column if not exists meal text;
alter table public.rsvps add column if not exists additional_guests integer;
alter table public.rsvps add column if not exists total_attending integer;

update public.rsvps
set
  meal = case
    when attendance = 'yes' then btrim(guests->0->>'meal')
    else ''
  end,
  additional_guests = case
    when attendance = 'yes' then greatest(coalesce(jsonb_array_length(guests), 0) - 1, 0)
    else 0
  end,
  total_attending = case
    when attendance = 'yes' then greatest(coalesce(jsonb_array_length(guests), 0), 1)
    else 0
  end
where meal is null
   or additional_guests is null
   or total_attending is null;

alter table public.rsvps alter column meal set default '';
alter table public.rsvps alter column meal set not null;
alter table public.rsvps alter column additional_guests set default 0;
alter table public.rsvps alter column additional_guests set not null;
alter table public.rsvps alter column total_attending set default 0;
alter table public.rsvps alter column total_attending set not null;

alter table public.rsvps drop constraint if exists rsvps_meal_check;
alter table public.rsvps add constraint rsvps_meal_check check (meal = '' or meal in ('Veg', 'Non Veg', 'Both'));

alter table public.rsvps drop constraint if exists rsvps_additional_guests_check;
alter table public.rsvps add constraint rsvps_additional_guests_check check (additional_guests >= 0);

alter table public.rsvps drop constraint if exists rsvps_total_attending_check;
alter table public.rsvps add constraint rsvps_total_attending_check check (total_attending >= 0);

create or replace function public.guests_are_valid(guests jsonb, attendance text)
returns boolean
language sql
immutable
as $$
  select case
    when attendance = 'no' then guests = '[]'::jsonb
    when attendance <> 'yes' then false
    when jsonb_typeof(guests) is distinct from 'array' then false
    else not exists (
      select 1
      from jsonb_array_elements(guests) as guest
      where jsonb_typeof(guest) is distinct from 'object'
        or guest->>'name' is null
        or char_length(btrim(guest->>'name')) < 1
        or char_length(guest->>'name') > 120
        or guest->>'meal' not in ('Veg', 'Non Veg', 'Both')
    )
  end;
$$;

revoke all on function public.guests_are_valid(jsonb, text) from public, anon, authenticated;

alter table public.rsvps drop constraint if exists rsvps_party_valid;
alter table public.rsvps add constraint rsvps_party_valid check (
  (attendance = 'no' and additional_guests = 0 and total_attending = 0 and meal = '')
  or
  (attendance = 'yes' and meal in ('Veg', 'Non Veg', 'Both') and total_attending = additional_guests + 1)
);
