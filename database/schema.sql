-- Fresh Supabase setup. Guest data is accessible only from the server.
-- The person completing the form is the primary guest. additional_guests is everyone
-- coming with them. total_attending is 0 when they decline, otherwise additional_guests + 1.
-- Meal values must be exactly: Veg, Non Veg, Both. There is no party-size limit.
-- The guests column stores only the primary guest for new RSVPs. It is kept so older
-- rows can retain names that were collected before this change.

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

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null unique check (char_length(email) <= 254),
  attendance text not null check (attendance in ('yes', 'no')),
  meal text not null default '' check (meal = '' or meal in ('Veg', 'Non Veg', 'Both')),
  additional_guests integer not null default 0 check (additional_guests >= 0),
  total_attending integer not null default 0 check (total_attending >= 0),
  guests jsonb not null default '[]'::jsonb,
  dietary text not null default '' check (char_length(dietary) <= 500),
  message text not null default '' check (char_length(message) <= 2000),
  notification_status text not null default 'pending' check (notification_status in ('pending', 'sending', 'sent', 'failed', 'unconfigured')),
  notification_error text check (notification_error is null or char_length(notification_error) <= 500),
  notified_at timestamptz,
  notification_id text,
  notification_claimed_at timestamptz,
  constraint rsvps_guests_valid check (public.guests_are_valid(guests, attendance)),
  constraint rsvps_party_valid check (
    (attendance = 'no' and additional_guests = 0 and total_attending = 0 and meal = '')
    or
    (attendance = 'yes' and meal in ('Veg', 'Non Veg', 'Both') and total_attending = additional_guests + 1)
  )
);

create index if not exists rsvps_notification_status_idx on public.rsvps (notification_status);

alter table public.rsvps enable row level security;
revoke all on table public.rsvps from anon, authenticated;
-- No public policies. View or export RSVPs from the Supabase dashboard.
-- The API uses the service role key, which bypasses row-level security.
