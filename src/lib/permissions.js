const ALL_PERMISSIONS = [
  "vehicle:create",
  "vehicle:edit",
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
  "dashboard:view",
];

export const ROLE_PERMISSIONS = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  technician: [
    "repair:manage",
    "repair_process:manage",
    "labor:manage",
    "photo:manage",
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
