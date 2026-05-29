export const finalCheckTemplates = [
  {
    check_key: "test_drive_completed",
    label: "Test drive completed",
    required_role: "technician",
  },
  {
    check_key: "no_warning_lights",
    label: "No warning lights",
    required_role: "technician",
  },
  {
    check_key: "repairs_completed",
    label: "Repairs completed",
    required_role: "technician",
  },
  {
    check_key: "parts_installed",
    label: "Parts installed",
    required_role: "technician",
  },
  {
    check_key: "photos_uploaded",
    label: "Photos uploaded",
    required_role: "technician",
  },
  {
    check_key: "costs_reviewed",
    label: "Costs reviewed",
    required_role: "admin",
  },
  {
    check_key: "photos_reviewed",
    label: "Photos reviewed",
    required_role: "admin",
  },
  {
    check_key: "title_status_reviewed",
    label: "Title status reviewed",
    required_role: "admin",
  },
  {
    check_key: "sale_price_approved",
    label: "Sale price approved",
    required_role: "admin",
  },
  {
    check_key: "final_approval",
    label: "Final approval",
    required_role: "admin",
  },
];

export function areFinalChecksComplete(finalChecks = []) {
  const checksByKey = new Map(
    finalChecks.map((finalCheck) => [finalCheck.check_key, finalCheck])
  );

  return finalCheckTemplates.every(
    (template) => checksByKey.get(template.check_key)?.is_checked === true
  );
}
