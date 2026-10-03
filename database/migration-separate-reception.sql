-- Run after migration-wedding-reception.sql, before deploying the new API.
-- Move existing reception rows atomically, preserving IDs and notification state.
begin;

create table if not exists public.reception_rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  event text not null default 'reception' check (event = 'reception'),
  attendance text not null check (attendance in ('yes', 'no')),
  meal text not null default '' check (meal = '' or meal in ('Veg', 'Non Veg', 'Both', 'Vegetarian', 'Non-vegetarian')),
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
  constraint reception_rsvps_guests_valid check (public.guests_are_valid(guests, attendance)),
  constraint reception_rsvps_party_valid check (
    (attendance = 'no' and additional_guests = 0 and total_attending = 0 and meal = '')
    or
    (attendance = 'yes' and event = 'reception' and meal in ('Vegetarian', 'Non-vegetarian', 'Both') and total_attending = additional_guests + 1)
  )
);


create unique index if not exists reception_rsvps_email_idx on public.reception_rsvps (email);
create index if not exists reception_rsvps_notification_status_idx on public.reception_rsvps (notification_status);
alter table public.reception_rsvps enable row level security;
revoke all on table public.reception_rsvps from anon, authenticated;
grant select, insert, update, delete on table public.reception_rsvps to service_role;

insert into public.reception_rsvps (id, created_at, name, email, event, attendance, meal, additional_guests, total_attending, guests, dietary, message, notification_status, notification_error, notified_at, notification_id, notification_claimed_at)
select source.id, source.created_at, source.name, source.email, source.event, source.attendance, source.meal, source.additional_guests, source.total_attending, source.guests, source.dietary, source.message, source.notification_status, source.notification_error, source.notified_at, source.notification_id, source.notification_claimed_at from public.rsvps source
where source.event = 'reception'
  and not exists (select 1 from public.reception_rsvps target where target.id = source.id);

delete from public.rsvps source
using public.reception_rsvps target
where source.event = 'reception' and source.id = target.id;

notify pgrst, 'reload schema';
commit;
