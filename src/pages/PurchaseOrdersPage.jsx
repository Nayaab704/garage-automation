import { useEffect, useMemo, useState } from "react";
import StatusDropdown from "../components/vehicle-detail/StatusDropdown";
import { logVehicleActivity } from "../lib/activityLogger";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";

const purchaseOrderColumns =
  "id, vehicle_id, vendor_id, status, ordered_by, ordered_at, received_at, notes, created_at";

const purchaseOrderItemColumns =
  "id, purchase_order_id, part_request_id, description, quantity, unit_cost, shipping_cost, tax, status, notes, created_at";

const purchaseOrderStatuses = [
  "draft",
  "ordered",
  "partial_received",
  "received",
  "cancelled",
];

const purchaseOrderItemStatuses = [
  "ordered",
  "received",
  "returned",
  "cancelled",
];

const statusLabels = {
  cancelled: "Cancelled",
  draft: "Draft",
  ordered: "Ordered",
  partial_received: "Partial Received",
  received: "Received",
  returned: "Returned",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const numberFormatter = new Intl.NumberFormat("en-US");

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

function formatNumber(value) {
  return numberFormatter.format(numberOrZero(value));
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function displayValue(value) {
  return value === null || value === undefined || value === ""
    ? "Not available"
    : value;
}

function formatLabel(value) {
  if (statusLabels[value]) {
    return statusLabels[value];
  }

  if (!value) {
    return "Not available";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getVehicleName(vehicle) {
  if (!vehicle) {
    return "Vehicle not found";
  }

  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

function getVehicleLabel(vehicle) {
  if (!vehicle) {
    return "Vehicle not found";
  }

  const stockNumber = vehicle.stock_number || "No stock number";
  const vehicleName = getVehicleName(vehicle);

  return vehicleName ? `${stockNumber} - ${vehicleName}` : stockNumber;
}

function getProfileName(profile) {
  return profile?.full_name || profile?.email || "Not available";
}

function getVendorName(vendor) {
  return vendor?.name || "Not available";
}

function getItemTotal(item) {
  return (
    numberOrZero(item.quantity) * numberOrZero(item.unit_cost) +
    numberOrZero(item.shipping_cost) +
    numberOrZero(item.tax)
  );
}

function getPurchaseOrderTotal(items) {
  return items.reduce((total, item) => total + getItemTotal(item), 0);
}

function statusClassName(status) {
  if (status === "received") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (status === "cancelled" || status === "returned") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "partial_received") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (status === "ordered") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }

  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function purchaseOrderMatchesFilters({
  items,
  purchaseOrder,
  searchTerm,
  statusFilter,
  vehicle,
  vendor,
}) {
  if (statusFilter !== "all" && purchaseOrder.status !== statusFilter) {
    return false;
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableText = [
    vehicle?.stock_number,
    vehicle?.make,
    vehicle?.model,
    vendor?.name,
    ...items.map((item) => item.description),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
}

async function fetchPurchaseOrdersData() {
  const purchaseOrdersResponse = await supabase
    .from("purchase_orders")
    .select(purchaseOrderColumns)
    .order("created_at", { ascending: false });

  if (purchaseOrdersResponse.error) {
    return { error: purchaseOrdersResponse.error };
  }

  const purchaseOrders = purchaseOrdersResponse.data ?? [];
  const purchaseOrderIds = uniqueValues(
    purchaseOrders.map((purchaseOrder) => purchaseOrder.id)
  );
  const vehicleIds = uniqueValues(
    purchaseOrders.map((purchaseOrder) => purchaseOrder.vehicle_id)
  );
  const vendorIds = uniqueValues(
    purchaseOrders.map((purchaseOrder) => purchaseOrder.vendor_id)
  );
  const orderedByIds = uniqueValues(
    purchaseOrders.map((purchaseOrder) => purchaseOrder.ordered_by)
  );

  const [itemsResponse, vehiclesResponse, vendorsResponse, profilesResponse] =
    await Promise.all([
      purchaseOrderIds.length > 0
        ? supabase
            .from("purchase_order_items")
            .select(purchaseOrderItemColumns)
            .in("purchase_order_id", purchaseOrderIds)
        : { data: [], error: null },
      vehicleIds.length > 0
        ? supabase
            .from("vehicles")
            .select("id, stock_number, year, make, model")
            .in("id", vehicleIds)
        : { data: [], error: null },
      vendorIds.length > 0
        ? supabase.from("vendors").select("id, name").in("id", vendorIds)
        : { data: [], error: null },
      orderedByIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", orderedByIds)
        : { data: [], error: null },
    ]);

  const firstRelatedError =
    itemsResponse.error ??
    vehiclesResponse.error ??
    vendorsResponse.error ??
    profilesResponse.error;

  if (firstRelatedError) {
    return { error: firstRelatedError };
  }

  return {
    data: {
      profilesById: Object.fromEntries(
        (profilesResponse.data ?? []).map((profile) => [profile.id, profile])
      ),
      purchaseOrderItems: itemsResponse.data ?? [],
      purchaseOrders,
      vehiclesById: Object.fromEntries(
        (vehiclesResponse.data ?? []).map((vehicle) => [vehicle.id, vehicle])
      ),
      vendorsById: Object.fromEntries(
        (vendorsResponse.data ?? []).map((vendor) => [vendor.id, vendor])
      ),
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

function SummaryCard({ label, value }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-zinc-950">{value}</p>
    </article>
  );
}

function PurchaseOrdersPage({ currentProfile, onSelectVehicle }) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [profilesById, setProfilesById] = useState({});
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusErrorMessage, setStatusErrorMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [updatingPurchaseOrderId, setUpdatingPurchaseOrderId] = useState(null);
  const [vehiclesById, setVehiclesById] = useState({});
  const [vendorsById, setVendorsById] = useState({});

  const canManagePurchaseOrders = hasPermission(
    currentProfile?.role,
    "purchase_order:manage"
  );

  const itemsByPurchaseOrderId = useMemo(() => {
    return purchaseOrderItems.reduce((groupedItems, item) => {
      const currentItems = groupedItems[item.purchase_order_id] ?? [];
      groupedItems[item.purchase_order_id] = [...currentItems, item];
      return groupedItems;
    }, {});
  }, [purchaseOrderItems]);

  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((purchaseOrder) =>
      purchaseOrderMatchesFilters({
        items: itemsByPurchaseOrderId[purchaseOrder.id] ?? [],
        purchaseOrder,
        searchTerm,
        statusFilter,
        vehicle: vehiclesById[purchaseOrder.vehicle_id],
        vendor: vendorsById[purchaseOrder.vendor_id],
      })
    );
  }, [
    itemsByPurchaseOrderId,
    purchaseOrders,
    searchTerm,
    statusFilter,
    vehiclesById,
    vendorsById,
  ]);

  const summary = useMemo(() => {
    const totalCost = purchaseOrders.reduce(
      (total, purchaseOrder) =>
        total +
        getPurchaseOrderTotal(itemsByPurchaseOrderId[purchaseOrder.id] ?? []),
      0
    );

    return {
      cancelled: purchaseOrders.filter(
        (purchaseOrder) => purchaseOrder.status === "cancelled"
      ).length,
      ordered: purchaseOrders.filter(
        (purchaseOrder) => purchaseOrder.status === "ordered"
      ).length,
      received: purchaseOrders.filter(
        (purchaseOrder) => purchaseOrder.status === "received"
      ).length,
      total: purchaseOrders.length,
      totalCost,
    };
  }, [itemsByPurchaseOrderId, purchaseOrders]);

  useEffect(() => {
    let isMounted = true;

    async function loadPurchaseOrders() {
      try {
        const { data, error } = await fetchPurchaseOrdersData();

        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setPurchaseOrders(data.purchaseOrders);
        setPurchaseOrderItems(data.purchaseOrderItems);
        setVehiclesById(data.vehiclesById);
        setVendorsById(data.vendorsById);
        setProfilesById(data.profilesById);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Unable to load purchase orders.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPurchaseOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handlePurchaseOrderStatusChange(purchaseOrder, newStatus) {
    if (!canManagePurchaseOrders) {
      setStatusErrorMessage("Your role cannot update purchase orders.");
      return;
    }

    if (!purchaseOrderStatuses.includes(newStatus)) {
      setStatusErrorMessage("That purchase order status is not allowed.");
      return;
    }

    const previousStatus = purchaseOrder.status;
    const shouldMarkReceived = newStatus === "received";
    const receivedAt =
      shouldMarkReceived && !purchaseOrder.received_at
        ? new Date().toISOString()
        : purchaseOrder.received_at;

    setStatusErrorMessage("");
    setUpdatingPurchaseOrderId(purchaseOrder.id);
    setPurchaseOrders((currentPurchaseOrders) =>
      currentPurchaseOrders.map((currentPurchaseOrder) =>
        currentPurchaseOrder.id === purchaseOrder.id
          ? { ...currentPurchaseOrder, received_at: receivedAt, status: newStatus }
          : currentPurchaseOrder
      )
    );

    try {
      const purchaseOrderUpdate = { status: newStatus };

      if (shouldMarkReceived && !purchaseOrder.received_at) {
        purchaseOrderUpdate.received_at = receivedAt;
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update(purchaseOrderUpdate)
        .eq("id", purchaseOrder.id);

      if (error) {
        throw error;
      }

      const linkedItems = itemsByPurchaseOrderId[purchaseOrder.id] ?? [];

      if (shouldMarkReceived && linkedItems.length > 0) {
        const itemIds = linkedItems.map((item) => item.id).filter(Boolean);
        const partRequestIds = uniqueValues(
          linkedItems.map((item) => item.part_request_id)
        );

        if (itemIds.length > 0) {
          const itemResponse = await supabase
            .from("purchase_order_items")
            .update({ status: "received" })
            .in("id", itemIds);

          if (itemResponse.error) {
            setStatusErrorMessage(
              `Purchase order marked received, but item statuses could not be updated: ${itemResponse.error.message}`
            );
            return;
          }

          setPurchaseOrderItems((currentItems) =>
            currentItems.map((item) =>
              itemIds.includes(item.id) ? { ...item, status: "received" } : item
            )
          );
        }

        if (partRequestIds.length > 0) {
          const partRequestResponse = await supabase
            .from("part_requests")
            .update({ status: "received" })
            .in("id", partRequestIds);

          if (partRequestResponse.error) {
            setStatusErrorMessage(
              `Purchase order marked received, but linked part requests could not be updated: ${partRequestResponse.error.message}`
            );
            return;
          }
        }
      }

      await logVehicleActivity({
        vehicleId: purchaseOrder.vehicle_id,
        action: "Purchase order status changed",
        details: {
          from: previousStatus,
          to: newStatus,
        },
      });
    } catch (error) {
      setPurchaseOrders((currentPurchaseOrders) =>
        currentPurchaseOrders.map((currentPurchaseOrder) =>
          currentPurchaseOrder.id === purchaseOrder.id
            ? {
                ...currentPurchaseOrder,
                received_at: purchaseOrder.received_at,
                status: previousStatus,
              }
            : currentPurchaseOrder
        )
      );
      setStatusErrorMessage(
        error.message ?? "Unable to update purchase order."
      );
    } finally {
      setUpdatingPurchaseOrderId(null);
    }
  }

  async function handleItemStatusChange(item, newStatus, purchaseOrder) {
    if (!canManagePurchaseOrders) {
      setStatusErrorMessage("Your role cannot update purchase order items.");
      return;
    }

    if (!purchaseOrderItemStatuses.includes(newStatus)) {
      setStatusErrorMessage("That item status is not allowed.");
      return;
    }

    const previousStatus = item.status;

    setStatusErrorMessage("");
    setUpdatingItemId(item.id);
    setPurchaseOrderItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, status: newStatus } : currentItem
      )
    );

    try {
      const { error } = await supabase
        .from("purchase_order_items")
        .update({ status: newStatus })
        .eq("id", item.id);

      if (error) {
        throw error;
      }

      if (newStatus === "received" && item.part_request_id) {
        const partRequestResponse = await supabase
          .from("part_requests")
          .update({ status: "received" })
          .eq("id", item.part_request_id);

        if (partRequestResponse.error) {
          setStatusErrorMessage(
            `Item marked received, but the linked part request could not be updated: ${partRequestResponse.error.message}`
          );
          return;
        }
      }

      await logVehicleActivity({
        vehicleId: purchaseOrder.vehicle_id,
        action: "Purchase order item status changed",
        details: {
          description: item.description,
          from: previousStatus,
          to: newStatus,
        },
      });
    } catch (error) {
      setPurchaseOrderItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, status: previousStatus }
            : currentItem
        )
      );
      setStatusErrorMessage(error.message ?? "Unable to update item status.");
    } finally {
      setUpdatingItemId(null);
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Purchase Orders
          </p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-950">
            Purchase Order Management
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Track ordered parts across vehicles, receive items, and keep part
            request statuses in sync without leaving the queue.
          </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total POs" value={formatNumber(summary.total)} />
        <SummaryCard label="Ordered" value={formatNumber(summary.ordered)} />
        <SummaryCard label="Received" value={formatNumber(summary.received)} />
        <SummaryCard label="Cancelled" value={formatNumber(summary.cancelled)} />
        <SummaryCard
          label="Total PO Cost"
          value={formatCurrency(summary.totalCost)}
        />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto] lg:items-end">
          <label className="block" htmlFor="purchase-order-search">
            <span className="text-sm font-medium text-zinc-700">Search</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="purchase-order-search"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Stock, vehicle, vendor, or item"
              type="search"
              value={searchTerm}
            />
          </label>

          <label className="block" htmlFor="purchase-order-status-filter">
            <span className="text-sm font-medium text-zinc-700">Status</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 shadow-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-200"
              id="purchase-order-status-filter"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="all">All Statuses</option>
              {purchaseOrderStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            onClick={clearFilters}
            type="button"
          >
            Clear Filters
          </button>
        </div>

        <p className="mt-4 text-sm text-zinc-500">
          Showing {filteredPurchaseOrders.length} of {purchaseOrders.length}{" "}
          purchase orders
        </p>
      </section>

      {isLoading && (
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-700">
            Loading purchase orders...
          </p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </section>
      )}

      {!isLoading && statusErrorMessage && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {statusErrorMessage}
        </section>
      )}

      {!isLoading && !errorMessage && filteredPurchaseOrders.length === 0 && (
        <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-zinc-950">
            No purchase orders found
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            Create purchase orders from needs-to-buy parts, then track them here.
          </p>
        </section>
      )}

      {!isLoading && !errorMessage && filteredPurchaseOrders.length > 0 && (
        <section className="space-y-4">
          {filteredPurchaseOrders.map((purchaseOrder) => {
            const vehicle = vehiclesById[purchaseOrder.vehicle_id];
            const vendor = vendorsById[purchaseOrder.vendor_id];
            const orderedBy = profilesById[purchaseOrder.ordered_by];
            const items = itemsByPurchaseOrderId[purchaseOrder.id] ?? [];
            const totalCost = getPurchaseOrderTotal(items);

            return (
              <article
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                key={purchaseOrder.id}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-zinc-950">
                        {getVehicleLabel(vehicle)}
                      </h3>
                      {!canManagePurchaseOrders && (
                        <Badge className={statusClassName(purchaseOrder.status)}>
                          {formatLabel(purchaseOrder.status)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      Created {formatDate(purchaseOrder.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-start gap-2 xl:justify-end">
                    {canManagePurchaseOrders ? (
                      <StatusDropdown
                        currentStatus={purchaseOrder.status}
                        isUpdating={
                          updatingPurchaseOrderId === purchaseOrder.id
                        }
                        onChange={(newStatus) =>
                          handlePurchaseOrderStatusChange(
                            purchaseOrder,
                            newStatus
                          )
                        }
                        statuses={purchaseOrderStatuses}
                      />
                    ) : null}
                    <button
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!purchaseOrder.vehicle_id}
                      onClick={() => onSelectVehicle?.(purchaseOrder.vehicle_id)}
                      type="button"
                    >
                      View Vehicle
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <p className="text-zinc-500">Vendor</p>
                    <p className="mt-1 font-medium text-zinc-800">
                      {getVendorName(vendor)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Ordered By</p>
                    <p className="mt-1 font-medium text-zinc-800">
                      {getProfileName(orderedBy)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Ordered At</p>
                    <p className="mt-1 font-medium text-zinc-800">
                      {formatDate(purchaseOrder.ordered_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Received At</p>
                    <p className="mt-1 font-medium text-zinc-800">
                      {formatDate(purchaseOrder.received_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Total Cost</p>
                    <p className="mt-1 font-medium text-zinc-800">
                      {formatCurrency(totalCost)}
                    </p>
                  </div>
                </div>

                {purchaseOrder.notes && (
                  <p className="mt-4 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
                    {purchaseOrder.notes}
                  </p>
                )}

                <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-zinc-950">Items</h4>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
                      No items found for this purchase order.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div
                          className="rounded-md border border-zinc-200 bg-white p-4"
                          key={item.id}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <h5 className="font-semibold text-zinc-950">
                                {displayValue(item.description)}
                              </h5>
                              <p className="mt-1 text-sm text-zinc-500">
                                Qty {formatNumber(item.quantity)} x{" "}
                                {formatCurrency(item.unit_cost)} + shipping{" "}
                                {formatCurrency(item.shipping_cost)} + tax{" "}
                                {formatCurrency(item.tax)}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-zinc-700">
                                Total {formatCurrency(getItemTotal(item))}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                              {canManagePurchaseOrders ? (
                                <StatusDropdown
                                  currentStatus={item.status ?? "ordered"}
                                  isUpdating={updatingItemId === item.id}
                                  onChange={(newStatus) =>
                                    handleItemStatusChange(
                                      item,
                                      newStatus,
                                      purchaseOrder
                                    )
                                  }
                                  statuses={purchaseOrderItemStatuses}
                                />
                              ) : (
                                <Badge className={statusClassName(item.status)}>
                                  {formatLabel(item.status)}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {item.notes && (
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default PurchaseOrdersPage;
