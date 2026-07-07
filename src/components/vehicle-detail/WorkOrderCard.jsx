import { useState } from "react";
import ActionTile from "../ui/ActionTile";
import AppIcon from "../ui/AppIcon";
import PriorityBadge from "../ui/PriorityBadge";
import StatusBadge from "../ui/StatusBadge";
import AddThirdPartyRepairForm from "./AddThirdPartyRepairForm";
import AddWorkOrderLaborForm from "./AddWorkOrderLaborForm";
import AddWorkOrderPartForm from "./AddWorkOrderPartForm";
import AddWorkOrderPhotoForm from "./AddWorkOrderPhotoForm";
import ThirdPartyRepairsList from "./ThirdPartyRepairsList";
import WorkOrderLaborList from "./WorkOrderLaborList";
import WorkOrderPartsList from "./WorkOrderPartsList";
import WorkOrderPhotosList from "./WorkOrderPhotosList";
import { getPurchaseOrderItemNetTotal } from "../../lib/partReturns";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatCurrency(value) {
  const numberValue = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(numberValue) ? numberValue : 0);
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

function formatStatusLabel(status) {
  if (!status) {
    return "Not available";
  }

  return String(status)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getProfileName(profiles, profileId) {
  const profile = profiles.find((profileRecord) => profileRecord.id === profileId);

  if (!profile) {
    return null;
  }

  return profile.full_name || profile.email || null;
}

function getLaborHours(laborLogs) {
  return laborLogs.reduce(
    (sum, laborLog) => sum + Number(laborLog.hours || 0),
    0
  );
}

function formatLaborHours(laborLogs) {
  const totalHours = getLaborHours(laborLogs);

  if (totalHours === 0) {
    return "0h";
  }

  return `${Number(totalHours.toFixed(2))}h`;
}

function formatLaborSummary(laborLogs) {
  const totalHours = getLaborHours(laborLogs);

  if (totalHours === 0) {
    return "0 hours";
  }

  const formattedHours = Number(totalHours.toFixed(2));
  return `${formattedHours} ${formattedHours === 1 ? "hour" : "hours"}`;
}

function getVendorName(vendors, vendorId) {
  const vendor = vendors.find((vendorRecord) => vendorRecord.id === vendorId);
  return vendor?.name || "Unknown Vendor";
}

function getPurchaseOrderTotal(items) {
  return items.reduce((total, item) => {
    return total + getPurchaseOrderItemNetTotal(item);
  }, 0);
}

function hasPartsNeedingAttention(parts) {
  return parts.some(
    (part) =>
      part.part_source === "needs_to_buy" &&
      (part.approval_status === "pending" ||
        part.approval_status === "rejected")
  );
}

function getDefaultOpenSection(parts) {
  return hasPartsNeedingAttention(parts) ? "parts" : null;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function CompactStat({ icon, label, value }) {
  return (
    <span
      aria-label={`${label}: ${value}`}
      className="inline-flex h-7 items-center gap-1 rounded-lg bg-slate-50 px-2 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-100"
      title={`${label}: ${value}`}
    >
      <AppIcon className="text-slate-500" name={icon} size={13} />
      <span className="text-slate-950">{value}</span>
    </span>
  );
}

function SectionAccordion({
  children,
  icon,
  isOpen,
  onToggle,
  summary,
  title,
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
        isOpen ? "border-emerald-300" : "border-slate-200"
      }`}
    >
      <button
        className={`flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition ${
          isOpen ? "bg-emerald-50/60" : "hover:bg-slate-50"
        }`}
        onClick={onToggle}
        type="button"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"
          }`}
        >
          <AppIcon name={icon} size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-slate-950">
            {title}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-slate-500">
          {summary}
        </span>
        <AppIcon
          className={`shrink-0 text-slate-500 transition ${
            isOpen ? "-rotate-90" : "rotate-90"
          }`}
          name="chevron-right"
          size={17}
        />
      </button>

      {isOpen && <div className="border-t border-slate-100 p-3">{children}</div>}
    </section>
  );
}

