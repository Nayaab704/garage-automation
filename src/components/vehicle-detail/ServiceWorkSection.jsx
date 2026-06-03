import { useMemo, useState } from "react";
import AppIcon from "../ui/AppIcon";
import {
  getPhaseOneServiceCategories,
  getServiceCategoryVisual,
} from "../../lib/serviceCategoryVisuals";
import AddWorkOrderForm from "./AddWorkOrderForm";
import ServiceCategoryCard from "./ServiceCategoryCard";

function sortWorkOrders(workOrders) {
  return [...workOrders].sort((firstOrder, secondOrder) => {
    const firstDate = new Date(firstOrder.created_at ?? 0).getTime();
    const secondDate = new Date(secondOrder.created_at ?? 0).getTime();
    return secondDate - firstDate;
  });
}

function isOpenWorkOrder(workOrder) {
  const closedWorkOrderStatuses = ["completed", "cancelled"];
  return !closedWorkOrderStatuses.includes(workOrder.status);
}

function getCategoryAlert(workOrders) {
  if (
    workOrders.some(
      (workOrder) =>
        workOrder.priority === "urgent" && isOpenWorkOrder(workOrder)
    )
  ) {
    return {
      className: "bg-red-50 text-red-700 ring-red-200",
      label: "Urgent",
    };
  }

  if (workOrders.some((workOrder) => workOrder.status === "blocked")) {
    return {
      className: "bg-red-50 text-red-700 ring-red-200",
      label: "Blocked",
    };
  }

  if (workOrders.some((workOrder) => workOrder.status === "waiting_parts")) {
    return {
      className: "bg-amber-50 text-amber-700 ring-amber-200",
      label: "Waiting",
    };
  }

  return null;
}

function CategoryChip({ category, isSelected, onSelect, workOrders }) {
  const alert = getCategoryAlert(workOrders);
  const visual = getServiceCategoryVisual(category);

  return (
    <button
      className={`min-h-32 min-w-[8.75rem] rounded-2xl border bg-white px-4 py-4 text-center shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-w-[9.5rem] ${
        isSelected
          ? "border-blue-500 text-blue-700 shadow-[0_12px_30px_rgba(37,99,235,0.18)] ring-1 ring-blue-100"
          : "border-slate-200 text-slate-700 hover:border-blue-200 hover:shadow-md"
      }`}
      onClick={() => onSelect(category)}
      type="button"
    >
      <span className="flex flex-col items-center">
        <span
          className={`mb-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition ${
            isSelected
              ? "bg-blue-50 text-blue-600"
              : "bg-slate-50 text-slate-500"
          }`}
        >
          <AppIcon name={visual.icon} size={44} />
        </span>
        <span className="block text-sm font-bold leading-5 sm:text-[15px]">
          {category.name}
        </span>
      </span>
      <span
        className={`mt-2 block text-xs font-medium ${
          isSelected ? "text-blue-500" : "text-slate-500"
        }`}
      >
        {workOrders.length}{" "}
        {workOrders.length === 1 ? "work order" : "work orders"}
      </span>
      {alert && (
        <span
          className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${alert.className}`}
        >
          {alert.label}
        </span>
      )}
    </button>
  );
}

function ServiceWorkSection({
  canManage = false,
  canManageLabor = false,
  canManageParts = false,
  canManagePhotos = false,
  canManageDocuments = false,
  canManageThirdPartyRepairs = false,
  canUploadDocuments = false,
  currentProfile,
  documents = [],
  laborLogs = [],
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
  onWorkOrderAdded,
  partRequests = [],
  profiles = [],
  purchaseOrderItems = [],
  purchaseOrders = [],
  repairJobs = [],
  serviceCategories = [],
  thirdPartyRepairs = [],
  vehicleId,
  vehiclePhotos = [],
  vendors = [],
}) {
  const [categoryForForm, setCategoryForForm] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const activeServiceCategories = useMemo(
    () => getPhaseOneServiceCategories(serviceCategories),
    [serviceCategories]
  );

  const workOrdersByCategoryId = useMemo(() => {
    return activeServiceCategories.reduce((groupedWorkOrders, category) => {
      const categoryWorkOrders = repairJobs.filter(
        (repairJob) => repairJob.service_category_id === category.id
      );

      groupedWorkOrders[category.id] = sortWorkOrders(categoryWorkOrders);
      return groupedWorkOrders;
    }, {});
  }, [activeServiceCategories, repairJobs]);

  const totalWorkOrders = activeServiceCategories.reduce(
    (total, category) =>
      total + (workOrdersByCategoryId[category.id]?.length ?? 0),
    0
  );
  const selectedCategory = activeServiceCategories.find(
    (category) => category.id === selectedCategoryId
  );
  const selectedWorkOrders = selectedCategory
    ? workOrdersByCategoryId[selectedCategory.id] ?? []
    : [];

  function handleWorkOrderAdded() {
    onWorkOrderAdded?.();
  }

  function handleCategorySelect(category) {
    setSelectedCategoryId((currentCategoryId) =>
      currentCategoryId === category.id ? null : category.id
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">Service Work</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pick a category to view work orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
            {activeServiceCategories.length}{" "}
            {activeServiceCategories.length === 1 ? "category" : "categories"}
          </span>
          <span className="w-fit rounded-full bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
            {totalWorkOrders}{" "}
            {totalWorkOrders === 1 ? "work order" : "work orders"}
          </span>
          {!canManage && (
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              Read only
            </span>
          )}
        </div>
      </div>

      {activeServiceCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No active service categories found.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 sm:flex-wrap">
            {activeServiceCategories.map((category) => (
              <CategoryChip
                category={category}
                isSelected={selectedCategory?.id === category.id}
                key={category.id}
                onSelect={handleCategorySelect}
                workOrders={workOrdersByCategoryId[category.id] ?? []}
              />
            ))}
          </div>

          {selectedCategory && (
            <ServiceCategoryCard
              canManage={canManage}
              canManageLabor={canManageLabor}
              canManageParts={canManageParts}
              canManagePhotos={canManagePhotos}
              canManageDocuments={canManageDocuments}
              canManageThirdPartyRepairs={canManageThirdPartyRepairs}
              canUploadDocuments={canUploadDocuments}
              category={selectedCategory}
              currentProfile={currentProfile}
              documents={documents}
              laborLogs={laborLogs}
              key={selectedCategory.id}
              onAddWorkOrder={setCategoryForForm}
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
              partRequests={partRequests}
              profiles={profiles}
              purchaseOrderItems={purchaseOrderItems}
              purchaseOrders={purchaseOrders}
              selectedCategory={selectedCategory}
              thirdPartyRepairs={thirdPartyRepairs}
              vehicleId={vehicleId}
              vehiclePhotos={vehiclePhotos}
              vendors={vendors}
              workOrders={selectedWorkOrders}
            />
          )}
        </div>
      )}

      {categoryForForm && canManage && (
        <AddWorkOrderForm
          category={categoryForForm}
          currentProfile={currentProfile}
          onActivityLogged={onActivityLogged}
          onClose={() => setCategoryForForm(null)}
          onWorkOrderAdded={handleWorkOrderAdded}
          vehicleId={vehicleId}
        />
      )}
    </section>
  );
}

export default ServiceWorkSection;
