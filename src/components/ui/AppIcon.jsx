const iconPaths = {
  "body-shop": (
    <>
      <path d="M5 15v-3.2l1.4-3.7A3 3 0 0 1 9.2 6h5.6a3 3 0 0 1 2.8 2.1l1.4 3.7V15" />
      <path d="M7.2 11h9.6" />
      <path d="M5 15h14" />
      <path d="M7 15v2.2" />
      <path d="M17 15v2.2" />
      <path d="M8.2 17h.01" />
      <path d="M15.8 17h.01" />
    </>
  ),
  box: (
    <>
      <path d="M4.5 8.2 12 4l7.5 4.2-7.5 4.2-7.5-4.2Z" />
      <path d="M4.5 8.2v8.4L12 20l7.5-3.4V8.2" />
      <path d="M12 12.4V20" />
      <path d="m8.2 6.1 7.5 4.2" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v12H4V8Z" />
      <circle cx="12" cy="14" r="3.2" />
    </>
  ),
  car: (
    <>
      <path d="M5 15h14" />
      <path d="M6.5 15l1.1-4.2A3 3 0 0 1 10.5 8h3a3 3 0 0 1 2.9 2.2L17.5 15" />
      <circle cx="8" cy="17" r="1.5" />
      <circle cx="16" cy="17" r="1.5" />
    </>
  ),
  check: (
    <>
      <path d="M5 13l4 4L19 7" />
    </>
  ),
  checklist: (
    <>
      <rect height="16" rx="2" width="14" x="5" y="4" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
      <path d="M7 8h.01" />
      <path d="M7 12h.01" />
      <path d="M7 16h.01" />
    </>
  ),
  "chevron-down": (
    <>
      <path d="M6 9l6 6 6-6" />
    </>
  ),
  "chevron-right": (
    <>
      <path d="M9 6l6 6-6 6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  dollar: (
    <>
      <path d="M12 3v18" />
      <path d="M17 7.5A4 4 0 0 0 12 6c-2.4 0-4 1.2-4 3s1.6 2.5 4 3 4 1.2 4 3-1.6 3-4 3a5 5 0 0 1-5-2" />
    </>
  ),
  file: (
    <>
      <path d="M7 3h7l5 5v13H7V3Z" />
      <path d="M14 3v5h5" />
      <path d="M9.5 13h5" />
      <path d="M9.5 17h7" />
    </>
  ),
  lightning: (
    <>
      <path d="M13 3 5.8 13h5.6L10.6 21 18.2 10.2h-5.6L13 3Z" />
    </>
  ),
  "paint-spray": (
    <>
      <path d="M4 8.5h9.5a2.5 2.5 0 0 1 0 5H10" />
      <path d="M4 6.5h9v4H4v-4Z" />
      <path d="M8 10.5V16a2 2 0 0 0 2 2h1.5" />
      <path d="M11 10.5 13.5 18" />
      <path d="M17.5 5.5 20 4.2" />
      <path d="M18.5 8.8H22" />
      <path d="M17.5 12.3 20 14" />
    </>
  ),
  paint: (
    <>
      <path d="M4 8.5h9.5a2.5 2.5 0 0 1 0 5H10" />
      <path d="M4 6.5h9v4H4v-4Z" />
      <path d="M8 10.5V16a2 2 0 0 0 2 2h1.5" />
      <path d="M11 10.5 13.5 18" />
      <path d="M17.5 5.5 20 4.2" />
      <path d="M18.5 8.8H22" />
      <path d="M17.5 12.3 20 14" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 6v5h-5" />
      <path d="M4 18v-5h5" />
      <path d="M18 11a6.5 6.5 0 0 0-11-4.5L4 9" />
      <path d="M6 13a6.5 6.5 0 0 0 11 4.5L20 15" />
    </>
  ),
  seat: (
    <>
      <path d="M8 4.5h5.5A2.5 2.5 0 0 1 16 7v5.5H9a3 3 0 0 1-3-3v-3A2 2 0 0 1 8 4.5Z" />
      <path d="M6 12.5h11.5A2.5 2.5 0 0 1 20 15v2H8a2 2 0 0 1-2-2v-2.5Z" />
      <path d="M8 17v3" />
      <path d="M18 17v3" />
    </>
  ),
  toolbox: (
    <>
      <path d="M8.5 7V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8V7" />
      <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <path d="M4 12h16" />
      <path d="M10 12v2h4v-2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 15.2A4.5 4.5 0 0 1 21 19" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3l10 18H2L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3.5v5.8" />
      <path d="M12 14.7v5.8" />
      <path d="M3.5 12h5.8" />
      <path d="M14.7 12h5.8" />
      <path d="m6 6 4.1 4.1" />
      <path d="m13.9 13.9 4.1 4.1" />
    </>
  ),
  windshield: (
    <>
      <path d="M5 17 8 6h8l3 11H5Z" />
      <path d="M8.5 14.5h7" />
      <path d="M9.5 6 8 17" />
      <path d="M14.5 6 16 17" />
    </>
  ),
  wrench: (
    <>
      <path d="M15.8 4.2a4.3 4.3 0 0 0 4 5.9L10 19.9a2.2 2.2 0 0 1-3.1-3.1l9.8-9.8a4.3 4.3 0 0 1-.9-2.8Z" />
      <path d="M7.5 16.5 9.5 18.5" />
      <path d="m16.7 4.1 3.2 3.2" />
    </>
  ),
};

const aliases = {
  alert: "warning",
  body: "body-shop",
  camera: "camera",
  document: "file",
  electrical: "lightning",
  glass: "windshield",
  interior: "seat",
  labor: "clock",
  mechanical: "wrench",
  money: "dollar",
  parts: "box",
  "paint-spray": "paint-spray",
  photo: "camera",
  spray: "paint-spray",
  status: "refresh",
  "third-party": "users",
  third_party: "users",
  tires: "wheel",
  other: "toolbox",
  vehicle: "car",
};

function normalizeIconName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function AppIcon({ className = "", name = "check", size = 20 }) {
  const normalizedName = normalizeIconName(name);
  const iconName = aliases[normalizedName] ?? normalizedName;
  const icon = iconPaths[iconName] ?? iconPaths.check;

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {icon}
    </svg>
  );
}

export default AppIcon;
