import { useEffect, useState } from "react";
import InvestmentSummary from "../components/vehicle-detail/InvestmentSummary";
import PartRequestsSection from "../components/vehicle-detail/PartRequestsSection";
import RepairJobsSection from "../components/vehicle-detail/RepairJobsSection";
import VehicleHeader from "../components/vehicle-detail/VehicleHeader";
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
  const [vehicleResponse, repairJobsResponse, partRequestsResponse] =
    await Promise.all([
      supabase.from("vehicles").select("*").eq("id", vehicleId).single(),
      supabase.from("repair_jobs").select("*").eq("vehicle_id", vehicleId),
      supabase.from("part_requests").select("*").eq("vehicle_id", vehicleId),
    ]);

  const investmentSummaryResponse = vehicleResponse.error
    ? { data: null, error: null }
    : await fetchInvestmentSummary(vehicleId, vehicleResponse.data?.stock_number);

  return {
    investmentSummaryResponse,
    partRequestsResponse,
    repairJobsResponse,
    vehicleResponse,
  };
}

function findFirstError(responses) {
  return (
    responses.vehicleResponse.error ??
    responses.repairJobsResponse.error ??
    responses.partRequestsResponse.error ??
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
    setters.setInvestmentSummary(null);
    return;
  }

  setters.setVehicle(responses.vehicleResponse.data);
  setters.setRepairJobs(responses.repairJobsResponse.data ?? []);
  setters.setPartRequests(responses.partRequestsResponse.data ?? []);
  setters.setInvestmentSummary(responses.investmentSummaryResponse.data);
}

function VehicleDetailPage({ vehicleId, onBack }) {
  const [vehicle, setVehicle] = useState(null);
  const [repairJobs, setRepairJobs] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [investmentSummary, setInvestmentSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
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

      try {
        const responses = await fetchVehicleDetails(vehicleId);

        if (!isMounted) {
          return;
        }

        applyVehicleDetails(responses, {
          setErrorMessage,
          setInvestmentSummary,
          setPartRequests,
          setRepairJobs,
          setVehicle,
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Something went wrong.");
          setVehicle(null);
          setRepairJobs([]);
          setPartRequests([]);
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
          <VehicleHeader vehicle={vehicle} />

          <InvestmentSummary
            investmentSummary={investmentSummary}
            vehicle={vehicle}
          />

          <RepairJobsSection
            onRepairJobAdded={refreshVehicleDetails}
            onRepairJobStatusUpdated={handleRepairJobStatusUpdated}
            repairJobs={repairJobs}
            vehicleId={vehicleId}
          />

          <PartRequestsSection
            onPartRequestAdded={refreshVehicleDetails}
            onPartRequestStatusUpdated={handlePartRequestStatusUpdated}
            partRequests={partRequests}
            repairJobs={repairJobs}
            vehicleId={vehicleId}
          />
        </>
      )}
    </div>
  );
}

export default VehicleDetailPage;
