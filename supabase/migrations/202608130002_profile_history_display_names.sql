-- Keep historical attribution readable after a team member is deactivated or
-- soft-removed. This view exposes display-only fields to active members and is
-- deliberately separate from profile_display_names, which remains appropriate
-- for current-user pickers and filters.
create or replace view public.profile_history_display_names as
select
  profiles.id,
  profiles.full_name,
  profiles.email,
  profiles.role
from public.profiles
where public.is_active_member();

revoke all on table public.profile_history_display_names from public;
revoke all on table public.profile_history_display_names from anon;
grant select on table public.profile_history_display_names to authenticated;

comment on view public.profile_history_display_names is
  'Display-only profile attribution for historical records, including inactive and soft-removed members; readable only by active authenticated team members.';
