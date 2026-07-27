const ALL_PERMISSIONS = [
  "vehicle:create",
  "vehicle:edit",
  "vehicle:delete",
  "vehicle:change_status",
  "repair:manage",
  "repair_process:manage",
  "part_request:manage",
  "purchase_order:manage",
  "labor:manage",
  "extra_cost:manage",
  "photo:manage",
  "sale:manage",
  "warranty:manage",
  "reports:view",
  "dashboard:view",
  "user:manage",
];
const MANAGER_PERMISSIONS = ALL_PERMISSIONS.filter(
  (permission) => permission !== "vehicle:delete"
);

export const ROLE_PERMISSIONS = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  technician: [
    "vehicle:edit",
    "repair:manage",
    "repair_process:manage",
    "labor:manage",
    "photo:manage",
    "purchase_order:manage",
    "vehicle:change_status",
  ],
  ordering: [
    "dashboard:view",
    "part_request:manage",
    "purchase_order:manage",
    "photo:manage",
  ],
  sales: ["dashboard:view", "sale:manage", "warranty:manage", "photo:manage"],
};

export function hasPermission(role, permission) {
  if (!role || !permission) {
    return false;
  }

  const permissions = ROLE_PERMISSIONS[role];

  if (!permissions) {
    return false;
  }

  return permissions.includes(permission);
}

export function isAdminOrManagerRole(role) {
  return ["owner", "admin", "manager"].includes(role);
}
