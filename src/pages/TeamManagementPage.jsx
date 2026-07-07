import { useEffect, useMemo, useState } from "react";
import {
  formatProfileRole,
  getProfileRoleClassName,
} from "../lib/currentUserProfile";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";

const profileSelectFields =
  "id, auth_user_id, full_name, email, role, phone, hourly_rate, is_active, created_at";

const roleOptions = [
  { label: "Admin", value: "admin" },
  { label: "Technician", value: "technician" },
];

const tabOptions = [
  {
    emptySubtext: "New signups waiting for approval will appear here.",
    emptyTitle: "No pending users.",
    label: "Pending",
    value: "pending",
  },
  {
    emptySubtext: "Approved users will appear here.",
    emptyTitle: "No active users.",
    label: "Active",
    value: "active",
  },
  {
    emptySubtext: "Deactivated users will appear here.",
    emptyTitle: "No inactive users.",
    label: "Inactive",
    value: "inactive",
  },
  {
    emptySubtext: "Team profiles will appear here after users sign up.",
    emptyTitle: "No team profiles found.",
    label: "All",
    value: "all",
  },
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

function formatSearchValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getProfileName(profile) {
  return profile.full_name || profile.email || "Unnamed user";
}

function getProfileStatus(profile) {
  return profile.is_active ? "Active" : "Pending / Inactive";
}

function getProfileStatusClassName(profile) {
  return profile.is_active
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-amber-50 text-amber-800 ring-amber-200";
}

function getRoleOptions(profile) {
  const currentRole = profile.role;
  const hasCurrentRole = roleOptions.some((option) => option.value === currentRole);

  if (!currentRole || hasCurrentRole) {
    return roleOptions;
  }

  return [
    { label: formatProfileRole(currentRole), value: currentRole },
    ...roleOptions,
  ];
}

function getActionLabel(profile, activeTab) {
  if (profile.is_active) {
    return "Deactivate";
  }

  return activeTab === "inactive" ? "Reactivate" : "Approve";
}

function profileMatchesSearch(profile, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const searchableValues = [
    profile.full_name,
    profile.email,
    profile.role,
    formatProfileRole(profile.role),
    getProfileStatus(profile),
  ];

  return searchableValues.some((value) =>
    formatSearchValue(value).includes(searchTerm)
  );
}

function filterByTab(profile, activeTab) {
  if (activeTab === "active") {
    return profile.is_active === true;
  }

  if (activeTab === "pending" || activeTab === "inactive") {
    return profile.is_active === false;
  }

  return true;
}

function sortProfiles(profiles) {
  return [...profiles].sort((firstProfile, secondProfile) => {
    if (firstProfile.is_active !== secondProfile.is_active) {
      return firstProfile.is_active ? 1 : -1;
    }

    if (firstProfile.is_active && secondProfile.is_active) {
      return getProfileName(firstProfile).localeCompare(
        getProfileName(secondProfile),
        undefined,
        { sensitivity: "base" }
      );
    }

    return (
      new Date(secondProfile.created_at ?? 0).getTime() -
      new Date(firstProfile.created_at ?? 0).getTime()
    );
  });
}

function TeamMemberCard({
  activeTab,
  currentProfile,
  isUpdating,
  onActiveChange,
  onRoleChange,
  profile,
}) {
  const isCurrentUser = profile.id === currentProfile?.id;
  const actionLabel = getActionLabel(profile, activeTab);
  const nextActiveState = !profile.is_active;
  const currentRole = profile.role || "technician";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.55fr)_minmax(190px,0.7fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-slate-950">
            {displayValue(profile.full_name)}
          </h3>
          <p className="mt-1 truncate text-sm font-medium text-slate-500">
            {displayValue(profile.email)}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Joined {formatDate(profile.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${getProfileRoleClassName(
              profile.role
            )}`}
          >
            {formatProfileRole(profile.role)}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${getProfileStatusClassName(
              profile
            )}`}
          >
            {getProfileStatus(profile)}
          </span>
        </div>

        <label className="block" htmlFor={`team-role-${profile.id}`}>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Role
          </span>
          <select
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUpdating || isCurrentUser}
            id={`team-role-${profile.id}`}
            onChange={(event) => onRoleChange(profile, event.target.value)}
            value={currentRole}
          >
            {getRoleOptions(profile).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {isCurrentUser && (
            <span className="mt-1 block text-xs text-slate-500">
              Your own role is protected.
            </span>
          )}
        </label>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-xl px-3 py-2 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none ${
              profile.is_active
                ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
            disabled={isUpdating || (isCurrentUser && !nextActiveState)}
            onClick={() => onActiveChange(profile, nextActiveState)}
            type="button"
          >
            {isUpdating ? "Saving..." : actionLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

function TeamManagementPage({ currentProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
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
          .select(profileSelectFields);

        if (!isMounted) {
          return;
        }

        if (error) {
          setProfiles([]);
          setErrorMessage(error.message);
          return;
        }

        setProfiles(sortProfiles(data ?? []));
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

  const tabCounts = useMemo(() => {
    const inactiveCount = profiles.filter((profile) => !profile.is_active).length;
    const activeCount = profiles.filter((profile) => profile.is_active).length;

    return {
      active: activeCount,
      all: profiles.length,
      inactive: inactiveCount,
      pending: inactiveCount,
    };
  }, [profiles]);

  const visibleProfiles = useMemo(() => {
    const normalizedSearchTerm = formatSearchValue(searchTerm);

    return profiles.filter(
      (profile) =>
        filterByTab(profile, activeTab) &&
        profileMatchesSearch(profile, normalizedSearchTerm)
    );
  }, [activeTab, profiles, searchTerm]);

  function updateProfileInState(updatedProfile) {
    setProfiles((currentProfiles) =>
      sortProfiles(
        currentProfiles.map((profile) =>
          profile.id === updatedProfile.id ? updatedProfile : profile
        )
      )
    );
  }

  async function handleRoleChange(profile, nextRole) {
    if (!nextRole) {
      setErrorMessage("Role is required.");
      return;
    }

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

  async function handleActiveChange(profile, nextIsActive) {
    if (profile.id === currentProfile?.id && nextIsActive === false) {
      setErrorMessage("You cannot deactivate your own account.");
      return;
    }

    const nextRole = profile.role || "technician";

    setUpdatingProfileId(profile.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_active: nextIsActive, role: nextRole })
        .eq("id", profile.id)
        .select(profileSelectFields)
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      updateProfileInState(data);
      setSuccessMessage(
        nextIsActive ? "User approved." : "User deactivated."
      );
    } catch (error) {
      setErrorMessage(error.message ?? "Unable to update user status.");
    } finally {
      setUpdatingProfileId(null);
    }
  }

  if (!canManageUsers) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">Team Management</h2>
        <p className="mt-2 text-sm text-slate-600">
          You do not have permission to manage users.
        </p>
      </section>
    );
  }

  const activeTabOption =
    tabOptions.find((tabOption) => tabOption.value === activeTab) ??
    tabOptions[0];

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Team Management
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review pending signups, approve access, manage roles, and
              deactivate accounts when needed.
            </p>
          </div>

          <label className="block w-full lg:w-80" htmlFor="team-search">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Search
            </span>
            <input
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              id="team-search"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name, email, or role"
              type="search"
              value={searchTerm}
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {tabOptions.map((tabOption) => {
            const isSelected = activeTab === tabOption.value;

            return (
              <button
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                key={tabOption.value}
                onClick={() => setActiveTab(tabOption.value)}
                type="button"
              >
                {tabOption.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-600"
                  }`}
                >
                  {tabCounts[tabOption.value]}
                </span>
              </button>
            );
          })}
        </div>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-slate-700">Loading team members...</p>
        </div>
      )}

      {!isLoading && visibleProfiles.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="font-black text-slate-700">
            {searchTerm.trim()
              ? "No matching users found."
              : activeTabOption.emptyTitle}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {searchTerm.trim()
              ? "Try searching by name, email, or role."
              : activeTabOption.emptySubtext}
          </p>
        </div>
      )}

      {!isLoading && visibleProfiles.length > 0 && (
        <div className="grid gap-3">
          {visibleProfiles.map((profile) => (
            <TeamMemberCard
              activeTab={activeTab}
              currentProfile={currentProfile}
              isUpdating={updatingProfileId === profile.id}
              key={profile.id}
              onActiveChange={handleActiveChange}
              onRoleChange={handleRoleChange}
              profile={profile}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default TeamManagementPage;
