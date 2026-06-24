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
}) {
  const visibleMobileItems = getVisibleMainNavItems(currentProfile?.role);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          {showBackButton && (
            <button
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={onBack}
              type="button"
            >
              <AppIcon className="rotate-180" name="chevron-right" size={17} />
              <span>Back</span>
            </button>
          )}

          <div className="min-w-0">
            <BrandLogo
              className="max-w-[190px] sm:max-w-none lg:hidden"
              size="compact"
            />
            {showTitle && (
              <h1 className="truncate text-lg font-black text-slate-950 sm:text-xl">
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
                  ? "bg-emerald-600 text-white shadow-sm"
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
