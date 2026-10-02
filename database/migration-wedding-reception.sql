-- Run this if public.rsvps already exists.
-- Adds event so wedding and reception replies can be stored separately.
-- The same email may reply once for the wedding and once for the reception.
-- New wedding replies do not collect a meal. Reception meals are
-- Vegetarian, Non-vegetarian, or Both.

alter table public.rsvps add column if not exists event text;

update public.rsvps
set event = 'wedding'
where event is null or btrim(event) = '';

alter table public.rsvps alter column event set default 'wedding';
alter table public.rsvps alter column event set not null;

alter table public.rsvps drop constraint if exists rsvps_event_check;
alter table public.rsvps add constraint rsvps_event_check check (event in ('wedding', 'reception'));

alter table public.rsvps drop constraint if exists rsvps_meal_check;
alter table public.rsvps add constraint rsvps_meal_check
  check (meal = '' or meal in ('Veg', 'Non Veg', 'Both', 'Vegetarian', 'Non-vegetarian'));

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
        or coalesce(guest->>'meal', '') not in ('', 'Veg', 'Non Veg', 'Both', 'Vegetarian', 'Non-vegetarian')
    )
  end;
$$;

revoke all on function public.guests_are_valid(jsonb, text) from public, anon, authenticated;

alter table public.rsvps drop constraint if exists rsvps_party_valid;
alter table public.rsvps add constraint rsvps_party_valid check (
  (attendance = 'no' and additional_guests = 0 and total_attending = 0 and meal = '')
  or
  (attendance = 'yes' and event = 'wedding' and total_attending = additional_guests + 1 and (meal = '' or meal in ('Veg', 'Non Veg', 'Both')))
  or
  (attendance = 'yes' and event = 'reception' and meal in ('Vegetarian', 'Non-vegetarian', 'Both') and total_attending = additional_guests + 1)
);

alter table public.rsvps drop constraint if exists rsvps_email_key;
drop index if exists public.rsvps_email_key;
create unique index if not exists rsvps_email_event_idx on public.rsvps (email, event);
