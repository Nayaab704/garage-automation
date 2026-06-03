import { useState } from "react";
import ActionTile from "../ui/ActionTile";
import PriorityBadge from "../ui/PriorityBadge";
import StatChip from "../ui/StatChip";
import StatusBadge from "../ui/StatusBadge";
import AddThirdPartyRepairForm from "./AddThirdPartyRepairForm";
import AddWorkOrderLaborForm from "./AddWorkOrderLaborForm";
import AddWorkOrderPartForm from "./AddWorkOrderPartForm";
import AddWorkOrderPhotoForm from "./AddWorkOrderPhotoForm";
import ThirdPartyRepairsList from "./ThirdPartyRepairsList";
import WorkOrderLaborList from "./WorkOrderLaborList";
import WorkOrderPartsList from "./WorkOrderPartsList";
import WorkOrderPhotosList from "./WorkOrderPhotosList";

const statusLabels = {
  needed: "Needed",
  approved: "Approved",
  in_progress: "In Progress",
  waiting_parts: "Waiting Parts",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusOrder = [
  "needed",
  "approved",
  "in_progress",
  "waiting_parts",
  "blocked",
  "completed",
  "cancelled",
];

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatLabel(value, labels) {
  if (labels[value]) {
    return labels[value];
  }

  return displayValue(value)
    .toString()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function statusClassName(status) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "blocked" || status === "cancelled") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "in_progress" || status === "approved") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  if (status === "waiting_parts") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function getProfileName(profiles, profileId) {
  const profile = profiles.find((profileRecord) => profileRecord.id === profileId);

  if (!profile) {
    return null;
  }

  return profile.full_name || profile.email || null;
}

