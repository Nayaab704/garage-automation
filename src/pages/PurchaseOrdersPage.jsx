import { useEffect, useMemo, useState } from "react";
import MarkReceivedModal from "../components/parts/MarkReceivedModal";
import MarkReturnedModal from "../components/parts/MarkReturnedModal";
import AppIcon from "../components/ui/AppIcon";
import OperationalSearchBar from "../components/ui/OperationalSearchBar";
import { buttonClassNames } from "../components/ui/uiStyles";
import DocumentsList from "../components/vehicle-detail/DocumentsList";
import StatusDropdown from "../components/vehicle-detail/StatusDropdown";
import { logVehicleActivity } from "../lib/activityLogger";
import {
  getPurchaseOrderItemNetTotal,
  getPurchaseOrderItemSubtotal,
  getReturnDeduction,
  isPurchaseOrderItemReturned,
  purchaseOrderItemReturnColumns,
} from "../lib/partReturns";
import { hasPermission } from "../lib/permissions";
import {
  canCancelPurchaseOrder,
  canMarkPurchaseOrderReceived,
  filterPurchaseOrders,
  formatPurchaseOrderLabel,
  getPurchaseOrderSearchText,
  getPurchaseOrderBadge,
  getPurchaseOrderCounts,
  PURCHASE_ORDER_TABS,
} from "../lib/purchaseOrderUtils";
import {
  buildVehicleSearchIndex,
  getVehicleContext,
  getVehicleSearchText,
  uniqueVehicleContexts,
} from "../lib/searchText";
import {
  getPurchaseOrderReceivedValues,
  markPurchaseOrderReceived,
} from "../lib/purchaseOrderReceiving";
import { supabase } from "../lib/supabaseClient";
import { formatUserFirstName } from "../lib/userDisplay";
import { getWorkOrderStatusAfterPartsReceived } from "../lib/workOrderStatus";
import useDebouncedValue from "../hooks/useDebouncedValue";

const purchaseOrderColumns =
  "id, vehicle_id, vendor_id, status, ordered_by, ordered_at, received_by, received_at, notes, created_at";

const purchaseOrderItemColumns =
  `id, purchase_order_id, part_request_id, description, quantity, unit_cost, shipping_cost, tax, status, notes, created_at, ${purchaseOrderItemReturnColumns}`;

const partRequestColumns =
  "id, vehicle_id, repair_job_id, part_name, quantity, status, part_source, approval_status, selected_vendor_id, selected_quote_id, quoted_unit_cost, quoted_total_cost";

const vehicleDocumentColumns =
  "id, vehicle_id, repair_job_id, third_party_repair_id, purchase_order_id, document_type, file_url, file_path, file_name, file_mime_type, file_size_bytes, notes, uploaded_by, created_at";

const purchaseOrderStatuses = [
  "draft",
  "ordered",
  "partial_received",
  "received",
  "cancelled",
];

const purchaseOrderItemStatuses = [
  "ordered",
  "received",
  "cancelled",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

function formatNumber(value) {
  return numberFormatter.format(numberOrZero(value));
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function getVehicleName(vehicle) {
  if (!vehicle) {
    return "";
  }

  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ");
}

function getVehicleLabel(vehicle) {
  if (!vehicle) {
    return "Vehicle not found";
  }

  const stockNumber = vehicle.stock_number || "No stock number";
  const vehicleName = getVehicleName(vehicle);

  return vehicleName ? `${stockNumber} - ${vehicleName}` : stockNumber;
}

function getVendorName(purchaseOrder) {
  return (
    purchaseOrder?.vendor?.name ||
    purchaseOrder?.items?.find((item) => item.partRequest?.selectedQuote)
      ?.partRequest?.selectedQuote?.vendor_name_snapshot ||
    "Unknown vendor"
  );
}

function getItemSubtotal(item) {
  return getPurchaseOrderItemSubtotal(item);
}

function getItemTotal(item) {
  return getPurchaseOrderItemNetTotal(item);
}

function getPurchaseOrderTotal(items = []) {
  return items.reduce((total, item) => total + getItemTotal(item), 0);
}

function getPurchaseOrderLabel(purchaseOrder) {
  return `PO ${String(purchaseOrder?.id ?? "").slice(0, 8).toUpperCase()}`;
}

function getPrimaryItem(purchaseOrder) {
  return purchaseOrder?.items?.[0] ?? null;
}

function getWorkOrderLabel(item) {
  const repairJob = item?.partRequest?.repairJob;
  const serviceCategory =
    repairJob?.serviceCategory?.name ||
    (repairJob?.category ? formatPurchaseOrderLabel(repairJob.category, {}) : "");

  return [serviceCategory, repairJob?.title].filter(Boolean).join(" - ");
}

function getLatestReturnedItem(items = []) {
  return [...items]
    .filter(isPurchaseOrderItemReturned)
    .sort((left, right) => {
      const leftDate = new Date(left.returned_at ?? left.created_at ?? 0).getTime();
      const rightDate = new Date(right.returned_at ?? right.created_at ?? 0).getTime();
      return rightDate - leftDate;
    })[0] ?? null;
}

function joinTrackingParts(parts) {
  return parts.filter(Boolean).join(" - ");
}

function isLikelyUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );
}

function getActionFirstName(profile, profileId) {
  if (profile) {
    return formatUserFirstName(profile);
  }

  if (!profileId) {
    return "";
  }

  return isLikelyUuid(profileId) ? "User" : formatUserFirstName(profileId);
}

function formatActionWithDate(actionText, dateValue) {
  return joinTrackingParts([actionText, dateValue ? formatDate(dateValue) : ""]);
}

function getCreatedTrackingText(purchaseOrder) {
  return purchaseOrder.created_at
    ? `Created ${formatDate(purchaseOrder.created_at)}`
    : "";
}

function getOrderedTrackingText(purchaseOrder, { includeDate = true } = {}) {
  const orderedName = getActionFirstName(
    purchaseOrder.orderedBy,
    purchaseOrder.ordered_by
  );

  return formatActionWithDate(
    orderedName ? `Ordered by ${orderedName}` : "Ordered",
    includeDate ? purchaseOrder.ordered_at ?? purchaseOrder.created_at : ""
  );
}

function getReceivedTrackingText(purchaseOrder, { includeDate = true } = {}) {
  if (!purchaseOrder.received_at && !purchaseOrder.received_by) {
    return "";
  }

  const receivedName = getActionFirstName(
    purchaseOrder.receivedBy,
    purchaseOrder.received_by
  );
  const receivedLabel = receivedName ? `Received by ${receivedName}` : "Received";
  const receivedDate = purchaseOrder.received_at
    ? formatDate(purchaseOrder.received_at)
    : "";

  return joinTrackingParts([receivedLabel, includeDate ? receivedDate : ""]);
}

