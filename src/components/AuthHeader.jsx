function AuthHeader({ isLoggingOut = false, onLogout, userEmail }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right md:block">
        <p className="text-xs font-medium text-zinc-500">Signed in as</p>
        <p className="max-w-56 truncate text-sm font-semibold text-zinc-800">
          {userEmail ?? "Unknown user"}
        </p>
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
