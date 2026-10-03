-- Wedding/reception use created_at, attendance, and total_attending.
-- Haldi/Pelli/Vratham use submitted_at, attending, and guest_count.
-- guest_count is the total party size, including the person submitting the RSVP.
create table if not exists public.rsvp_daily_reports (
  report_date date primary key,
  sent_at timestamptz
);
alter table public.rsvp_daily_reports enable row level security;
revoke all on table public.rsvp_daily_reports from anon, authenticated;
grant select, insert, update, delete on table public.rsvp_daily_reports to service_role;

create or replace function public.rsvp_daily_summary(report_day date, report_zone text, cutoff timestamptz)
returns table(event text, daily_replies bigint, previous_day_replies bigint, cumulative_replies bigint, attending_people bigint)
language sql stable security invoker
set search_path = public
as $$
  select 'wedding'::text,
    count(*) filter (where (created_at at time zone report_zone)::date = report_day),
    count(*) filter (where (created_at at time zone report_zone)::date = report_day - 1),
    count(*), coalesce(sum(total_attending) filter (where attendance = 'yes'), 0)::bigint
  from public.rsvps where created_at <= cutoff
  union all
  select 'reception'::text,
    count(*) filter (where (created_at at time zone report_zone)::date = report_day),
    count(*) filter (where (created_at at time zone report_zone)::date = report_day - 1),
    count(*), coalesce(sum(total_attending) filter (where attendance = 'yes'), 0)::bigint
  from public.reception_rsvps where created_at <= cutoff
  union all
  select 'haldi'::text,
    count(*) filter (where (submitted_at at time zone report_zone)::date = report_day),
    count(*) filter (where (submitted_at at time zone report_zone)::date = report_day - 1),
    count(*), coalesce(sum(guest_count) filter (where attending = true), 0)::bigint
  from public.haldi_rsvps where submitted_at <= cutoff
  union all
  select 'pellikuthuru_pellikoduku'::text,
    count(*) filter (where (submitted_at at time zone report_zone)::date = report_day),
    count(*) filter (where (submitted_at at time zone report_zone)::date = report_day - 1),
    count(*), coalesce(sum(guest_count) filter (where attending = true), 0)::bigint
  from public.pelli_rsvps where submitted_at <= cutoff
  union all
  select 'vratham'::text,
    count(*) filter (where (submitted_at at time zone report_zone)::date = report_day),
    count(*) filter (where (submitted_at at time zone report_zone)::date = report_day - 1),
    count(*), coalesce(sum(guest_count) filter (where attending = true), 0)::bigint
  from public.vratham_rsvps where submitted_at <= cutoff;
$$;
revoke all on function public.rsvp_daily_summary(date, text, timestamptz) from public, anon, authenticated;
grant execute on function public.rsvp_daily_summary(date, text, timestamptz) to service_role;
