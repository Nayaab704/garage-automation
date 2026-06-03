import { APP_NAME, APP_SHORT_NAME } from "../config/appConfig";
import { hasPermission } from "../lib/permissions";

const sidebarItems = [
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

function getVisibleSidebarItems(role) {
  return sidebarItems.filter((item) => {
    if (item === "Dashboard") {
      return hasPermission(role, "dashboard:view");
    }

    if (item === "Purchase Orders") {
      return hasPermission(role, "purchase_order:manage");
    }

    return true;
  });
}

function Sidebar({ activePage = "Vehicles", currentProfile, onPageChange }) {
  const visibleSidebarItems = getVisibleSidebarItems(currentProfile?.role);

  return (
    <aside className="hidden border-r border-zinc-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col">
      <div className="flex h-16 items-center border-b border-zinc-200 px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white">
            {APP_SHORT_NAME}
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-950">{APP_NAME}</p>
            <p className="text-xs text-zinc-500">Garage Operations</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {visibleSidebarItems.map((item) => {
          const isActive = item === activePage;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                isActive
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              <span>{item}</span>
              {isActive && (
                <span className="size-1.5 rounded-full bg-white" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-4">
        <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-zinc-950">
            Inventory Workspace
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            Manage vehicle records, repairs, parts, and profitability.
          </p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
