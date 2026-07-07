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

const profileSelectFields =
  "id, auth_user_id, full_name, email, role, phone, hourly_rate, is_active, created_at";

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

function numberToInputValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function TeamMemberCard({
  currentProfile,
  isUpdating,
  onHourlyRateSave,
  onRoleChange,
  onToggleActive,
  profile,
}) {
  const [hourlyRateValue, setHourlyRateValue] = useState(() =>
    numberToInputValue(profile.hourly_rate)
  );
  const isCurrentUser = profile.id === currentProfile?.id;
  const hasHourlyRateChanged =
    hourlyRateValue !== numberToInputValue(profile.hourly_rate);

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

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <label className="block" htmlFor={`hourly-rate-${profile.id}`}>
            <span className="text-sm text-zinc-500">Hourly Rate</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUpdating}
              id={`hourly-rate-${profile.id}`}
              min="0"
              onChange={(event) => setHourlyRateValue(event.target.value)}
              step="0.01"
              type="number"
              value={hourlyRateValue}
            />
          </label>
          <button
            className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUpdating || !hasHourlyRateChanged}
            onClick={() => onHourlyRateSave(profile, hourlyRateValue)}
            type="button"
          >
            {isUpdating ? "Saving..." : "Save Rate"}
          </button>
        </div>

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

function ProfileSettingsCard({ currentProfile, onCurrentProfileUpdated }) {
  const [fullName, setFullName] = useState(currentProfile?.full_name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const savedFullName = currentProfile?.full_name ?? "";
  const hasChanged = fullName.trim() !== savedFullName.trim();

  async function handleSubmit(event) {
    event.preventDefault();

    const nextFullName = fullName.trim();

    if (!currentProfile?.id) {
      setErrorMessage("Profile is still loading. Please try again.");
      return;
    }

    if (!nextFullName) {
      setErrorMessage("Full name is required.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ full_name: nextFullName })
        .eq("id", currentProfile.id)
        .select(profileSelectFields)
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: nextFullName,
          name: nextFullName,
        },
      });

      if (metadataError) {
        console.error("Could not update auth display name:", metadataError);
      }

      onCurrentProfileUpdated?.(data);
      setFullName(nextFullName);
      setSuccessMessage("Full name updated.");
    } catch (error) {
      setErrorMessage(error.message ?? "Unable to update full name.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">My Profile</h2>
          <p className="mt-2 text-sm text-zinc-600">
            This name appears in the app header and team activity.
          </p>
        </div>

        {currentProfile?.role && (
          <span
            className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getProfileRoleClassName(
              currentProfile.role
            )}`}
          >
            {formatProfileRole(currentProfile.role)}
          </span>
        )}
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
        <label className="block" htmlFor="profile-full-name">
          <span className="text-sm font-semibold text-zinc-700">Full Name</span>
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || !currentProfile?.id}
            id="profile-full-name"
            onChange={(event) => setFullName(event.target.value)}
            required
            type="text"
            value={fullName}
          />
          {currentProfile?.email && (
            <span className="mt-1 block truncate text-xs text-zinc-500">
              {currentProfile.email}
            </span>
          )}
        </label>

        <div className="flex items-end">
          <button
            className="w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
            disabled={isSaving || !hasChanged}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save Name"}
          </button>
        </div>
      </form>

      {errorMessage && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}
    </section>
  );
}

function SettingsPage({ currentProfile, onCurrentProfileUpdated }) {
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
          .select(profileSelectFields)
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
        .select(profileSelectFields)
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
        .select(profileSelectFields)
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

  async function handleHourlyRateSave(profile, hourlyRateValue) {
    const hourlyRate = Number(hourlyRateValue || 0);

    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      setErrorMessage("Hourly rate must be 0 or greater.");
      return;
    }

    setUpdatingProfileId(profile.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ hourly_rate: hourlyRate })
        .eq("id", profile.id)
        .select(profileSelectFields)
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      updateProfileInState(data);
      setSuccessMessage("Hourly rate updated.");
    } catch (error) {
      setErrorMessage(error.message ?? "Unable to update hourly rate.");
    } finally {
      setUpdatingProfileId(null);
    }
  }

  if (!canManageUsers) {
    return (
      <section className="space-y-5">
        <ProfileSettingsCard
          currentProfile={currentProfile}
          key={currentProfile?.id ?? "current-profile"}
          onCurrentProfileUpdated={onCurrentProfileUpdated}
        />

        <section className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-zinc-950">Team Management</h2>
          <p className="mt-2 text-zinc-600">
            You do not have permission to manage users.
          </p>
        </section>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <ProfileSettingsCard
        currentProfile={currentProfile}
        key={currentProfile?.id ?? "current-profile"}
        onCurrentProfileUpdated={onCurrentProfileUpdated}
      />

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
              onHourlyRateSave={handleHourlyRateSave}
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
