import { formatUserFirstName } from "../lib/userDisplay";

function getGreetingName({ currentProfile, userEmail, userMetadata }) {
  const profileForDisplay = {
    ...(currentProfile ?? {}),
    email: currentProfile?.email ?? userEmail,
    user_metadata: userMetadata,
  };

  return formatUserFirstName(profileForDisplay);
}

function AuthHeader({
  currentProfile,
  isLoggingOut = false,
  isProfileLoading = false,
  onLogout,
  profileError = "",
  userEmail,
  userMetadata = null,
}) {
  const greetingName = isProfileLoading
    ? "Loading..."
    : getGreetingName({ currentProfile, userEmail, userMetadata });

  return (
    <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
      <div className="min-w-0 text-right" title={userEmail || undefined}>
        <p className="max-w-36 truncate text-sm font-black text-slate-900 sm:max-w-48 sm:text-base">
          Hello, {greetingName}
        </p>
        {profileError && !isProfileLoading && (
          <p className="mt-0.5 max-w-40 truncate text-xs font-medium text-amber-700 sm:max-w-56">
            {profileError}
          </p>
        )}
      </div>

      <button
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
