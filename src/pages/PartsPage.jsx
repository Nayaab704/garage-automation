import { useEffect, useMemo, useState } from "react";
import PartPriceHistoryModal from "../components/parts/PartPriceHistoryModal";
import PartsQueueCard from "../components/parts/PartsQueueCard";
import PartsQueueEmptyState from "../components/parts/PartsQueueEmptyState";
import PartsQueueTabs from "../components/parts/PartsQueueTabs";
import AppIcon from "../components/ui/AppIcon";
import CreatePurchaseOrderForm from "../components/vehicle-detail/CreatePurchaseOrderForm";
import { logVehicleActivity } from "../lib/activityLogger";
import {
  getPartQueueCounts,
  getSelectedVendorId,
} from "../lib/partWorkflowUtils";
import {
  fetchPartsQueue,
  filterPartsQueueResults,
} from "../lib/partsQueue";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import {
  getVendorQuoteDisplayName,
  markQuotePurchased,
} from "../lib/vendorPriceMemory";

const partRequestColumns =
  "id, vehicle_id, repair_job_id, part_name, quantity, status, notes, part_source, approval_status, unit_cost, selected_vendor_id, selected_quote_id, quoted_unit_cost, quoted_total_cost, created_by, created_at";

function canApprovePartsForProfile(profile) {
  return profile?.role === "admin" || profile?.role === "owner";
}