function Badge({ children, className }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
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
  onPhotoAdded,
  onPhotoDeleted,
  onThirdPartyRepairAdded,
  onThirdPartyRepairDeleted,
  parts,
  photos,
  profiles,
  thirdPartyRepairs,
  vehicleId,
  vendors,
  workOrder,
}) {
  const [isLaborFormOpen, setIsLaborFormOpen] = useState(false);
  const [isPartFormOpen, setIsPartFormOpen] = useState(false);
  const [isPhotoFormOpen, setIsPhotoFormOpen] = useState(false);
  const [isThirdPartyFormOpen, setIsThirdPartyFormOpen] = useState(false);
  const creatorName = getProfileName(profiles, workOrder.created_by);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h4 className="text-base font-bold text-zinc-950">
            {displayValue(workOrder.title)}
          </h4>
          {creatorName && (
            <p className="mt-1 text-sm text-zinc-500">
              Created by {creatorName}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <StatChip icon="camera" label="Photos" value={photos.length} />
            <StatChip icon="clock" label="Labor" value={laborLogs.length} />
            <StatChip icon="box" label="Parts" value={parts.length} />
            <StatChip
              icon="users"
              label="3rd-Party"
              value={thirdPartyRepairs.length}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <PriorityBadge priority={workOrder.priority} />
            <StatusBadge status={workOrder.status} />
          </div>

          <button
            className="min-h-10 w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            onClick={onToggle}
            type="button"
          >
            {isOpen ? "Close" : "Open"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          {workOrder.notes && (
            <p className="mb-4 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
              {workOrder.notes}
            </p>
          )}

          {(canManageLabor ||
            canManageParts ||
            canManagePhotos ||
            canManageThirdPartyRepairs) && (
            <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {canManageLabor && (
                <ActionTile
                  icon="clock"
                  label="Add Labor"
                  onClick={() => setIsLaborFormOpen(true)}
                />
              )}

              {canManageParts && (
                <ActionTile
                  icon="box"
                  label="Add Part"
                  onClick={() => setIsPartFormOpen(true)}
                />
              )}

              {canManagePhotos && (
                <ActionTile
                  icon="camera"
                  label="Add Photo"
                  onClick={() => setIsPhotoFormOpen(true)}
                  variant="primary"
                />
              )}

              {canManageThirdPartyRepairs && (
                <ActionTile
                  icon="users"
                  label="Add 3rd-Party"
                  onClick={() => setIsThirdPartyFormOpen(true)}
                />
              )}
            </div>
          )}

          <div className="space-y-3">
            <WorkOrderPhotosList
              canManage={canManagePhotos}
              showAddButton={false}
              onActivityLogged={onActivityLogged}
              onPhotoAdded={onPhotoAdded}
              onPhotoDeleted={onPhotoDeleted}
              photos={photos}
              vehicleId={vehicleId}
              workOrder={workOrder}
            />

            <WorkOrderLaborList
              canManage={canManageLabor}
              currentProfile={currentProfile}
              laborLogs={laborLogs}
              onActivityLogged={onActivityLogged}
              onLaborDeleted={onLaborDeleted}
              profiles={profiles}
              vehicleId={vehicleId}
            />

            <WorkOrderPartsList
              currentProfile={currentProfile}
              onActivityLogged={onActivityLogged}
              onPartApprovalUpdated={onPartApprovalUpdated}
              onPartPurchaseOrderCreated={onPartPurchaseOrderCreated}
              parts={parts}
              vehicleId={vehicleId}
              vendors={vendors}
            />

            <ThirdPartyRepairsList
              canManage={canManageThirdPartyRepairs}
              canManageDocuments={canManageDocuments}
              canUploadDocuments={canUploadDocuments}
              currentProfile={currentProfile}
              documents={documents}
              onActivityLogged={onActivityLogged}
              onDocumentAdded={onDocumentAdded}
              onDocumentDeleted={onDocumentDeleted}
              onThirdPartyRepairDeleted={onThirdPartyRepairDeleted}
              thirdPartyRepairs={thirdPartyRepairs}
              vehicleId={vehicleId}
              vendors={vendors}
            />
          </div>
        </div>
      )}

      {isLaborFormOpen && canManageLabor && (
        <AddWorkOrderLaborForm
          currentProfile={currentProfile}
          onActivityLogged={onActivityLogged}
          onClose={() => setIsLaborFormOpen(false)}
          onLaborAdded={onLaborAdded}
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
          onPartAdded={onPartAdded}
          vehicleId={vehicleId}
          workOrder={workOrder}
        />
      )}

      {isPhotoFormOpen && canManagePhotos && (
        <AddWorkOrderPhotoForm
          onActivityLogged={onActivityLogged}
          onClose={() => setIsPhotoFormOpen(false)}
          onPhotoAdded={async (photo) => {
            await onPhotoAdded?.(photo);
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
          onThirdPartyRepairAdded={onThirdPartyRepairAdded}
          vehicleId={vehicleId}
          vendors={vendors}
          workOrder={workOrder}
        />
      )}
    </article>
  );
}

function getStatusSummary(workOrders) {
  return statusOrder
    .map((status) => ({
      count: workOrders.filter((workOrder) => workOrder.status === status).length,
      status,
    }))
    .filter((summaryItem) => summaryItem.count > 0);
}

function ServiceCategoryCard({
  canManage = false,
  canManageLabor = false,
  canManageParts = false,
  canManagePhotos = false,
  canManageDocuments = false,
  canManageThirdPartyRepairs = false,
  canUploadDocuments = false,
  category,
  currentProfile,
  documents = [],
  laborLogs = [],
  onAddWorkOrder,
  onActivityLogged,
  onDocumentAdded,
  onDocumentDeleted,
  onLaborAdded,
  onLaborDeleted,
  onPartAdded,
  onPartApprovalUpdated,
  onPartPurchaseOrderCreated,
  onPhotoAdded,
  onPhotoDeleted,
  onThirdPartyRepairAdded,
  onThirdPartyRepairDeleted,
  partRequests = [],
  profiles = [],
  thirdPartyRepairs = [],
  vehicleId,
  vehiclePhotos = [],
  vendors = [],
  workOrders = [],
}) {
  const [openWorkOrderId, setOpenWorkOrderId] = useState(null);
  const statusSummary = getStatusSummary(workOrders);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-bold text-zinc-950">
              {displayValue(category.name)}
            </h3>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700">
              {workOrders.length}{" "}
              {workOrders.length === 1 ? "work order" : "work orders"}
            </span>
          </div>

          {category.description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              {category.description}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {statusSummary.length > 0 ? (
              statusSummary.map((summaryItem) => (
                <Badge
                  className={statusClassName(summaryItem.status)}
                  key={summaryItem.status}
                >
                  {formatLabel(summaryItem.status, statusLabels)}:{" "}
                  {summaryItem.count}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-zinc-500">
                No work orders in this category yet.
              </span>
            )}
          </div>
        </div>

        {canManage && (
          <button
            className="min-h-11 w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 sm:w-fit"
            onClick={() => onAddWorkOrder(category)}
            type="button"
          >
            Add Work Order
          </button>
        )}
      </div>

      {workOrders.length > 0 && (
        <div className="mt-5 space-y-4">
          {workOrders.map((workOrder, index) => {
            const workOrderLaborLogs = laborLogs.filter(
              (laborLog) => laborLog.repair_job_id === workOrder.id
            );
            const workOrderParts = partRequests.filter(
              (partRequest) => partRequest.repair_job_id === workOrder.id
            );
            const workOrderPhotos = vehiclePhotos.filter(
              (photo) => photo.repair_job_id === workOrder.id
            );
            const workOrderThirdPartyRepairs = thirdPartyRepairs.filter(
              (thirdPartyRepair) =>
                thirdPartyRepair.repair_job_id === workOrder.id
            );

            return (
              <WorkOrderCard
                canManageLabor={canManageLabor}
                canManageParts={canManageParts}
                canManagePhotos={canManagePhotos}
                canManageDocuments={canManageDocuments}
                canManageThirdPartyRepairs={canManageThirdPartyRepairs}
                canUploadDocuments={canUploadDocuments}
                currentProfile={currentProfile}
                documents={documents}
                isOpen={openWorkOrderId === workOrder.id}
                key={workOrder.id ?? index}
                laborLogs={workOrderLaborLogs}
                onActivityLogged={onActivityLogged}
                onDocumentAdded={onDocumentAdded}
                onDocumentDeleted={onDocumentDeleted}
                onLaborAdded={onLaborAdded}
                onLaborDeleted={onLaborDeleted}
                onPartAdded={onPartAdded}
                onPartApprovalUpdated={onPartApprovalUpdated}
                onPartPurchaseOrderCreated={onPartPurchaseOrderCreated}
                onPhotoAdded={onPhotoAdded}
                onPhotoDeleted={onPhotoDeleted}
                onThirdPartyRepairAdded={onThirdPartyRepairAdded}
                onThirdPartyRepairDeleted={onThirdPartyRepairDeleted}
                onToggle={() =>
                  setOpenWorkOrderId((currentId) =>
                    currentId === workOrder.id ? null : workOrder.id
                  )
                }
                parts={workOrderParts}
                photos={workOrderPhotos}
                profiles={profiles}
                thirdPartyRepairs={workOrderThirdPartyRepairs}
                vehicleId={vehicleId}
                vendors={vendors}
                workOrder={workOrder}
              />
            );
          })}
        </div>
      )}
    </article>
  );
}

export default ServiceCategoryCard;
