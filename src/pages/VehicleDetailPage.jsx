import { useEffect, useState } from "react";
import EditVehicleForm from "../components/EditVehicleForm";
import ActivityTimelineSection from "../components/vehicle-detail/ActivityTimelineSection";
import ExtraCostsSection from "../components/vehicle-detail/ExtraCostsSection";
import FinalCheckSection from "../components/vehicle-detail/FinalCheckSection";
import {
  areFinalChecksComplete,
  finalCheckTemplates,
} from "../lib/finalChecks";
import InvestmentSummary from "../components/vehicle-detail/InvestmentSummary";
import PurchaseOrdersSection from "../components/vehicle-detail/PurchaseOrdersSection";
import SaleWarrantySection from "../components/vehicle-detail/SaleWarrantySection";
import SellVehicleForm from "../components/vehicle-detail/SellVehicleForm";
import ServiceWorkSection from "../components/vehicle-detail/ServiceWorkSection";
import VehicleHeader from "../components/vehicle-detail/VehicleHeader";
import VehiclePhotosSection from "../components/vehicle-detail/VehiclePhotosSection";
import { logVehicleActivity } from "../lib/activityLogger";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";

async function fetchInvestmentSummary(vehicleId, stockNumber) {
  const byVehicleId = await supabase
    .from("vehicle_investment_summary")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();

  if (byVehicleId.data || !stockNumber) {
    return byVehicleId;
  }

  return supabase
    .from("vehicle_investment_summary")
    .select("*")
    .eq("stock_number", stockNumber)
    .maybeSingle();
}

const finalCheckColumns =
  "id, vehicle_id, check_key, label, required_role, is_checked, checked_by, checked_at, notes, created_at";

const vehicleDocumentColumns =
  "id, vehicle_id, repair_job_id, third_party_repair_id, purchase_order_id, document_type, file_url, file_path, file_name, file_mime_type, file_size_bytes, notes, uploaded_by, created_at";

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

