import BrandLogo from "./branding/BrandLogo";
import AppIcon from "./ui/AppIcon";
import { getVisibleMainNavItems } from "../lib/navigation";

function Sidebar({ activePage = "Vehicles", currentProfile, onPageChange }) {
  const visibleSidebarItems = getVisibleMainNavItems(currentProfile?.role);

  return (
    <aside className="hidden border-r border-slate-200 bg-white/95 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col">
      <div className="flex h-16 items-center border-b border-slate-200 px-5">
        <BrandLogo size="compact" />
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-4">
        {visibleSidebarItems.map((item) => {
          const isActive = item.page === activePage;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-bold transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
              key={item.page}
              onClick={() => onPageChange(item.page)}
              type="button"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  isActive ? "bg-white/15" : "bg-white"
                }`}
              >
                <AppIcon name={item.icon} size={18} />
              </span>
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
