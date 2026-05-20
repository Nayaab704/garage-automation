import { useState } from "react";
import AddPartRequestForm from "./AddPartRequestForm";
import StatusDropdown from "./StatusDropdown";
import { logVehicleActivity } from "../../lib/activityLogger";
import { formatRepairProcessType } from "../../lib/repairProcess";
import { supabase } from "../../lib/supabaseClient";

const numberFormatter = new Intl.NumberFormat("en-US");

const partRequestStatuses = ["requested", "ordered", "received", "installed"];

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "Not available";
  }

  return numberFormatter.format(numberValue);
}

function getFirstValue(record, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function getRepairProcessById(repairProcesses, repairProcessId) {
  return repairProcesses.find(
    (repairProcess) => repairProcess.id === repairProcessId
  );
}

function getRepairProcessLabel(repairProcesses, repairProcessId) {
  const repairProcess = getRepairProcessById(repairProcesses, repairProcessId);

  if (!repairProcess) {
    return "Not available";
  }

  return formatRepairProcessType(repairProcess.process_type);
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function PartRequestCard({
  onStatusChange,
  partRequest,
  repairProcesses,
  updatingStatusId,
}) {
  const partName =
    getFirstValue(partRequest, ["part_name", "name", "part"]) ??
    "Part Request";
  const quantity = getFirstValue(partRequest, ["quantity", "qty"]);
  const status = getFirstValue(partRequest, ["status"]);
  const notes = getFirstValue(partRequest, ["notes", "description"]);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-950">{partName}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Quantity: {formatNumber(quantity)}
          </p>
        </div>

        <StatusDropdown
          currentStatus={status}
          isUpdating={updatingStatusId === partRequest.id}
          onChange={(newStatus) => onStatusChange(partRequest.id, newStatus)}
          statuses={partRequestStatuses}
        />
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <DetailItem
          label="Repair Process"
          value={getRepairProcessLabel(
            repairProcesses,
            partRequest.repair_process_id
          )}
        />
      </dl>

      {notes && (
        <div className="mt-5 rounded-md bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {notes}
          </p>
        </div>
      )}
    </article>
  );
}

function PartRequestsSection({
  onActivityLogged,
  onPartRequestAdded,
  onPartRequestStatusUpdated,
  partRequests = [],
  repairProcesses = [],
  repairJobs = [],
  vehicleId,
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  async function handleStatusChange(partRequestId, newStatus) {
    if (!partRequestId) {
      setStatusError("Unable to update a part request without an ID.");
      return;
    }

    const currentPartRequest = partRequests.find(
      (partRequest) => partRequest.id === partRequestId
    );
    const previousStatus = currentPartRequest
      ? getFirstValue(currentPartRequest, ["status"])
      : null;

    setStatusError("");
    setUpdatingStatusId(partRequestId);
    onPartRequestStatusUpdated(partRequestId, newStatus);

    try {
      const { error } = await supabase
        .from("part_requests")
        .update({ status: newStatus })
        .eq("id", partRequestId);

      if (error) {
        onPartRequestStatusUpdated(partRequestId, previousStatus);
        setStatusError(error.message);
        return;
      }

      await logVehicleActivity({
        vehicleId,
        action: "Part request status changed",
        details: {
          part_name:
            getFirstValue(currentPartRequest ?? {}, [
              "part_name",
              "name",
              "part",
            ]) ?? "Part Request",
          from: previousStatus,
          to: newStatus,
        },
      });
      onActivityLogged?.();
    } catch (error) {
      onPartRequestStatusUpdated(partRequestId, previousStatus);
      setStatusError(error.message ?? "Something went wrong.");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">Part Requests</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {partRequests.length}{" "}
            {partRequests.length === 1 ? "record" : "records"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            {partRequests.length}
          </span>
          <button
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            onClick={() => setIsFormOpen(true)}
            type="button"
          >
            Add Part Request
          </button>
        </div>
      </div>

      {partRequests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No part requests found for this vehicle.
        </div>
      ) : (
        <div className="space-y-3">
          {partRequests.map((partRequest, index) => (
            <PartRequestCard
              key={partRequest.id ?? index}
              onStatusChange={handleStatusChange}
              partRequest={partRequest}
              repairProcesses={repairProcesses}
              updatingStatusId={updatingStatusId}
            />
          ))}
        </div>
      )}

      {statusError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {statusError}
        </div>
      )}

      {isFormOpen && (
        <AddPartRequestForm
          onClose={() => setIsFormOpen(false)}
          onActivityLogged={onActivityLogged}
          onPartRequestAdded={onPartRequestAdded}
          repairProcesses={repairProcesses}
          repairJobs={repairJobs}
          vehicleId={vehicleId}
        />
      )}
    </section>
  );
}

export default PartRequestsSection;
