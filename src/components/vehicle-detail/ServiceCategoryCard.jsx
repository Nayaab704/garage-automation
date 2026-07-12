import { useState } from "react";
import WorkOrderCard from "./WorkOrderCard";
import {
  getWorkOrderStatusLabel,
  isWorkOrderStatusWaitingForParts,
  workOrderStatusOrder,
} from "../../lib/workOrderStatus";

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
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

  if (isWorkOrderStatusWaitingForParts(status)) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
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

function getStatusSummary(workOrders) {
  return workOrderStatusOrder
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
  canManagePurchaseOrders = false,
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
  onPurchaseOrderReceived,
  onPurchaseOrderItemUpdated,
  onPhotoAdded,
  onPhotoDeleted,
  onThirdPartyRepairAdded,
  onThirdPartyRepairCompleted,
  onThirdPartyRepairDeleted,
  onWorkOrderStatusChange,
  partRequests = [],
  profiles = [],
  purchaseOrderItems = [],
  purchaseOrders = [],
  thirdPartyRepairs = [],
  vehicle,
  vehicleId,
  vehiclePhotos = [],
  vendors = [],
  workOrders = [],
}) {
  const [openWorkOrderId, setOpenWorkOrderId] = useState(null);
  const statusSummary = getStatusSummary(workOrders);

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-black text-slate-950">
              {displayValue(category.name)}
            </h3>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
              {workOrders.length}{" "}
              {workOrders.length === 1 ? "work order" : "work orders"}
            </span>
          </div>

          {category.description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
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
                  {getWorkOrderStatusLabel(summaryItem.status)}:{" "}
                  {summaryItem.count}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-slate-500">
                No work orders in this category yet.
              </span>
            )}
          </div>
        </div>

        {canManage && (
          <button
            className="min-h-12 w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:w-fit"
            onClick={() => onAddWorkOrder(category)}
            type="button"
          >
            Add Work Order
          </button>
        )}
      </div>

      {workOrders.length > 0 && (
        <div className="mt-4 space-y-2.5">
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
                canManagePurchaseOrders={canManagePurchaseOrders}
                canManageLabor={canManageLabor}
                canManageParts={canManageParts}
                canManagePhotos={canManagePhotos}
                canManageDocuments={canManageDocuments}
                canManageWorkOrders={canManage}
                canManageThirdPartyRepairs={canManageThirdPartyRepairs}
                canUploadDocuments={canUploadDocuments}
                currentProfile={currentProfile}
                documents={documents}
                index={index}
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
                onPurchaseOrderReceived={onPurchaseOrderReceived}
                onPurchaseOrderItemUpdated={onPurchaseOrderItemUpdated}
                onPhotoAdded={onPhotoAdded}
                onPhotoDeleted={onPhotoDeleted}
                onThirdPartyRepairAdded={onThirdPartyRepairAdded}
                onThirdPartyRepairCompleted={onThirdPartyRepairCompleted}
                onThirdPartyRepairDeleted={onThirdPartyRepairDeleted}
                onWorkOrderStatusChange={onWorkOrderStatusChange}
                onToggle={() =>
                  setOpenWorkOrderId((currentId) =>
                    currentId === workOrder.id ? null : workOrder.id
                  )
                }
                parts={workOrderParts}
                photos={workOrderPhotos}
                profiles={profiles}
                purchaseOrderItems={purchaseOrderItems}
                purchaseOrders={purchaseOrders}
                thirdPartyRepairs={workOrderThirdPartyRepairs}
                vehicle={vehicle}
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
