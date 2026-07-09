import { useEffect, useRef, useState } from "react";
import EditVehicleForm from "../components/EditVehicleForm";
import AppIcon from "../components/ui/AppIcon";
import AddVehiclePhotoForm from "../components/vehicle-detail/AddVehiclePhotoForm";
import DeleteVehicleModal from "../components/vehicle-detail/DeleteVehicleModal";
import ExtraCostsSection from "../components/vehicle-detail/ExtraCostsSection";
import FinalCheckSection from "../components/vehicle-detail/FinalCheckSection";
import {
  areFinalChecksComplete,
  finalCheckTemplates,
} from "../lib/finalChecks";
import InvestmentSummary from "../components/vehicle-detail/InvestmentSummary";
import SaleWarrantySection from "../components/vehicle-detail/SaleWarrantySection";
import SellVehicleForm from "../components/vehicle-detail/SellVehicleForm";
import ServiceWorkSection from "../components/vehicle-detail/ServiceWorkSection";
import VehicleHeader from "../components/vehicle-detail/VehicleHeader";
import VehiclePhotosSection from "../components/vehicle-detail/VehiclePhotosSection";
import { logVehicleActivity } from "../lib/activityLogger";
import {
  applyReturnDeductionToInvestmentSummary,
  getPurchaseOrderReturnDeduction,
} from "../lib/partReturns";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";
import { getVehiclePrimaryPhoto } from "../lib/vehicleDisplayPhoto";
import {
  getVehicleStatusAfterFinalCheckChange,
  normalizeVehicleStatus,
  shouldMoveToRepair,
} from "../lib/vehicleStatus";
import {
  getWorkOrderStatusAfterPartAdded,
  getWorkOrderStatusAfterPartsReceived,
  getWorkOrderStatusAfterPurchaseOrderCreated,
  getWorkOrderStatusAfterWorkStarted,
} from "../lib/workOrderStatus";

async function fetchInvestmentSummary(vehicleId, stockNumber) {
  const byVehicleId = await supabase
    .from("vehicle_investment_summary")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();

  if (byVehicleId.error) {
    return byVehicleId;
  }

  const summaryResponse =
    byVehicleId.data || !stockNumber
      ? byVehicleId
      : await supabase
          .from("vehicle_investment_summary")
          .select("*")
          .eq("stock_number", stockNumber)
          .maybeSingle();

  if (summaryResponse.error || !summaryResponse.data) {
    return summaryResponse;
  }

  const returnDeductionResponse = await fetchVehicleReturnDeduction(vehicleId);

  if (returnDeductionResponse.error) {
    return { data: null, error: returnDeductionResponse.error };
  }

  return {
    data: applyReturnDeductionToInvestmentSummary(
      summaryResponse.data,
      returnDeductionResponse.data
    ),
    error: null,
  };
}

async function fetchVehicleReturnDeduction(vehicleId) {
  const purchaseOrdersResponse = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("vehicle_id", vehicleId);

  if (purchaseOrdersResponse.error) {
    return { data: 0, error: purchaseOrdersResponse.error };
  }

  const purchaseOrderIds = (purchaseOrdersResponse.data ?? [])
    .map((purchaseOrder) => purchaseOrder.id)
    .filter(Boolean);

  if (purchaseOrderIds.length === 0) {
    return { data: 0, error: null };
  }

  const itemsResponse = await supabase
    .from("purchase_order_items")
    .select(
      "id, quantity, unit_cost, shipping_cost, tax, status, return_status, returned_amount, returned_shipping_amount"
    )
    .in("purchase_order_id", purchaseOrderIds);

  if (itemsResponse.error) {
    return { data: 0, error: itemsResponse.error };
  }

  return {
    data: getPurchaseOrderReturnDeduction(itemsResponse.data ?? []),
    error: null,
  };
}

const finalCheckColumns =
  "id, vehicle_id, check_key, label, required_role, is_checked, checked_by, checked_at, notes, created_at";

const vehicleDocumentColumns =
  "id, vehicle_id, repair_job_id, third_party_repair_id, purchase_order_id, document_type, file_url, file_path, file_name, file_mime_type, file_size_bytes, notes, uploaded_by, created_at";

const vehicleStatusUpdateFailureMessage =
  "Vehicle status could not be updated. Please refresh and try again.";

async function fetchFinalChecks(vehicleId) {
  const existingChecksResponse = await supabase
    .from("vehicle_final_checks")
    .select(finalCheckColumns)
    .eq("vehicle_id", vehicleId);

  if (existingChecksResponse.error) {
    return existingChecksResponse;
  }

  const existingKeys = new Set(
    (existingChecksResponse.data ?? []).map((finalCheck) => finalCheck.check_key)
  );
  const missingChecks = finalCheckTemplates.filter(
    (template) => !existingKeys.has(template.check_key)
  );

  if (missingChecks.length === 0) {
    return existingChecksResponse;
  }

  const insertRows = missingChecks.map((template) => ({
    vehicle_id: vehicleId,
    check_key: template.check_key,
    label: template.label,
    required_role: template.required_role,
    is_checked: false,
  }));

  const insertResponse = await supabase
    .from("vehicle_final_checks")
    .upsert(insertRows, {
      ignoreDuplicates: true,
      onConflict: "vehicle_id,check_key",
    });

  if (insertResponse.error && insertResponse.error.code !== "23505") {
    return { data: existingChecksResponse.data ?? [], error: insertResponse.error };
  }

  return supabase
    .from("vehicle_final_checks")
    .select(finalCheckColumns)
    .eq("vehicle_id", vehicleId);
}

