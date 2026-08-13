const removedProfileStatuses = new Set(["inactive", "removed", "deleted"]);

export const NO_ACTIVE_TEAM_MEMBERS_MESSAGE =
  "No active team members available.";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function hasAlternateRemovedState(profile) {
  const status = normalizeText(profile?.status).toLowerCase();

  return (
    profile?.is_removed === true ||
    profile?.removed === true ||
    removedProfileStatuses.has(status)
  );
}

export function isLaborProfileSelectable(profile) {
  return Boolean(
    profile?.id &&
      profile.is_active === true &&
      profile.removed_at == null &&
      !hasAlternateRemovedState(profile)
  );
}

export function formatLaborProfileName(profile) {
  const fullName = normalizeText(profile?.full_name);

  if (fullName) {
    return fullName;
  }

  const email = normalizeText(profile?.email);
  const emailUsername = email.split("@")[0]?.trim();

  return emailUsername || "Unnamed team member";
}

export function sortLaborProfiles(profiles = []) {
  return [...profiles]
    .filter(isLaborProfileSelectable)
    .sort((firstProfile, secondProfile) =>
      formatLaborProfileName(firstProfile).localeCompare(
        formatLaborProfileName(secondProfile),
        undefined,
        { sensitivity: "base" }
      )
    );
}

export async function fetchSelectableLaborProfiles(supabaseClient) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email, role, hourly_rate, is_active, removed_at")
    .eq("is_active", true)
    .is("removed_at", null)
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("email", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return sortLaborProfiles(data ?? []);
}

export async function fetchSelectableLaborProfileById(
  supabaseClient,
  profileId
) {
  if (!profileId) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email, role, hourly_rate, is_active, removed_at")
    .eq("id", profileId)
    .eq("is_active", true)
    .is("removed_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return isLaborProfileSelectable(data) ? data : null;
}
