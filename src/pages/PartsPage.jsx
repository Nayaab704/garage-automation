import { useEffect, useMemo, useState } from "react";
import PartPriceHistoryModal from "../components/parts/PartPriceHistoryModal";
import PartsQueueCard from "../components/parts/PartsQueueCard";
import PartsQueueEmptyState from "../components/parts/PartsQueueEmptyState";
import PartsQueueTabs from "../components/parts/PartsQueueTabs";
import CompactRecordFilters from "../components/ui/CompactRecordFilters";
import ModalShell from "../components/ui/ModalShell";
import OperationalSearchBar, {
  OperationalSearchIconButton,
} from "../components/ui/OperationalSearchBar";
import { buttonClassNames } from "../components/ui/uiStyles";
import CreatePurchaseOrderForm from "../components/vehicle-detail/CreatePurchaseOrderForm";
import { logVehicleActivity } from "../lib/activityLogger";
import {
  getPartQueueCounts,
  getSelectedVendorId,
} from "../lib/partWorkflowUtils";
import {
  getPrimaryReturnedPurchaseOrderItem,
  getReturnDeduction,
} from "../lib/partReturns";
import {
  fetchPartsQueue,
  filterPartsQueueResults,
} from "../lib/partsQueue";
import {
  getActiveFilterCount,
  getOptionById,
  getPartsServiceCategoryFilterOptions,
  getPartsVehicleFilterOptions,
  getPartsVendorFilterOptions,
} from "../lib/operationalFilterOptions";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import useDebouncedValue from "../hooks/useDebouncedValue";
import {
  getVendorQuoteDisplayName,
  markQuotePurchased,
} from "../lib/vendorPriceMemory";

const partRequestColumns =
  "id, vehicle_id, repair_job_id, part_name, quantity, status, notes, part_source, approval_status, approved_by, approved_at, unit_cost, selected_vendor_id, selected_quote_id, quoted_unit_cost, quoted_total_cost, created_by, created_at";

