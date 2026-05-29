import { useState } from "react";
import AddWorkOrderPartForm from "./AddWorkOrderPartForm";
import WorkOrderPartsList from "./WorkOrderPartsList";

const priorityLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

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

function priorityClassName(priority) {
  if (priority === "urgent") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (priority === "high") {
    return "bg-orange-50 text-orange-700 ring-orange-200";
  }

  if (priority === "medium") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
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
  canManageParts,
  currentProfile,
  onActivityLogged,
  onPartAdded,
  onPartApprovalUpdated,
  parts,
  profiles,
  vehicleId,
  workOrder,
}) {
  const [isPartFormOpen, setIsPartFormOpen] = useState(false);
  const creatorName = getProfileName(profiles, workOrder.created_by);

  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-semibold text-zinc-950">
            {displayValue(workOrder.title)}
          </h4>
          {creatorName && (
            <p className="mt-1 text-sm text-zinc-500">
              Created by {creatorName}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-2 sm:justify-end">
          <div className="flex flex-wrap gap-2">
            <Badge className={priorityClassName(workOrder.priority)}>
              {formatLabel(workOrder.priority, priorityLabels)}
            </Badge>
            <Badge className={statusClassName(workOrder.status)}>
              {formatLabel(workOrder.status, statusLabels)}
            </Badge>
          </div>

          {canManageParts && (
            <button
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              onClick={() => setIsPartFormOpen(true)}
              type="button"
            >
              Add Part
            </button>
          )}
        </div>
      </div>

      {workOrder.notes && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
          {workOrder.notes}
        </p>
      )}

      <WorkOrderPartsList
        currentProfile={currentProfile}
        onActivityLogged={onActivityLogged}
        onPartApprovalUpdated={onPartApprovalUpdated}
        parts={parts}
        vehicleId={vehicleId}
      />

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
  canManageParts = false,
  category,
  currentProfile,
  onAddWorkOrder,
  onActivityLogged,
  onPartAdded,
  onPartApprovalUpdated,
  partRequests = [],
  profiles = [],
  vehicleId,
  workOrders = [],
}) {
  const statusSummary = getStatusSummary(workOrders);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
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
                No work orders yet.
              </span>
            )}
          </div>
        </div>

        {canManage && (
          <button
            className="w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            onClick={() => onAddWorkOrder(category)}
            type="button"
          >
            Add Work Order
          </button>
        )}
      </div>

      {workOrders.length > 0 && (
        <div className="mt-5 space-y-3">
          {workOrders.map((workOrder, index) => (
            <WorkOrderCard
              canManageParts={canManageParts}
              currentProfile={currentProfile}
              key={workOrder.id ?? index}
              onActivityLogged={onActivityLogged}
              onPartAdded={onPartAdded}
              onPartApprovalUpdated={onPartApprovalUpdated}
              parts={partRequests.filter(
                (partRequest) => partRequest.repair_job_id === workOrder.id
              )}
              profiles={profiles}
              vehicleId={vehicleId}
              workOrder={workOrder}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export default ServiceCategoryCard;
