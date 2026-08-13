import { useState } from "react";
import ActionTile from "../ui/ActionTile";
import AppIcon from "../ui/AppIcon";
import MarkReceivedModal from "../parts/MarkReceivedModal";
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
import { getReceivablePurchaseOrderItems } from "../../lib/purchaseOrderReceiving";
import {
  canMarkPurchaseOrderReceived,
  getPurchaseOrderBadge,
} from "../../lib/purchaseOrderUtils";
import { formatUserFirstName } from "../../lib/userDisplay";

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

function getProfileName(profiles, profileId) {
  const profile = profiles.find((profileRecord) => profileRecord.id === profileId);

  if (!profile) {
    return profileId ? "Removed user" : null;
  }

  return profile.full_name || profile.email || null;
}

function getProfileById(profiles, profileId, currentProfile) {
  if (!profileId) {
    return null;
  }

  if (currentProfile?.id === profileId) {
    return currentProfile;
  }

  return profiles.find((profile) => profile.id === profileId) ?? null;
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

function getReceivedAttributionText(purchaseOrder, profiles, currentProfile) {
  if (!purchaseOrder?.received_at && !purchaseOrder?.received_by) {
    return "";
  }

  const receivedByProfile = getProfileById(
    profiles,
    purchaseOrder.received_by,
    currentProfile
  );
  const receivedName = receivedByProfile
    ? formatUserFirstName(receivedByProfile)
    : purchaseOrder.received_by
      ? "Removed user"
      : "";
  const receivedLabel = receivedName
    ? `Received by ${receivedName}`
    : "Received";
  const receivedDate =
    purchaseOrder.received_at && formatDate(purchaseOrder.received_at) !== "Not available"
      ? formatDate(purchaseOrder.received_at)
      : "";

  return [receivedLabel, receivedDate].filter(Boolean).join(" - ");
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
        isOpen ? "border-blue-300" : "border-slate-200"
      }`}
    >
      <button
        className={`flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition ${
          isOpen ? "bg-blue-50/60" : "hover:bg-slate-50"
        }`}
        onClick={onToggle}
        type="button"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            isOpen ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-600"
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

function PurchaseOrdersList({
  canManagePurchaseOrders,
  currentProfile,
  onPurchaseOrderReceived,
  profiles,
  purchaseOrderItems,
  purchaseOrders,
  vendors,
}) {
  const [confirmReceivedOrder, setConfirmReceivedOrder] = useState(null);
  const [receivingPurchaseOrderId, setReceivingPurchaseOrderId] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleConfirmMarkReceived() {
    if (!confirmReceivedOrder) {
      return;
    }

    const linkedItems = purchaseOrderItems.filter(
      (item) => item.purchase_order_id === confirmReceivedOrder.id
    );

    setReceivingPurchaseOrderId(confirmReceivedOrder.id);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      if (!onPurchaseOrderReceived) {
        throw new Error("Missing purchase order receive handler.");
      }

      const result = await onPurchaseOrderReceived?.(
        confirmReceivedOrder,
        linkedItems
      );

      if (result === false) {
        throw new Error("Could not mark purchase order received.");
      }

      setConfirmReceivedOrder(null);
      setSuccessMessage("Purchase order marked received.");
    } catch (error) {
      console.error("Could not mark purchase order received:", error);
      setErrorMessage("Could not mark purchase order received. Please try again.");
    } finally {
      setReceivingPurchaseOrderId(null);
    }
  }

  if (purchaseOrders.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-500">
        No purchase orders linked to this work order yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorMessage && (
        <p className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          {successMessage}
        </p>
      )}

      {purchaseOrders.map((purchaseOrder) => {
        const items = purchaseOrderItems.filter(
          (item) => item.purchase_order_id === purchaseOrder.id
        );
        const badge = getPurchaseOrderBadge(purchaseOrder.status);
        const receivableItems = getReceivablePurchaseOrderItems(items);
        const hasReturnedItems = receivableItems.length < items.length;
        const canReceive =
          canManagePurchaseOrders &&
          canMarkPurchaseOrderReceived(purchaseOrder) &&
          receivableItems.length > 0 &&
          !hasReturnedItems;
        const receivedAttributionText = getReceivedAttributionText(
          purchaseOrder,
          profiles,
          currentProfile
        );
        const isReceiving = receivingPurchaseOrderId === purchaseOrder.id;

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
                {receivedAttributionText && (
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    {receivedAttributionText}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
                >
                  {badge.label}
                </span>
                {hasReturnedItems && purchaseOrder.status !== "returned" && (
                  <span className="w-fit rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                    Returned item
                  </span>
                )}
                {canReceive && (
                  <button
                    className="inline-flex min-h-8 items-center justify-center rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isReceiving}
                    onClick={() => {
                      setConfirmReceivedOrder(purchaseOrder);
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    type="button"
                  >
                    {isReceiving ? "Marking..." : "Mark Received"}
                  </button>
                )}
              </div>
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

      {confirmReceivedOrder && (
        <MarkReceivedModal
          isSubmitting={receivingPurchaseOrderId === confirmReceivedOrder.id}
          onClose={() => setConfirmReceivedOrder(null)}
          onConfirm={handleConfirmMarkReceived}
          purchaseOrder={confirmReceivedOrder}
          subtitle={getVendorName(vendors, confirmReceivedOrder.vendor_id)}
        />
      )}
    </div>
  );
}

function WorkOrderCard({
  canManagePurchaseOrders = false,
  canManageLabor,
  canManageParts,
  canManagePhotos,
  canManageDocuments,
  canManageThirdPartyRepairs,
  canManageWorkOrders = false,
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
  onPurchaseOrderReceived,
  onPurchaseOrderItemUpdated,
  onPhotoAdded,
  onPhotoDeleted,
  onThirdPartyRepairAdded,
  onThirdPartyRepairCompleted,
  onThirdPartyRepairDeleted,
  onViewPurchaseOrders,
  onWorkOrderStatusChange,
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
  const isCompleted = workOrder.status === "completed";
  const canMarkComplete = canManageWorkOrders && !isCompleted;

  function toggleSection(sectionName) {
    setOpenSection((currentSection) =>
      currentSection === sectionName ? null : sectionName
    );
  }

  function openPurchaseOrdersSection() {
    setOpenSection("purchase_orders");
  }

  function handleOpenPurchaseOrders(target) {
    if (target?.poId) {
      onViewPurchaseOrders?.(target);
      return;
    }

    openPurchaseOrdersSection();
  }

  return (
    <article
      className={`rounded-2xl border shadow-sm transition ${
        isOpen
          ? isCompleted
            ? "border-emerald-400 bg-emerald-50/20 shadow-[0_10px_26px_rgba(16,185,129,0.14)]"
            : "border-blue-500 shadow-[0_10px_26px_rgba(37,99,235,0.14)]"
          : isCompleted
            ? "border-emerald-200 bg-emerald-50/20 hover:border-emerald-300"
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
            canManageThirdPartyRepairs ||
            canMarkComplete) && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                Quick Actions
              </p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {canMarkComplete && (
                  <button
                    className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-1"
                    onClick={() =>
                      onWorkOrderStatusChange?.(workOrder, "completed")
                    }
                    type="button"
                  >
                    <AppIcon name="check" size={20} />
                    <span>Mark Complete</span>
                  </button>
                )}

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
                onOpenPurchaseOrders={handleOpenPurchaseOrders}
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
                canManagePurchaseOrders={canManagePurchaseOrders}
                currentProfile={currentProfile}
                onPurchaseOrderReceived={onPurchaseOrderReceived}
                profiles={profiles}
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
                onThirdPartyRepairCompleted={onThirdPartyRepairCompleted}
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
