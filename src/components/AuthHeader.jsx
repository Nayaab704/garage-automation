import {
  formatProfileRole,
  getProfileRoleClassName,
} from "../lib/currentUserProfile";

function AuthHeader({
  currentProfile,
  isLoggingOut = false,
  isProfileLoading = false,
  onLogout,
  profileError = "",
  userEmail,
}) {
  const role = currentProfile?.role;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-medium text-zinc-500">Signed in as</p>
        <p className="max-w-56 truncate text-sm font-semibold text-zinc-800">
          {userEmail ?? "Unknown user"}
        </p>
        <div className="mt-1 flex justify-end">
          {isProfileLoading ? (
            <span className="text-xs font-medium text-zinc-500">
              Loading profile...
            </span>
          ) : profileError ? (
            <span className="max-w-56 truncate text-xs font-medium text-amber-700">
              {profileError}
            </span>
          ) : (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${getProfileRoleClassName(
                role
              )}`}
            >
              {formatProfileRole(role)}
            </span>
          )}
        </div>
      </div>

      <button
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoggingOut}
        onClick={onLogout}
        type="button"
      >
        {isLoggingOut ? "Logging Out..." : "Logout"}
      </button>
    </div>
  );
}

export default AuthHeader;
