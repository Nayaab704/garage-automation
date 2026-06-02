import { useEffect, useMemo, useState } from "react";
import CreatePurchaseOrderForm from "../components/vehicle-detail/CreatePurchaseOrderForm";
import { logVehicleActivity } from "../lib/activityLogger";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

const partRequestColumns =
  "id, vehicle_id, repair_job_id, part_name, quantity, status, notes, part_source, approval_status, unit_cost, created_by, created_at";

const filterOptions = [
  { key: "pending", label: "Pending Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "in_house", label: "In-House / Not Required" },
  { key: "all", label: "All" },
];

const partSourceLabels = {
  in_house: "In-house / Available",
  needs_to_buy: "Needs to Buy",
};

const approvalLabels = {
  not_required: "Not Required",
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

const statusLabels = {
  cancelled: "Cancelled",
  requested: "Requested",
  ordered: "Ordered",
  received: "Received",
  installed: "Installed",
};

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatCurrency(value) {
  const numberValue = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(numberValue) ? numberValue : 0);
}

function formatNumber(value) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue)) {
    return "0";
  }

  return numberFormatter.format(numberValue);
}

function formatLabel(value, labels) {
  if (labels[value]) {
    return labels[value];
  }

  if (!value) {
    return "Not available";
  }

  return value
    .toString()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getTotalCost(part) {
  const quantity = Number(part.quantity || 0);
  const unitCost = Number(part.unit_cost || 0);

  if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) {
    return 0;
  }

  return quantity * unitCost;
}

function approvalClassName(approvalStatus) {
  if (approvalStatus === "approved" || approvalStatus === "not_required") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (approvalStatus === "rejected") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function statusClassName(status) {
  if (status === "cancelled") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "installed" || status === "received") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "ordered") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function canCreatePurchaseOrderForPart(part) {
  return (
    part.part_source === "needs_to_buy" &&
    !["ordered", "received", "installed", "cancelled"].includes(part.status)
  );
}

function hasOrderOrCompletedStatus(part) {
  return ["ordered", "received", "installed"].includes(part.status);
}