function VehicleDetailPage({ currentProfile, vehicleId, onBack }) {
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
  const [activityRefreshCount, setActivityRefreshCount] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);

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
  }, [vehicleId, refreshCount]);

  function refreshVehicleDetails() {
    setRefreshCount((currentCount) => currentCount + 1);
  }

  function refreshActivityTimeline() {
    setActivityRefreshCount((currentCount) => currentCount + 1);
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

  function handleFinalCheckUpdated(updatedFinalCheck) {
    if (!updatedFinalCheck?.id) {
      return;
    }

    setFinalChecks((currentFinalChecks) =>
      currentFinalChecks.map((finalCheck) =>
        finalCheck.id === updatedFinalCheck.id ? updatedFinalCheck : finalCheck
      )
    );
  }

  async function handleWorkOrderLaborAdded(laborLog) {
    if (laborLog?.id) {
      setLaborLogs((currentLaborLogs) => [
        laborLog,
        ...currentLaborLogs.filter(
          (currentLaborLog) => currentLaborLog.id !== laborLog.id
        ),
      ]);
    }

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
    if (partRequest?.id) {
      setPartRequests((currentPartRequests) => [
        partRequest,
        ...currentPartRequests.filter(
          (currentPartRequest) => currentPartRequest.id !== partRequest.id
        ),
      ]);
    }

    if (partRequest?.part_source === "in_house") {
      await refreshInvestmentSummary();
    }
  }

  function handleWorkOrderPartApprovalUpdated(updatedPartRequest) {
    if (!updatedPartRequest?.id) {
      return;
    }

    setPartRequests((currentPartRequests) =>
      currentPartRequests.map((partRequest) =>
        partRequest.id === updatedPartRequest.id
          ? updatedPartRequest
          : partRequest
      )
    );
  }

  async function handleWorkOrderPartPurchaseOrderCreated(updatedPartRequest) {
    if (updatedPartRequest?.id) {
      setPartRequests((currentPartRequests) =>
        currentPartRequests.map((partRequest) =>
          partRequest.id === updatedPartRequest.id
            ? updatedPartRequest
            : partRequest
        )
      );
    }

    await refreshInvestmentSummary();
  }

  function handleWorkOrderPhotoAdded(photo) {
    if (!photo?.id) {
      return;
    }

    setVehiclePhotos((currentPhotos) => [
      photo,
      ...currentPhotos.filter((currentPhoto) => currentPhoto.id !== photo.id),
    ]);
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
    if (!documentRecord?.id) {
      return;
    }

    setVehicleDocuments((currentDocuments) => [
      documentRecord,
      ...currentDocuments.filter(
        (currentDocument) => currentDocument.id !== documentRecord.id
      ),
    ]);
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
    if (thirdPartyRepair?.id) {
      setThirdPartyRepairs((currentRepairs) => [
        thirdPartyRepair,
        ...currentRepairs.filter((repair) => repair.id !== thirdPartyRepair.id),
      ]);
    }

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

  async function handleVehicleStatusChange(newStatus) {
    if (!canChangeVehicleStatus) {
      setVehicleStatusError("Your role cannot change vehicle status.");
      return;
    }

    if (!vehicle?.id) {
      setVehicleStatusError("Unable to update a vehicle without an ID.");
      return;
    }

    if (newStatus === vehicle.status) {
      return;
    }

    if (newStatus === "ready_for_sale" && !areFinalChecksComplete(finalChecks)) {
      setVehicleStatusError(
        "Complete all final checks before marking this vehicle Ready For Sale."
      );
      return;
    }

    const previousStatus = vehicle.status;

    setVehicleStatusError("");
    setIsVehicleStatusUpdating(true);
    setVehicle((currentVehicle) =>
      currentVehicle ? { ...currentVehicle, status: newStatus } : currentVehicle
    );

    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ status: newStatus })
        .eq("id", vehicle.id);

      if (error) {
        setVehicle((currentVehicle) =>
          currentVehicle
            ? { ...currentVehicle, status: previousStatus }
            : currentVehicle
        );
        setVehicleStatusError(error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId,
        action: "Vehicle status changed",
        details: {
          from: previousStatus,
          to: newStatus,
        },
      });
      refreshActivityTimeline();
      refreshVehicleDetails();
    } catch (error) {
      setVehicle((currentVehicle) =>
        currentVehicle
          ? { ...currentVehicle, status: previousStatus }
          : currentVehicle
      );
      setVehicleStatusError(error.message ?? "Something went wrong.");
    } finally {
      setIsVehicleStatusUpdating(false);
    }
  }

  const isVehicleSold =
    String(vehicle?.status ?? "").toLowerCase() === "sold" || sales.length > 0;
  const role = currentProfile?.role;
  const canChangeVehicleStatus = hasPermission(role, "vehicle:change_status");
  const canEditVehicle = hasPermission(role, "vehicle:edit");
  const canManageExtraCosts = hasPermission(role, "extra_cost:manage");
  const canManageLabor = hasPermission(role, "labor:manage");
  const canManagePartRequests = hasPermission(role, "part_request:manage");
  const canManagePhotos = hasPermission(role, "photo:manage");
  const canManagePurchaseOrders = hasPermission(role, "purchase_order:manage");
  const canManageRepairJobs = hasPermission(role, "repair:manage");
  const canManageWorkOrderParts = canManageRepairJobs || canManagePartRequests;
  const canUploadDocuments =
    (role === "admin" || role === "owner" || role === "technician") &&
    (canManagePhotos || canManageRepairJobs);
  const canManageDocuments = canManagePhotos;
  const canSellVehicle = hasPermission(role, "sale:manage");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="w-fit rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
          onClick={onBack}
          type="button"
        >
          Back to Vehicles
        </button>

        <button
          className="w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isLoading}
          onClick={refreshVehicleDetails}
          type="button"
        >
          Refresh
        </button>
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
            canEdit={canEditVehicle}
            canSell={canSellVehicle}
            isSold={isVehicleSold}
            isStatusUpdating={isVehicleStatusUpdating}
            onEdit={() => setIsEditFormOpen(true)}
            onSell={() => setIsSellFormOpen(true)}
            onStatusChange={handleVehicleStatusChange}
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
            onPhotoAdded={handleWorkOrderPhotoAdded}
            onPhotoDeleted={handleWorkOrderPhotoDeleted}
            onThirdPartyRepairAdded={handleThirdPartyRepairAdded}
            onThirdPartyRepairDeleted={handleThirdPartyRepairDeleted}
            onWorkOrderAdded={refreshVehicleDetails}
            partRequests={partRequests}
            profiles={profiles}
            repairJobs={repairJobs}
            serviceCategories={serviceCategories}
            thirdPartyRepairs={thirdPartyRepairs}
            vehicleId={vehicleId}
            vehiclePhotos={vehiclePhotos}
            vendors={vendors}
          />

          <VehiclePhotosSection
            canManage={canManagePhotos}
            onActivityLogged={refreshActivityTimeline}
            onVehiclePhotoChanged={refreshVehicleDetails}
            vehicleId={vehicleId}
            vehiclePhotos={vehiclePhotos.filter((photo) => !photo.repair_job_id)}
          />

          <FinalCheckSection
            currentProfile={currentProfile}
            finalChecks={finalChecks}
            onActivityLogged={refreshActivityTimeline}
            onFinalCheckUpdated={handleFinalCheckUpdated}
            profiles={profiles}
            vehicleId={vehicleId}
          />

          {/* Legacy repair process workflow hidden after migration to service-category work orders. */}
          <ExtraCostsSection
            canManage={canManageExtraCosts}
            costEntries={costEntries}
            onActivityLogged={refreshActivityTimeline}
            onExtraCostChanged={refreshVehicleDetails}
            vehicleId={vehicleId}
          />

          <PurchaseOrdersSection
            canManage={canManagePurchaseOrders}
            currentProfile={currentProfile}
            onActivityLogged={refreshActivityTimeline}
            onPurchaseOrderCreated={refreshVehicleDetails}
            partRequests={partRequests}
            purchaseOrderItems={purchaseOrderItems}
            purchaseOrders={purchaseOrders}
            vehicleId={vehicleId}
            vendors={vendors}
          />

          {isVehicleSold && (
            <SaleWarrantySection
              sales={sales}
              warranties={warranties}
            />
          )}

          <ActivityTimelineSection
            refreshKey={activityRefreshCount}
            vehicleId={vehicleId}
          />

          {isEditFormOpen && canEditVehicle && (
            <EditVehicleForm
              onClose={() => setIsEditFormOpen(false)}
              onVehicleUpdated={refreshVehicleDetails}
              vehicle={vehicle}
            />
          )}

          {isSellFormOpen && canSellVehicle && (
            <SellVehicleForm
              onClose={() => setIsSellFormOpen(false)}
              onActivityLogged={refreshActivityTimeline}
              onVehicleSold={refreshVehicleDetails}
              vehicle={vehicle}
            />
          )}
        </>
      )}
    </div>
  );
}

export default VehicleDetailPage;
