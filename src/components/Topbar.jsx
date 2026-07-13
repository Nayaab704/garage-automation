import AuthHeader from "./AuthHeader";
import BrandLogo from "./branding/BrandLogo";
import AppIcon from "./ui/AppIcon";
import { getVisibleMainNavItems } from "../lib/navigation";

function Topbar({
  activePage = "Vehicles",
  currentProfile,
  isLoggingOut = false,
  isProfileLoading = false,
  onBack,
  onPageChange,
  onLogout,
  profileError = "",
  showBackButton = false,
  showTitle = false,
  title = "Vehicles",
  userEmail,
  userMetadata,
}) {
  const visibleMobileItems = getVisibleMainNavItems(currentProfile?.role);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-14 min-w-0 items-center justify-between gap-2 overflow-hidden px-3 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {showBackButton && (
            <button
              aria-label="Back"
              className="inline-flex min-h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-0 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:min-h-10 sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
              onClick={onBack}
              type="button"
            >
              <AppIcon className="rotate-180" name="chevron-right" size={17} />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}

          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo
              className="sm:hidden"
              mode="icon"
              size="compact"
            />
            <BrandLogo
              className="hidden max-w-[190px] sm:flex sm:max-w-none lg:hidden"
              size="compact"
            />
            {showTitle && (
              <h1 className="hidden truncate text-lg font-black text-slate-950 sm:block sm:text-xl">
                {title}
              </h1>
            )}
          </div>
        </div>

        <AuthHeader
          currentProfile={currentProfile}
          isLoggingOut={isLoggingOut}
          isProfileLoading={isProfileLoading}
          onLogout={onLogout}
          profileError={profileError}
          userEmail={userEmail}
          userMetadata={userMetadata}
        />
      </div>

      <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 px-3 py-2 sm:px-6 lg:hidden">
        {visibleMobileItems.map((item) => {
          const isActive = item.page === activePage;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
              key={item.page}
              onClick={() => onPageChange(item.page)}
              type="button"
            >
              <AppIcon name={item.icon} size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

export default Topbar;