function canApprovePartsForProfile(profile) {
  return profile?.role === "admin" || profile?.role === "owner";
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

function numberOrZero(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrency(value) {
  return currencyFormatter.format(numberOrZero(value));
}

function getRestoredItemStatus(item) {
  return item?.purchaseOrder?.status === "received" ? "received" : "ordered";
}

function UndoReturnModal({ isSubmitting, onClose, onConfirm, part }) {
  const returnedItem = getPrimaryReturnedPurchaseOrderItem(part);

  return (
    <ModalShell
      description="This will add the returned amount back into vehicle costs."
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      title="Undo return for this part?"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">
            {part?.part_name || returnedItem?.description || "Unnamed part"}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Restores {formatCurrency(getReturnDeduction(returnedItem))} to
            vehicle costs.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button
            className={`w-full sm:w-auto ${buttonClassNames.secondary}`}
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className={`w-full sm:w-auto ${buttonClassNames.primary}`}
            disabled={isSubmitting}
            onClick={onConfirm}
            type="button"
          >
            {isSubmitting ? "Undoing return..." : "Undo Return"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
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
  const [selectedServiceCategoryFilterId, setSelectedServiceCategoryFilterId] =
    useState("");
  const [selectedVehicleFilterId, setSelectedVehicleFilterId] = useState("");
  const [selectedVendorFilterId, setSelectedVendorFilterId] = useState("");
  const [serviceCategories, setServiceCategories] = useState([]);
  const [selectedPartForPurchaseOrder, setSelectedPartForPurchaseOrder] =
    useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [undoReturnPart, setUndoReturnPart] = useState(null);
  const [updatingPartId, setUpdatingPartId] = useState(null);
  const [vehicleSearchIndex, setVehicleSearchIndex] = useState([]);
  const [vendors, setVendors] = useState([]);

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  const canApproveParts = canApprovePartsForProfile(currentProfile);
  const canManageReturns = canApprovePartsForProfile(currentProfile);
  const canManagePurchaseOrders = hasPermission(
    currentProfile?.role,
    "purchase_order:manage"
  );

  const countsByTab = useMemo(
    () => getPartQueueCounts(partQueue),
    [partQueue]
  );
  const vendorFilterOptions = useMemo(
    () => getPartsVendorFilterOptions(partQueue, vendors),
    [partQueue, vendors]
  );
  const vehicleFilterOptions = useMemo(
    () => getPartsVehicleFilterOptions(partQueue),
    [partQueue]
  );
  const serviceCategoryFilterOptions = useMemo(
    () => getPartsServiceCategoryFilterOptions(partQueue, serviceCategories),
    [partQueue, serviceCategories]
  );
  const selectedVendorFilter = useMemo(
    () => getOptionById(vendorFilterOptions, selectedVendorFilterId),
    [selectedVendorFilterId, vendorFilterOptions]
  );
  const selectedVehicleFilter = useMemo(
    () => getOptionById(vehicleFilterOptions, selectedVehicleFilterId),
    [selectedVehicleFilterId, vehicleFilterOptions]
  );
  const selectedServiceCategoryFilter = useMemo(
    () =>
      getOptionById(
        serviceCategoryFilterOptions,
        selectedServiceCategoryFilterId
      ),
    [selectedServiceCategoryFilterId, serviceCategoryFilterOptions]
  );
  const activeFilterCount = getActiveFilterCount([
    selectedServiceCategoryFilter?.id,
    selectedVendorFilter?.id,
    selectedVehicleFilter?.id,
  ]);
  const hasActiveFilters = activeFilterCount > 0;

  const filteredParts = useMemo(
    () =>
      filterPartsQueueResults(partQueue, {
        search: debouncedSearchTerm,
        tab: activeTab,
        vehicleId: selectedVehicleFilter?.vehicleId ?? "",
        vehicleSearchIndex,
        serviceCategoryId:
          selectedServiceCategoryFilter?.serviceCategoryId ?? "",
        serviceCategoryKey:
          selectedServiceCategoryFilter?.serviceCategoryKey ?? "",
        vendorId: selectedVendorFilter?.vendorId ?? "",
        vendorName: selectedVendorFilter?.label ?? "",
      }),
    [
      activeTab,
      debouncedSearchTerm,
      partQueue,
      selectedServiceCategoryFilter,
      selectedVehicleFilter,
      selectedVendorFilter,
      vehicleSearchIndex,
    ]
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
      setServiceCategories(data.serviceCategories ?? []);
      setVehicleSearchIndex(data.vehicleSearchIndex ?? []);
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
        setVehicleSearchIndex(data.vehicleSearchIndex ?? []);
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
      const reviewValues =
        approvalStatus === "approved"
          ? {
              approval_status: approvalStatus,
              approved_at: new Date().toISOString(),
              approved_by: currentProfile?.id ?? null,
            }
          : {
              approval_status: approvalStatus,
              approved_at: null,
              approved_by: null,
            };
      const { data, error } = await supabase
        .from("part_requests")
        .update(reviewValues)
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
            ? {
                ...currentPart,
                ...(data ?? reviewValues),
                approvedByProfile:
                  approvalStatus === "approved"
                    ? currentProfile
                    : null,
                approval_status: approvalStatus,
              }
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
    let purchasedQuote = result?.purchasedQuote ?? null;

    if (!purchasedQuote && selectedQuote?.id && result?.purchaseOrderId) {
      const quoteResult = await markQuotePurchased({
        partName:
          result?.partRequest?.part_name ??
          result?.purchaseOrderItem?.description ??
          selectedPart?.part_name,
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

  async function handleConfirmUndoReturn() {
    const part = undoReturnPart;
    const returnedItem = getPrimaryReturnedPurchaseOrderItem(part);

    if (!canManageReturns) {
      setErrorMessage("Your role cannot undo returns.");
      return;
    }

    if (!part?.id || !returnedItem?.id) {
      setErrorMessage("Could not find a returned item to undo.");
      setUndoReturnPart(null);
      return;
    }

    setUpdatingPartId(part.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const restoredStatus = getRestoredItemStatus(returnedItem);
      const updateValues = {
        return_notes: null,
        return_reason: null,
        return_status: null,
        returned_amount: null,
        returned_at: null,
        returned_by: null,
        returned_quantity: null,
        returned_shipping_amount: null,
        status: restoredStatus,
      };
      const { data, error } = await supabase
        .from("purchase_order_items")
        .update(updateValues)
        .eq("id", returnedItem.id)
        .select("*")
        .single();

      if (error) {
        console.error("Could not undo return:", error);
        setErrorMessage("Could not undo return. Please try again.");
        return;
      }

      const nextItem = data ?? { ...returnedItem, ...updateValues };

      setPartQueue((currentParts) =>
        currentParts.map((currentPart) =>
          currentPart.id === part.id
            ? {
                ...currentPart,
                purchaseOrderItems: (currentPart.purchaseOrderItems ?? []).map(
                  (item) =>
                    item.id === returnedItem.id
                      ? {
                          ...item,
                          ...nextItem,
                          purchaseOrder: item.purchaseOrder,
                        }
                      : item
                ),
              }
            : currentPart
        )
      );

      await logVehicleActivity({
        vehicleId: part.vehicle_id,
        action: "Part return undone",
        details: {
          part_name: part.part_name,
          purchase_order_item_id: returnedItem.id,
          restored_status: restoredStatus,
        },
      });
      setUndoReturnPart(null);
      setSuccessMessage("Return undone. Vehicle costs include the part again.");
    } catch (error) {
      console.error("Could not undo return:", error);
      setErrorMessage("Could not undo return. Please try again.");
    } finally {
      setUpdatingPartId(null);
    }
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
    setSelectedServiceCategoryFilterId("");
    setSelectedVehicleFilterId("");
    setSelectedVendorFilterId("");
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm sm:p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-slate-950 sm:text-2xl">
              Parts Queue
            </h2>
            <p className="mt-0.5 max-w-2xl text-xs font-semibold leading-5 text-slate-500 sm:text-sm">
              Track parts that need purchase orders, review, ordering, or receiving.
            </p>
          </div>
        </div>

        <div className="mt-3 min-w-0">
          <OperationalSearchBar
            actions={
              <OperationalSearchIconButton
                ariaLabel="Refresh parts queue"
                disabled={isLoading}
                isBusy={isLoading}
                onClick={() => loadPartsQueue()}
              />
            }
            activeFilterCount={activeFilterCount}
            clearLabel={hasActiveFilters ? "Clear Filters" : "Clear Search"}
            dense
            id="parts-queue-search"
            label="Search parts"
            onChange={setSearchTerm}
            onClear={clearSearch}
            placeholder="Search VIN, stock, vehicle, part, vendor..."
            resultCount={filteredParts.length}
            totalCount={countsByTab[activeTab] ?? partQueue.length}
            value={searchTerm}
          >
            <CompactRecordFilters
              onServiceCategoryChange={setSelectedServiceCategoryFilterId}
              onVehicleChange={setSelectedVehicleFilterId}
              onVendorChange={setSelectedVendorFilterId}
              selectedServiceCategoryId={selectedServiceCategoryFilterId}
              selectedVehicleId={selectedVehicleFilterId}
              selectedVendorId={selectedVendorFilterId}
              serviceCategoryOptions={serviceCategoryFilterOptions}
              vehicleOptions={vehicleFilterOptions}
              vendorOptions={vendorFilterOptions}
            />
          </OperationalSearchBar>
        </div>

        <div className="mt-3 min-w-0">
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
          hasFilters={hasActiveFilters}
          hasSearch={Boolean(debouncedSearchTerm.trim())}
          onClearSearch={clearSearch}
        />
      )}

      {!isLoading && !errorMessage && filteredParts.length > 0 && (
        <section className="min-w-0 space-y-2.5">
          {filteredParts.map((part) => (
            <PartsQueueCard
              canApproveParts={canApproveParts}
              canCreatePurchaseOrders={canManagePurchaseOrders}
              canManageReturns={canManageReturns}
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
              onUndoReturn={setUndoReturnPart}
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

      {undoReturnPart && canManageReturns && (
        <UndoReturnModal
          isSubmitting={updatingPartId === undoReturnPart.id}
          onClose={() => setUndoReturnPart(null)}
          onConfirm={handleConfirmUndoReturn}
          part={undoReturnPart}
        />
      )}
    </div>
  );
}

export default PartsPage;