async function fetchVehicleDetails(vehicleId) {
  const [
    vehicleResponse,
    repairJobsResponse,
    partRequestsResponse,
    laborLogsResponse,
    profilesResponse,
    costEntriesResponse,
    vehiclePhotosResponse,
    vehicleDocumentsResponse,
    serviceCategoriesResponse,
    thirdPartyRepairsResponse,
    purchaseOrdersResponse,
    vendorsResponse,
    salesResponse,
  ] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", vehicleId).single(),
    supabase.from("repair_jobs").select("*").eq("vehicle_id", vehicleId),
    supabase.from("part_requests").select("*").eq("vehicle_id", vehicleId),
    supabase
      .from("labor_logs")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, phone, hourly_rate"),
    supabase.from("cost_entries").select("*").eq("vehicle_id", vehicleId),
    supabase
      .from("vehicle_photos")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicle_documents")
      .select(vehicleDocumentColumns)
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("service_categories")
      .select("id, slug, name, description, sort_order, is_active, created_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("third_party_repairs")
      .select(
        "id, vehicle_id, repair_job_id, vendor_id, service_rendered, status, outbound_date, inbound_date, repair_cost, transit_cost, invoice_url, invoice_path, notes, created_by, created_at"
      )
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase.from("purchase_orders").select("*").eq("vehicle_id", vehicleId),
    supabase.from("vendors").select("*"),
    supabase.from("sales").select("*").eq("vehicle_id", vehicleId),
  ]);

  const purchaseOrderIds = (purchaseOrdersResponse.data ?? [])
    .map((purchaseOrder) => purchaseOrder.id)
    .filter(Boolean);

  const purchaseOrderItemsResponse =
    purchaseOrdersResponse.error || purchaseOrderIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("purchase_order_items")
          .select("*")
          .in("purchase_order_id", purchaseOrderIds);

  const saleIds = (salesResponse.data ?? [])
    .map((sale) => sale.id)
    .filter(Boolean);

  const warrantiesResponse =
    salesResponse.error || saleIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("warranties")
          .select("*")
          .in("sale_id", saleIds);

  const investmentSummaryResponse = vehicleResponse.error
    ? { data: null, error: null }
    : await fetchInvestmentSummary(vehicleId, vehicleResponse.data?.stock_number);
  const finalChecksResponse = vehicleResponse.error
    ? { data: [], error: null }
    : await fetchFinalChecks(vehicleId);

  return {
    investmentSummaryResponse,
    costEntriesResponse,
    finalChecksResponse,
    laborLogsResponse,
    partRequestsResponse,
    profilesResponse,
    serviceCategoriesResponse,
    thirdPartyRepairsResponse,
    vehicleDocumentsResponse,
    vehiclePhotosResponse,
    purchaseOrderItemsResponse,
    purchaseOrdersResponse,
    repairJobsResponse,
    salesResponse,
    vendorsResponse,
    vehicleResponse,
    warrantiesResponse,
  };
}

function findFirstError(responses) {
  return (
    responses.vehicleResponse.error ??
    responses.repairJobsResponse.error ??
    responses.partRequestsResponse.error ??
    responses.laborLogsResponse.error ??
    responses.finalChecksResponse.error ??
    responses.profilesResponse.error ??
    responses.costEntriesResponse.error ??
    responses.vehiclePhotosResponse.error ??
    responses.vehicleDocumentsResponse.error ??
    responses.serviceCategoriesResponse.error ??
    responses.thirdPartyRepairsResponse.error ??
    responses.purchaseOrdersResponse.error ??
    responses.purchaseOrderItemsResponse.error ??
    responses.vendorsResponse.error ??
    responses.salesResponse.error ??
    responses.warrantiesResponse.error ??
    responses.investmentSummaryResponse.error
  );
}

