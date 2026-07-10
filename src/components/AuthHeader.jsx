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
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-3">
      <div className="min-w-0 text-right" title={userEmail || undefined}>
        <p className="max-w-[11rem] truncate text-xs font-black text-slate-900 sm:max-w-48 sm:text-base">
          Hello, {greetingName}
        </p>
        {profileError && !isProfileLoading && (
          <p className="mt-0.5 max-w-20 truncate text-[11px] font-medium text-amber-700 sm:max-w-56 sm:text-xs">
            {profileError}
          </p>
        )}
      </div>

      <button
        className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-sm"
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