function sourceClassName(partSource) {
  if (partSource === "needs_to_buy") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function getVehicleLabel(vehicle) {
  if (!vehicle) {
    return "Vehicle not found";
  }

  const stockNumber = vehicle.stock_number || "No stock number";
  const vehicleName = [vehicle.make, vehicle.model].filter(Boolean).join(" ");

  return vehicleName ? `${stockNumber} - ${vehicleName}` : stockNumber;
}

function getRequesterName(profile) {
  return profile?.full_name || profile?.email || "Unknown technician";
}

function partMatchesFilter(part, activeFilter) {
  if (activeFilter === "pending") {
    return (
      part.part_source === "needs_to_buy" && part.approval_status === "pending"
    );
  }

  if (activeFilter === "approved") {
    return part.approval_status === "approved";
  }

  if (activeFilter === "rejected") {
    return part.approval_status === "rejected";
  }

  if (activeFilter === "in_house") {
    return (
      part.part_source === "in_house" ||
      part.approval_status === "not_required"
    );
  }

  return true;
}

async function fetchPartsQueueData() {
  const partRequestsResponse = await supabase
    .from("part_requests")
    .select(partRequestColumns)
    .order("created_at", { ascending: false });

  if (partRequestsResponse.error) {
    return { error: partRequestsResponse.error };
  }

  const parts = partRequestsResponse.data ?? [];
  const vehicleIds = uniqueValues(parts.map((part) => part.vehicle_id));
  const repairJobIds = uniqueValues(parts.map((part) => part.repair_job_id));
  const profileIds = uniqueValues(parts.map((part) => part.created_by));

  const [vehiclesResponse, repairJobsResponse, profilesResponse, vendorsResponse] =
    await Promise.all([
      vehicleIds.length > 0
        ? supabase
            .from("vehicles")
            .select("id, stock_number, make, model")
            .in("id", vehicleIds)
        : { data: [], error: null },
      repairJobIds.length > 0
        ? supabase.from("repair_jobs").select("id, title").in("id", repairJobIds)
        : { data: [], error: null },
      profileIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", profileIds)
        : { data: [], error: null },
      supabase.from("vendors").select("id, name").order("name", {
        ascending: true,
      }),
    ]);

  const firstRelatedError =
    vehiclesResponse.error ??
    repairJobsResponse.error ??
    profilesResponse.error ??
    vendorsResponse.error;

  if (firstRelatedError) {
    return { error: firstRelatedError };
  }

  return {
    data: {
      partRequests: parts,
      profilesById: Object.fromEntries(
        (profilesResponse.data ?? []).map((profile) => [profile.id, profile])
      ),
      repairJobsById: Object.fromEntries(
        (repairJobsResponse.data ?? []).map((repairJob) => [
          repairJob.id,
          repairJob,
        ])
      ),
      vehiclesById: Object.fromEntries(
        (vehiclesResponse.data ?? []).map((vehicle) => [vehicle.id, vehicle])
      ),
      vendors: vendorsResponse.data ?? [],
    },
    error: null,
  };
}

function Badge({ children, className }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function PartsPage({ currentProfile }) {
  const [activeFilter, setActiveFilter] = useState("pending");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [partRequests, setPartRequests] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [repairJobsById, setRepairJobsById] = useState({});
  const [selectedPartForPurchaseOrder, setSelectedPartForPurchaseOrder] =
    useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingPartId, setUpdatingPartId] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vehiclesById, setVehiclesById] = useState({});

  const canApproveParts =
    currentProfile?.role === "admin" || currentProfile?.role === "owner";
  const canManagePurchaseOrders = hasPermission(
    currentProfile?.role,
    "purchase_order:manage"
  );

  const filteredParts = useMemo(
    () => partRequests.filter((part) => partMatchesFilter(part, activeFilter)),
    [activeFilter, partRequests]
  );

  const countsByFilter = useMemo(() => {
    return filterOptions.reduce((counts, filter) => {
      counts[filter.key] = partRequests.filter((part) =>
        partMatchesFilter(part, filter.key)
      ).length;
      return counts;
    }, {});
  }, [partRequests]);

  const pendingNeedsToBuyParts = partRequests.filter(
    (part) =>
      part.part_source === "needs_to_buy" && part.approval_status === "pending"
  );
  const pendingTotal = pendingNeedsToBuyParts.reduce(
    (total, part) => total + getTotalCost(part),
    0
  );

  useEffect(() => {
    let isMounted = true;

    async function loadParts() {
      try {
        const { data, error } = await fetchPartsQueueData();

        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setPartRequests(data.partRequests);
        setVehiclesById(data.vehiclesById);
        setRepairJobsById(data.repairJobsById);
        setProfilesById(data.profilesById);
        setVendors(data.vendors);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Unable to load parts.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadParts();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleApprovalChange(part, approvalStatus) {
    if (!canApproveParts) {
      setErrorMessage("Your role cannot approve or reject parts.");
      return;
    }

    if (
      approvalStatus === "rejected" &&
      !window.confirm("Reject this part request? This cannot be undone.")
    ) {
      return;
    }

    setUpdatingPartId(part.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase
        .from("part_requests")
        .update({ approval_status: approvalStatus })
        .eq("id", part.id)
        .select(partRequestColumns)
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const updatedPart = data ?? { ...part, approval_status: approvalStatus };

      setPartRequests((currentParts) =>
        currentParts.map((currentPart) =>
          currentPart.id === part.id ? updatedPart : currentPart
        )
      );

      await logVehicleActivity({
        vehicleId: part.vehicle_id,
        action:
          approvalStatus === "approved"
            ? "Part request approved"
            : "Part request rejected",
        details: {
          part_name: part.part_name,
          quantity: part.quantity,
        },
      });
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setUpdatingPartId(null);
    }
  }

  function handlePurchaseOrderCreated(result) {
    const partRequestId =
      result?.partRequestId ?? selectedPartForPurchaseOrder?.id;

    if (result?.partRequestStatusUpdated === false) {
      setSelectedPartForPurchaseOrder(null);
      setErrorMessage(
        result.warningMessage ??
          "Purchase order created, but the part status could not be updated."
      );
      return;
    }

    if (partRequestId) {
      setPartRequests((currentParts) =>
        currentParts.map((part) =>
          part.id === partRequestId ? { ...part, status: "ordered" } : part
        )
      );
    }

    setErrorMessage("");
    setSelectedPartForPurchaseOrder(null);
    setSuccessMessage("Purchase order created. Part status is now Ordered.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Parts Review
            </p>
            <h2 className="mt-2 text-2xl font-bold text-zinc-950">
              Parts Review Queue
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Review requested parts for oversight while technicians keep work
              moving and create purchase orders when needed.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Pending Review
              </p>
              <p className="mt-2 text-2xl font-bold text-zinc-950">
                {pendingNeedsToBuyParts.length}
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Pending Review Cost
              </p>
              <p className="mt-2 text-2xl font-bold text-zinc-950">
                {formatCurrency(pendingTotal)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((filter) => {
            const isActive = activeFilter === filter.key;

            return (
              <button
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-zinc-950 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                type="button"
              >
                {filter.label}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "bg-white text-zinc-500 ring-1 ring-inset ring-zinc-200"
                  }`}
                >
                  {countsByFilter[filter.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {isLoading && (
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-700">Loading parts queue...</p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </section>
      )}

      {!isLoading && successMessage && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {successMessage}
        </section>
      )}

      {!isLoading && !errorMessage && filteredParts.length === 0 && (
        <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-zinc-950">
            No parts in this queue
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            New work-order part requests will appear here when they match this
            filter.
          </p>
        </section>
      )}

      {!isLoading && !errorMessage && filteredParts.length > 0 && (
        <section className="space-y-3">
          {filteredParts.map((part) => {
            const vehicle = vehiclesById[part.vehicle_id];
            const repairJob = repairJobsById[part.repair_job_id];
            const requester = profilesById[part.created_by];
            const canActOnPart =
              canApproveParts &&
              part.part_source === "needs_to_buy" &&
              part.approval_status === "pending";
            const canCreatePurchaseOrder =
              canManagePurchaseOrders && canCreatePurchaseOrderForPart(part);

            return (
              <article
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                key={part.id}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-zinc-950">
                        {part.part_name || "Unnamed part"}
                      </h3>
                      <Badge className={sourceClassName(part.part_source)}>
                        {formatLabel(part.part_source, partSourceLabels)}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm text-zinc-600 sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                          Vehicle
                        </p>
                        <p className="mt-1 font-medium text-zinc-800">
                          {getVehicleLabel(vehicle)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                          Work Order
                        </p>
                        <p className="mt-1 font-medium text-zinc-800">
                          {repairJob?.title || "No work order assigned"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                          Requested By
                        </p>
                        <p className="mt-1 font-medium text-zinc-800">
                          {getRequesterName(requester)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                          Cost
                        </p>
                        <p className="mt-1 font-medium text-zinc-800">
                          Qty {formatNumber(part.quantity)} x{" "}
                          {formatCurrency(part.unit_cost)} ={" "}
                          {formatCurrency(getTotalCost(part))}
                        </p>
                      </div>
                    </div>

                    {part.notes && (
                      <p className="mt-4 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
                        {part.notes}
                      </p>
                    )}

                    {canCreatePurchaseOrder &&
                      part.approval_status === "pending" && (
                        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          Pending admin review, but PO can still be created.
                        </p>
                      )}

                    {part.approval_status === "rejected" &&
                      hasOrderOrCompletedStatus(part) && (
                        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                          This part has a rejected review status after ordering.
                          Check the purchase order and resolve manually.
                        </p>
                      )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-3 xl:items-end">
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Badge className={approvalClassName(part.approval_status)}>
                        {formatLabel(part.approval_status, approvalLabels)}
                      </Badge>
                      <Badge className={statusClassName(part.status)}>
                        {formatLabel(part.status, statusLabels)}
                      </Badge>
                    </div>

                    {canActOnPart && (
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <button
                          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                          disabled={updatingPartId === part.id}
                          onClick={() => handleApprovalChange(part, "approved")}
                          type="button"
                        >
                          {updatingPartId === part.id ? "Saving..." : "Approve"}
                        </button>
                        <button
                          className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={updatingPartId === part.id}
                          onClick={() => handleApprovalChange(part, "rejected")}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {canCreatePurchaseOrder && (
                      <button
                        className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                        onClick={() => {
                          setSuccessMessage("");
                          setSelectedPartForPurchaseOrder(part);
                        }}
                        type="button"
                      >
                        Create PO
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {selectedPartForPurchaseOrder && canManagePurchaseOrders && (
        <CreatePurchaseOrderForm
          initialPartRequest={selectedPartForPurchaseOrder}
          lockPartRequest
          onClose={() => setSelectedPartForPurchaseOrder(null)}
          onPurchaseOrderCreated={handlePurchaseOrderCreated}
          partRequests={[selectedPartForPurchaseOrder]}
          vehicleId={selectedPartForPurchaseOrder.vehicle_id}
          vendors={vendors}
        />
      )}
    </div>
  );
}

export default PartsPage;
