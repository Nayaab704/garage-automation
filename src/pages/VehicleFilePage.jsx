import { useEffect, useMemo, useState } from "react";
import AppIcon from "../components/ui/AppIcon";
import { buttonClassNames } from "../components/ui/uiStyles";
import VehicleColorLabel from "../components/VehicleColorLabel";
import VehiclePrebookingBadge from "../components/VehiclePrebookingBadge";
import VehicleSaleSummary from "../components/VehicleSaleSummary";
import VehicleStatusBadge from "../components/VehicleStatusBadge";
import SaleWarrantySection from "../components/vehicle-detail/SaleWarrantySection";
import SellVehicleForm from "../components/vehicle-detail/SellVehicleForm";
import { logVehicleActivity } from "../lib/activityLogger";
import { getLaborLogCost, formatHourlyRate } from "../lib/laborCost";
import { hasPermission, isAdminOrManagerRole } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import { isThirdPartyRepairActive } from "../lib/thirdPartyRepairWorkflow";
import { formatUserFirstName } from "../lib/userDisplay";
import { getVehiclePrimaryPhoto } from "../lib/vehicleDisplayPhoto";
import { activePrebookingBadgeColumns } from "../lib/vehiclePrebookings";
import { isReadyForSaleStatus } from "../lib/vehicleStatus";
import { getWorkOrderStatusLabel } from "../lib/workOrderStatus";
import useActiveTabScroll from "../hooks/useActiveTabScroll";

