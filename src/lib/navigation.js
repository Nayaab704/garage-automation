import { MAIN_NAV_ITEMS } from "../config/appConfig";
import { hasPermission } from "./permissions";

export function getVisibleMainNavItems(role) {
  return MAIN_NAV_ITEMS.filter((item) => {
    if (item.page === "My Work") {
      return role === "technician";
    }

    if (!item.permission) {
      return true;
    }

    return hasPermission(role, item.permission);
  });
}
