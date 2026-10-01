-- Run this if public.rsvps already exists from the earlier schema.
-- New projects should run schema.sql instead.
-- Existing rows need a meal of Veg, Non Veg, or Both on every guest before the
-- guest check below will succeed. Declined rows must keep guests as [].

create or replace function public.guests_are_valid(guests jsonb, attendance text)
returns boolean
language sql
immutable
as $$
  select case
    when attendance = 'no' then guests = '[]'::jsonb
    when attendance <> 'yes' then false
    when jsonb_typeof(guests) is distinct from 'array' then false
    when jsonb_array_length(guests) < 1 or jsonb_array_length(guests) > 4 then false
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

alter table public.rsvps add column if not exists dietary text not null default '';
alter table public.rsvps add column if not exists notification_status text not null default 'pending';
alter table public.rsvps add column if not exists notification_error text;
alter table public.rsvps add column if not exists notified_at timestamptz;
alter table public.rsvps add column if not exists notification_id text;
alter table public.rsvps add column if not exists notification_claimed_at timestamptz;

alter table public.rsvps drop constraint if exists rsvps_guests_check;
alter table public.rsvps drop constraint if exists rsvps_guests_valid;
alter table public.rsvps add constraint rsvps_guests_valid check (public.guests_are_valid(guests, attendance));

alter table public.rsvps drop constraint if exists rsvps_dietary_check;
alter table public.rsvps add constraint rsvps_dietary_check check (char_length(dietary) <= 500);

alter table public.rsvps drop constraint if exists rsvps_notification_status_check;
alter table public.rsvps add constraint rsvps_notification_status_check
  check (notification_status in ('pending', 'sending', 'sent', 'failed', 'unconfigured'));

alter table public.rsvps drop constraint if exists rsvps_notification_error_check;
alter table public.rsvps add constraint rsvps_notification_error_check
  check (notification_error is null or char_length(notification_error) <= 500);

create index if not exists rsvps_notification_status_idx on public.rsvps (notification_status);
