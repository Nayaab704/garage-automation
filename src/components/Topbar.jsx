import AuthHeader from "./AuthHeader";
import { hasPermission } from "../lib/permissions";

const mobileItems = [
  "Dashboard",
  "Intake",
  "Vehicles",
  "Repairs",
  "Parts",
  "Purchase Orders",
  "Vendors",
  "Analytics",
  "Settings",
];

function getVisibleMobileItems(role) {
  return mobileItems.filter((item) => {
    if (item === "Dashboard") {
      return hasPermission(role, "dashboard:view");
    }

    if (item === "Purchase Orders") {
      return hasPermission(role, "purchase_order:manage");
    }

    return true;
  });
}

function Topbar({
  activePage = "Vehicles",
  currentProfile,
  isLoggingOut = false,
  isProfileLoading = false,
  onPageChange,
  onLogout,
  profileError = "",
  title = "Vehicles",
  description = "Manage garage inventory and operations.",
  userEmail,
}) {
  const visibleMobileItems = getVisibleMobileItems(currentProfile?.role);

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Garage Management
          </p>
          <h1 className="text-xl font-bold text-zinc-950 sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 hidden text-sm text-zinc-500 sm:block">
            {description}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 md:block">
            Production View
          </div>
          <AuthHeader
            currentProfile={currentProfile}
            isLoggingOut={isLoggingOut}
            isProfileLoading={isProfileLoading}
            onLogout={onLogout}
            profileError={profileError}
            userEmail={userEmail}
          />
          <div className="flex size-9 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white lg:hidden">
            GM
          </div>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-t border-zinc-100 px-4 py-2 sm:px-6 lg:hidden">
        {visibleMobileItems.map((item) => {
          const isActive = item === activePage;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

export default Topbar;
