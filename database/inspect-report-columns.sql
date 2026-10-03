-- Read-only: paste into the Supabase SQL editor and share the result.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('rsvps', 'reception_rsvps', 'haldi_rsvps', 'pelli_rsvps', 'vratham_rsvps')
order by table_name, ordinal_position;