const tabs = [
  { key: "work_parts", label: "Work & Parts" },
  { key: "financial", label: "Financial" },
  { key: "activity", label: "Activity" },
  { key: "documents", label: "Documents" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

const vehicleDocumentColumns =
  "id, vehicle_id, repair_job_id, third_party_repair_id, purchase_order_id, document_type, file_url, file_path, file_name, file_mime_type, file_size_bytes, notes, uploaded_by, created_at";

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function displayValue(value, fallback = "Not available") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

function formatNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "0";
  }

  return numberFormatter.format(numberValue);
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLabel(value, fallback = "Not available") {
  if (value === "in_house") {
    return "In-House";
  }

  const label = String(value ?? "")
    .trim()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return label || fallback;
}

function getVehicleTitle(vehicle) {
  return [vehicle?.year, vehicle?.make, vehicle?.model]
    .filter(Boolean)
    .join(" ") || "Vehicle";
}

function getVehicleReportTitle(vehicle) {
  return [vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.trim]
    .filter(Boolean)
    .join(" ") || "Vehicle";
}

function getVinEnding(vin) {
  const cleanVin = String(vin ?? "").trim().replace(/\s+/g, "");

  if (!cleanVin) {
    return "";
  }

  if (cleanVin.length <= 4) {
    return `VIN ${cleanVin}`;
  }

  return `VIN ending ${cleanVin.slice(-4)}`;
}

function getRecordById(records, id) {
  return records.find((record) => record?.id === id) ?? null;
}

function getProfileName(profiles, profileId) {
  const profile = getRecordById(profiles, profileId);
  return profile ? formatUserFirstName(profile) : profileId ? "Removed user" : "";
}

function getVendorName(vendors, vendorId) {
  const vendor = getRecordById(vendors, vendorId);
  return vendor?.name ?? vendor?.vendor_name ?? vendor?.company_name ?? "";
}

function getPartName(partRequest) {
  return (
    partRequest?.part_name ??
    partRequest?.name ??
    partRequest?.part ??
    "Part request"
  );
}

function getPartItemTotal(item) {
  if (!item) {
    return null;
  }

  const subtotal = numberOrZero(item.quantity) * numberOrZero(item.unit_cost);
  const additions = numberOrZero(item.shipping_cost) + numberOrZero(item.tax);
  const returns =
    numberOrZero(item.returned_amount) +
    numberOrZero(item.returned_shipping_amount);

  return Math.max(0, subtotal + additions - returns);
}

function hasDisplayValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function numberOrNull(value) {
  if (!hasDisplayValue(value)) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getPartVendorName(vendors, partRequest, purchaseOrderItem, purchaseOrder) {
  return (
    getVendorName(vendors, purchaseOrderItem?.vendor_id) ||
    getVendorName(vendors, purchaseOrderItem?.purchase_order_vendor_id) ||
    getVendorName(vendors, purchaseOrder?.vendor_id) ||
    getVendorName(vendors, partRequest?.selected_vendor_id) ||
    "No vendor"
  );
}

function getPartCurrentStatus(partRequest, purchaseOrderItem) {
  if (partRequest?.part_source === "in_house") {
    return "in_house";
  }

  return (
    purchaseOrderItem?.return_status ||
    purchaseOrderItem?.status ||
    partRequest?.status ||
    partRequest?.approval_status ||
    "pending"
  );
}

function getPartQuantity(partRequest, purchaseOrderItem) {
  return (
    numberOrNull(purchaseOrderItem?.quantity) ??
    numberOrNull(partRequest?.quantity)
  );
}

function getPartUnitCost(partRequest, purchaseOrderItem) {
  return (
    numberOrNull(purchaseOrderItem?.unit_cost) ??
    numberOrNull(partRequest?.unit_cost) ??
    numberOrNull(partRequest?.quoted_unit_cost)
  );
}

function getPartDisplayTotal(partRequest, purchaseOrderItem) {
  const itemTotal = getPartItemTotal(purchaseOrderItem);

  if (itemTotal !== null) {
    return itemTotal;
  }

  const quotedTotal = numberOrNull(partRequest?.quoted_total_cost);

  if (quotedTotal !== null) {
    return quotedTotal;
  }

  const quantity = getPartQuantity(partRequest, purchaseOrderItem);
  const unitCost = getPartUnitCost(partRequest, purchaseOrderItem);

  return quantity !== null && unitCost !== null ? quantity * unitCost : null;
}

function isInHousePartRequest(partRequest) {
  return partRequest?.part_source === "in_house";
}

function shouldCountInHousePart(partRequest, purchaseOrderItemIds) {
  if (!isInHousePartRequest(partRequest)) {
    return false;
  }

  if (purchaseOrderItemIds.has(partRequest.id)) {
    return false;
  }

  const status = String(partRequest?.status ?? "").toLowerCase();
  return !["cancelled", "canceled", "returned"].includes(status);
}

function getPurchasedPartsTotal(purchaseOrderItems) {
  return purchaseOrderItems.reduce(
    (total, item) => total + numberOrZero(getPartItemTotal(item)),
    0
  );
}

function getInHousePartsTotal(partRequests, purchaseOrderItems) {
  const purchaseOrderItemPartRequestIds = new Set(
    purchaseOrderItems
      .map((item) => item.part_request_id)
      .filter(Boolean)
  );

  return partRequests.reduce((total, partRequest) => {
    if (!shouldCountInHousePart(partRequest, purchaseOrderItemPartRequestIds)) {
      return total;
    }

    return total + numberOrZero(getPartDisplayTotal(partRequest, null));
  }, 0);
}

function getPartsInvestmentTotal(partRequests, purchaseOrderItems) {
  return (
    getPurchasedPartsTotal(purchaseOrderItems) +
    getInHousePartsTotal(partRequests, purchaseOrderItems)
  );
}

function getPurchaseOrderLabel(purchaseOrder) {
  if (!purchaseOrder) {
    return "";
  }

  return (
    purchaseOrder.po_number ||
    purchaseOrder.purchase_order_number ||
    purchaseOrder.order_number ||
    (purchaseOrder.id ? `PO-${String(purchaseOrder.id).slice(0, 8)}` : "")
  );
}

function getPurchaseOrderDocumentLinks(documents, purchaseOrder) {
  if (!purchaseOrder?.id) {
    return [];
  }

  return documents.filter(
    (documentRecord) =>
      documentRecord.purchase_order_id === purchaseOrder.id &&
      documentRecord.file_url
  );
}

function getDocumentActionLabel(documentRecord) {
  const normalizedType = String(documentRecord?.document_type ?? "").toLowerCase();

  if (normalizedType.includes("invoice") || normalizedType.includes("receipt")) {
    return "View Invoice / Receipt";
  }

  if (normalizedType.includes("purchase") || normalizedType.includes("po")) {
    return "View PO";
  }

  return "View Document";
}

function getThirdPartyTotal(thirdPartyRepair) {
  return (
    numberOrZero(thirdPartyRepair?.repair_cost) +
    numberOrZero(thirdPartyRepair?.transit_cost)
  );
}

function getLaborTotal(laborLog) {
  return getLaborLogCost(laborLog);
}

function getExtraCostAmount(costEntry) {
  return numberOrZero(costEntry?.amount ?? costEntry?.cost);
}

function getStatusClassName(status) {
  const normalizedStatus = String(status ?? "").toLowerCase();

  if (["received", "installed", "completed", "approved"].includes(normalizedStatus)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (["ordered", "in_progress", "partial_received"].includes(normalizedStatus)) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (
    [
      "needs_po",
      "needs to buy",
      "not_ordered",
      "pending",
      "pending_review",
      "requested",
      "waiting",
    ].includes(normalizedStatus)
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (["returned", "cancelled", "rejected", "issue"].includes(normalizedStatus)) {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (["in_house", "in-house"].includes(normalizedStatus)) {
    return "bg-teal-50 text-teal-700 ring-teal-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex h-7 max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusClassName(
        status
      )}`}
    >
      <span className="truncate">{formatLabel(status)}</span>
    </span>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

function MetricCard({ className = "", label, subtitle = "", value }) {
  return (
    <div className={`rounded-xl border border-slate-100 bg-slate-50 p-2.5 ${className}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-base font-black tabular-nums text-slate-950 sm:text-lg">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function VehicleFileHeader({
  activePrebooking,
  canMarkSold = false,
  canViewSaleDetails = false,
  hasActiveThirdPartyRepair,
  onMarkSold,
  onOpenVehicleDetail,
  photo,
  sale,
  vehicle,
}) {
  const title = getVehicleReportTitle(vehicle);
  const fallbackPhotoTitle = getVehicleTitle(vehicle);
  const isSold = vehicle?.sale_status === "sold" || Boolean(sale);
  const vinEnding = getVinEnding(vehicle?.vin);
  const metadataItems = [
    vehicle?.stock_number ? `Stock ${vehicle.stock_number}` : "",
    vinEnding,
    vehicle?.mileage !== null && vehicle?.mileage !== undefined
      ? `${formatNumber(vehicle.mileage)} mi`
      : "",
  ].filter(Boolean);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600">
              <AppIcon name="file" size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                Vehicle File
              </p>
              <p className="hidden truncate text-xs font-semibold text-slate-500 sm:block">
                Complete record, work, parts, financials, activity, and documents.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {onOpenVehicleDetail && vehicle?.id && (
              <button
                aria-label="Open Vehicle Detail"
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                onClick={() => onOpenVehicleDetail(vehicle.id)}
                title="Open Vehicle Detail"
                type="button"
              >
                <AppIcon name="car" size={15} />
                <span className="hidden sm:inline">Vehicle Detail</span>
              </button>
            )}
            {canMarkSold && (
              <button
                aria-label="Mark Vehicle Sold"
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onClick={onMarkSold}
                title="Mark Vehicle Sold"
                type="button"
              >
                <AppIcon name="dollar" size={15} />
                <span className="hidden sm:inline">Mark Sold</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex gap-3 sm:items-start">
          <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-24 sm:w-32">
            {photo?.photo_url ? (
              <img
                alt={`${fallbackPhotoTitle} thumbnail`}
                className="h-full w-full object-cover"
                loading="lazy"
                src={photo.photo_url}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <AppIcon name="car" size={30} />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              {title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-600">
              {metadataItems.map((item) => (
                <span
                  className="inline-flex h-7 max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 tabular-nums"
                  key={item}
                >
                  <span className="min-w-0 truncate">{item}</span>
                </span>
              ))}
              <VehicleColorLabel
                className="h-7 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1"
                color={vehicle.color}
                colorHex={vehicle.color_hex}
              />
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <VehicleStatusBadge
                className="h-7 max-w-[10.5rem] truncate px-2.5 text-xs"
                status={vehicle.status}
              />
              {activePrebooking && (
                <VehiclePrebookingBadge
                  prebooking={activePrebooking}
                  showAmount={false}
                  showIcon={false}
                />
              )}
              {isSold && (
                <VehicleSaleSummary
                  canViewDetails={canViewSaleDetails}
                  compact
                  sale={sale}
                />
              )}
              {hasActiveThirdPartyRepair && (
                <span className="inline-flex h-7 items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  3rd-Party
                </span>
              )}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

function NestedItemLabel({ children, tone = "blue" }) {
  const toneClassName =
    tone === "purple"
      ? "bg-violet-50 text-violet-700 ring-violet-200"
      : "bg-blue-50 text-blue-700 ring-blue-200";

  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[10px] font-black uppercase tracking-wide ring-1 ring-inset ${toneClassName}`}
    >
      {children}
    </span>
  );
}

function DetailField({ label, value }) {
  if (!hasDisplayValue(value)) {
    return null;
  }

  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold tabular-nums text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function buildPartCostRows(partRequest, purchaseOrderItem) {
  const quantity = getPartQuantity(partRequest, purchaseOrderItem);
  const unitCost = getPartUnitCost(partRequest, purchaseOrderItem);
  const subtotal = quantity !== null && unitCost !== null ? quantity * unitCost : null;
  const shipping = numberOrNull(purchaseOrderItem?.shipping_cost);
  const tax = numberOrNull(purchaseOrderItem?.tax);
  const returnDeduction =
    numberOrZero(purchaseOrderItem?.returned_amount) +
    numberOrZero(purchaseOrderItem?.returned_shipping_amount);
  const total = getPartDisplayTotal(partRequest, purchaseOrderItem);

  return [
    unitCost !== null
      ? { label: "Unit cost", value: formatCurrency(unitCost) }
      : null,
    quantity !== null ? { label: "Quantity", value: formatNumber(quantity) } : null,
    subtotal !== null ? { label: "Subtotal", value: formatCurrency(subtotal) } : null,
    shipping !== null ? { label: "Shipping", value: formatCurrency(shipping) } : null,
    tax !== null ? { label: "Tax", value: formatCurrency(tax) } : null,
    returnDeduction > 0
      ? { label: "Return deduction", value: `-${formatCurrency(returnDeduction)}` }
      : null,
    total !== null ? { label: "Total", value: formatCurrency(total) } : null,
  ].filter(Boolean);
}

function buildActivityLabel(action, profileName, dateValue) {
  const parts = [
    profileName ? `${action} by ${profileName}` : action,
    dateValue ? formatDateTime(dateValue) : "",
  ].filter(Boolean);

  return parts.join(" - ");
}

function buildPartActivityRows({
  partRequest,
  profiles,
  purchaseOrder,
  purchaseOrderItem,
}) {
  return [
    hasDisplayValue(partRequest?.created_by) || hasDisplayValue(partRequest?.created_at)
      ? buildActivityLabel(
          "Added",
          getProfileName(profiles, partRequest?.created_by),
          partRequest?.created_at
        )
      : null,
    hasDisplayValue(partRequest?.approved_by) || hasDisplayValue(partRequest?.approved_at)
      ? buildActivityLabel(
          "Approved",
          getProfileName(profiles, partRequest?.approved_by),
          partRequest?.approved_at
        )
      : null,
    purchaseOrder &&
    (hasDisplayValue(purchaseOrder.ordered_by) ||
      hasDisplayValue(purchaseOrder.ordered_at) ||
      hasDisplayValue(purchaseOrder.created_at))
      ? buildActivityLabel(
          "Ordered",
          getProfileName(profiles, purchaseOrder.ordered_by),
          purchaseOrder.ordered_at ?? purchaseOrder.created_at
        )
      : null,
    purchaseOrder &&
    (hasDisplayValue(purchaseOrder.received_by) ||
      hasDisplayValue(purchaseOrder.received_at))
      ? buildActivityLabel(
          "Received",
          getProfileName(profiles, purchaseOrder.received_by),
          purchaseOrder.received_at
        )
      : null,
    purchaseOrderItem &&
    (hasDisplayValue(purchaseOrderItem.returned_by) ||
      hasDisplayValue(purchaseOrderItem.returned_at))
      ? buildActivityLabel(
          "Returned",
          getProfileName(profiles, purchaseOrderItem.returned_by),
          purchaseOrderItem.returned_at
        )
      : null,
    purchaseOrder &&
    (hasDisplayValue(purchaseOrder.cancelled_by) ||
      hasDisplayValue(purchaseOrder.cancelled_at))
      ? buildActivityLabel(
          "Cancelled",
          getProfileName(profiles, purchaseOrder.cancelled_by),
          purchaseOrder.cancelled_at
        )
      : null,
  ].filter(Boolean);
}

function PartDetailsModal({
  canMoveInHouseToNeedsPo = false,
  documents,
  onClose,
  onNeedToBuyInstead,
  onViewPurchaseOrder,
  partRequest,
  profiles,
  purchaseOrder,
  purchaseOrderItem,
  vendors,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const vendorName = getPartVendorName(
    vendors,
    partRequest,
    purchaseOrderItem,
    purchaseOrder
  );
  const currentStatus = getPartCurrentStatus(partRequest, purchaseOrderItem);
  const purchaseOrderLabel = getPurchaseOrderLabel(purchaseOrder);
  const total = getPartDisplayTotal(partRequest, purchaseOrderItem);
  const costRows = buildPartCostRows(partRequest, purchaseOrderItem);
  const activityRows = buildPartActivityRows({
    partRequest,
    profiles,
    purchaseOrder,
    purchaseOrderItem,
  });
  const documentLinks = getPurchaseOrderDocumentLinks(documents, purchaseOrder);
  const canMoveToNeedsPo =
    canMoveInHouseToNeedsPo && isInHousePartRequest(partRequest);
  const canOpenPurchaseOrder = Boolean(purchaseOrder?.id);

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">
              Part Details
            </p>
            <h3 className="mt-1 break-words text-lg font-black text-slate-950">
              {getPartName(partRequest)}
            </h3>
          </div>
          <button
            className={`shrink-0 px-3 py-2 ${buttonClassNames.secondary}`}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(92vh-5.5rem)] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={currentStatus} />
              {!purchaseOrder && (
                <span className="inline-flex h-7 items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                  PO not created yet
                </span>
              )}
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <DetailField label="Vendor" value={vendorName} />
              <DetailField label="PO" value={purchaseOrderLabel} />
              <DetailField
                label="Approval"
                value={formatLabel(partRequest?.approval_status, "")}
              />
              <DetailField
                label="Total"
                value={total === null ? "" : formatCurrency(total)}
              />
            </dl>
            {(canOpenPurchaseOrder || canMoveToNeedsPo) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {canOpenPurchaseOrder && (
                  <button
                    className={`inline-flex min-h-9 items-center justify-center px-3 ${buttonClassNames.secondary}`}
                    onClick={() =>
                      onViewPurchaseOrder?.({
                        itemId: purchaseOrderItem?.id,
                        poId: purchaseOrder.id,
                      })
                    }
                    type="button"
                  >
                    <AppIcon name="file" size={15} />
                    View PO
                  </button>
                )}
                {canMoveToNeedsPo && (
                  <button
                    className={`inline-flex min-h-9 items-center justify-center px-3 ${buttonClassNames.secondary}`}
                    onClick={() => onNeedToBuyInstead?.(partRequest)}
                    type="button"
                  >
                    <AppIcon name="box" size={15} />
                    Need to Buy Instead
                  </button>
                )}
              </div>
            )}
          </section>

          {costRows.length > 0 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-4">
              <h4 className="text-sm font-black text-slate-950">
                Cost Breakdown
              </h4>
              <dl className="mt-3 divide-y divide-slate-100">
                {costRows.map((row) => (
                  <div
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                    key={row.label}
                  >
                    <dt className="font-semibold text-slate-500">{row.label}</dt>
                    <dd className="font-black tabular-nums text-slate-900">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="rounded-2xl border border-slate-100 bg-white p-4">
            <h4 className="text-sm font-black text-slate-950">
              Purchase Activity
            </h4>
            {activityRows.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {activityRows.map((activityText) => (
                  <li
                    className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                    key={activityText}
                  >
                    {activityText}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm font-semibold text-slate-500">
                No purchase activity recorded yet.
              </p>
            )}
          </section>

          {documentLinks.length > 0 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-4">
              <h4 className="text-sm font-black text-slate-950">
                Documents / PO
              </h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {documentLinks.map((documentRecord) => (
                  <a
                    className={`inline-flex min-h-10 items-center justify-center px-3 ${buttonClassNames.secondary}`}
                    href={documentRecord.file_url}
                    key={documentRecord.id}
                    rel="noreferrer"
                    title={
                      documentRecord.file_name ||
                      formatLabel(documentRecord.document_type, "Document")
                    }
                    target="_blank"
                  >
                    {getDocumentActionLabel(documentRecord)}
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function PartSummaryRow({
  documents = [],
  onViewDetails,
  partRequest,
  profiles = [],
  purchaseOrder,
  purchaseOrderItem,
  vendors,
}) {
  const vendorName = getPartVendorName(
    vendors,
    partRequest,
    purchaseOrderItem,
    purchaseOrder
  );
  const status = getPartCurrentStatus(partRequest, purchaseOrderItem);
  const total = getPartDisplayTotal(partRequest, purchaseOrderItem);

  function handleDetailsClick() {
    onViewDetails?.({
      documents,
      partRequest,
      profiles,
      purchaseOrder,
      purchaseOrderItem,
      vendors,
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-200 bg-slate-50/80 p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
        <div className="flex min-w-0 items-start justify-between gap-2 sm:block">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <NestedItemLabel>Part</NestedItemLabel>
              <p className="min-w-0 truncate text-sm font-black text-slate-900">
                {getPartName(partRequest)}
              </p>
            </div>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">
              {vendorName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
            <StatusPill status={status} />
            <button
              aria-label="View part details"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              onClick={handleDetailsClick}
              title="View part details"
              type="button"
            >
              <AppIcon name="info" size={15} />
            </button>
          </div>
        </div>
        <div className="hidden sm:block">
          <StatusPill status={status} />
        </div>
        <p className="text-right text-sm font-black tabular-nums text-slate-900">
          {total === null ? "No cost" : formatCurrency(total)}
        </p>
        <button
          aria-label="View part details"
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 sm:inline-flex"
          onClick={handleDetailsClick}
          title="View part details"
          type="button"
        >
          <AppIcon name="info" size={15} />
        </button>
      </div>
    </div>
  );
}

function ThirdPartySummaryRow({ thirdPartyRepair, vendors }) {
  const vendorName = getVendorName(vendors, thirdPartyRepair.vendor_id) || "No vendor";
  const total = getThirdPartyTotal(thirdPartyRepair);

  return (
    <div className="rounded-xl border border-violet-100 border-l-4 border-l-violet-300 bg-violet-50/40 p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <div className="flex min-w-0 items-start justify-between gap-2 sm:block">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <NestedItemLabel tone="purple">3rd-Party</NestedItemLabel>
              <p className="min-w-0 truncate text-sm font-black text-slate-900">
                {thirdPartyRepair.service_rendered || "Third-party repair"}
              </p>
            </div>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">
              {vendorName}
            </p>
          </div>
          <div className="shrink-0 sm:hidden">
            <StatusPill status={thirdPartyRepair.status} />
          </div>
        </div>
        <div className="hidden sm:block">
          <StatusPill status={thirdPartyRepair.status} />
        </div>
        <p className="text-right text-sm font-black tabular-nums text-slate-900">
          {formatCurrency(total)}
        </p>
      </div>
    </div>
  );
}

function WorkOrderCard({
  documents,
  onViewPartDetails,
  partRequests,
  profiles,
  purchaseOrderItemsByPartRequestId,
  purchaseOrdersById,
  repairJob,
  thirdPartyRepairs,
  vendors,
}) {
  const partsForJob = partRequests.filter(
    (partRequest) => partRequest.repair_job_id === repairJob.id
  );
  const thirdPartyForJob = thirdPartyRepairs.filter(
    (thirdPartyRepair) => thirdPartyRepair.repair_job_id === repairJob.id
  );
  const hasActiveOutsideWork = thirdPartyForJob.some(isThirdPartyRepairActive);
  const hasNestedItems = partsForJob.length > 0 || thirdPartyForJob.length > 0;
  const isCompleted = repairJob.status === "completed";

  return (
    <article
      className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${
        isCompleted
          ? "border-emerald-200 bg-emerald-50/30"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-base font-black leading-snug text-slate-950 sm:text-lg">
            {displayValue(repairJob.title, "Work order")}
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill status={getWorkOrderStatusLabel(repairJob.status)} />
          <span className="inline-flex h-7 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
            {partsForJob.length} {partsForJob.length === 1 ? "part" : "parts"}
          </span>
          {hasActiveOutsideWork && (
            <span className="inline-flex h-7 items-center rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
              3rd-Party
            </span>
          )}
        </div>
      </div>

      {hasNestedItems ? (
        <div className="mt-3 space-y-2 border-l border-slate-200 pl-3">
          {partsForJob.map((partRequest) => {
            const item = purchaseOrderItemsByPartRequestId[partRequest.id];
            const purchaseOrder = purchaseOrdersById[item?.purchase_order_id];

            return (
              <PartSummaryRow
                documents={documents}
                key={partRequest.id}
                onViewDetails={onViewPartDetails}
                partRequest={partRequest}
                profiles={profiles}
                purchaseOrder={purchaseOrder}
                purchaseOrderItem={item}
                vendors={vendors}
              />
            );
          })}
          {thirdPartyForJob.map((thirdPartyRepair) => (
            <ThirdPartySummaryRow
              key={thirdPartyRepair.id}
              thirdPartyRepair={thirdPartyRepair}
              vendors={vendors}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
          No parts or third-party work recorded for this work order.
        </p>
      )}
    </article>
  );
}

function WorkPartsTab({
  canMoveInHouseToNeedsPo = false,
  documents = [],
  onNeedToBuyInstead,
  onViewPurchaseOrders,
  partRequests,
  profiles = [],
  purchaseOrderItems,
  purchaseOrders,
  repairJobs,
  thirdPartyRepairs,
  vendors,
}) {
  const [selectedPartDetails, setSelectedPartDetails] = useState(null);
  const purchaseOrderItemsByPartRequestId = useMemo(
    () =>
      Object.fromEntries(
        purchaseOrderItems
          .filter((item) => item.part_request_id)
          .map((item) => [item.part_request_id, item])
      ),
    [purchaseOrderItems]
  );
  const purchaseOrdersById = useMemo(
    () =>
      Object.fromEntries(
        purchaseOrders
          .filter((purchaseOrder) => purchaseOrder.id)
          .map((purchaseOrder) => [purchaseOrder.id, purchaseOrder])
      ),
    [purchaseOrders]
  );
  const unassignedParts = partRequests.filter(
    (partRequest) => !partRequest.repair_job_id
  );
  const repairJobIds = new Set(repairJobs.map((repairJob) => repairJob.id));
  const unassignedThirdPartyRepairs = thirdPartyRepairs.filter(
    (thirdPartyRepair) =>
      !thirdPartyRepair.repair_job_id ||
      !repairJobIds.has(thirdPartyRepair.repair_job_id)
  );
  const purchasedPartsTotal = getPurchasedPartsTotal(purchaseOrderItems);
  const inHousePartsTotal = getInHousePartsTotal(
    partRequests,
    purchaseOrderItems
  );
  const partsTotal = purchasedPartsTotal + inHousePartsTotal;
  const thirdPartyTotal = thirdPartyRepairs.reduce(
    (total, thirdPartyRepair) => total + getThirdPartyTotal(thirdPartyRepair),
    0
  );
  const shouldShowTotals =
    purchaseOrderItems.length > 0 ||
    inHousePartsTotal > 0 ||
    thirdPartyRepairs.length > 0;

  async function handleNeedToBuyInstead(partRequest) {
    const updatedPartRequest = await onNeedToBuyInstead?.(partRequest);

    if (!updatedPartRequest?.id) {
      return;
    }

    setSelectedPartDetails((currentDetails) =>
      currentDetails?.partRequest?.id === updatedPartRequest.id
        ? {
            ...currentDetails,
            partRequest: {
              ...currentDetails.partRequest,
              ...updatedPartRequest,
            },
          }
        : currentDetails
    );
  }

  return (
    <div className="space-y-3">
      {repairJobs.length === 0 &&
      unassignedParts.length === 0 &&
      unassignedThirdPartyRepairs.length === 0 ? (
        <EmptyState>No work orders or parts are recorded for this vehicle yet.</EmptyState>
      ) : (
        repairJobs.map((repairJob) => (
          <WorkOrderCard
            documents={documents}
            key={repairJob.id}
            onViewPartDetails={setSelectedPartDetails}
            partRequests={partRequests}
            profiles={profiles}
            purchaseOrderItemsByPartRequestId={purchaseOrderItemsByPartRequestId}
            purchaseOrdersById={purchaseOrdersById}
            repairJob={repairJob}
            thirdPartyRepairs={thirdPartyRepairs}
            vendors={vendors}
          />
        ))
      )}

      {unassignedParts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Unassigned Parts</h3>
          <div className="mt-3 space-y-2">
            {unassignedParts.map((partRequest) => {
              const item = purchaseOrderItemsByPartRequestId[partRequest.id];
              const purchaseOrder = purchaseOrdersById[item?.purchase_order_id];

              return (
                <PartSummaryRow
                  documents={documents}
                  key={partRequest.id}
                  onViewDetails={setSelectedPartDetails}
                  partRequest={partRequest}
                  profiles={profiles}
                  purchaseOrder={purchaseOrder}
                  purchaseOrderItem={item}
                  vendors={vendors}
                />
              );
            })}
          </div>
        </section>
      )}

      {unassignedThirdPartyRepairs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Third-Party Work</h3>
          <div className="mt-3 space-y-2">
            {unassignedThirdPartyRepairs.map((thirdPartyRepair) => (
              <ThirdPartySummaryRow
                key={thirdPartyRepair.id}
                thirdPartyRepair={thirdPartyRepair}
                vendors={vendors}
              />
            ))}
          </div>
        </section>
      )}

      {selectedPartDetails && (
        <PartDetailsModal
          canMoveInHouseToNeedsPo={canMoveInHouseToNeedsPo}
          documents={selectedPartDetails.documents}
          onClose={() => setSelectedPartDetails(null)}
          onNeedToBuyInstead={handleNeedToBuyInstead}
          onViewPurchaseOrder={onViewPurchaseOrders}
          partRequest={selectedPartDetails.partRequest}
          profiles={selectedPartDetails.profiles}
          purchaseOrder={selectedPartDetails.purchaseOrder}
          purchaseOrderItem={selectedPartDetails.purchaseOrderItem}
          vendors={selectedPartDetails.vendors}
        />
      )}

      {shouldShowTotals && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Purchased Parts"
            value={formatCurrency(purchasedPartsTotal)}
          />
          <MetricCard
            label="In-House Parts"
            value={formatCurrency(inHousePartsTotal)}
          />
          <MetricCard
            label="Third-Party Total"
            value={formatCurrency(thirdPartyTotal)}
          />
          <MetricCard
            label="Vendor / Parts Combined"
            value={formatCurrency(partsTotal + thirdPartyTotal)}
          />
        </div>
      )}
    </div>
  );
}

function FinancialTab({
  costEntries,
  currentProfile,
  laborLogs,
  partRequests,
  profiles,
  purchaseOrderItems,
  repairJobs,
  thirdPartyRepairs,
}) {
  const canViewAdminFinancial = isAdminOrManagerRole(currentProfile?.role);
  const userLaborLogs = laborLogs.filter(
    (laborLog) => laborLog.technician_id === currentProfile?.id
  );
  const visibleLaborLogs = canViewAdminFinancial ? laborLogs : userLaborLogs;
  const partsTotal = getPartsInvestmentTotal(partRequests, purchaseOrderItems);
  const thirdPartyTotal = thirdPartyRepairs.reduce(
    (total, thirdPartyRepair) => total + getThirdPartyTotal(thirdPartyRepair),
    0
  );
  const laborTotal = visibleLaborLogs.reduce(
    (total, laborLog) => total + getLaborTotal(laborLog),
    0
  );
  const laborHoursTotal = visibleLaborLogs.reduce(
    (total, laborLog) => total + numberOrZero(laborLog.hours),
    0
  );
  const extraCostsTotal = costEntries.reduce(
    (total, costEntry) => total + getExtraCostAmount(costEntry),
    0
  );
  const totalInvestment =
    partsTotal + thirdPartyTotal + laborTotal + extraCostsTotal;

  if (!canViewAdminFinancial && currentProfile?.role !== "technician") {
    return (
      <EmptyState>Financial details are limited for your role.</EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {canViewAdminFinancial ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <MetricCard label="Parts" value={formatCurrency(partsTotal)} />
          <MetricCard label="Labor" subtitle={`${formatNumber(laborHoursTotal)}h`} value={formatCurrency(laborTotal)} />
          <MetricCard label="Third-Party" value={formatCurrency(thirdPartyTotal)} />
          <MetricCard label="Extra Costs" value={formatCurrency(extraCostsTotal)} />
          <MetricCard
            className="col-span-2 sm:col-span-1"
            label="Total Investment"
            value={formatCurrency(totalInvestment)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="My Hours"
            value={formatNumber(
              userLaborLogs.reduce(
                (total, laborLog) => total + numberOrZero(laborLog.hours),
                0
              )
            )}
          />
          <MetricCard label="My Labor" value={formatCurrency(laborTotal)} />
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-950">
            {canViewAdminFinancial ? "Labor Entries" : "My Labor Entries"}
          </h3>
          <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-black text-slate-500 ring-1 ring-inset ring-slate-100">
            {visibleLaborLogs.length}
          </span>
        </div>
        {visibleLaborLogs.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            No labor entries found.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100">
            {visibleLaborLogs.map((laborLog) => {
              const repairJob = getRecordById(repairJobs, laborLog.repair_job_id);
              const technicianName = getProfileName(profiles, laborLog.technician_id);

              return (
                <div
                  className="grid gap-1.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  key={laborLog.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-800">
                      {[technicianName || "Technician", repairJob?.title]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-600 sm:text-right">
                    {formatNumber(laborLog.hours)}h x{" "}
                    {formatHourlyRate(laborLog.hourly_rate)} ={" "}
                    <span className="font-black tabular-nums text-slate-800">
                      {formatCurrency(getLaborTotal(laborLog))}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function getActivitySummary(details, { redactSaleDetails = false } = {}) {
  if (!details || typeof details !== "object") {
    return "";
  }

  return Object.entries(details)
    .filter(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      const isSensitiveSaleField = [
        "buyer",
        "customer",
        "deposit",
        "email",
        "payment",
        "phone",
        "sale_price",
        "sold_price",
        "terms",
        "refund",
        "warranty",
      ].some((fieldName) => normalizedKey.includes(fieldName));

      return (
        !normalizedKey.endsWith("id") &&
        !(redactSaleDetails && isSensitiveSaleField) &&
        value !== null &&
        value !== undefined &&
        value !== ""
      );
    })
    .slice(0, 3)
    .map(([key, value]) => `${formatLabel(key)}: ${formatActivityValue(value)}`)
    .join(" · ");
}

function formatActivityValue(value) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return formatNumber(value);
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, nestedValue]) => nestedValue !== null && nestedValue !== "")
      .slice(0, 2)
      .map(([nestedKey, nestedValue]) => `${formatLabel(nestedKey)} ${nestedValue}`)
      .join(", ");
  }

  return formatLabel(value, String(value));
}

function ActivityTab({ activityLogs, canViewSaleDetails = false, profiles }) {
  if (activityLogs.length === 0) {
    return (
      <EmptyState>
        Activity history will appear here as work is completed.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      {activityLogs.map((activityLog) => {
        const person = getProfileName(profiles, activityLog.user_id);
        const summary = getActivitySummary(activityLog.details, {
          redactSaleDetails: !canViewSaleDetails,
        });

        return (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            key={activityLog.id}
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="text-sm font-black text-slate-950">
                {formatLabel(activityLog.action, "Activity logged")}
              </h3>
              <p className="text-xs font-semibold text-slate-400">
                {formatDateTime(activityLog.created_at)}
              </p>
            </div>
            {(person || summary) && (
              <p className="mt-1 text-sm leading-5 text-slate-500">
                {[person ? `By ${person}` : "", summary].filter(Boolean).join(" · ")}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function DocumentsTab({ documents, photos, thirdPartyRepairs }) {
  const thirdPartyInvoiceDocuments = thirdPartyRepairs
    .filter((thirdPartyRepair) => thirdPartyRepair.invoice_url)
    .map((thirdPartyRepair) => ({
      created_at: thirdPartyRepair.created_at,
      file_name: thirdPartyRepair.service_rendered || "Third-party invoice",
      file_url: thirdPartyRepair.invoice_url,
      id: `third-party-${thirdPartyRepair.id}`,
      document_type: "third_party_invoice",
    }));
  const allDocuments = [...documents, ...thirdPartyInvoiceDocuments].filter(
    (documentRecord) => documentRecord.file_url
  );

  if (allDocuments.length === 0 && photos.length === 0) {
    return (
      <EmptyState>Vehicle documents and invoices will appear here.</EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {allDocuments.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Documents</h3>
          <div className="mt-3 divide-y divide-slate-100">
            {allDocuments.map((documentRecord) => (
              <a
                className="flex min-w-0 items-center justify-between gap-3 py-2 text-sm transition hover:text-blue-700"
                href={documentRecord.file_url}
                key={documentRecord.id}
                rel="noreferrer"
                target="_blank"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <AppIcon className="shrink-0 text-slate-400" name="file" size={17} />
                  <span className="truncate font-bold text-slate-800">
                    {documentRecord.file_name ||
                      formatLabel(documentRecord.document_type, "Document")}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-400">
                  {formatDate(documentRecord.created_at)}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Photos</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photos.slice(0, 8).map((photo) => (
              <a
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                href={photo.photo_url}
                key={photo.id}
                rel="noreferrer"
                target="_blank"
              >
                <img
                  alt={photo.caption || "Vehicle photo"}
                  className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                  src={photo.photo_url}
                />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function fetchVehicleFileData(
  vehicleId,
  { canViewAdminFinancial = false, canViewSaleDetails = false } = {}
) {
  const costEntriesQuery = canViewAdminFinancial
    ? supabase.from("cost_entries").select("*").eq("vehicle_id", vehicleId)
    : { data: [], error: null };
  const salesQuery = canViewSaleDetails
    ? supabase
        .from("sales")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("sale_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const [
    vehicleResponse,
    photosResponse,
    repairJobsResponse,
    partRequestsResponse,
    serviceCategoriesResponse,
    thirdPartyRepairsResponse,
    purchaseOrdersResponse,
    vendorsResponse,
    laborLogsResponse,
    profilesResponse,
    costEntriesResponse,
    documentsResponse,
    activityLogsResponse,
    activePrebookingResponse,
    salesResponse,
  ] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle(),
    supabase
      .from("vehicle_photos")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("repair_jobs")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("part_requests")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("service_categories")
      .select("id, slug, name, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("third_party_repairs")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase.from("purchase_orders").select("*").eq("vehicle_id", vehicleId),
    supabase.from("vendors").select("*"),
    supabase
      .from("labor_logs")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("profile_display_names")
      .select("id, full_name, email, role"),
    costEntriesQuery,
    supabase
      .from("vehicle_documents")
      .select(vehicleDocumentColumns)
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_logs_visible")
      .select("id, vehicle_id, user_id, action, details, created_at")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("active_vehicle_prebooking_badges")
      .select(activePrebookingBadgeColumns)
      .eq("vehicle_id", vehicleId)
      .maybeSingle(),
    salesQuery,
  ]);

  if (vehicleResponse.error) {
    return { data: null, error: vehicleResponse.error };
  }

  if (!vehicleResponse.data) {
    return { data: null, error: null };
  }

  const purchaseOrderIds = (purchaseOrdersResponse.data ?? [])
    .map((purchaseOrder) => purchaseOrder.id)
    .filter(Boolean);
  const purchaseOrderItemsResponse =
    purchaseOrdersResponse.error || purchaseOrderIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("purchase_order_items")
          .select("*")
          .in("purchase_order_id", purchaseOrderIds);
  const saleIds = (salesResponse.data ?? [])
    .map((sale) => sale.id)
    .filter(Boolean);
  const warrantiesResponse =
    salesResponse.error || saleIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("warranties")
          .select("*")
          .in("sale_id", saleIds);
  const investmentSummaryResponse = canViewAdminFinancial
    ? await supabase
        .from("vehicle_investment_summary")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .maybeSingle()
    : { data: null, error: null };
  const firstError =
    photosResponse.error ??
    repairJobsResponse.error ??
    partRequestsResponse.error ??
    serviceCategoriesResponse.error ??
    thirdPartyRepairsResponse.error ??
    purchaseOrdersResponse.error ??
    purchaseOrderItemsResponse.error ??
    vendorsResponse.error ??
    laborLogsResponse.error ??
    profilesResponse.error ??
    costEntriesResponse.error ??
    documentsResponse.error ??
    activityLogsResponse.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  return {
    data: {
      activePrebooking: activePrebookingResponse.error
        ? null
        : activePrebookingResponse.data,
      activityLogs: activityLogsResponse.data ?? [],
      costEntries: costEntriesResponse.data ?? [],
      documents: documentsResponse.data ?? [],
      investmentSummary: investmentSummaryResponse.error
        ? null
        : investmentSummaryResponse.data,
      laborLogs: laborLogsResponse.data ?? [],
      partRequests: partRequestsResponse.data ?? [],
      photos: photosResponse.data ?? [],
      profiles: profilesResponse.data ?? [],
      purchaseOrderItems: purchaseOrderItemsResponse.data ?? [],
      purchaseOrders: purchaseOrdersResponse.data ?? [],
      repairJobs: repairJobsResponse.data ?? [],
      sales: salesResponse.error ? [] : salesResponse.data ?? [],
      serviceCategories: serviceCategoriesResponse.data ?? [],
      thirdPartyRepairs: thirdPartyRepairsResponse.data ?? [],
      vehicle: vehicleResponse.data,
      vendors: vendorsResponse.data ?? [],
      warranties: warrantiesResponse.error
        ? []
        : warrantiesResponse.data ?? [],
    },
    error: null,
  };
}

function VehicleFilePage({
  currentProfile,
  onBack,
  onOpenVehicleDetail,
  onViewPurchaseOrders,
  vehicleId,
}) {
  const [activeTab, setActiveTab] = useState("work_parts");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSellFormOpen, setIsSellFormOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const canOpenVehicle = Boolean(vehicleId);
  const canViewVehicleFile =
    canOpenVehicle &&
    (hasPermission(currentProfile?.role, "repair:manage") ||
      hasPermission(currentProfile?.role, "dashboard:view") ||
      hasPermission(currentProfile?.role, "sale:manage") ||
      hasPermission(currentProfile?.role, "vehicle:change_status"));
  const canMoveInHouseToNeedsPo =
    hasPermission(currentProfile?.role, "purchase_order:manage") ||
    hasPermission(currentProfile?.role, "part_request:manage") ||
    hasPermission(currentProfile?.role, "repair:manage");
  const canViewAdminFinancial = isAdminOrManagerRole(currentProfile?.role);
  const canViewSaleDetails = hasPermission(currentProfile?.role, "sale:manage");
  const canManageWarranty = hasPermission(
    currentProfile?.role,
    "warranty:manage"
  );

  useEffect(() => {
    let isMounted = true;

    async function loadVehicleFile() {
      if (!vehicleId || !canViewVehicleFile) {
        setData(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetchVehicleFileData(vehicleId, {
          canViewAdminFinancial,
          canViewSaleDetails,
        });

        if (!isMounted) {
          return;
        }

        if (response.error) {
          console.error("Could not load vehicle file:", response.error);
          setData(null);
          setErrorMessage("Could not load Vehicle File.");
          return;
        }

        setData(response.data);
      } catch (error) {
        if (isMounted) {
          console.error("Could not load vehicle file:", error);
          setData(null);
          setErrorMessage("Could not load Vehicle File.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadVehicleFile();

    return () => {
      isMounted = false;
    };
  }, [canViewAdminFinancial, canViewSaleDetails, canViewVehicleFile, vehicleId]);

  const primaryPhoto = data
    ? getVehiclePrimaryPhoto(data.vehicle, data.photos)
    : null;
  const hasActiveThirdPartyRepair =
    data?.thirdPartyRepairs?.some(isThirdPartyRepairActive) ?? false;
  const activeSale = data?.sales?.[0] ?? null;
  const isVehicleSold =
    data?.vehicle?.sale_status === "sold" || Boolean(activeSale);
  const canMarkSold =
    canViewSaleDetails &&
    !isVehicleSold &&
    isReadyForSaleStatus(data?.vehicle?.status);
  const tabRefs = useActiveTabScroll(activeTab);

  async function handleVehicleSold(result) {
    setData((currentData) =>
      currentData
        ? {
            ...currentData,
            sales: result?.sale?.id
              ? [
                  result.sale,
                  ...(currentData.sales ?? []).filter(
                    (sale) => sale.id !== result.sale.id
                  ),
                ]
              : currentData.sales ?? [],
            warranties: result?.warranty?.id
              ? [
                  result.warranty,
                  ...(currentData.warranties ?? []).filter(
                    (warranty) => warranty.id !== result.warranty.id
                  ),
                ]
              : currentData.warranties ?? [],
            vehicle: result?.vehicle?.id
              ? { ...currentData.vehicle, ...result.vehicle }
              : { ...currentData.vehicle, sale_status: "sold" },
          }
        : currentData
    );
  }

  function handleWarrantySaved(warranty) {
    if (!warranty?.id) {
      return;
    }

    setData((currentData) =>
      currentData
        ? {
            ...currentData,
            warranties: [
              warranty,
              ...(currentData.warranties ?? []).filter(
                (currentWarranty) => currentWarranty.id !== warranty.id
              ),
            ],
          }
        : currentData
    );
  }

  async function handleNeedToBuyInstead(partRequest) {
    if (!canMoveInHouseToNeedsPo) {
      return null;
    }

    if (!isInHousePartRequest(partRequest)) {
      return null;
    }

    if (
      !window.confirm(
        "Move this part from In-House to Needs PO? Use this if the part is not actually available in-house."
      )
    ) {
      return null;
    }

    const updateValues = {
      approval_status: "pending",
      approved_at: null,
      approved_by: null,
      part_source: "needs_to_buy",
      status: "requested",
    };

    const { data: updatedPartRequest, error } = await supabase
      .from("part_requests")
      .update(updateValues)
      .eq("id", partRequest.id)
      .select("*")
      .single();

    if (error) {
      console.error("Could not move in-house part to Needs PO:", error);
      return null;
    }

    const nextPartRequest = updatedPartRequest ?? {
      ...partRequest,
      ...updateValues,
    };

    setData((currentData) =>
      currentData
        ? {
            ...currentData,
            partRequests: currentData.partRequests.map((currentPartRequest) =>
              currentPartRequest.id === partRequest.id
                ? { ...currentPartRequest, ...nextPartRequest }
                : currentPartRequest
            ),
          }
        : currentData
    );

    await logVehicleActivity({
      vehicleId: partRequest.vehicle_id ?? vehicleId,
      action: "In-house part moved to Needs PO",
      details: {
        part_name: partRequest.part_name,
        quantity: partRequest.quantity,
      },
    });

    return nextPartRequest;
  }

  return (
    <div className="space-y-4 text-slate-950">
      <div className="flex justify-start">
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          onClick={onBack}
          type="button"
        >
          <AppIcon className="rotate-180" name="chevron-right" size={16} />
          Back
        </button>
      </div>

      {isLoading && (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-600">Loading Vehicle File...</p>
        </section>
      )}

      {!isLoading && !canViewVehicleFile && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
          You do not have permission to open this Vehicle File.
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
          {errorMessage}
        </section>
      )}

      {!isLoading && !errorMessage && canViewVehicleFile && !data?.vehicle && (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-black text-slate-950">
            Vehicle not found or archived.
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            This vehicle may have been removed or is no longer available.
          </p>
        </section>
      )}

      {!isLoading && !errorMessage && data?.vehicle && (
        <>
          <VehicleFileHeader
            activePrebooking={data.activePrebooking}
            canMarkSold={canMarkSold}
            canViewSaleDetails={canViewSaleDetails}
            hasActiveThirdPartyRepair={hasActiveThirdPartyRepair}
            onMarkSold={() => setIsSellFormOpen(true)}
            onOpenVehicleDetail={onOpenVehicleDetail}
            photo={primaryPhoto}
            sale={activeSale}
            vehicle={data.vehicle}
          />

          <section className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;

                return (
                  <button
                    className={`inline-flex min-h-10 shrink-0 items-center rounded-2xl px-4 py-2 text-sm font-black transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    ref={(element) => {
                      tabRefs.current[tab.key] = element;
                    }}
                    type="button"
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </section>

          {activeTab === "work_parts" && (
            <WorkPartsTab
              canMoveInHouseToNeedsPo={canMoveInHouseToNeedsPo}
              documents={data.documents}
              onNeedToBuyInstead={handleNeedToBuyInstead}
              onViewPurchaseOrders={onViewPurchaseOrders}
              partRequests={data.partRequests}
              profiles={data.profiles}
              purchaseOrderItems={data.purchaseOrderItems}
              purchaseOrders={data.purchaseOrders}
              repairJobs={data.repairJobs}
              thirdPartyRepairs={data.thirdPartyRepairs}
              vendors={data.vendors}
            />
          )}

          {activeTab === "financial" && (
            <div className="space-y-3">
              <FinancialTab
                costEntries={data.costEntries}
                currentProfile={currentProfile}
                laborLogs={data.laborLogs}
                partRequests={data.partRequests}
                profiles={data.profiles}
                purchaseOrderItems={data.purchaseOrderItems}
                repairJobs={data.repairJobs}
                thirdPartyRepairs={data.thirdPartyRepairs}
              />
              {canViewSaleDetails && isVehicleSold && (
                <SaleWarrantySection
                  canManage={canManageWarranty}
                  onWarrantySaved={handleWarrantySaved}
                  sales={data.sales}
                  warranties={data.warranties}
                />
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <ActivityTab
              activityLogs={data.activityLogs}
              canViewSaleDetails={canViewSaleDetails}
              profiles={data.profiles}
            />
          )}

          {activeTab === "documents" && (
            <DocumentsTab
              documents={data.documents}
              photos={data.photos}
              thirdPartyRepairs={data.thirdPartyRepairs}
            />
          )}

          {isSellFormOpen && canViewSaleDetails && (
            <SellVehicleForm
              onClose={() => setIsSellFormOpen(false)}
              onVehicleSold={handleVehicleSold}
              vehicle={data.vehicle}
            />
          )}
        </>
      )}
    </div>
  );
}

export default VehicleFilePage;
