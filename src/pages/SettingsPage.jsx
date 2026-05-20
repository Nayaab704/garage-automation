import { useEffect, useState } from "react";
import {
  formatProfileRole,
  getProfileRoleClassName,
} from "../lib/currentUserProfile";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";

const roleOptions = [
  { label: "Owner", value: "owner" },
  { label: "Admin", value: "admin" },
  { label: "Technician", value: "technician" },
  { label: "Ordering", value: "ordering" },
  { label: "Sales", value: "sales" },
];

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TeamMemberCard({
  currentProfile,
  isUpdating,
  onRoleChange,
  onToggleActive,
  profile,
}) {
  const isCurrentUser = profile.id === currentProfile?.id;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-zinc-950">
            {displayValue(profile.full_name)}
          </h3>
          <p className="mt-1 truncate text-sm text-zinc-500">
            {displayValue(profile.email)}
          </p>
          {profile.phone && (
            <p className="mt-1 text-sm text-zinc-500">{profile.phone}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getProfileRoleClassName(
              profile.role
            )}`}
          >
            {formatProfileRole(profile.role)}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
              profile.is_active
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}
          >
            {profile.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-sm text-zinc-500">Created</dt>
          <dd className="mt-1 font-semibold text-zinc-950">
            {formatDate(profile.created_at)}
          </dd>
        </div>

        <label className="block" htmlFor={`role-${profile.id}`}>
          <span className="text-sm text-zinc-500">Role</span>
          <select
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUpdating}
            id={`role-${profile.id}`}
            onChange={(event) => onRoleChange(profile, event.target.value)}
            value={profile.role ?? "technician"}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="text-sm text-zinc-500">Status</p>
          <button
            className={`mt-1 w-full rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
              profile.is_active
                ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                : "bg-zinc-950 text-white hover:bg-zinc-800"
            }`}
            disabled={isUpdating}
            onClick={() => onToggleActive(profile)}
            type="button"
          >
            {isUpdating
              ? "Saving..."
              : profile.is_active
                ? "Deactivate"
                : "Activate"}
          </button>
          {isCurrentUser && (
            <p className="mt-2 text-xs text-zinc-500">
              You cannot change your own role or active status.
            </p>
          )}
        </div>
      </dl>
    </article>
  );
}

function SettingsPage({ currentProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingProfileId, setUpdatingProfileId] = useState(null);
  const canManageUsers = hasPermission(currentProfile?.role, "user:manage");

  useEffect(() => {
    let isMounted = true;

    async function fetchProfiles() {
      if (!canManageUsers) {
        setProfiles([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, phone, is_active, created_at")
          .order("created_at", { ascending: false });

        if (!isMounted) {
          return;
        }

        if (error) {
          setProfiles([]);
          setErrorMessage(error.message);
          return;
        }

        setProfiles(data ?? []);
      } catch (error) {
        if (isMounted) {
          setProfiles([]);
          setErrorMessage(error.message ?? "Unable to load team members.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchProfiles();

    return () => {
      isMounted = false;
    };
  }, [canManageUsers]);

  function updateProfileInState(updatedProfile) {
    setProfiles((currentProfiles) =>
      currentProfiles.map((profile) =>
        profile.id === updatedProfile.id ? updatedProfile : profile
      )
    );
  }

  async function handleRoleChange(profile, nextRole) {
    if (profile.id === currentProfile?.id) {
      setErrorMessage("You cannot change your own role.");
      return;
    }

    setUpdatingProfileId(profile.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ role: nextRole })
        .eq("id", profile.id)
        .select("id, full_name, email, role, phone, is_active, created_at")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      updateProfileInState(data);
      setSuccessMessage("User role updated.");
    } catch (error) {
      setErrorMessage(error.message ?? "Unable to update user role.");
    } finally {
      setUpdatingProfileId(null);
    }
  }

  async function handleToggleActive(profile) {
    if (profile.id === currentProfile?.id) {
      setErrorMessage("You cannot deactivate yourself.");
      return;
    }

    setUpdatingProfileId(profile.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_active: !profile.is_active })
        .eq("id", profile.id)
        .select("id, full_name, email, role, phone, is_active, created_at")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      updateProfileInState(data);
      setSuccessMessage(
        data.is_active ? "User activated." : "User deactivated."
      );
    } catch (error) {
      setErrorMessage(error.message ?? "Unable to update user status.");
    } finally {
      setUpdatingProfileId(null);
    }
  }

  if (!canManageUsers) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-950">Team Management</h2>
        <p className="mt-2 text-zinc-600">
          You do not have permission to manage users.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-zinc-950">Team Management</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Approve users, update roles, and manage team access.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      {isLoading && (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-700">Loading team members...</p>
        </div>
      )}

      {!isLoading && profiles.length === 0 && !errorMessage && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No team profiles found.
        </div>
      )}

      {!isLoading && profiles.length > 0 && (
        <div className="grid gap-4">
          {profiles.map((profile) => (
            <TeamMemberCard
              currentProfile={currentProfile}
              isUpdating={updatingProfileId === profile.id}
              key={profile.id}
              onRoleChange={handleRoleChange}
              onToggleActive={handleToggleActive}
              profile={profile}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default SettingsPage;