function getReturnedTrackingText(
  returnedItem,
  { deduction = null, includeDate = true, includeDeduction = false } = {}
) {
  if (!returnedItem) {
    return "";
  }

  const returnedName = getActionFirstName(
    returnedItem.returnedBy,
    returnedItem.returned_by
  );
  const returnedLabel = returnedName ? `Returned by ${returnedName}` : "Returned";
  const returnedDate = returnedItem.returned_at
    ? formatDate(returnedItem.returned_at)
    : "";
  const deductionText = includeDeduction
    ? `${formatCurrency(deduction)} deducted`
    : "";

  return joinTrackingParts([
    returnedLabel,
    includeDate ? returnedDate : "",
    deductionText,
  ]);
}

function getCancelledTrackingText(purchaseOrder) {
  if (purchaseOrder.status !== "cancelled") {
    return "";
  }

  return "Cancelled";
}

function getPurchaseOrderTrackingText(purchaseOrder, activeTab) {
  const returnedItem = getLatestReturnedItem(purchaseOrder.items);
  const createdText = getCreatedTrackingText(purchaseOrder);
  const orderedText = getOrderedTrackingText(purchaseOrder);
  const receivedText = getReceivedTrackingText(purchaseOrder);
  const returnedText = getReturnedTrackingText(returnedItem);
  const cancelledText = getCancelledTrackingText(purchaseOrder);

  if (activeTab === "all") {
    return joinTrackingParts([
      getOrderedTrackingText(purchaseOrder, { includeDate: false }),
      getReceivedTrackingText(purchaseOrder, { includeDate: false }),
      getReturnedTrackingText(returnedItem, { includeDate: false }),
      cancelledText,
    ]);
  }

  if (activeTab === "open") {
    return createdText || orderedText;
  }

  if (
    activeTab === "ordered" ||
    ["draft", "ordered", "partial_received"].includes(purchaseOrder.status)
  ) {
    return orderedText || createdText;
  }

  if (activeTab === "received" || purchaseOrder.status === "received") {
    return receivedText || orderedText || createdText;
  }

  if (activeTab === "cancelled" || purchaseOrder.status === "cancelled") {
    return cancelledText || createdText;
  }

  if (purchaseOrder.status === "returned" || returnedItem) {
    return returnedText || receivedText || orderedText || createdText;
  }

  return orderedText || createdText;
}

function canUploadDocumentsForProfile(profile) {
  const role = profile?.role;

  return (
    (role === "admin" || role === "owner" || role === "technician") &&
    (hasPermission(role, "photo:manage") || hasPermission(role, "repair:manage"))
  );
}

function canManageReturnsForProfile(profile) {
  return ["admin", "owner", "technician"].includes(profile?.role);
}

function canMarkItemReturned(item) {
  return (
    !isPurchaseOrderItemReturned(item) &&
    ["ordered", "received"].includes(item?.status ?? "ordered")
  );
}

function statusClassName(status) {
  return getPurchaseOrderBadge(status).className;
}

function groupBy(records, key) {
  return records.reduce((groupedRecords, record) => {
    const groupKey = record?.[key];

    if (!groupKey) {
      return groupedRecords;
    }

    groupedRecords[groupKey] = [...(groupedRecords[groupKey] ?? []), record];
    return groupedRecords;
  }, {});
}

async function fetchPurchaseOrdersData() {
  const purchaseOrdersResponse = await supabase
    .from("purchase_orders")
    .select(purchaseOrderColumns)
    .order("created_at", { ascending: false });

  if (purchaseOrdersResponse.error) {
    return { error: purchaseOrdersResponse.error };
  }

  const purchaseOrders = purchaseOrdersResponse.data ?? [];
  const purchaseOrderIds = uniqueValues(
    purchaseOrders.map((purchaseOrder) => purchaseOrder.id)
  );
  const [
    itemsResponse,
    vehicleDocumentsResponse,
    vehiclesResponse,
  ] = await Promise.all([
    purchaseOrderIds.length > 0
      ? supabase
          .from("purchase_order_items")
          .select(purchaseOrderItemColumns)
          .in("purchase_order_id", purchaseOrderIds)
      : { data: [], error: null },
    purchaseOrderIds.length > 0
      ? supabase
          .from("vehicle_documents")
          .select(vehicleDocumentColumns)
          .in("purchase_order_id", purchaseOrderIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null },
    supabase
      .from("vehicles")
      .select("id, stock_number, vin, year, make, model, trim, color, status"),
  ]);

  const firstRequiredError =
    itemsResponse.error ??
    vehicleDocumentsResponse.error ??
    vehiclesResponse.error;

  if (firstRequiredError) {
    return { error: firstRequiredError };
  }

  const purchaseOrderItems = itemsResponse.data ?? [];
  const profileIds = uniqueValues([
    ...purchaseOrders.flatMap((purchaseOrder) => [
      purchaseOrder.ordered_by,
      purchaseOrder.received_by,
    ]),
    ...purchaseOrderItems.map((item) => item.returned_by),
  ]);
  const profilesResponse =
    profileIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds)
      : { data: [], error: null };

  if (profilesResponse.error) {
    return { error: profilesResponse.error };
  }

  const partRequestIds = uniqueValues(
    purchaseOrderItems.map((item) => item.part_request_id)
  );

  const partRequestsResponse =
    partRequestIds.length > 0
      ? await supabase
          .from("part_requests")
          .select(partRequestColumns)
          .in("id", partRequestIds)
      : { data: [], error: null };

  if (partRequestsResponse.error) {
    return { error: partRequestsResponse.error };
  }

  const partRequests = partRequestsResponse.data ?? [];
  const repairJobIds = uniqueValues(
    partRequests.map((partRequest) => partRequest.repair_job_id)
  );
  const selectedQuoteIds = uniqueValues(
    partRequests.map((partRequest) => partRequest.selected_quote_id)
  );
  const vendorIds = uniqueValues([
    ...purchaseOrders.map((purchaseOrder) => purchaseOrder.vendor_id),
    ...partRequests.map((partRequest) => partRequest.selected_vendor_id),
  ]);

  const [
    repairJobsResponse,
    serviceCategoriesResponse,
    selectedQuotesResponse,
    vendorsResponse,
  ] = await Promise.all([
    repairJobIds.length > 0
      ? supabase
          .from("repair_jobs")
          .select("id, vehicle_id, service_category_id, title, category, status")
          .in("id", repairJobIds)
      : { data: [], error: null },
    supabase
      .from("service_categories")
      .select("id, slug, name, description, sort_order, is_active"),
    selectedQuoteIds.length > 0
      ? supabase
          .from("vendor_part_quotes")
          .select(
            "id, vendor_id, vendor_name_snapshot, raw_part_name, quote_status, availability, notes, unit_price, total_price"
          )
          .in("id", selectedQuoteIds)
      : { data: [], error: null },
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, name, phone, email").in("id", vendorIds)
      : { data: [], error: null },
  ]);

  const secondRequiredError =
    repairJobsResponse.error ??
    serviceCategoriesResponse.error ??
    selectedQuotesResponse.error ??
    vendorsResponse.error;

  if (secondRequiredError) {
    return { error: secondRequiredError };
  }

  const repairJobs = repairJobsResponse.data ?? [];
  const initialVehicles = vehiclesResponse.data ?? [];
  const initialVehicleIds = new Set(initialVehicles.map((vehicle) => vehicle.id));
  const missingVehicleIds = uniqueValues([
    ...partRequests.map((partRequest) => partRequest.vehicle_id),
    ...repairJobs.map((repairJob) => repairJob.vehicle_id),
  ]).filter((vehicleId) => vehicleId && !initialVehicleIds.has(vehicleId));
  const missingVehiclesResponse =
    missingVehicleIds.length > 0
      ? await supabase
          .from("vehicles")
          .select("id, stock_number, vin, year, make, model, trim, color, status")
          .in("id", missingVehicleIds)
      : { data: [], error: null };

  if (missingVehiclesResponse.error) {
    return { error: missingVehiclesResponse.error };
  }

  const vehicles = [
    ...initialVehicles,
    ...(missingVehiclesResponse.data ?? []),
  ];

  return {
    data: {
      partRequests,
      profilesById: Object.fromEntries(
        (profilesResponse.data ?? []).map((profile) => [profile.id, profile])
      ),
      purchaseOrderItems,
      purchaseOrders,
      repairJobsById: Object.fromEntries(
        repairJobs.map((repairJob) => [
          repairJob.id,
          repairJob,
        ])
      ),
      selectedQuotesById: Object.fromEntries(
        (selectedQuotesResponse.data ?? []).map((quote) => [quote.id, quote])
      ),
      serviceCategoriesById: Object.fromEntries(
        (serviceCategoriesResponse.data ?? []).map((category) => [
          category.id,
          category,
        ])
      ),
      vehicleDocuments: vehicleDocumentsResponse.data ?? [],
      vehicleSearchIndex: buildVehicleSearchIndex(vehicles),
      vehiclesById: Object.fromEntries(
        vehicles.map((vehicle) => [vehicle.id, vehicle])
      ),
      vendorsById: Object.fromEntries(
        (vendorsResponse.data ?? []).map((vendor) => [vendor.id, vendor])
      ),
    },
    error: null,
  };
}

