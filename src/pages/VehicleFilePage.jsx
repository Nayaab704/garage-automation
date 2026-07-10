import { useEffect, useMemo, useState } from "react";
import AppIcon from "../components/ui/AppIcon";
import { buttonClassNames } from "../components/ui/uiStyles";
import VehicleColorLabel from "../components/VehicleColorLabel";
import VehiclePrebookingBadge from "../components/VehiclePrebookingBadge";
import VehicleStatusBadge from "../components/VehicleStatusBadge";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import { isThirdPartyRepairActive } from "../lib/thirdPartyRepairWorkflow";
import { formatUserFirstName } from "../lib/userDisplay";
import { getVehiclePrimaryPhoto } from "../lib/vehicleDisplayPhoto";
import { activePrebookingBadgeColumns } from "../lib/vehiclePrebookings";
import { getWorkOrderStatusLabel } from "../lib/workOrderStatus";

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

function getVehicleSubtitle(vehicle) {
  return [vehicle?.trim, vehicle?.vin ? `VIN ${vehicle.vin}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function getServiceCategoryName(serviceCategories, repairJob) {
  const category = serviceCategories.find(
    (serviceCategory) => serviceCategory.id === repairJob?.service_category_id
  );

  return category?.name ?? formatLabel(repairJob?.category, "Service Work");
}

function getRecordById(records, id) {
  return records.find((record) => record?.id === id) ?? null;
}

function getProfileName(profiles, profileId) {
  const profile = getRecordById(profiles, profileId);
  return profile ? formatUserFirstName(profile) : "";
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

function getThirdPartyTotal(thirdPartyRepair) {
  return (
    numberOrZero(thirdPartyRepair?.repair_cost) +
    numberOrZero(thirdPartyRepair?.transit_cost)
  );
}

function getLaborTotal(laborLog) {
  return numberOrZero(laborLog?.hours) * numberOrZero(laborLog?.hourly_rate);
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

  if (["returned", "cancelled", "rejected", "issue"].includes(normalizedStatus)) {
    return "bg-red-50 text-red-700 ring-red-200";
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

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function VehicleFileHeader({
  activePrebooking,
  hasActiveThirdPartyRepair,
  photo,
  vehicle,
}) {
  const title = getVehicleTitle(vehicle);
  const subtitle = getVehicleSubtitle(vehicle);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:h-24 sm:w-36">
          {photo?.photo_url ? (
            <img
              alt={`${title} thumbnail`}
              className="h-full w-full object-cover"
              src={photo.photo_url}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <AppIcon name="car" size={34} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-500">
            {displayValue(vehicle.stock_number, "No stock number")}
          </p>
          <h2 className="mt-0.5 truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 break-words text-sm font-semibold text-slate-500">
              {subtitle}
            </p>
          )}

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
            {hasActiveThirdPartyRepair && (
              <span className="inline-flex h-7 items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                3rd-Party
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs leading-5 text-slate-600 sm:text-sm">
            {vehicle.mileage !== null && vehicle.mileage !== undefined && (
              <span className="font-semibold">
                {formatNumber(vehicle.mileage)} mi
              </span>
            )}
            <VehicleColorLabel color={vehicle.color} showLabel />
            {vehicle.vin && (
              <span className="break-all font-mono font-semibold">
                {vehicle.vin}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkOrderCard({
  partRequests,
  purchaseOrderItemsByPartRequestId,
  purchaseOrdersById,
  repairJob,
  serviceCategories,
  thirdPartyRepairs,
  vendors,
}) {
  const partsForJob = partRequests.filter(
    (partRequest) => partRequest.repair_job_id === repairJob.id
  );
  const thirdPartyForJob = thirdPartyRepairs.filter(
    (thirdPartyRepair) => thirdPartyRepair.repair_job_id === repairJob.id
  );
  const categoryName = getServiceCategoryName(serviceCategories, repairJob);
  const hasActiveOutsideWork = thirdPartyForJob.some(isThirdPartyRepairActive);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-slate-950">
            {displayValue(repairJob.title, "Work order")}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {categoryName}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill status={getWorkOrderStatusLabel(repairJob.status)} />
          <span className="inline-flex h-7 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
            {partsForJob.length} {partsForJob.length === 1 ? "part" : "parts"}
          </span>
          {hasActiveOutsideWork && (
            <span className="inline-flex h-7 items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              3rd-Party
            </span>
          )}
        </div>
      </div>

      {partsForJob.length > 0 && (
        <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
          {partsForJob.map((partRequest) => {
            const item = purchaseOrderItemsByPartRequestId[partRequest.id];
            const purchaseOrder = purchaseOrdersById[item?.purchase_order_id];
            const vendorName =
              getVendorName(vendors, item?.vendor_id) ||
              getVendorName(vendors, item?.purchase_order_vendor_id) ||
              getVendorName(vendors, purchaseOrder?.vendor_id) ||
              getVendorName(vendors, partRequest.selected_vendor_id) ||
              "No vendor";
            const status =
              item?.return_status ||
              item?.status ||
              partRequest.status ||
              partRequest.approval_status;
            const total = getPartItemTotal(item);

            return (
              <div
                className="grid gap-2 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                key={partRequest.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-800">
                    {getPartName(partRequest)}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                    {vendorName}
                  </p>
                </div>
                <StatusPill status={status} />
                <p className="text-sm font-black text-slate-800">
                  {total === null ? "No cost" : formatCurrency(total)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function WorkPartsTab({
  partRequests,
  purchaseOrderItems,
  purchaseOrders,
  repairJobs,
  serviceCategories,
  thirdPartyRepairs,
  vendors,
}) {
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
  const partsTotal = purchaseOrderItems.reduce(
    (total, item) => total + numberOrZero(getPartItemTotal(item)),
    0
  );
  const thirdPartyTotal = thirdPartyRepairs.reduce(
    (total, thirdPartyRepair) => total + getThirdPartyTotal(thirdPartyRepair),
    0
  );
  const shouldShowTotals =
    purchaseOrderItems.length > 0 || thirdPartyRepairs.length > 0;

  return (
    <div className="space-y-3">
      {repairJobs.length === 0 && unassignedParts.length === 0 ? (
        <EmptyState>No work orders or parts are recorded for this vehicle yet.</EmptyState>
      ) : (
        repairJobs.map((repairJob) => (
          <WorkOrderCard
            key={repairJob.id}
            partRequests={partRequests}
            purchaseOrderItemsByPartRequestId={purchaseOrderItemsByPartRequestId}
            purchaseOrdersById={purchaseOrdersById}
            repairJob={repairJob}
            serviceCategories={serviceCategories}
            thirdPartyRepairs={thirdPartyRepairs}
            vendors={vendors}
          />
        ))
      )}

      {unassignedParts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Unassigned Parts</h3>
          <div className="mt-3 divide-y divide-slate-100">
            {unassignedParts.map((partRequest) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 py-2"
                key={partRequest.id}
              >
                <span className="text-sm font-bold text-slate-800">
                  {getPartName(partRequest)}
                </span>
                <StatusPill status={partRequest.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {shouldShowTotals && (
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricCard label="Parts Total" value={formatCurrency(partsTotal)} />
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
  investmentSummary,
  laborLogs,
  profiles,
  purchaseOrderItems,
  repairJobs,
  thirdPartyRepairs,
}) {
  const canViewAdminFinancial = ["admin", "owner"].includes(currentProfile?.role);
  const userLaborLogs = laborLogs.filter(
    (laborLog) => laborLog.technician_id === currentProfile?.id
  );
  const visibleLaborLogs = canViewAdminFinancial ? laborLogs : userLaborLogs;
  const partsTotal = purchaseOrderItems.reduce(
    (total, item) => total + numberOrZero(getPartItemTotal(item)),
    0
  );
  const thirdPartyTotal = thirdPartyRepairs.reduce(
    (total, thirdPartyRepair) => total + getThirdPartyTotal(thirdPartyRepair),
    0
  );
  const laborTotal = visibleLaborLogs.reduce(
    (total, laborLog) => total + getLaborTotal(laborLog),
    0
  );
  const extraCostsTotal = costEntries.reduce(
    (total, costEntry) => total + getExtraCostAmount(costEntry),
    0
  );
  const totalInvestment =
    investmentSummary?.total_invested ??
    partsTotal + thirdPartyTotal + laborTotal + extraCostsTotal;

  if (!canViewAdminFinancial && currentProfile?.role !== "technician") {
    return (
      <EmptyState>Financial details are limited for your role.</EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {canViewAdminFinancial ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Parts" value={formatCurrency(partsTotal)} />
          <MetricCard label="Third-Party" value={formatCurrency(thirdPartyTotal)} />
          <MetricCard label="Labor" value={formatCurrency(laborTotal)} />
          <MetricCard label="Extra Costs" value={formatCurrency(extraCostsTotal)} />
          <MetricCard label="Total Investment" value={formatCurrency(totalInvestment)} />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
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
        <h3 className="text-sm font-black text-slate-950">
          {canViewAdminFinancial ? "Labor Entries" : "My Labor Entries"}
        </h3>
        {visibleLaborLogs.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-slate-500">
            No labor entries found.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {visibleLaborLogs.map((laborLog) => {
              const repairJob = getRecordById(repairJobs, laborLog.repair_job_id);
              const technicianName = getProfileName(profiles, laborLog.technician_id);

              return (
                <div
                  className="grid gap-2 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                  key={laborLog.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-800">
                      {technicianName || "Technician"}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                      {repairJob?.title ?? "Work order unavailable"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-600">
                    {formatNumber(laborLog.hours)} hr
                  </span>
                  <span className="text-sm font-black text-slate-800">
                    {formatCurrency(getLaborTotal(laborLog))}
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

function getActivitySummary(details) {
  if (!details || typeof details !== "object") {
    return "";
  }

  return Object.entries(details)
    .filter(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      return (
        !normalizedKey.endsWith("id") &&
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

function ActivityTab({ activityLogs, profiles }) {
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
        const summary = getActivitySummary(activityLog.details);

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
                className="flex min-w-0 items-center justify-between gap-3 py-2 text-sm transition hover:text-emerald-700"
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

async function fetchVehicleFileData(vehicleId) {
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
    supabase.from("profiles").select("id, full_name, email, role"),
    supabase.from("cost_entries").select("*").eq("vehicle_id", vehicleId),
    supabase
      .from("vehicle_documents")
      .select(vehicleDocumentColumns)
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("id, vehicle_id, user_id, action, details, created_at")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("active_vehicle_prebooking_badges")
      .select(activePrebookingBadgeColumns)
      .eq("vehicle_id", vehicleId)
      .maybeSingle(),
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
  const investmentSummaryResponse = await supabase
    .from("vehicle_investment_summary")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
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
      serviceCategories: serviceCategoriesResponse.data ?? [],
      thirdPartyRepairs: thirdPartyRepairsResponse.data ?? [],
      vehicle: vehicleResponse.data,
      vendors: vendorsResponse.data ?? [],
    },
    error: null,
  };
}

function VehicleFilePage({
  currentProfile,
  onBack,
  onOpenVehicleDetail,
  vehicleId,
}) {
  const [activeTab, setActiveTab] = useState("work_parts");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const canOpenVehicle = Boolean(vehicleId);
  const canViewVehicleFile =
    canOpenVehicle &&
    (hasPermission(currentProfile?.role, "repair:manage") ||
      hasPermission(currentProfile?.role, "dashboard:view") ||
      hasPermission(currentProfile?.role, "sale:manage") ||
      hasPermission(currentProfile?.role, "vehicle:change_status"));

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
        const response = await fetchVehicleFileData(vehicleId);

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
  }, [canViewVehicleFile, vehicleId]);

  const primaryPhoto = data
    ? getVehiclePrimaryPhoto(data.vehicle, data.photos)
    : null;
  const hasActiveThirdPartyRepair =
    data?.thirdPartyRepairs?.some(isThirdPartyRepairActive) ?? false;

  return (
    <div className="space-y-4 text-slate-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
            Vehicle File
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            Vehicle File
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Complete work, parts, labor, costs, activity, and documents for this vehicle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClassNames.secondary} onClick={onBack} type="button">
            <AppIcon className="rotate-180" name="chevron-right" size={17} />
            Back
          </button>
          {vehicleId && (
            <button
              className={buttonClassNames.secondary}
              onClick={() => onOpenVehicleDetail?.(vehicleId)}
              type="button"
            >
              <AppIcon name="car" size={17} />
              Open Vehicle Detail
            </button>
          )}
        </div>
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
          <h2 className="text-lg font-black text-slate-950">Vehicle not found.</h2>
          <p className="mt-2 text-sm text-slate-500">
            This vehicle may have been removed or is no longer available.
          </p>
        </section>
      )}

      {!isLoading && !errorMessage && data?.vehicle && (
        <>
          <VehicleFileHeader
            activePrebooking={data.activePrebooking}
            hasActiveThirdPartyRepair={hasActiveThirdPartyRepair}
            photo={primaryPhoto}
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
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
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
              partRequests={data.partRequests}
              purchaseOrderItems={data.purchaseOrderItems}
              purchaseOrders={data.purchaseOrders}
              repairJobs={data.repairJobs}
              serviceCategories={data.serviceCategories}
              thirdPartyRepairs={data.thirdPartyRepairs}
              vendors={data.vendors}
            />
          )}

          {activeTab === "financial" && (
            <FinancialTab
              costEntries={data.costEntries}
              currentProfile={currentProfile}
              investmentSummary={data.investmentSummary}
              laborLogs={data.laborLogs}
              profiles={data.profiles}
              purchaseOrderItems={data.purchaseOrderItems}
              repairJobs={data.repairJobs}
              thirdPartyRepairs={data.thirdPartyRepairs}
            />
          )}

          {activeTab === "activity" && (
            <ActivityTab
              activityLogs={data.activityLogs}
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
        </>
      )}
    </div>
  );
}

export default VehicleFilePage;
