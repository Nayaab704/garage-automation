export const APP_NAME = "Makkah Autosales";
export const APP_SHORT_NAME = "MA";

export const BRAND_COLORS = {
  accent: "#2563EB",
  accentDark: "#0F172A",
  accentSoft: "#EFF6FF",
  ink: "#0F172A",
  inkSoft: "rgba(15, 23, 42, 0.12)",
  surface: "#F8FAFC",
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
    icon: "checklist",
    label: "Warranty Register",
    page: "Warranties",
    permission: "warranty:manage",
  },
  {
    icon: "file",
    label: "Reports",
    page: "Reports",
    permission: "reports:view",
  },
  {
    icon: "users",
    label: "Team",
    page: "Team",
    permission: "user:manage",
  },
];

export const MAIN_NAV_PAGES = MAIN_NAV_ITEMS.map((item) => item.page);