function applyVehicleDetails(responses, setters) {
  const firstError = findFirstError(responses);

  if (firstError) {
    setters.setErrorMessage(firstError.message);
    setters.setVehicle(null);
    setters.setRepairJobs([]);
    setters.setPartRequests([]);
    setters.setLaborLogs([]);
    setters.setFinalChecks([]);
    setters.setProfiles([]);
    setters.setCostEntries([]);
    setters.setVehiclePhotos([]);
    setters.setVehicleDocuments([]);
    setters.setServiceCategories([]);
    setters.setThirdPartyRepairs([]);
    setters.setPurchaseOrders([]);
    setters.setPurchaseOrderItems([]);
    setters.setVendors([]);
    setters.setSales([]);
    setters.setWarranties([]);
    setters.setInvestmentSummary(null);
    return;
  }

  setters.setVehicle(responses.vehicleResponse.data);
  setters.setRepairJobs(responses.repairJobsResponse.data ?? []);
  setters.setPartRequests(responses.partRequestsResponse.data ?? []);
  setters.setLaborLogs(responses.laborLogsResponse.data ?? []);
  setters.setFinalChecks(responses.finalChecksResponse.data ?? []);
  setters.setProfiles(responses.profilesResponse.data ?? []);
  setters.setCostEntries(responses.costEntriesResponse.data ?? []);
  setters.setVehiclePhotos(responses.vehiclePhotosResponse.data ?? []);
  setters.setVehicleDocuments(responses.vehicleDocumentsResponse.data ?? []);
  setters.setServiceCategories(responses.serviceCategoriesResponse.data ?? []);
  setters.setThirdPartyRepairs(responses.thirdPartyRepairsResponse.data ?? []);
  setters.setPurchaseOrders(responses.purchaseOrdersResponse.data ?? []);
  setters.setPurchaseOrderItems(responses.purchaseOrderItemsResponse.data ?? []);
  setters.setVendors(responses.vendorsResponse.data ?? []);
  setters.setSales(responses.salesResponse.data ?? []);
  setters.setWarranties(responses.warrantiesResponse.data ?? []);
  setters.setInvestmentSummary(responses.investmentSummaryResponse.data);
}

function upsertNewestById(items, nextItem) {
  if (!nextItem?.id) {
    return items;
  }

  return [
    nextItem,
    ...items.filter((currentItem) => currentItem.id !== nextItem.id),
  ];
}

function replaceById(items, nextItem) {
  if (!nextItem?.id) {
    return items;
  }

  return items.map((currentItem) =>
    currentItem.id === nextItem.id ? nextItem : currentItem
  );
}

function mergeVehicleState(currentVehicle, nextVehicle) {
  if (!nextVehicle?.id) {
    return currentVehicle;
  }

  const hasPrimaryPhotoId = Object.prototype.hasOwnProperty.call(
    nextVehicle,
    "primary_photo_id"
  );

  return {
    ...currentVehicle,
    ...nextVehicle,
    primary_photo_id: hasPrimaryPhotoId
      ? nextVehicle.primary_photo_id
      : currentVehicle?.primary_photo_id ?? null,
  };
}

