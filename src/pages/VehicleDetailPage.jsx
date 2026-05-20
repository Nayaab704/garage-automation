import { useEffect, useState } from "react";
import EditVehicleForm from "../components/EditVehicleForm";
import ExtraCostsSection from "../components/vehicle-detail/ExtraCostsSection";
import InvestmentSummary from "../components/vehicle-detail/InvestmentSummary";
import LaborLogsSection from "../components/vehicle-detail/LaborLogsSection";
import PartRequestsSection from "../components/vehicle-detail/PartRequestsSection";
import PurchaseOrdersSection from "../components/vehicle-detail/PurchaseOrdersSection";
import RepairProcessesSection from "../components/vehicle-detail/RepairProcessesSection";
import RepairJobsSection from "../components/vehicle-detail/RepairJobsSection";
import SaleWarrantySection from "../components/vehicle-detail/SaleWarrantySection";
import SellVehicleForm from "../components/vehicle-detail/SellVehicleForm";
import VehicleHeader from "../components/vehicle-detail/VehicleHeader";
import VehiclePhotosSection from "../components/vehicle-detail/VehiclePhotosSection";
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

async function fetchVehicleDetails(vehicleId) {
  const [
    vehicleResponse,
    repairJobsResponse,
    partRequestsResponse,
    laborLogsResponse,
    profilesResponse,
    costEntriesResponse,
    vehiclePhotosResponse,
    repairProcessesResponse,
    repairProcessItemsResponse,
    purchaseOrdersResponse,
    vendorsResponse,
    salesResponse,
  ] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", vehicleId).single(),
    supabase.from("repair_jobs").select("*").eq("vehicle_id", vehicleId),
    supabase.from("part_requests").select("*").eq("vehicle_id", vehicleId),
    supabase.from("labor_logs").select("*").eq("vehicle_id", vehicleId),
    supabase.from("profiles").select("*"),
    supabase.from("cost_entries").select("*").eq("vehicle_id", vehicleId),
    supabase
      .from("vehicle_photos")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("repair_processes")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("repair_process_items")
      .select(
        "id, repair_process_id, vehicle_id, category_name, status, cost, notes, created_at"
      )
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: true }),
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

  return {
    investmentSummaryResponse,
    costEntriesResponse,
    laborLogsResponse,
    partRequestsResponse,
    profilesResponse,
    vehiclePhotosResponse,
    repairProcessesResponse,
    repairProcessItemsResponse,
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
    responses.profilesResponse.error ??
    responses.costEntriesResponse.error ??
    responses.vehiclePhotosResponse.error ??
    responses.repairProcessesResponse.error ??
    responses.repairProcessItemsResponse.error ??
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
    setters.setProfiles([]);
    setters.setCostEntries([]);
    setters.setVehiclePhotos([]);
    setters.setRepairProcesses([]);
    setters.setRepairProcessItems([]);
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
  setters.setProfiles(responses.profilesResponse.data ?? []);
  setters.setCostEntries(responses.costEntriesResponse.data ?? []);
  setters.setVehiclePhotos(responses.vehiclePhotosResponse.data ?? []);
  setters.setRepairProcesses(responses.repairProcessesResponse.data ?? []);
  setters.setRepairProcessItems(responses.repairProcessItemsResponse.data ?? []);
  setters.setPurchaseOrders(responses.purchaseOrdersResponse.data ?? []);
  setters.setPurchaseOrderItems(responses.purchaseOrderItemsResponse.data ?? []);
  setters.setVendors(responses.vendorsResponse.data ?? []);
  setters.setSales(responses.salesResponse.data ?? []);
  setters.setWarranties(responses.warrantiesResponse.data ?? []);
  setters.setInvestmentSummary(responses.investmentSummaryResponse.data);
}

