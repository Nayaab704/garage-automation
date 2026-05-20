import { supabase } from "./supabaseClient";

const roleLabels = {
  owner: "Owner",
  admin: "Admin",
  technician: "Technician",
  ordering: "Ordering",
  sales: "Sales",
};

export function formatProfileRole(role) {
  return roleLabels[role] ?? "No Role";
}

export function getProfileRoleClassName(role) {
  if (role === "owner" || role === "admin") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (role === "technician") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (role === "ordering") {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }

  if (role === "sales") {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

export async function fetchCurrentUserProfile(userId) {
  if (!userId) {
    return { data: null, error: null };
  }

  return supabase
    .from("profiles")
    .select("id, auth_user_id, email, full_name, role")
    .eq("auth_user_id", userId)
    .maybeSingle();
}