function Badge({ children, className }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-black ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function PurchaseOrderTabs({ activeTab, counts, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {PURCHASE_ORDER_TABS.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-black transition ${
              isActive
                ? "bg-emerald-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            }`}
            key={tab.key}
            onClick={() => onChange(tab.key)}
            type="button"
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {counts[tab.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PurchaseOrderEmptyState({ activeTab, hasSearch, onClearSearch }) {
  const message = hasSearch
    ? {
        body: "Try searching by VIN, stock number, vehicle, part, or vendor.",
        title: "No matching records found.",
      }
    : activeTab === "open"
      ? {
          body: "Parts ordered from the Parts Queue will appear here.",
          title: "No open purchase orders.",
        }
      : {
          body: "Purchase orders matching this filter will appear here.",
          title: "No purchase orders found.",
        };

  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <AppIcon name="box" size={24} />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">
        {message.title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {message.body}
      </p>
      {hasSearch && onClearSearch && (
        <button
          className={`mt-4 ${buttonClassNames.secondary}`}
          onClick={onClearSearch}
          type="button"
        >
          Clear Search
        </button>
      )}
    </section>
  );
}

function PurchaseOrderCard({
  activeTab,
  canDeleteDocuments,
  canManagePurchaseOrders,
  canManageReturns,
  canUploadDocuments,
  currentProfile,
  documents,
  isExpanded,
  isUpdating,
  onCancel,
  onDocumentAdded,
  onDocumentDeleted,
  onItemStatusChange,
  onMarkReceived,
  onMarkReturned,
  onOpenVehicle,
  onStatusChange,
  onToggleDetails,
  purchaseOrder,
  updatingItemId,
}) {
  const badge = getPurchaseOrderBadge(purchaseOrder.status);
  const primaryItem = getPrimaryItem(purchaseOrder);
  const itemCount = purchaseOrder.items.length;
  const totalCost = getPurchaseOrderTotal(purchaseOrder.items);
  const canReceive =
    canManagePurchaseOrders && canMarkPurchaseOrderReceived(purchaseOrder);
  const canCancel =
    canManagePurchaseOrders && canCancelPurchaseOrder(purchaseOrder);
  const workOrderLabel = getWorkOrderLabel(primaryItem);
  const trackingText = getPurchaseOrderTrackingText(purchaseOrder, activeTab);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black leading-snug text-slate-950">
                {getPurchaseOrderLabel(purchaseOrder)}
              </h3>
              <p className="mt-1 text-sm font-black text-slate-800">
                {getVendorName(purchaseOrder)}
              </p>
            </div>
            <Badge className={`${badge.className} shrink-0`}>{badge.label}</Badge>
          </div>

          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p className="font-black text-slate-900">
              {getVehicleLabel(purchaseOrder.vehicle)}
            </p>
            {workOrderLabel && <p>{workOrderLabel}</p>}
          </div>

          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-sm font-black text-slate-950">
              {displayValue(primaryItem?.description)}
              {itemCount > 1 ? ` + ${itemCount - 1} more` : ""}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Qty {formatNumber(primaryItem?.quantity || 0)} -{" "}
              {formatCurrency(primaryItem?.unit_cost)} each
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Subtotal {formatCurrency(getItemSubtotal(primaryItem))} - Shipping{" "}
              {formatCurrency(primaryItem?.shipping_cost)} - Tax{" "}
              {formatCurrency(primaryItem?.tax)}
            </p>
            {isPurchaseOrderItemReturned(primaryItem) && (
              <p className="mt-1 text-xs font-black text-red-700">
                Returned - {formatCurrency(getReturnDeduction(primaryItem))} deducted
              </p>
            )}
            <p className="mt-1 text-xs font-black text-slate-700">
              Total {formatCurrency(totalCost)}
            </p>
          </div>

          {trackingText && (
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {trackingText}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:w-48 lg:flex-col lg:items-stretch">
          {canReceive && (
            <button
              className={`${buttonClassNames.primary} flex-1 lg:w-full`}
              disabled={isUpdating}
              onClick={() => onMarkReceived(purchaseOrder)}
              type="button"
            >
              Mark Received
            </button>
          )}
          <button
            className={`${buttonClassNames.secondary} flex-1 lg:w-full`}
            disabled={!purchaseOrder.vehicle_id}
            onClick={() => onOpenVehicle?.(purchaseOrder.vehicle_id)}
            type="button"
          >
            Open Vehicle
          </button>
          <button
            className={`${buttonClassNames.secondary} flex-1 lg:w-full`}
            onClick={() => onToggleDetails(purchaseOrder.id)}
            type="button"
          >
            {isExpanded ? "Hide Details" : "View Details"}
          </button>
          {canCancel && (
            <button
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 lg:w-full"
              disabled={isUpdating}
              onClick={() => onCancel(purchaseOrder)}
              type="button"
            >
              Cancel PO
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Ordered
              </p>
              <p className="mt-1 font-semibold text-slate-700">
                {formatDate(purchaseOrder.ordered_at)}
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Received
              </p>
              <p className="mt-1 font-semibold text-slate-700">
                {formatDate(purchaseOrder.received_at)}
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Items
              </p>
              <p className="mt-1 font-semibold text-slate-700">
                {formatNumber(itemCount)}
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                Total
              </p>
              <p className="mt-1 font-semibold text-slate-700">
                {formatCurrency(totalCost)}
              </p>
            </div>
          </div>

          {canManagePurchaseOrders && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Status controls
              </p>
              <StatusDropdown
                currentStatus={purchaseOrder.status}
                isUpdating={isUpdating}
                onChange={(newStatus) => onStatusChange(purchaseOrder, newStatus)}
                statuses={purchaseOrderStatuses}
              />
            </div>
          )}

          {purchaseOrder.notes && (
            <p className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              {purchaseOrder.notes}
            </p>
          )}

          <DocumentsList
            canDelete={canDeleteDocuments}
            canUpload={canUploadDocuments}
            currentProfile={currentProfile}
            description="Upload a PDF or image receipt or invoice for this purchase order."
            documentType="purchase_receipt"
            documents={documents}
            emptyMessage="No receipts or invoices uploaded for this purchase order."
            onDocumentAdded={onDocumentAdded}
            onDocumentDeleted={onDocumentDeleted}
            purchaseOrderId={purchaseOrder.id}
            title="Documents"
            uploadButtonLabel="Upload Receipt / Invoice"
            uploadTitle="Upload Receipt / Invoice"
            vehicleId={purchaseOrder.vehicle_id}
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-black text-slate-950">Items</h4>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>

            {purchaseOrder.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                No items found for this purchase order.
              </div>
            ) : (
              <div className="space-y-3">
                {purchaseOrder.items.map((item) => {
                  const isReturned = isPurchaseOrderItemReturned(item);
                  const returnDeduction = getReturnDeduction(item);
                  const returnTrackingText = getReturnedTrackingText(item);

                  return (
                    <div
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                      key={item.id}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h5 className="font-black text-slate-950">
                            {displayValue(item.description)}
                          </h5>
                          {getWorkOrderLabel(item) && (
                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              {getWorkOrderLabel(item)}
                            </p>
                          )}
                          <p className="mt-2 text-sm text-slate-500">
                            Qty {formatNumber(item.quantity)} -{" "}
                            {formatCurrency(item.unit_cost)} each - Subtotal{" "}
                            {formatCurrency(getItemSubtotal(item))} - Shipping{" "}
                            {formatCurrency(item.shipping_cost)} - Tax{" "}
                            {formatCurrency(item.tax)}
                          </p>
                          {isReturned && (
                            <p className="mt-1 text-sm font-black text-red-700">
                              Returned - {formatCurrency(returnDeduction)} deducted
                            </p>
                          )}
                          {isReturned && (
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {returnTrackingText}
                            </p>
                          )}
                          <p className="mt-1 text-sm font-black text-slate-700">
                            Total {formatCurrency(getItemTotal(item))}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          {isReturned ? (
                            <Badge className="bg-red-50 text-red-700 ring-red-200">
                              Returned
                            </Badge>
                          ) : canManagePurchaseOrders ? (
                            <StatusDropdown
                              currentStatus={item.status ?? "ordered"}
                              isUpdating={updatingItemId === item.id}
                              onChange={(newStatus) =>
                                onItemStatusChange(item, newStatus, purchaseOrder)
                              }
                              statuses={purchaseOrderItemStatuses}
                            />
                          ) : (
                            <Badge
                              className={statusClassName(item.status ?? "ordered")}
                            >
                              {formatPurchaseOrderLabel(item.status ?? "ordered")}
                            </Badge>
                          )}

                          {canManageReturns && canMarkItemReturned(item) && (
                            <button
                              className="inline-flex min-h-9 items-center justify-center rounded-2xl border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={updatingItemId === item.id}
                              onClick={() => onMarkReturned(item, purchaseOrder)}
                              type="button"
                            >
                              Mark Returned
                            </button>
                          )}
                        </div>
                      </div>

                      {item.notes && (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function PurchaseOrdersPage({ currentProfile, onSelectVehicle }) {
  const [activeTab, setActiveTab] = useState("open");
  const [confirmReceivedOrder, setConfirmReceivedOrder] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedPurchaseOrderIds, setExpandedPurchaseOrderIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [partRequestsById, setPartRequestsById] = useState({});
  const [profilesById, setProfilesById] = useState({});
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [repairJobsById, setRepairJobsById] = useState({});
  const [returningItemContext, setReturningItemContext] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuotesById, setSelectedQuotesById] = useState({});
  const [serviceCategoriesById, setServiceCategoriesById] = useState({});
  const [statusErrorMessage, setStatusErrorMessage] = useState("");
  const [statusSuccessMessage, setStatusSuccessMessage] = useState("");
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [updatingPurchaseOrderId, setUpdatingPurchaseOrderId] = useState(null);
  const [vehicleDocuments, setVehicleDocuments] = useState([]);
  const [vehiclesById, setVehiclesById] = useState({});
  const [vendorsById, setVendorsById] = useState({});

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  const canManagePurchaseOrders = hasPermission(
    currentProfile?.role,
    "purchase_order:manage"
  );
  const canManageReturns = canManageReturnsForProfile(currentProfile);
  const canUploadDocuments = canUploadDocumentsForProfile(currentProfile);
  const canDeleteDocuments = hasPermission(currentProfile?.role, "photo:manage");

  const itemsByPurchaseOrderId = useMemo(
    () => groupBy(purchaseOrderItems, "purchase_order_id"),
    [purchaseOrderItems]
  );

  const documentsByPurchaseOrderId = useMemo(
    () => groupBy(vehicleDocuments, "purchase_order_id"),
    [vehicleDocuments]
  );

  const vehicleSearchIndex = useMemo(
    () => buildVehicleSearchIndex(Object.values(vehiclesById)),
    [vehiclesById]
  );

  const enrichedPurchaseOrders = useMemo(() => {
    return purchaseOrders.map((purchaseOrder) => {
      const items = (itemsByPurchaseOrderId[purchaseOrder.id] ?? []).map(
        (item) => {
          const partRequest = partRequestsById[item.part_request_id] ?? null;
          const repairJob = repairJobsById[partRequest?.repair_job_id] ?? null;
          const selectedQuote = selectedQuotesById[partRequest?.selected_quote_id] ?? null;
          const partRequestVehicle = vehiclesById[partRequest?.vehicle_id] ?? null;
          const repairJobVehicle = vehiclesById[repairJob?.vehicle_id] ?? null;
          const itemVehicle = partRequestVehicle ?? repairJobVehicle ?? null;
          const itemVehicleContext = getVehicleContext(itemVehicle);
          const partRequestVehicleContext = getVehicleContext(partRequestVehicle);
          const repairJobVehicleContext = getVehicleContext(repairJobVehicle);

          return {
            ...item,
            vehicle: itemVehicle,
            vehicleContext: itemVehicleContext,
            vehicleSearchText: getVehicleSearchText(itemVehicleContext),
            vehicleVin: itemVehicleContext?.vin ?? "",
            partRequest: partRequest
              ? {
                  ...partRequest,
                  vehicle: partRequestVehicle,
                  vehicleContext: partRequestVehicleContext,
                  vehicleSearchText: getVehicleSearchText(partRequestVehicleContext),
                  vehicleVin: partRequestVehicleContext?.vin ?? "",
                  repairJob: repairJob
                    ? {
                        ...repairJob,
                        serviceCategory:
                          serviceCategoriesById[repairJob.service_category_id] ??
                          null,
                        vehicle: repairJobVehicle,
                        vehicleContext: repairJobVehicleContext,
                        vehicleSearchText: getVehicleSearchText(
                          repairJobVehicleContext
                        ),
                        vehicleVin: repairJobVehicleContext?.vin ?? "",
                      }
                    : null,
                  selectedQuote,
                }
              : null,
            returnedBy: profilesById[item.returned_by] ?? null,
          };
        }
      );
      const topLevelVehicle = vehiclesById[purchaseOrder.vehicle_id] ?? null;
      const relatedVehicleContexts = uniqueVehicleContexts([
        topLevelVehicle,
        ...items.flatMap((item) => [
          item.vehicle,
          item.partRequest?.vehicle,
          item.partRequest?.repairJob?.vehicle,
        ]),
      ]);

      const enrichedPurchaseOrder = {
        ...purchaseOrder,
        documents: documentsByPurchaseOrderId[purchaseOrder.id] ?? [],
        items,
        orderedBy: profilesById[purchaseOrder.ordered_by] ?? null,
        receivedBy: profilesById[purchaseOrder.received_by] ?? null,
        vehicle: topLevelVehicle ?? relatedVehicleContexts[0] ?? null,
        vehicleContext: getVehicleContext(topLevelVehicle ?? relatedVehicleContexts[0]),
        vehicleContexts: relatedVehicleContexts,
        vehicleSearchText: relatedVehicleContexts
          .map(getVehicleSearchText)
          .join(" "),
        vehicleVins: relatedVehicleContexts
          .map((vehicle) => vehicle.vin)
          .filter(Boolean),
        vehicleVin: getVehicleContext(topLevelVehicle ?? relatedVehicleContexts[0])
          ?.vin ?? "",
        vendor: vendorsById[purchaseOrder.vendor_id] ?? null,
      };

      return {
        ...enrichedPurchaseOrder,
        searchText: getPurchaseOrderSearchText(enrichedPurchaseOrder),
      };
    });
  }, [
    documentsByPurchaseOrderId,
    itemsByPurchaseOrderId,
    partRequestsById,
    profilesById,
    purchaseOrders,
    repairJobsById,
    selectedQuotesById,
    serviceCategoriesById,
    vehiclesById,
    vendorsById,
  ]);

  const countsByTab = useMemo(
    () => getPurchaseOrderCounts(enrichedPurchaseOrders),
    [enrichedPurchaseOrders]
  );

  const filteredPurchaseOrders = useMemo(
    () =>
      filterPurchaseOrders(enrichedPurchaseOrders, {
        search: debouncedSearchTerm,
        tab: activeTab,
        vehicleSearchIndex,
      }),
    [activeTab, debouncedSearchTerm, enrichedPurchaseOrders, vehicleSearchIndex]
  );

  async function persistAutomaticRepairJobStatus(
    repairJobId,
    nextStatus,
    details = {}
  ) {
    const repairJob = repairJobsById[repairJobId];

    if (!repairJob?.id || !nextStatus || repairJob.status === nextStatus) {
      return;
    }

    const previousStatus = repairJob.status;

    setRepairJobsById((currentRepairJobsById) => ({
      ...currentRepairJobsById,
      [repairJob.id]: {
        ...currentRepairJobsById[repairJob.id],
        status: nextStatus,
      },
    }));

    const { error } = await supabase
      .from("repair_jobs")
      .update({ status: nextStatus })
      .eq("id", repairJob.id);

    if (error) {
      console.error("Could not update linked work order status:", error);
      setRepairJobsById((currentRepairJobsById) => ({
        ...currentRepairJobsById,
        [repairJob.id]: {
          ...currentRepairJobsById[repairJob.id],
          status: previousStatus,
        },
      }));
      return;
    }

    await logVehicleActivity({
      vehicleId: repairJob.vehicle_id,
      action: "Work order status changed automatically",
      details: {
        ...details,
        from: previousStatus,
        title: repairJob.title,
        to: nextStatus,
      },
    });
  }

  async function syncRepairJobStatusesAfterPartsReceived(
    repairJobIds,
    {
      nextPartRequestsById = partRequestsById,
      nextPurchaseOrderItems = purchaseOrderItems,
      triggerDetails = {},
    } = {}
  ) {
    const nextPartRequests = Object.values(nextPartRequestsById);

    await Promise.all(
      uniqueValues(repairJobIds).map((repairJobId) => {
        const repairJob = repairJobsById[repairJobId];
        const workOrderPartRequests = nextPartRequests.filter(
          (partRequest) => partRequest.repair_job_id === repairJobId
        );

        return persistAutomaticRepairJobStatus(
          repairJobId,
          getWorkOrderStatusAfterPartsReceived(repairJob?.status, {
            partRequests: workOrderPartRequests,
            purchaseOrderItems: nextPurchaseOrderItems,
          }),
          triggerDetails
        );
      })
    );
  }

  async function handleMarkPurchaseOrderReceived(
    purchaseOrder,
    { successMessage = "" } = {}
  ) {
    if (!canManagePurchaseOrders) {
      setStatusErrorMessage("Your role cannot update purchase orders.");
      return false;
    }

    const previousStatus = purchaseOrder.status;
    const receivedValues = getPurchaseOrderReceivedValues(
      purchaseOrder,
      currentProfile
    );
    const linkedItems = itemsByPurchaseOrderId[purchaseOrder.id] ?? [];

    setStatusErrorMessage("");
    setStatusSuccessMessage("");
    setUpdatingPurchaseOrderId(purchaseOrder.id);

    if (currentProfile?.id) {
      setProfilesById((currentProfilesById) => ({
        ...currentProfilesById,
        [currentProfile.id]: currentProfile,
      }));
    }

    setPurchaseOrders((currentPurchaseOrders) =>
      currentPurchaseOrders.map((currentPurchaseOrder) =>
        currentPurchaseOrder.id === purchaseOrder.id
          ? { ...currentPurchaseOrder, ...receivedValues }
          : currentPurchaseOrder
      )
    );

    try {
      const { data, error } = await markPurchaseOrderReceived({
        currentProfile,
        linkedItems,
        purchaseOrder,
      });

      if (error) {
        console.error("Could not mark purchase order received:", error);
        throw error;
      }

      const purchaseOrderItemsById = Object.fromEntries(
        (data.purchaseOrderItems ?? []).map((item) => [item.id, item])
      );
      const nextPurchaseOrderItems = purchaseOrderItems.map((item) =>
        purchaseOrderItemsById[item.id]
          ? { ...item, ...purchaseOrderItemsById[item.id] }
          : data.itemIds.includes(item.id)
            ? { ...item, status: "received" }
            : item
      );
      const nextPartRequestsById = { ...partRequestsById };

      for (const partRequest of data.partRequests ?? []) {
        if (partRequest?.id) {
          nextPartRequestsById[partRequest.id] = {
            ...nextPartRequestsById[partRequest.id],
            ...partRequest,
          };
        }
      }

      for (const partRequestId of data.partRequestIds) {
        if (nextPartRequestsById[partRequestId]) {
          nextPartRequestsById[partRequestId] = {
            ...nextPartRequestsById[partRequestId],
            status: "received",
          };
        }
      }

      setPurchaseOrders((currentPurchaseOrders) =>
        currentPurchaseOrders.map((currentPurchaseOrder) =>
          currentPurchaseOrder.id === purchaseOrder.id
            ? { ...currentPurchaseOrder, ...data.purchaseOrder }
            : currentPurchaseOrder
        )
      );
      setPurchaseOrderItems(nextPurchaseOrderItems);
      setPartRequestsById(nextPartRequestsById);

      await syncRepairJobStatusesAfterPartsReceived(
        data.partRequestIds.map(
          (partRequestId) => nextPartRequestsById[partRequestId]?.repair_job_id
        ),
        {
          nextPartRequestsById,
          nextPurchaseOrderItems,
          triggerDetails: {
            purchase_order_id: purchaseOrder.id,
            trigger: "purchase_order_received",
          },
        }
      );

      await logVehicleActivity({
        vehicleId: purchaseOrder.vehicle_id,
        action: "Purchase order status changed",
        details: {
          from: previousStatus,
          to: "received",
        },
      });

      setStatusSuccessMessage(
        successMessage || "Purchase order marked received."
      );
      return true;
    } catch (error) {
      setPurchaseOrders((currentPurchaseOrders) =>
        currentPurchaseOrders.map((currentPurchaseOrder) =>
          currentPurchaseOrder.id === purchaseOrder.id
            ? {
                ...currentPurchaseOrder,
                received_at: purchaseOrder.received_at,
                received_by: purchaseOrder.received_by,
                status: previousStatus,
              }
            : currentPurchaseOrder
        )
      );
      console.error("Could not mark purchase order received:", error);
      setStatusErrorMessage(
        "Could not mark this purchase order as received. Please try again."
      );
      return false;
    } finally {
      setUpdatingPurchaseOrderId(null);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadPurchaseOrders() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await fetchPurchaseOrdersData();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Could not load purchase orders:", error);
          setErrorMessage("Unable to load purchase orders.");
          return;
        }

        setPartRequestsById(
          Object.fromEntries(
            (data.partRequests ?? []).map((partRequest) => [
              partRequest.id,
              partRequest,
            ])
          )
        );
        setProfilesById(data.profilesById);
        setPurchaseOrders(data.purchaseOrders);
        setPurchaseOrderItems(data.purchaseOrderItems);
        setRepairJobsById(data.repairJobsById);
        setSelectedQuotesById(data.selectedQuotesById);
        setServiceCategoriesById(data.serviceCategoriesById);
        setVehicleDocuments(data.vehicleDocuments);
        setVehiclesById(data.vehiclesById);
        setVendorsById(data.vendorsById);
      } catch (error) {
        if (isMounted) {
          console.error("Could not load purchase orders:", error);
          setErrorMessage("Unable to load purchase orders.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPurchaseOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handlePurchaseOrderStatusChange(
    purchaseOrder,
    newStatus,
    { successMessage = "" } = {}
  ) {
    if (!canManagePurchaseOrders) {
      setStatusErrorMessage("Your role cannot update purchase orders.");
      return false;
    }

    if (!purchaseOrderStatuses.includes(newStatus)) {
      setStatusErrorMessage("That purchase order status is not allowed.");
      return false;
    }

    if (newStatus === "received") {
      return handleMarkPurchaseOrderReceived(purchaseOrder, { successMessage });
    }

    const previousStatus = purchaseOrder.status;
    const shouldCancelItems = newStatus === "cancelled";
    const shouldMarkReceived = newStatus === "received";
    const failureMessage = shouldMarkReceived
      ? "Could not mark this purchase order as received. Please try again."
      : "Could not update purchase order. Please try again.";
    const receivedAt =
      shouldMarkReceived && !purchaseOrder.received_at
        ? new Date().toISOString()
        : purchaseOrder.received_at;
    const receivedBy =
      shouldMarkReceived && currentProfile?.id
        ? currentProfile.id
        : purchaseOrder.received_by ?? null;

    setStatusErrorMessage("");
    setStatusSuccessMessage("");
    setUpdatingPurchaseOrderId(purchaseOrder.id);
    if (shouldMarkReceived && currentProfile?.id) {
      setProfilesById((currentProfilesById) => ({
        ...currentProfilesById,
        [currentProfile.id]: currentProfile,
      }));
    }
    setPurchaseOrders((currentPurchaseOrders) =>
      currentPurchaseOrders.map((currentPurchaseOrder) =>
        currentPurchaseOrder.id === purchaseOrder.id
          ? {
              ...currentPurchaseOrder,
              received_at: receivedAt,
              received_by: receivedBy,
              status: newStatus,
            }
          : currentPurchaseOrder
      )
    );

    try {
      const purchaseOrderUpdate = { status: newStatus };

      if (shouldMarkReceived && !purchaseOrder.received_at) {
        purchaseOrderUpdate.received_at = receivedAt;
      }

      if (shouldMarkReceived && currentProfile?.id) {
        purchaseOrderUpdate.received_by = currentProfile.id;
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update(purchaseOrderUpdate)
        .eq("id", purchaseOrder.id);

      if (error) {
        console.error("Could not update purchase order:", error);
        throw error;
      }

      const linkedItems = itemsByPurchaseOrderId[purchaseOrder.id] ?? [];
      let nextPurchaseOrderItems = purchaseOrderItems;
      let nextPartRequestsById = partRequestsById;

      if ((shouldMarkReceived || shouldCancelItems) && linkedItems.length > 0) {
        const activeLinkedItems = linkedItems.filter(
          (item) => !isPurchaseOrderItemReturned(item)
        );
        const itemIds = activeLinkedItems.map((item) => item.id).filter(Boolean);
        const partRequestIds = uniqueValues(
          activeLinkedItems.map((item) => item.part_request_id)
        );
        const nextItemStatus = shouldMarkReceived ? "received" : "cancelled";

        if (itemIds.length > 0) {
          const itemResponse = await supabase
            .from("purchase_order_items")
            .update({ status: nextItemStatus })
            .in("id", itemIds);

          if (itemResponse.error) {
            console.error("Could not update purchase order items:", itemResponse.error);
            setStatusErrorMessage(failureMessage);
            return false;
          }

          nextPurchaseOrderItems = purchaseOrderItems.map((item) =>
            itemIds.includes(item.id)
              ? { ...item, status: nextItemStatus }
              : item
          );
          setPurchaseOrderItems(nextPurchaseOrderItems);
        }

        if (shouldMarkReceived && partRequestIds.length > 0) {
          const partRequestResponse = await supabase
            .from("part_requests")
            .update({ status: "received" })
            .in("id", partRequestIds);

          if (partRequestResponse.error) {
            console.error(
              "Could not update linked part requests after receiving purchase order:",
              partRequestResponse.error
            );
            setStatusErrorMessage(failureMessage);
            return false;
          }

          nextPartRequestsById = { ...partRequestsById };

          for (const partRequestId of partRequestIds) {
            if (nextPartRequestsById[partRequestId]) {
              nextPartRequestsById[partRequestId] = {
                ...nextPartRequestsById[partRequestId],
                status: "received",
              };
            }
          }

          setPartRequestsById(nextPartRequestsById);

          await syncRepairJobStatusesAfterPartsReceived(
            partRequestIds.map(
              (partRequestId) =>
                nextPartRequestsById[partRequestId]?.repair_job_id
            ),
            {
              nextPartRequestsById,
              nextPurchaseOrderItems,
              triggerDetails: {
                purchase_order_id: purchaseOrder.id,
                trigger: "purchase_order_received",
              },
            }
          );
        }
      }

      await logVehicleActivity({
        vehicleId: purchaseOrder.vehicle_id,
        action: "Purchase order status changed",
        details: {
          from: previousStatus,
          to: newStatus,
        },
      });
      setStatusSuccessMessage(
        successMessage || `Purchase order marked ${formatPurchaseOrderLabel(newStatus).toLowerCase()}.`
      );
      return true;
    } catch (error) {
      setPurchaseOrders((currentPurchaseOrders) =>
        currentPurchaseOrders.map((currentPurchaseOrder) =>
          currentPurchaseOrder.id === purchaseOrder.id
            ? {
                ...currentPurchaseOrder,
                received_at: purchaseOrder.received_at,
                received_by: purchaseOrder.received_by,
                status: previousStatus,
              }
            : currentPurchaseOrder
        )
      );
      console.error("Could not update purchase order:", error);
      setStatusErrorMessage(failureMessage);
      return false;
    } finally {
      setUpdatingPurchaseOrderId(null);
    }
  }

  async function handleItemStatusChange(item, newStatus, purchaseOrder) {
    if (!canManagePurchaseOrders) {
      setStatusErrorMessage("Your role cannot update purchase order items.");
      return;
    }

    if (!purchaseOrderItemStatuses.includes(newStatus)) {
      setStatusErrorMessage("That item status is not allowed.");
      return;
    }

    const previousStatus = item.status;
    const nextPurchaseOrderItems = purchaseOrderItems.map((currentItem) =>
      currentItem.id === item.id
        ? { ...currentItem, status: newStatus }
        : currentItem
    );

    setStatusErrorMessage("");
    setStatusSuccessMessage("");
    setUpdatingItemId(item.id);
    setPurchaseOrderItems(nextPurchaseOrderItems);

    try {
      const { error } = await supabase
        .from("purchase_order_items")
        .update({ status: newStatus })
        .eq("id", item.id);

      if (error) {
        console.error("Could not update purchase order item:", error);
        throw error;
      }

      if (newStatus === "received" && item.part_request_id) {
        const partRequestResponse = await supabase
          .from("part_requests")
          .update({ status: "received" })
          .eq("id", item.part_request_id);

        if (partRequestResponse.error) {
          console.error(
            "Could not update linked part request after receiving item:",
            partRequestResponse.error
          );
          setStatusErrorMessage("Could not update item status. Please try again.");
          return;
        }

        const nextPartRequestsById = {
          ...partRequestsById,
          [item.part_request_id]: {
            ...partRequestsById[item.part_request_id],
            status: "received",
          },
        };

        setPartRequestsById(nextPartRequestsById);

        await syncRepairJobStatusesAfterPartsReceived(
          [nextPartRequestsById[item.part_request_id]?.repair_job_id],
          {
            nextPartRequestsById,
            nextPurchaseOrderItems,
            triggerDetails: {
              purchase_order_id: purchaseOrder.id,
              purchase_order_item_id: item.id,
              trigger: "purchase_order_item_received",
            },
          }
        );
      }

      await logVehicleActivity({
        vehicleId: purchaseOrder.vehicle_id,
        action: "Purchase order item status changed",
        details: {
          description: item.description,
          from: previousStatus,
          to: newStatus,
        },
      });
      setStatusSuccessMessage("Item status updated.");
    } catch (error) {
      setPurchaseOrderItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, status: previousStatus }
            : currentItem
        )
      );
      console.error("Could not update purchase order item:", error);
      setStatusErrorMessage("Could not update item status. Please try again.");
    } finally {
      setUpdatingItemId(null);
    }
  }

  function handleOpenMarkReturned(item, purchaseOrder) {
    if (!canManageReturns) {
      setStatusErrorMessage("Your role cannot mark parts returned.");
      return;
    }

    setStatusErrorMessage("");
    setStatusSuccessMessage("");
    setReturningItemContext({ item, purchaseOrder });
  }

  function handleReturnedItemUpdated(updatedItem) {
    if (!updatedItem?.id) {
      return;
    }

    if (currentProfile?.id) {
      setProfilesById((currentProfilesById) => ({
        ...currentProfilesById,
        [currentProfile.id]: currentProfile,
      }));
    }

    setPurchaseOrderItems((currentItems) =>
      currentItems.map((item) =>
        item.id === updatedItem.id ? { ...item, ...updatedItem } : item
      )
    );
    setStatusErrorMessage("");
    setStatusSuccessMessage("Part marked returned.");
  }

  function clearSearch() {
    setSearchTerm("");
  }

  function toggleDetails(purchaseOrderId) {
    setExpandedPurchaseOrderIds((currentIds) =>
      currentIds.includes(purchaseOrderId)
        ? currentIds.filter((currentId) => currentId !== purchaseOrderId)
        : [...currentIds, purchaseOrderId]
    );
  }

  async function handleConfirmMarkReceived() {
    if (!confirmReceivedOrder) {
      return;
    }

    if (updatingPurchaseOrderId === confirmReceivedOrder.id) {
      return;
    }

    const success = await handlePurchaseOrderStatusChange(
      confirmReceivedOrder,
      "received",
      { successMessage: "Purchase order marked received." }
    );

    if (success) {
      setConfirmReceivedOrder(null);
    }
  }

  async function handleCancelPurchaseOrder(purchaseOrder) {
    if (!window.confirm("Cancel this purchase order?")) {
      return;
    }

    await handlePurchaseOrderStatusChange(purchaseOrder, "cancelled", {
      successMessage: "Purchase order cancelled.",
    });
  }

  function handleDocumentAdded(documentRecord) {
    if (!documentRecord?.id) {
      return;
    }

    setVehicleDocuments((currentDocuments) => [
      documentRecord,
      ...currentDocuments.filter(
        (currentDocument) => currentDocument.id !== documentRecord.id
      ),
    ]);
  }

  function handleDocumentDeleted(deletedDocument) {
    if (!deletedDocument?.id) {
      return;
    }

    setVehicleDocuments((currentDocuments) =>
      currentDocuments.filter(
        (documentRecord) => documentRecord.id !== deletedDocument.id
      )
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Purchase Orders
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Track ordered parts, vendors, costs, and receiving status.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <OperationalSearchBar
            id="purchase-order-search"
            label="Search purchase orders"
            onChange={setSearchTerm}
            onClear={clearSearch}
            placeholder="Search VIN, stock, PO, vendor, part..."
            resultCount={filteredPurchaseOrders.length}
            totalCount={countsByTab[activeTab] ?? enrichedPurchaseOrders.length}
            value={searchTerm}
          />
        </div>

        <div className="mt-4">
          <PurchaseOrderTabs
            activeTab={activeTab}
            counts={countsByTab}
            onChange={setActiveTab}
          />
        </div>
      </section>

      {isLoading && (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-700">
            Loading purchase orders...
          </p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {errorMessage}
        </section>
      )}

      {!isLoading && statusErrorMessage && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {statusErrorMessage}
        </section>
      )}

      {!isLoading && statusSuccessMessage && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {statusSuccessMessage}
        </section>
      )}

      {!isLoading && !errorMessage && filteredPurchaseOrders.length === 0 && (
        <PurchaseOrderEmptyState
          activeTab={activeTab}
          hasSearch={Boolean(debouncedSearchTerm.trim())}
          onClearSearch={clearSearch}
        />
      )}

      {!isLoading && !errorMessage && filteredPurchaseOrders.length > 0 && (
        <section className="space-y-3">
          {filteredPurchaseOrders.map((purchaseOrder) => (
            <PurchaseOrderCard
              activeTab={activeTab}
              canDeleteDocuments={canDeleteDocuments}
              canManagePurchaseOrders={canManagePurchaseOrders}
              canManageReturns={canManageReturns}
              canUploadDocuments={canUploadDocuments}
              currentProfile={currentProfile}
              documents={purchaseOrder.documents}
              isExpanded={expandedPurchaseOrderIds.includes(purchaseOrder.id)}
              isUpdating={updatingPurchaseOrderId === purchaseOrder.id}
              key={purchaseOrder.id}
              onCancel={handleCancelPurchaseOrder}
              onDocumentAdded={handleDocumentAdded}
              onDocumentDeleted={handleDocumentDeleted}
              onItemStatusChange={handleItemStatusChange}
              onMarkReceived={setConfirmReceivedOrder}
              onMarkReturned={handleOpenMarkReturned}
              onOpenVehicle={onSelectVehicle}
              onStatusChange={handlePurchaseOrderStatusChange}
              onToggleDetails={toggleDetails}
              purchaseOrder={purchaseOrder}
              updatingItemId={updatingItemId}
            />
          ))}
        </section>
      )}

      {confirmReceivedOrder && (
        <MarkReceivedModal
          isSubmitting={updatingPurchaseOrderId === confirmReceivedOrder.id}
          onClose={() => setConfirmReceivedOrder(null)}
          onConfirm={handleConfirmMarkReceived}
          purchaseOrder={confirmReceivedOrder}
          subtitle={getVendorName(confirmReceivedOrder)}
        />
      )}

      {returningItemContext && canManageReturns && (
        <MarkReturnedModal
          currentProfile={currentProfile}
          item={returningItemContext.item}
          key={returningItemContext.item.id}
          onClose={() => setReturningItemContext(null)}
          onReturned={handleReturnedItemUpdated}
          purchaseOrder={returningItemContext.purchaseOrder}
          vehicleId={returningItemContext.purchaseOrder?.vehicle_id}
        />
      )}
    </div>
  );
}

export default PurchaseOrdersPage;
