import { useMemo, useState } from "react";
import AppIcon from "../ui/AppIcon";
import {
  getPhaseOneServiceCategories,
  getServiceCategoryVisual,
} from "../../lib/serviceCategoryVisuals";
import { isWorkOrderStatusWaitingForParts } from "../../lib/workOrderStatus";
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

const categoryKeyAliases = {
  a_c: "ac",
  air_conditioning: "ac",
  parts_accessories: "parts",
  paint_cosmetic: "paint",
  tires_wheels: "tires",
};

function normalizeCategoryKey(value) {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return categoryKeyAliases[normalizedValue] ?? normalizedValue;
}

function getCategoryMatchKeys(category) {
  return new Set(
    [category?.slug, category?.name]
      .map(normalizeCategoryKey)
      .filter(Boolean)
  );
}

function workOrderMatchesCategory(workOrder, category) {
  if (workOrder.service_category_id) {
    return workOrder.service_category_id === category.id;
  }

  const categoryKeys = getCategoryMatchKeys(category);
  const workOrderKeys = [
    workOrder.category,
    workOrder.repair_category,
    workOrder.serviceCategory?.slug,
    workOrder.serviceCategory?.name,
  ]
    .map(normalizeCategoryKey)
    .filter(Boolean);

  return workOrderKeys.some((key) => categoryKeys.has(key));
}

function getLegacyWorkOrders(workOrders, categories) {
  return sortWorkOrders(
    workOrders.filter(
      (workOrder) =>
        !categories.some((category) =>
          workOrderMatchesCategory(workOrder, category)
        )
    )
  );
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

  if (
    workOrders.some((workOrder) =>
      isWorkOrderStatusWaitingForParts(workOrder.status)
    )
  ) {
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
      className={`min-h-28 w-full rounded-2xl border bg-white px-3 py-3 text-center shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
        isSelected
          ? "border-blue-500 text-blue-700 shadow-[0_12px_30px_rgba(37,99,235,0.18)] ring-1 ring-blue-100"
          : "border-slate-200 text-slate-700 hover:border-blue-200 hover:shadow-md"
      }`}
      onClick={() => onSelect(category)}
      type="button"
    >
      <span className="flex flex-col items-center">
        <span
          className={`mb-2.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${
            isSelected
              ? "bg-blue-50 text-blue-600"
              : "bg-slate-50 text-slate-500"
          }`}
        >
          <AppIcon name={visual.icon} size={32} />
        </span>
        <span className="block text-sm font-bold leading-5">
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
  canManagePurchaseOrders = false,
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
  onPurchaseOrderReceived,
  onPurchaseOrderItemUpdated,
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
  vehicle,
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
        (repairJob) => workOrderMatchesCategory(repairJob, category)
      );

      groupedWorkOrders[category.id] = sortWorkOrders(categoryWorkOrders);
      return groupedWorkOrders;
    }, {});
  }, [activeServiceCategories, repairJobs]);
  const legacyWorkOrders = useMemo(
    () => getLegacyWorkOrders(repairJobs, activeServiceCategories),
    [activeServiceCategories, repairJobs]
  );

  const totalWorkOrders = activeServiceCategories.reduce(
    (total, category) =>
      total + (workOrdersByCategoryId[category.id]?.length ?? 0),
    legacyWorkOrders.length
  );
  const selectedCategory = activeServiceCategories.find(
    (category) => category.id === selectedCategoryId
  );
  const selectedWorkOrders = selectedCategory
    ? workOrdersByCategoryId[selectedCategory.id] ?? []
    : [];

  async function handleWorkOrderAdded(workOrder) {
    await onWorkOrderAdded?.(workOrder);
    setCategoryForForm(null);
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
              canManagePurchaseOrders={canManagePurchaseOrders}
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
              onPurchaseOrderReceived={onPurchaseOrderReceived}
              onPurchaseOrderItemUpdated={onPurchaseOrderItemUpdated}
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
              vehicle={vehicle}
              vehicleId={vehicleId}
              vehiclePhotos={vehiclePhotos}
              vendors={vendors}
              workOrders={selectedWorkOrders}
            />
          )}

          {legacyWorkOrders.length > 0 && (
            <ServiceCategoryCard
              canManage={false}
              canManageDocuments={canManageDocuments}
              canManageLabor={canManageLabor}
              canManageParts={canManageParts}
              canManagePhotos={canManagePhotos}
              canManagePurchaseOrders={canManagePurchaseOrders}
              canManageThirdPartyRepairs={canManageThirdPartyRepairs}
              canUploadDocuments={canUploadDocuments}
              category={{
                description:
                  "Existing work orders from older or inactive categories.",
                id: "legacy_uncategorized",
                name: "Legacy / Uncategorized",
              }}
              currentProfile={currentProfile}
              documents={documents}
              key="legacy_uncategorized"
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
              onThirdPartyRepairDeleted={onThirdPartyRepairDeleted}
              partRequests={partRequests}
              profiles={profiles}
              purchaseOrderItems={purchaseOrderItems}
              purchaseOrders={purchaseOrders}
              thirdPartyRepairs={thirdPartyRepairs}
              vehicle={vehicle}
              vehicleId={vehicleId}
              vehiclePhotos={vehiclePhotos}
              vendors={vendors}
              workOrders={legacyWorkOrders}
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
