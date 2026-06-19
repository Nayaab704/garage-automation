function AuthHeader({
  currentProfile,
  isLoggingOut = false,
  isProfileLoading = false,
  onLogout,
  profileError = "",
  userEmail,
}) {
  const displayName = currentProfile?.full_name || userEmail || "User";
  const initials = String(displayName)
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white shadow-sm">
        {initials || "MA"}
      </div>

      <div className="hidden text-right md:block">
        <p className="max-w-48 truncate text-sm font-bold text-slate-900">
          {userEmail ?? "Unknown user"}
        </p>
        {isProfileLoading && (
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Loading profile...
          </p>
        )}
        {profileError && !isProfileLoading && (
          <p className="mt-0.5 max-w-48 truncate text-xs font-medium text-amber-700">
            {profileError}
          </p>
        )}
      </div>

      <button
        className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