function VehicleDetailPage({
  currentProfile,
  onBack,
  vehicleId,
}) {
  const [vehicle, setVehicle] = useState(null);
  const [repairJobs, setRepairJobs] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [laborLogs, setLaborLogs] = useState([]);
  const [finalChecks, setFinalChecks] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [costEntries, setCostEntries] = useState([]);
  const [vehiclePhotos, setVehiclePhotos] = useState([]);
  const [vehicleDocuments, setVehicleDocuments] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [thirdPartyRepairs, setThirdPartyRepairs] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrderItems, setPurchaseOrderItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [sales, setSales] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [investmentSummary, setInvestmentSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [vehicleStatusError, setVehicleStatusError] = useState("");
  const [isVehicleStatusUpdating, setIsVehicleStatusUpdating] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isSellFormOpen, setIsSellFormOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVehiclePhotoFormOpen, setIsVehiclePhotoFormOpen] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const serviceWorkRef = useRef(null);
  const vehiclePhotosRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadVehicleDetails() {
      if (!vehicleId) {
        setErrorMessage("No vehicle was selected.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setVehicleStatusError("");

      try {
        const responses = await fetchVehicleDetails(vehicleId);

        if (!isMounted) {
          return;
        }

        applyVehicleDetails(responses, {
          setCostEntries,
          setErrorMessage,
          setFinalChecks,
          setInvestmentSummary,
          setLaborLogs,
          setPartRequests,
          setProfiles,
          setServiceCategories,
          setThirdPartyRepairs,
          setVehicleDocuments,
          setVehiclePhotos,
          setPurchaseOrderItems,
          setPurchaseOrders,
          setRepairJobs,
          setSales,
          setVendors,
          setVehicle,
          setWarranties,
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Something went wrong.");
          setVehicle(null);
          setRepairJobs([]);
          setPartRequests([]);
          setLaborLogs([]);
          setFinalChecks([]);
          setProfiles([]);
          setCostEntries([]);
          setVehiclePhotos([]);
          setVehicleDocuments([]);
          setServiceCategories([]);
          setThirdPartyRepairs([]);
          setPurchaseOrders([]);
          setPurchaseOrderItems([]);
          setVendors([]);
          setSales([]);
          setWarranties([]);
          setInvestmentSummary(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadVehicleDetails();

    return () => {
      isMounted = false;
    };
  }, [refreshCount, vehicleId]);

  function refreshVehicleDetails() {
    setRefreshCount((currentCount) => currentCount + 1);
  }

  function refreshActivityTimeline() {
    // Activity is still logged, but the timeline is hidden from Vehicle Detail.
  }

  function scrollToSection(sectionRef) {
    sectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleHeroPhotoClick() {
    if (canManagePhotos) {
      setIsVehiclePhotoFormOpen(true);
      return;
    }

    scrollToSection(vehiclePhotosRef);
  }

  async function refreshInvestmentSummary() {
    if (!vehicleId) {
      return;
    }

    const response = await fetchInvestmentSummary(
      vehicleId,
      vehicle?.stock_number
    );

    if (response.error) {
      setErrorMessage(response.error.message);
      return;
    }

    setInvestmentSummary(response.data);
  }

  async function persistVehicleStatus(
    newStatus,
    {
      activityAction = "Vehicle status changed",
      activityDetails = {},
      enforcePermission = true,
      failureMessage = vehicleStatusUpdateFailureMessage,
      requireReadyChecks = true,
    } = {}
  ) {
    const normalizedNewStatus = normalizeVehicleStatus(newStatus);

    if (enforcePermission && !canChangeVehicleStatus) {
      setVehicleStatusError("Your role cannot change vehicle status.");
      return false;
    }

    if (!vehicle?.id) {
      setVehicleStatusError("Unable to update a vehicle without an ID.");
      return false;
    }

    const normalizedCurrentStatus = normalizeVehicleStatus(vehicle.status);

    if (normalizedCurrentStatus === normalizedNewStatus) {
      return true;
    }

    if (
      requireReadyChecks &&
      normalizedNewStatus === "ready_for_sale" &&
      !areFinalChecksComplete(finalChecks)
    ) {
      setVehicleStatusError(
        "Complete all final checks before marking this vehicle Ready For Sale."
      );
      return false;
    }

    const previousStatus = vehicle.status;

    setVehicleStatusError("");
    setIsVehicleStatusUpdating(true);
    setVehicle((currentVehicle) =>
      currentVehicle
        ? { ...currentVehicle, status: normalizedNewStatus }
        : currentVehicle
    );

    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ status: normalizedNewStatus })
        .eq("id", vehicle.id);

      if (error) {
        console.error("Could not update vehicle status:", error);
        setVehicle((currentVehicle) =>
          currentVehicle
            ? { ...currentVehicle, status: previousStatus }
            : currentVehicle
        );
        setVehicleStatusError(failureMessage);
        return false;
      }

      await logVehicleActivity({
        vehicleId,
        action: activityAction,
        details: {
          ...activityDetails,
          from: normalizedCurrentStatus,
          to: normalizedNewStatus,
        },
      });
      refreshActivityTimeline();
      return true;
    } catch (error) {
      console.error("Could not update vehicle status:", error);
      setVehicle((currentVehicle) =>
        currentVehicle
          ? { ...currentVehicle, status: previousStatus }
          : currentVehicle
      );
      setVehicleStatusError(failureMessage);
      return false;
    } finally {
      setIsVehicleStatusUpdating(false);
    }
  }

  async function moveVehicleToRepairIfNeeded(trigger) {
    if (!shouldMoveToRepair(vehicle)) {
      return;
    }

    await persistVehicleStatus("repair", {
      activityAction: "Vehicle moved to Repair",
      activityDetails: { trigger },
      enforcePermission: false,
      failureMessage:
        "Work was saved, but the vehicle status could not be moved to Repair. Please refresh and try again.",
      requireReadyChecks: false,
    });
  }

  async function persistWorkOrderStatusIfNeeded(
    workOrderId,
    nextStatus,
    details = {}
  ) {
    if (!workOrderId || !nextStatus) {
      return false;
    }

    const workOrder = repairJobs.find(
      (currentWorkOrder) => currentWorkOrder.id === workOrderId
    );
    const previousStatus = workOrder?.status ?? null;

    if (previousStatus === nextStatus) {
      return true;
    }

    setRepairJobs((currentRepairJobs) =>
      currentRepairJobs.map((currentWorkOrder) =>
        currentWorkOrder.id === workOrderId
          ? { ...currentWorkOrder, status: nextStatus }
          : currentWorkOrder
      )
    );

    try {
      const { data, error } = await supabase
        .from("repair_jobs")
        .update({ status: nextStatus })
        .eq("id", workOrderId)
        .select("*")
        .single();

      if (error) {
        console.error("Could not update work order status:", error);
        setRepairJobs((currentRepairJobs) =>
          currentRepairJobs.map((currentWorkOrder) =>
            currentWorkOrder.id === workOrderId
              ? { ...currentWorkOrder, status: previousStatus }
              : currentWorkOrder
          )
        );
        return false;
      }

      if (data) {
        setRepairJobs((currentRepairJobs) =>
          replaceById(currentRepairJobs, data)
        );
      }

      await logVehicleActivity({
        vehicleId,
        action: "Work order status changed automatically",
        details: {
          ...details,
          from: previousStatus,
          title: workOrder?.title ?? "Work Order",
          to: nextStatus,
        },
      });
      refreshActivityTimeline();
      return true;
    } catch (error) {
      console.error("Could not update work order status:", error);
      setRepairJobs((currentRepairJobs) =>
        currentRepairJobs.map((currentWorkOrder) =>
          currentWorkOrder.id === workOrderId
            ? { ...currentWorkOrder, status: previousStatus }
            : currentWorkOrder
        )
      );
      return false;
    }
  }

  async function syncVehicleStatusFromFinalChecks(nextFinalChecks) {
    const nextStatus = getVehicleStatusAfterFinalCheckChange({
      finalChecks: nextFinalChecks,
      finalCheckTemplates,
      vehicle,
    });

    if (!nextStatus) {
      return;
    }

    await persistVehicleStatus(nextStatus, {
      activityAction: "Vehicle status updated from final checklist",
      activityDetails: {
        checked_count: nextFinalChecks.filter((check) => check.is_checked).length,
      },
      enforcePermission: false,
      failureMessage:
        "Final check was saved, but the vehicle status could not be updated. Please refresh and try again.",
      requireReadyChecks: false,
    });
  }

  async function handleFinalCheckUpdated(updatedFinalCheck, nextFinalChecks) {
    setFinalChecks((currentFinalChecks) =>
      replaceById(currentFinalChecks, updatedFinalCheck)
    );

    if (nextFinalChecks) {
      await syncVehicleStatusFromFinalChecks(nextFinalChecks);
    }
  }

  async function handleWorkOrderAdded(workOrder) {
    setRepairJobs((currentRepairJobs) =>
      upsertNewestById(currentRepairJobs, workOrder)
    );
    await moveVehicleToRepairIfNeeded("work_order_added");
  }

  async function handleWorkOrderLaborAdded(laborLog) {
    setLaborLogs((currentLaborLogs) =>
      upsertNewestById(currentLaborLogs, laborLog)
    );

    const workOrder = repairJobs.find(
      (currentWorkOrder) => currentWorkOrder.id === laborLog?.repair_job_id
    );

    await persistWorkOrderStatusIfNeeded(
      laborLog?.repair_job_id,
      getWorkOrderStatusAfterWorkStarted(workOrder?.status),
      {
        labor_log_id: laborLog?.id,
        trigger: "labor_added",
      }
    );

    await refreshInvestmentSummary();
  }

  async function handleWorkOrderLaborDeleted(deletedLaborLog) {
    if (deletedLaborLog?.id) {
      setLaborLogs((currentLaborLogs) =>
        currentLaborLogs.filter(
          (laborLog) => laborLog.id !== deletedLaborLog.id
        )
      );
    }

    await refreshInvestmentSummary();
  }

  async function handleWorkOrderPartAdded(partRequest) {
    setPartRequests((currentPartRequests) =>
      upsertNewestById(currentPartRequests, partRequest)
    );

    const workOrder = repairJobs.find(
      (currentWorkOrder) => currentWorkOrder.id === partRequest?.repair_job_id
    );

    await persistWorkOrderStatusIfNeeded(
      partRequest?.repair_job_id,
      getWorkOrderStatusAfterPartAdded(workOrder?.status, partRequest),
      {
        part_name: partRequest?.part_name,
        part_source: partRequest?.part_source,
        trigger: "part_added",
      }
    );

    await moveVehicleToRepairIfNeeded("part_added");

    if (partRequest?.part_source === "in_house") {
      await refreshInvestmentSummary();
    }
  }

  function handleWorkOrderPartApprovalUpdated(updatedPartRequest) {
    setPartRequests((currentPartRequests) =>
      replaceById(currentPartRequests, updatedPartRequest)
    );
  }

  async function handleWorkOrderPartPurchaseOrderCreated(result) {
    const updatedPartRequest = result?.partRequest ?? result;

    if (updatedPartRequest?.id) {
      setPartRequests((currentPartRequests) =>
        replaceById(currentPartRequests, updatedPartRequest)
      );
    }

    if (result?.purchaseOrder?.id) {
      setPurchaseOrders((currentPurchaseOrders) =>
        upsertNewestById(currentPurchaseOrders, result.purchaseOrder)
      );
    }

    if (result?.purchaseOrderItem?.id) {
      setPurchaseOrderItems((currentPurchaseOrderItems) =>
        upsertNewestById(currentPurchaseOrderItems, result.purchaseOrderItem)
      );
    }

    const workOrder = repairJobs.find(
      (currentWorkOrder) =>
        currentWorkOrder.id === updatedPartRequest?.repair_job_id
    );

    await persistWorkOrderStatusIfNeeded(
      updatedPartRequest?.repair_job_id,
      getWorkOrderStatusAfterPurchaseOrderCreated(workOrder?.status),
      {
        part_name: updatedPartRequest?.part_name,
        purchase_order_id: result?.purchaseOrder?.id,
        trigger: "purchase_order_created",
      }
    );

    await refreshInvestmentSummary();
  }

  async function handlePurchaseOrderItemUpdated(updatedItem) {
    const nextPurchaseOrderItems = updatedItem?.id
      ? purchaseOrderItems.map((purchaseOrderItem) =>
          purchaseOrderItem.id === updatedItem.id
            ? { ...purchaseOrderItem, ...updatedItem }
            : purchaseOrderItem
        )
      : purchaseOrderItems;
    const linkedPartRequest = partRequests.find(
      (partRequest) => partRequest.id === updatedItem?.part_request_id
    );
    const nextPartRequests =
      linkedPartRequest && updatedItem?.status === "received"
        ? partRequests.map((partRequest) =>
            partRequest.id === linkedPartRequest.id
              ? { ...partRequest, status: "received" }
              : partRequest
          )
        : partRequests;

    if (updatedItem?.id) {
      setPurchaseOrderItems(nextPurchaseOrderItems);
    }

    if (linkedPartRequest && updatedItem?.status === "received") {
      setPartRequests(nextPartRequests);
    }

    if (linkedPartRequest?.repair_job_id) {
      const workOrder = repairJobs.find(
        (currentWorkOrder) =>
          currentWorkOrder.id === linkedPartRequest.repair_job_id
      );
      const workOrderPartRequests = nextPartRequests.filter(
        (partRequest) =>
          partRequest.repair_job_id === linkedPartRequest.repair_job_id
      );

      await persistWorkOrderStatusIfNeeded(
        linkedPartRequest.repair_job_id,
        getWorkOrderStatusAfterPartsReceived(workOrder?.status, {
          partRequests: workOrderPartRequests,
          purchaseOrderItems: nextPurchaseOrderItems,
        }),
        {
          part_name: linkedPartRequest.part_name,
          purchase_order_item_id: updatedItem?.id,
          trigger: "purchase_order_item_received",
        }
      );
    }

    await refreshInvestmentSummary();
  }

  function handleWorkOrderPhotoAdded(photo) {
    setVehiclePhotos((currentPhotos) => upsertNewestById(currentPhotos, photo));
  }

  function handleWorkOrderPhotoDeleted(deletedPhoto) {
    if (!deletedPhoto?.id) {
      return;
    }

    setVehiclePhotos((currentPhotos) =>
      currentPhotos.filter((photo) => photo.id !== deletedPhoto.id)
    );
  }

  function handleDocumentAdded(documentRecord) {
    setVehicleDocuments((currentDocuments) =>
      upsertNewestById(currentDocuments, documentRecord)
    );
  }

  function handleDocumentDeleted(deletedDocument) {
    if (!deletedDocument?.id) {
      return;
    }

    setVehicleDocuments((currentDocuments) =>
      currentDocuments.filter((documentRecord) => documentRecord.id !== deletedDocument.id)
    );
  }

  async function handleThirdPartyRepairAdded(thirdPartyRepair) {
    setThirdPartyRepairs((currentRepairs) =>
      upsertNewestById(currentRepairs, thirdPartyRepair)
    );

    const workOrder = repairJobs.find(
      (currentWorkOrder) =>
        currentWorkOrder.id === thirdPartyRepair?.repair_job_id
    );

    await persistWorkOrderStatusIfNeeded(
      thirdPartyRepair?.repair_job_id,
      getWorkOrderStatusAfterWorkStarted(workOrder?.status),
      {
        third_party_repair_id: thirdPartyRepair?.id,
        trigger: "third_party_repair_added",
      }
    );

    await moveVehicleToRepairIfNeeded("third_party_repair_added");
    await refreshInvestmentSummary();
  }

  async function handleThirdPartyRepairDeleted(deletedRepair) {
    if (deletedRepair?.id) {
      setThirdPartyRepairs((currentRepairs) =>
        currentRepairs.filter((repair) => repair.id !== deletedRepair.id)
      );
    }

    await refreshInvestmentSummary();
  }

  async function handleVehicleUpdated(updatedVehicle) {
    if (updatedVehicle?.id) {
      setVehicle((currentVehicle) =>
        mergeVehicleState(currentVehicle, updatedVehicle)
      );
    }

    await refreshInvestmentSummary();
  }

  async function handleVehicleSold(result) {
    if (result?.vehicle?.id) {
      setVehicle((currentVehicle) =>
        mergeVehicleState(currentVehicle, result.vehicle)
      );
    }

    if (result?.sale?.id) {
      setSales((currentSales) => upsertNewestById(currentSales, result.sale));
    }

    if (result?.warranty?.id) {
      setWarranties((currentWarranties) =>
        upsertNewestById(currentWarranties, result.warranty)
      );
    }

    await refreshInvestmentSummary();
  }

  function handleVehiclePhotoAdded(photo) {
    setVehiclePhotos((currentPhotos) => upsertNewestById(currentPhotos, photo));
  }

  async function updateVehiclePrimaryPhoto(photo) {
    if (!photo?.id || !vehicle?.id) {
      throw new Error("Missing main photo.");
    }

    const { data, error } = await supabase
      .from("vehicles")
      .update({ primary_photo_id: photo.id })
      .eq("id", vehicle.id)
      .select("id, primary_photo_id")
      .single();

    if (error || data?.primary_photo_id !== photo.id) {
      console.error("Could not update main photo:", error ?? data);
      throw new Error("Could not update main vehicle photo. Please try again.");
    }

    setVehiclePhotos((currentPhotos) => upsertNewestById(currentPhotos, photo));
    setVehicle((currentVehicle) =>
      mergeVehicleState(currentVehicle, {
        id: vehicle.id,
        primary_photo_id: data.primary_photo_id,
      })
    );

    return data;
  }

  async function handleMainVehiclePhotoAdded(photo) {
    await updateVehiclePrimaryPhoto(photo);
  }

  async function handleGalleryMainPhotoSelected(photo) {
    await updateVehiclePrimaryPhoto(photo);

    await logVehicleActivity({
      vehicleId,
      action: "Main photo updated",
      details: {
        photo_id: photo.id,
        photo_type: photo.photo_type,
        caption: photo.caption,
      },
    });
    refreshActivityTimeline();
  }

  async function handleVehiclePhotoDeleted(deletedPhoto) {
    if (!deletedPhoto?.id) {
      return;
    }

    setVehiclePhotos((currentPhotos) =>
      currentPhotos.filter((photo) => photo.id !== deletedPhoto.id)
    );

    if (vehicle?.primary_photo_id !== deletedPhoto.id) {
      return;
    }

    setVehicle((currentVehicle) =>
      currentVehicle
        ? { ...currentVehicle, primary_photo_id: null }
        : currentVehicle
    );

    const { data, error } = await supabase
      .from("vehicles")
      .update({ primary_photo_id: null })
      .eq("id", vehicle.id)
      .select("id, primary_photo_id")
      .single();

    if (error) {
      console.error("Could not clear main photo:", error);
      return;
    }

    setVehicle((currentVehicle) => mergeVehicleState(currentVehicle, data));
  }

  async function handleExtraCostAdded(costEntry) {
    setCostEntries((currentCostEntries) =>
      upsertNewestById(currentCostEntries, costEntry)
    );
    await refreshInvestmentSummary();
  }

  async function handleExtraCostDeleted(deletedCostEntry) {
    if (deletedCostEntry?.id) {
      setCostEntries((currentCostEntries) =>
        currentCostEntries.filter(
          (costEntry) => costEntry.id !== deletedCostEntry.id
        )
      );
    }

    await refreshInvestmentSummary();
  }

  async function handleVehicleStatusChange(newStatus) {
    await persistVehicleStatus(newStatus);
  }

  const isVehicleSold =
    String(vehicle?.status ?? "").toLowerCase() === "sold" || sales.length > 0;
  const role = currentProfile?.role;
  const canChangeVehicleStatus = hasPermission(role, "vehicle:change_status");
  const canDeleteVehicle = hasPermission(role, "vehicle:delete");
  const canEditVehicle = hasPermission(role, "vehicle:edit");
  const canManageExtraCosts = hasPermission(role, "extra_cost:manage");
  const canManageLabor = hasPermission(role, "labor:manage");
  const canManagePartRequests = hasPermission(role, "part_request:manage");
  const canManagePhotos = hasPermission(role, "photo:manage");
  const canManageRepairJobs = hasPermission(role, "repair:manage");
  const canManageWorkOrderParts = canManageRepairJobs || canManagePartRequests;
  const canUploadDocuments =
    (role === "admin" || role === "owner" || role === "technician") &&
    (canManagePhotos || canManageRepairJobs);
  const canManageDocuments = canManagePhotos;
  const canSellVehicle = hasPermission(role, "sale:manage");
  const primaryVehiclePhoto = getVehiclePrimaryPhoto(vehicle, vehiclePhotos);

  return (
    <div className="space-y-4 text-slate-950">
      <div className="sticky top-0 z-10 -mx-4 bg-slate-50/95 px-4 py-1.5 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex items-center justify-between gap-3">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto sm:px-4"
            onClick={onBack}
            type="button"
          >
            <AppIcon
              className="rotate-180 sm:mr-2"
              name="chevron-right"
              size={20}
            />
            <span className="hidden text-sm font-bold sm:inline">
              Back
            </span>
          </button>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-4"
            disabled={isLoading}
            onClick={refreshVehicleDetails}
            type="button"
          >
            <AppIcon className="sm:mr-2" name="refresh" size={18} />
            <span className="hidden text-sm font-bold sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-700">
            Loading vehicle details...
          </p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <h2 className="font-semibold">Unable to load vehicle details</h2>
          <p className="mt-2 text-sm">{errorMessage}</p>
        </section>
      )}

      {!isLoading && !errorMessage && vehicle && (
        <>
          <VehicleHeader
            canChangeStatus={canChangeVehicleStatus}
            canAddWorkOrder={canManageRepairJobs}
            canEdit={canEditVehicle}
            canManagePhotos={canManagePhotos}
            canMarkReady={canChangeVehicleStatus}
            isStatusUpdating={isVehicleStatusUpdating}
            onEdit={() => setIsEditFormOpen(true)}
            onMarkReady={() => handleVehicleStatusChange("ready_for_sale")}
            onQuickAddWorkOrder={() => scrollToSection(serviceWorkRef)}
            onQuickPhotos={handleHeroPhotoClick}
            onStatusChange={handleVehicleStatusChange}
            primaryPhoto={primaryVehiclePhoto}
            vehicle={vehicle}
          />

          {vehicleStatusError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {vehicleStatusError}
            </div>
          )}

          <InvestmentSummary
            currentProfile={currentProfile}
            investmentSummary={investmentSummary}
            vehicle={vehicle}
          />

          <div ref={serviceWorkRef} className="scroll-mt-20 sm:scroll-mt-6">
            <ServiceWorkSection
              canManage={canManageRepairJobs}
              canManageLabor={canManageLabor}
              canManageParts={canManageWorkOrderParts}
              canManagePhotos={canManagePhotos}
              canManageDocuments={canManageDocuments}
              canManageThirdPartyRepairs={canManageRepairJobs}
              canUploadDocuments={canUploadDocuments}
              currentProfile={currentProfile}
              documents={vehicleDocuments}
              laborLogs={laborLogs}
              onActivityLogged={refreshActivityTimeline}
              onDocumentAdded={handleDocumentAdded}
              onDocumentDeleted={handleDocumentDeleted}
              onLaborAdded={handleWorkOrderLaborAdded}
              onLaborDeleted={handleWorkOrderLaborDeleted}
              onPartAdded={handleWorkOrderPartAdded}
              onPartApprovalUpdated={handleWorkOrderPartApprovalUpdated}
              onPartPurchaseOrderCreated={handleWorkOrderPartPurchaseOrderCreated}
              onPurchaseOrderItemUpdated={handlePurchaseOrderItemUpdated}
              onPhotoAdded={handleWorkOrderPhotoAdded}
              onPhotoDeleted={handleWorkOrderPhotoDeleted}
              onThirdPartyRepairAdded={handleThirdPartyRepairAdded}
              onThirdPartyRepairDeleted={handleThirdPartyRepairDeleted}
              onWorkOrderAdded={handleWorkOrderAdded}
              partRequests={partRequests}
              profiles={profiles}
              purchaseOrderItems={purchaseOrderItems}
              purchaseOrders={purchaseOrders}
              repairJobs={repairJobs}
              serviceCategories={serviceCategories}
              thirdPartyRepairs={thirdPartyRepairs}
              vehicle={vehicle}
              vehicleId={vehicleId}
              vehiclePhotos={vehiclePhotos}
              vendors={vendors}
            />
          </div>

          <div ref={vehiclePhotosRef} className="scroll-mt-20 sm:scroll-mt-6">
            <VehiclePhotosSection
              canManage={canManagePhotos}
              onActivityLogged={refreshActivityTimeline}
              onSetMainPhoto={handleGalleryMainPhotoSelected}
              onVehiclePhotoAdded={handleVehiclePhotoAdded}
              onVehiclePhotoDeleted={handleVehiclePhotoDeleted}
              primaryPhotoId={vehicle.primary_photo_id}
              vehicleId={vehicleId}
              vehiclePhotos={vehiclePhotos.filter((photo) => !photo.repair_job_id)}
            />
          </div>

          <ExtraCostsSection
            canManage={canManageExtraCosts}
            costEntries={costEntries}
            onActivityLogged={refreshActivityTimeline}
            onExtraCostAdded={handleExtraCostAdded}
            onExtraCostDeleted={handleExtraCostDeleted}
            vehicleId={vehicleId}
          />

          <FinalCheckSection
            currentProfile={currentProfile}
            finalChecks={finalChecks}
            onActivityLogged={refreshActivityTimeline}
            onFinalCheckUpdated={handleFinalCheckUpdated}
            profiles={profiles}
            vehicleId={vehicleId}
          />

          {canDeleteVehicle && (
            <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-950">
                    Admin Actions
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Permanently remove this vehicle and its related records.
                  </p>
                </div>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
                  onClick={() => setIsDeleteModalOpen(true)}
                  type="button"
                >
                  <AppIcon name="warning" size={17} />
                  Delete Vehicle
                </button>
              </div>
            </section>
          )}

          {isVehicleSold && (
            <SaleWarrantySection
              sales={sales}
              warranties={warranties}
            />
          )}

          {isEditFormOpen && canEditVehicle && (
            <EditVehicleForm
              onClose={() => setIsEditFormOpen(false)}
              onVehicleUpdated={handleVehicleUpdated}
              vehicle={vehicle}
            />
          )}

          {isSellFormOpen && canSellVehicle && (
            <SellVehicleForm
              onClose={() => setIsSellFormOpen(false)}
              onActivityLogged={refreshActivityTimeline}
              onVehicleSold={handleVehicleSold}
              vehicle={vehicle}
            />
          )}

          {isVehiclePhotoFormOpen && canManagePhotos && (
            <AddVehiclePhotoForm
              activityAction="Main photo updated"
              description="Upload the main image shown on this vehicle and vehicle cards."
              failureMessage="Could not update main vehicle photo. Please try again."
              onActivityLogged={refreshActivityTimeline}
              onClose={() => setIsVehiclePhotoFormOpen(false)}
              onPhotoAdded={handleMainVehiclePhotoAdded}
              onSaved={() => setIsVehiclePhotoFormOpen(false)}
              submitLabel="Save Main Photo"
              successMessageText="Main photo updated."
              title="Change Main Photo"
              vehicleId={vehicleId}
            />
          )}

          {isDeleteModalOpen && canDeleteVehicle && (
            <DeleteVehicleModal
              onClose={() => setIsDeleteModalOpen(false)}
              onDeleted={onBack}
              vehicle={vehicle}
              vehicleDocuments={vehicleDocuments}
              vehiclePhotos={vehiclePhotos}
            />
          )}
        </>
      )}
    </div>
  );
}

export default VehicleDetailPage;