function VehicleDetailPage({ vehicleId, onBack }) {
  const [vehicle, setVehicle] = useState(null);
  const [repairJobs, setRepairJobs] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [laborLogs, setLaborLogs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [costEntries, setCostEntries] = useState([]);
  const [vehiclePhotos, setVehiclePhotos] = useState([]);
  const [repairProcesses, setRepairProcesses] = useState([]);
  const [repairProcessItems, setRepairProcessItems] = useState([]);
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
          setInvestmentSummary,
          setLaborLogs,
          setPartRequests,
          setProfiles,
          setVehiclePhotos,
          setRepairProcesses,
          setRepairProcessItems,
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
          setProfiles([]);
          setCostEntries([]);
          setVehiclePhotos([]);
          setRepairProcesses([]);
          setRepairProcessItems([]);
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

  async function handleRepairProcessItemAdded(newItem) {
    if (newItem) {
      setRepairProcessItems((currentItems) => [...currentItems, newItem]);
    }

    await refreshInvestmentSummary();
  }

  async function handleRepairProcessItemUpdated(updatedItem) {
    if (updatedItem) {
      setRepairProcessItems((currentItems) =>
        currentItems.map((item) =>
          item.id === updatedItem.id ? updatedItem : item
        )
      );
    }

    await refreshInvestmentSummary();
  }

  async function handleRepairProcessItemDeleted(deletedItemId) {
    if (deletedItemId) {
      setRepairProcessItems((currentItems) =>
        currentItems.filter((item) => item.id !== deletedItemId)
      );
    }

    await refreshInvestmentSummary();
  }

  function handleRepairJobStatusUpdated(repairJobId, newStatus) {
    setRepairJobs((currentRepairJobs) =>
      currentRepairJobs.map((repairJob) =>
        repairJob.id === repairJobId
          ? { ...repairJob, status: newStatus }
          : repairJob
      )
    );
  }

  function handlePartRequestStatusUpdated(partRequestId, newStatus) {
    setPartRequests((currentPartRequests) =>
      currentPartRequests.map((partRequest) =>
        partRequest.id === partRequestId
          ? { ...partRequest, status: newStatus }
          : partRequest
      )
    );
  }

  async function handleVehicleStatusChange(newStatus) {
    if (!vehicle?.id) {
      setVehicleStatusError("Unable to update a vehicle without an ID.");
      return;
    }

    if (newStatus === vehicle.status) {
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
            investmentSummary={investmentSummary}
            vehicle={vehicle}
          />

          <VehiclePhotosSection
            onVehiclePhotoChanged={refreshVehicleDetails}
            vehicleId={vehicleId}
            vehiclePhotos={vehiclePhotos}
          />

          <RepairProcessesSection
            onRepairProcessAdded={refreshVehicleDetails}
            onRepairProcessItemAdded={handleRepairProcessItemAdded}
            onRepairProcessItemDeleted={handleRepairProcessItemDeleted}
            onRepairProcessItemUpdated={handleRepairProcessItemUpdated}
            repairProcessItems={repairProcessItems}
            repairProcesses={repairProcesses}
            vehicleId={vehicleId}
            vendors={vendors}
          />

          <RepairJobsSection
            onRepairJobAdded={refreshVehicleDetails}
            onRepairJobStatusUpdated={handleRepairJobStatusUpdated}
            repairProcesses={repairProcesses}
            repairJobs={repairJobs}
            vehicleId={vehicleId}
          />

          <LaborLogsSection
            laborLogs={laborLogs}
            onLaborLogAdded={refreshVehicleDetails}
            profiles={profiles}
            repairJobs={repairJobs}
            vehicleId={vehicleId}
          />

          <ExtraCostsSection
            costEntries={costEntries}
            onExtraCostChanged={refreshVehicleDetails}
            vehicleId={vehicleId}
          />

          <PartRequestsSection
            onPartRequestAdded={refreshVehicleDetails}
            onPartRequestStatusUpdated={handlePartRequestStatusUpdated}
            partRequests={partRequests}
            repairProcesses={repairProcesses}
            repairJobs={repairJobs}
            vehicleId={vehicleId}
          />

          <PurchaseOrdersSection
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

          {isEditFormOpen && (
            <EditVehicleForm
              onClose={() => setIsEditFormOpen(false)}
              onVehicleUpdated={refreshVehicleDetails}
              vehicle={vehicle}
            />
          )}

          {isSellFormOpen && (
            <SellVehicleForm
              onClose={() => setIsSellFormOpen(false)}
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
