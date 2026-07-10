export const APP_NAME = "Makkah Autosales";
export const APP_SHORT_NAME = "MA";

export const BRAND_COLORS = {
  accent: "#007a3d",
  accentDark: "#005f32",
  accentSoft: "rgba(0, 122, 61, 0.16)",
  ink: "#142231",
  inkSoft: "rgba(20, 34, 49, 0.12)",
  surface: "#f8faf8",
};

export const BRAND_TAGLINE = "Garage Operations";

export const MAIN_NAV_ITEMS = [
  {
    icon: "chart-up",
    label: "Dashboard",
    page: "Dashboard",
    permission: "dashboard:view",
  },
  { icon: "checklist", label: "My Work", page: "My Work" },
  {
    icon: "car",
    label: "Intake",
    page: "Intake",
    permission: "vehicle:create",
  },
  { icon: "vehicle", label: "Vehicles", page: "Vehicles" },
  { icon: "wrench", label: "Repairs", page: "Repairs" },
  { icon: "parts", label: "Parts", page: "Parts" },
  {
    icon: "file",
    label: "Purchase Orders",
    page: "Purchase Orders",
    permission: "purchase_order:manage",
  },
  { icon: "users", label: "Vendors", page: "Vendors" },
  {
    icon: "users",
    label: "Team",
    page: "Team",
    permission: "user:manage",
  },
];

export const MAIN_NAV_PAGES = MAIN_NAV_ITEMS.map((item) => item.page);
