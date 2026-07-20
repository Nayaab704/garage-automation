export const VENDOR_TYPE_OPTIONS = [
  { value: "parts", label: "Parts Supplier" },
  { value: "service", label: "Third-Party Repair" },
  { value: "other", label: "Both / General" },
  { value: "auction", label: "Auction / Source" },
];

export const VENDOR_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  ...VENDOR_TYPE_OPTIONS,
];

export const vendorTypeLabels = Object.fromEntries(
  VENDOR_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

const auctionVendorTypes = new Set(["auction", "auction_source", "source"]);
const generalVendorTypes = new Set([
  "",
  "both",
  "both_general",
  "general",
  "general_both",
  "other",
]);
const partsSupplierVendorTypes = new Set([
  "part",
  "part_supplier",
  "parts",
  "parts_supplier",
  "supplier",
]);
const thirdPartyRepairVendorTypes = new Set([
  "repair",
  "repair_vendor",
  "service",
  "service_repair_vendor",
  "service_vendor",
  "services",
  "third_party",
  "third_party_repair",
]);

export function normalizeVendorType(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getVendorTypeLabel(vendorType) {
  const normalizedType = normalizeVendorType(vendorType);

  if (partsSupplierVendorTypes.has(normalizedType)) {
    return "Parts Supplier";
  }

  if (thirdPartyRepairVendorTypes.has(normalizedType)) {
    return "Third-Party Repair";
  }

  if (generalVendorTypes.has(normalizedType)) {
    return "Both / General";
  }

  if (auctionVendorTypes.has(normalizedType)) {
    return "Auction / Source";
  }

  return vendorTypeLabels[normalizedType] ?? String(vendorType ?? "Both / General");
}

export function isAuctionVendorType(vendorType) {
  return auctionVendorTypes.has(normalizeVendorType(vendorType));
}

export function isGeneralVendor(vendor) {
  return generalVendorTypes.has(normalizeVendorType(vendor?.vendor_type));
}

export function isPartsSupplierVendorType(vendorType) {
  return partsSupplierVendorTypes.has(normalizeVendorType(vendorType));
}

export function isPartsSupplierVendor(vendor) {
  const vendorType = normalizeVendorType(vendor?.vendor_type);

  return partsSupplierVendorTypes.has(vendorType) || isGeneralVendor(vendor);
}

export function isThirdPartyRepairVendorType(vendorType) {
  return thirdPartyRepairVendorTypes.has(normalizeVendorType(vendorType));
}

export function isThirdPartyRepairVendor(vendor) {
  const vendorType = normalizeVendorType(vendor?.vendor_type);

  return thirdPartyRepairVendorTypes.has(vendorType) || isGeneralVendor(vendor);
}

export function filterPartsSupplierVendors(vendors = []) {
  return vendors.filter(isPartsSupplierVendor);
}

export function isPartsSupplierVendorId(vendorId, vendors = []) {
  const normalizedVendorId = String(vendorId ?? "");

  if (!normalizedVendorId) {
    return true;
  }

  const vendor = vendors.find(
    (vendorRecord) => String(vendorRecord?.id ?? "") === normalizedVendorId
  );

  return !vendor || isPartsSupplierVendor(vendor);
}

export function filterPartsSupplierVendorRecords(
  records = [],
  vendors = [],
  getVendorId = (record) => record?.vendor_id
) {
  return records.filter((record) =>
    isPartsSupplierVendorId(getVendorId(record), vendors)
  );
}

export function filterThirdPartyRepairVendors(vendors = []) {
  return vendors.filter(isThirdPartyRepairVendor);
}