function PurchaseOrdersList({ purchaseOrderItems, purchaseOrders, vendors }) {
  if (purchaseOrders.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-500">
        No purchase orders linked to this work order yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {purchaseOrders.map((purchaseOrder) => {
        const items = purchaseOrderItems.filter(
          (item) => item.purchase_order_id === purchaseOrder.id
        );

        return (
          <article
            className="rounded-md border border-zinc-100 bg-white p-3"
            key={purchaseOrder.id}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h6 className="font-semibold text-zinc-950">
                  {getVendorName(vendors, purchaseOrder.vendor_id)}
                </h6>
                <p className="mt-1 text-sm text-zinc-500">
                  Ordered {formatDate(purchaseOrder.ordered_at ?? purchaseOrder.created_at)}
                </p>
              </div>
              <span className="w-fit rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                {formatStatusLabel(purchaseOrder.status)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-zinc-600">
              <span>{pluralize(items.length, "item")}</span>
              <span aria-hidden="true">|</span>
              <span className="font-semibold text-zinc-950">
                {formatCurrency(getPurchaseOrderTotal(items))}
              </span>
            </div>

            {purchaseOrder.notes && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                {purchaseOrder.notes}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function WorkOrderCard({
  canManageLabor,
  canManageParts,
  canManagePhotos,
  canManageDocuments,
  canManageThirdPartyRepairs,
  canUploadDocuments,
  currentProfile,
  documents,
  index,
  isOpen,
  laborLogs,
  onActivityLogged,
  onDocumentAdded,
  onDocumentDeleted,
  onLaborAdded,
  onLaborDeleted,
  onToggle,
  onPartAdded,
  onPartApprovalUpdated,
  onPartPurchaseOrderCreated,
  onPurchaseOrderItemUpdated,
  onPhotoAdded,
  onPhotoDeleted,
  onThirdPartyRepairAdded,
  onThirdPartyRepairDeleted,
  parts,
  photos,
  profiles,
  purchaseOrderItems = [],
  purchaseOrders = [],
  thirdPartyRepairs,
  vehicle,
  vehicleId,
  vendors,
  workOrder,
}) {
  const [isLaborFormOpen, setIsLaborFormOpen] = useState(false);
  const [isPartFormOpen, setIsPartFormOpen] = useState(false);
  const [isPhotoFormOpen, setIsPhotoFormOpen] = useState(false);
  const [isThirdPartyFormOpen, setIsThirdPartyFormOpen] = useState(false);
  const [openSection, setOpenSection] = useState(() =>
    getDefaultOpenSection(parts)
  );
  const creatorName = getProfileName(profiles, workOrder.created_by);
  const laborValue = formatLaborHours(laborLogs);
  const workOrderPartIds = new Set(parts.map((part) => part.id).filter(Boolean));
  const linkedPurchaseOrderItems = purchaseOrderItems.filter((item) =>
    workOrderPartIds.has(item.part_request_id)
  );
  const linkedPurchaseOrderIds = new Set(
    linkedPurchaseOrderItems.map((item) => item.purchase_order_id).filter(Boolean)
  );
  const linkedPurchaseOrders = purchaseOrders.filter((purchaseOrder) =>
    linkedPurchaseOrderIds.has(purchaseOrder.id)
  );

  function toggleSection(sectionName) {
    setOpenSection((currentSection) =>
      currentSection === sectionName ? null : sectionName
    );
  }

  function openPurchaseOrdersSection() {
    setOpenSection("purchase_orders");
  }

  return (
    <article
      className={`rounded-2xl border bg-white shadow-sm transition ${
        isOpen
          ? "border-blue-500 shadow-[0_10px_26px_rgba(37,99,235,0.14)]"
        : "border-slate-200 hover:border-blue-200"
      }`}
    >
      <button
        className="w-full px-3 py-2.5 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
              isOpen
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h4 className="min-w-0 flex-1 truncate text-sm font-black leading-5 text-slate-950 sm:text-base">
                {displayValue(workOrder.title)}
              </h4>
              <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
                <PriorityBadge className="whitespace-nowrap" priority={workOrder.priority} />
                <StatusBadge className="whitespace-nowrap" status={workOrder.status} />
                <CompactStat icon="camera" label="Photos" value={photos.length} />
                <CompactStat icon="clock" label="Labor" value={laborValue} />
                <CompactStat icon="box" label="Parts" value={parts.length} />
                <CompactStat
                  icon="users"
                  label="3rd-Party"
                  value={thirdPartyRepairs.length}
                />
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 xl:hidden">
              <PriorityBadge className="whitespace-nowrap" priority={workOrder.priority} />
              <StatusBadge className="whitespace-nowrap" status={workOrder.status} />
              <CompactStat icon="camera" label="Photos" value={photos.length} />
              <CompactStat icon="clock" label="Labor" value={laborValue} />
              <CompactStat icon="box" label="Parts" value={parts.length} />
              <CompactStat
                icon="users"
                label="3rd-Party"
                value={thirdPartyRepairs.length}
              />
            </div>
          </div>

          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              isOpen
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-50 text-slate-500"
            }`}
          >
            <AppIcon
              className={`transition ${isOpen ? "-rotate-90" : "rotate-90"}`}
              name="chevron-right"
              size={17}
            />
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-3">
          {creatorName && (
            <p className="mb-3 truncate text-xs font-medium text-slate-500">
              Created by {creatorName}
            </p>
          )}

          {(canManageLabor ||
            canManageParts ||
            canManagePhotos ||
            canManageThirdPartyRepairs) && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Quick Actions
              </p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {canManagePhotos && (
                  <ActionTile
                    icon="camera"
                    label="Add Photo"
                    onClick={() => setIsPhotoFormOpen(true)}
                    variant="quick"
                  />
                )}

                {canManageLabor && (
                  <ActionTile
                    icon="clock"
                    label="Add Labor"
                    onClick={() => setIsLaborFormOpen(true)}
                    variant="quick"
                  />
                )}

                {canManageParts && (
                  <ActionTile
                    icon="box"
                    label="Add Part"
                    onClick={() => setIsPartFormOpen(true)}
                    variant="quick"
                  />
                )}

                {canManageThirdPartyRepairs && (
                  <ActionTile
                    icon="users"
                    label="Add 3rd-Party"
                    onClick={() => setIsThirdPartyFormOpen(true)}
                    variant="quick"
                  />
                )}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <SectionAccordion
              icon="camera"
              isOpen={openSection === "photos"}
              onToggle={() => toggleSection("photos")}
              summary={pluralize(photos.length, "photo")}
              title="Photos"
            >
              <WorkOrderPhotosList
                canManage={canManagePhotos}
                hideHeader
                showAddButton={false}
                onActivityLogged={onActivityLogged}
                onPhotoAdded={onPhotoAdded}
                onPhotoDeleted={onPhotoDeleted}
                photos={photos}
                vehicleId={vehicleId}
                workOrder={workOrder}
              />
            </SectionAccordion>

            <SectionAccordion
              icon="clock"
              isOpen={openSection === "labor"}
              onToggle={() => toggleSection("labor")}
              summary={formatLaborSummary(laborLogs)}
              title="Labor"
            >
              <WorkOrderLaborList
                canManage={canManageLabor}
                currentProfile={currentProfile}
                hideHeader
                laborLogs={laborLogs}
                onActivityLogged={onActivityLogged}
                onLaborDeleted={onLaborDeleted}
                profiles={profiles}
                vehicleId={vehicleId}
              />
            </SectionAccordion>

            <SectionAccordion
              icon="box"
              isOpen={openSection === "parts"}
              onToggle={() => toggleSection("parts")}
              summary={pluralize(parts.length, "part")}
              title="Required Parts"
            >
              <WorkOrderPartsList
                currentProfile={currentProfile}
                hideHeader
                onActivityLogged={onActivityLogged}
                onOpenPurchaseOrders={openPurchaseOrdersSection}
                onPartApprovalUpdated={onPartApprovalUpdated}
                onPartPurchaseOrderCreated={onPartPurchaseOrderCreated}
                onPurchaseOrderItemUpdated={onPurchaseOrderItemUpdated}
                parts={parts}
                profiles={profiles}
                purchaseOrderItems={linkedPurchaseOrderItems}
                purchaseOrders={linkedPurchaseOrders}
                vehicleId={vehicleId}
                vendors={vendors}
              />
            </SectionAccordion>

            <SectionAccordion
              icon="file"
              isOpen={openSection === "purchase_orders"}
              onToggle={() => toggleSection("purchase_orders")}
              summary={pluralize(linkedPurchaseOrders.length, "PO")}
              title="Purchase Orders"
            >
              <PurchaseOrdersList
                purchaseOrderItems={linkedPurchaseOrderItems}
                purchaseOrders={linkedPurchaseOrders}
                vendors={vendors}
              />
            </SectionAccordion>

            <SectionAccordion
              icon="users"
              isOpen={openSection === "third_party"}
              onToggle={() => toggleSection("third_party")}
              summary={pluralize(thirdPartyRepairs.length, "repair")}
              title="Third-Party Repairs"
            >
              <ThirdPartyRepairsList
                canManage={canManageThirdPartyRepairs}
                canManageDocuments={canManageDocuments}
                canUploadDocuments={canUploadDocuments}
                currentProfile={currentProfile}
                documents={documents}
                hideHeader
                onActivityLogged={onActivityLogged}
                onDocumentAdded={onDocumentAdded}
                onDocumentDeleted={onDocumentDeleted}
                onThirdPartyRepairDeleted={onThirdPartyRepairDeleted}
                thirdPartyRepairs={thirdPartyRepairs}
                vehicleId={vehicleId}
                vendors={vendors}
              />
            </SectionAccordion>

            <SectionAccordion
              icon="checklist"
              isOpen={openSection === "notes"}
              onToggle={() => toggleSection("notes")}
              summary={workOrder.notes ? "Has notes" : "No notes"}
              title="Notes"
            >
              {workOrder.notes ? (
                <p className="whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
                  {workOrder.notes}
                </p>
              ) : (
                <div className="rounded-md border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-500">
                  No notes added yet.
                </div>
              )}
            </SectionAccordion>
          </div>
        </div>
      )}

      {isLaborFormOpen && canManageLabor && (
        <AddWorkOrderLaborForm
          currentProfile={currentProfile}
          onActivityLogged={onActivityLogged}
          onClose={() => setIsLaborFormOpen(false)}
          onLaborAdded={async (laborLog) => {
            await onLaborAdded?.(laborLog);
            setOpenSection("labor");
            setIsLaborFormOpen(false);
          }}
          profiles={profiles}
          vehicleId={vehicleId}
          workOrder={workOrder}
        />
      )}

      {isPartFormOpen && canManageParts && (
        <AddWorkOrderPartForm
          currentProfile={currentProfile}
          onActivityLogged={onActivityLogged}
          onClose={() => setIsPartFormOpen(false)}
          onPartAdded={async (partRequest) => {
            await onPartAdded?.(partRequest);
            setOpenSection("parts");
            setIsPartFormOpen(false);
          }}
          vehicle={vehicle}
          vehicleId={vehicleId}
          vendors={vendors}
          workOrder={workOrder}
        />
      )}

      {isPhotoFormOpen && canManagePhotos && (
        <AddWorkOrderPhotoForm
          onActivityLogged={onActivityLogged}
          onClose={() => setIsPhotoFormOpen(false)}
          onPhotoAdded={async (photo) => {
            await onPhotoAdded?.(photo);
            setOpenSection("photos");
            setIsPhotoFormOpen(false);
          }}
          vehicleId={vehicleId}
          workOrder={workOrder}
        />
      )}

      {isThirdPartyFormOpen && canManageThirdPartyRepairs && (
        <AddThirdPartyRepairForm
          currentProfile={currentProfile}
          onActivityLogged={onActivityLogged}
          onClose={() => setIsThirdPartyFormOpen(false)}
          onThirdPartyRepairAdded={async (thirdPartyRepair) => {
            await onThirdPartyRepairAdded?.(thirdPartyRepair);
            setOpenSection("third_party");
            setIsThirdPartyFormOpen(false);
          }}
          vehicleId={vehicleId}
          vendors={vendors}
          workOrder={workOrder}
        />
      )}
    </article>
  );
}

export default WorkOrderCard;