function PartsPage({
  currentProfile,
  onSelectVehicle,
  onViewPurchaseOrders,
}) {
  const [activeTab, setActiveTab] = useState("needs_po");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [partQueue, setPartQueue] = useState([]);
  const [priceHistoryPart, setPriceHistoryPart] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPartForPurchaseOrder, setSelectedPartForPurchaseOrder] =
    useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingPartId, setUpdatingPartId] = useState(null);
  const [vendors, setVendors] = useState([]);

  const canApproveParts = canApprovePartsForProfile(currentProfile);
  const canManagePurchaseOrders = hasPermission(
    currentProfile?.role,
    "purchase_order:manage"
  );

  const countsByTab = useMemo(
    () => getPartQueueCounts(partQueue),
    [partQueue]
  );

  const filteredParts = useMemo(
    () =>
      filterPartsQueueResults(partQueue, {
        search: searchTerm,
        tab: activeTab,
      }),
    [activeTab, partQueue, searchTerm]
  );

  async function loadPartsQueue({ showLoading = true } = {}) {
    if (showLoading) {
      setIsLoading(true);
    }

    setErrorMessage("");

    try {
      const { data, error } = await fetchPartsQueue();

      if (error) {
        console.error("Could not load parts queue:", error);
        setErrorMessage("Unable to load the parts queue.");
        return;
      }

      setPartQueue(data.parts);
      setVendors(data.vendors);
    } catch (error) {
      console.error("Could not load parts queue:", error);
      setErrorMessage("Unable to load the parts queue.");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialParts() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await fetchPartsQueue();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Could not load parts queue:", error);
          setErrorMessage("Unable to load the parts queue.");
          return;
        }

        setPartQueue(data.parts);
        setVendors(data.vendors);
      } catch (error) {
        if (isMounted) {
          console.error("Could not load parts queue:", error);
          setErrorMessage("Unable to load the parts queue.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialParts();

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
        console.error("Could not update part approval:", error);
        setErrorMessage("Could not save part review. Please try again.");
        return;
      }

      setPartQueue((currentParts) =>
        currentParts.map((currentPart) =>
          currentPart.id === part.id
            ? { ...currentPart, ...(data ?? {}), approval_status: approvalStatus }
            : currentPart
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
      setSuccessMessage(
        approvalStatus === "approved"
          ? "Part approved."
          : "Part request rejected."
      );
    } catch (error) {
      console.error("Could not update part approval:", error);
      setErrorMessage("Could not save part review. Please try again.");
    } finally {
      setUpdatingPartId(null);
    }
  }

  async function handlePurchaseOrderCreated(result) {
    const selectedPart = selectedPartForPurchaseOrder;
    const partRequestId = result?.partRequestId ?? selectedPart?.id;
    const selectedQuote = selectedPart?.selectedQuote;
    let purchasedQuote = null;

    if (selectedQuote?.id && result?.purchaseOrderId) {
      const quoteResult = await markQuotePurchased({
        purchaseOrderId: result.purchaseOrderId,
        purchaseOrderItemId: result.purchaseOrderItemId ?? null,
        quoteId: selectedQuote.id,
      });

      if (quoteResult.error) {
        console.error(
          "Purchase order created, but price memory could not be marked purchased:",
          quoteResult.error
        );
      } else {
        purchasedQuote = quoteResult.data;
      }
    }

    setSelectedPartForPurchaseOrder(null);

    if (partRequestId) {
      const purchaseOrder = result?.purchaseOrder
        ? {
            ...result.purchaseOrder,
            vendor:
              vendors.find((vendor) => vendor.id === result.purchaseOrder.vendor_id) ??
              null,
          }
        : null;
      const purchaseOrderItem = result?.purchaseOrderItem
        ? {
            ...result.purchaseOrderItem,
            purchaseOrder,
          }
        : null;

      setPartQueue((currentParts) =>
        currentParts.map((part) => {
          if (part.id !== partRequestId) {
            return part;
          }

          const nextPurchaseOrderItems = purchaseOrderItem?.id
            ? [
                purchaseOrderItem,
                ...(part.purchaseOrderItems ?? []).filter(
                  (item) => item.id !== purchaseOrderItem.id
                ),
              ]
            : part.purchaseOrderItems;
          const nextSelectedQuote = purchasedQuote
            ? { ...(part.selectedQuote ?? {}), ...purchasedQuote }
            : part.selectedQuote;

          return {
            ...part,
            ...(result?.partRequest ?? {}),
            purchaseOrderItems: nextPurchaseOrderItems,
            selectedQuote: nextSelectedQuote,
            status:
              result?.partRequestStatusUpdated === false
                ? part.status
                : result?.partRequest?.status ?? "ordered",
          };
        })
      );
    }

    if (result?.partRequestStatusUpdated === false) {
      setErrorMessage(
        result.warningMessage ??
          "Purchase order created, but the part status could not be updated."
      );
      return;
    }

    setErrorMessage("");
    setSuccessMessage("Purchase order created. Part moved out of Needs PO.");
  }

  function handleCreatePurchaseOrder(part) {
    setSuccessMessage("");
    setErrorMessage("");
    setSelectedPartForPurchaseOrder(part);
  }

  async function handleUseQuoteForPart(quote, data) {
    const selectedQuote = {
      ...quote,
      id: data.selected_quote_id,
      unit_price: data.quoted_unit_cost,
      vendor_id: data.selected_vendor_id,
    };
    const selectedVendor =
      vendors.find((vendor) => vendor.id === data.selected_vendor_id) ??
      (data.selected_vendor_id
        ? {
            id: data.selected_vendor_id,
            name: getVendorQuoteDisplayName(selectedQuote),
          }
        : null);

    setPartQueue((currentParts) =>
      currentParts.map((part) =>
        part.id === data.id
          ? {
              ...part,
              ...data,
              selectedQuote,
              selectedVendor,
            }
          : part
      )
    );
    setErrorMessage("");
    setSuccessMessage("Vendor price selected for this part.");
    setPriceHistoryPart(null);
  }

  function clearSearch() {
    setSearchTerm("");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Parts Queue</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Track parts that need purchase orders, review, ordering, or receiving.
            </p>
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={() => loadPartsQueue()}
            type="button"
          >
            <AppIcon name="refresh" size={16} />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <label className="relative block" htmlFor="parts-queue-search">
            <span className="sr-only">Search parts</span>
            <AppIcon
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              name="search"
              size={18}
            />
            <input
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white py-2 pl-11 pr-4 text-sm font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              id="parts-queue-search"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search part, stock, vehicle, vendor, or work order"
              type="search"
              value={searchTerm}
            />
          </label>

          {searchTerm.trim() && (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
              onClick={clearSearch}
              type="button"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-4">
          <PartsQueueTabs
            activeTab={activeTab}
            counts={countsByTab}
            onChange={setActiveTab}
          />
        </div>
      </section>

      {isLoading && (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-700">Loading parts queue...</p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {errorMessage}
        </section>
      )}

      {!isLoading && successMessage && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {successMessage}
        </section>
      )}

      {!isLoading && !errorMessage && filteredParts.length === 0 && (
        <PartsQueueEmptyState
          activeTab={activeTab}
          hasSearch={Boolean(searchTerm.trim())}
        />
      )}

      {!isLoading && !errorMessage && filteredParts.length > 0 && (
        <section className="space-y-3">
          {filteredParts.map((part) => (
            <PartsQueueCard
              canApproveParts={canApproveParts}
              canCreatePurchaseOrders={canManagePurchaseOrders}
              isUpdating={updatingPartId === part.id}
              key={part.id}
              onApprove={(currentPart) =>
                handleApprovalChange(currentPart, "approved")
              }
              onCreatePurchaseOrder={handleCreatePurchaseOrder}
              onOpenPurchaseOrders={onViewPurchaseOrders}
              onOpenVehicle={onSelectVehicle}
              onReject={(currentPart) =>
                handleApprovalChange(currentPart, "rejected")
              }
              onViewPrices={setPriceHistoryPart}
              part={part}
            />
          ))}
        </section>
      )}

      {selectedPartForPurchaseOrder && canManagePurchaseOrders && (
        <CreatePurchaseOrderForm
          currentProfile={currentProfile}
          initialPartRequest={selectedPartForPurchaseOrder}
          initialVendorId={getSelectedVendorId(selectedPartForPurchaseOrder)}
          key={selectedPartForPurchaseOrder.id}
          lockPartRequest
          onClose={() => setSelectedPartForPurchaseOrder(null)}
          onPurchaseOrderCreated={handlePurchaseOrderCreated}
          partRequests={[selectedPartForPurchaseOrder]}
          vehicleId={selectedPartForPurchaseOrder.vehicle_id}
          vendors={vendors}
        />
      )}

      {priceHistoryPart && (
        <PartPriceHistoryModal
          onClose={() => setPriceHistoryPart(null)}
          onUseQuote={handleUseQuoteForPart}
          part={priceHistoryPart}
          selectedQuoteId={priceHistoryPart.selected_quote_id}
        />
      )}
    </div>
  );
}

export default PartsPage;
