import { useMemo, useState } from "react";
import AddWorkOrderForm from "./AddWorkOrderForm";
import ServiceCategoryCard from "./ServiceCategoryCard";

function sortWorkOrders(workOrders) {
  return [...workOrders].sort((firstOrder, secondOrder) => {
    const firstDate = new Date(firstOrder.created_at ?? 0).getTime();
    const secondDate = new Date(secondOrder.created_at ?? 0).getTime();
    return secondDate - firstDate;
  });
}

function ServiceWorkSection({
  canManage = false,
  canManageParts = false,
  currentProfile,
  onActivityLogged,
  onPartAdded,
  onPartApprovalUpdated,
  onWorkOrderAdded,
  partRequests = [],
  profiles = [],
  repairJobs = [],
  serviceCategories = [],
  vehicleId,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const workOrdersByCategoryId = useMemo(() => {
    return serviceCategories.reduce((groupedWorkOrders, category) => {
      const categoryWorkOrders = repairJobs.filter(
        (repairJob) => repairJob.service_category_id === category.id
      );

      groupedWorkOrders[category.id] = sortWorkOrders(categoryWorkOrders);
      return groupedWorkOrders;
    }, {});
  }, [repairJobs, serviceCategories]);

  const totalWorkOrders = serviceCategories.reduce(
    (total, category) =>
      total + (workOrdersByCategoryId[category.id]?.length ?? 0),
    0
  );

  function handleWorkOrderAdded() {
    onWorkOrderAdded?.();
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Service Work</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {serviceCategories.length} service{" "}
            {serviceCategories.length === 1 ? "category" : "categories"} and{" "}
            {totalWorkOrders}{" "}
            {totalWorkOrders === 1 ? "work order" : "work orders"}
          </p>
        </div>

        {!canManage && (
          <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            Read only
          </span>
        )}
      </div>

      {serviceCategories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No active service categories found.
        </div>
      ) : (
        <div className="space-y-4">
          {serviceCategories.map((category) => (
            <ServiceCategoryCard
              canManage={canManage}
              canManageParts={canManageParts}
              category={category}
              currentProfile={currentProfile}
              key={category.id}
              onAddWorkOrder={setSelectedCategory}
              onActivityLogged={onActivityLogged}
              onPartAdded={onPartAdded}
              onPartApprovalUpdated={onPartApprovalUpdated}
              partRequests={partRequests}
              profiles={profiles}
              vehicleId={vehicleId}
              workOrders={workOrdersByCategoryId[category.id] ?? []}
            />
          ))}
        </div>
      )}

      {selectedCategory && canManage && (
        <AddWorkOrderForm
          category={selectedCategory}
          currentProfile={currentProfile}
          onActivityLogged={onActivityLogged}
          onClose={() => setSelectedCategory(null)}
          onWorkOrderAdded={handleWorkOrderAdded}
          vehicleId={vehicleId}
        />
      )}
    </section>
  );
}

export default ServiceWorkSection;
