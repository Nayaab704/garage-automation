-- Segment 2 needs authenticated app users to read and save vendor quote memory.
-- UI role checks still control who can reach the operational Add Part flow;
-- future RLS policies can narrow this further without changing the frontend API.
grant select, insert, update on table public.vendor_part_quotes to authenticated;
grant execute on function public.search_vendor_part_quotes(text, text, text, integer, integer) to authenticated;
