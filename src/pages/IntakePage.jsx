import { useState } from "react";
import AddVehicleForm from "../components/AddVehicleForm";
import { hasPermission } from "../lib/permissions";
import { supabase } from "../lib/supabaseClient";

function normalizeVin(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .toUpperCase()
    .slice(0, 17);
}

function IntakePage({ currentProfile, onViewVehicles }) {
  const [vin, setVin] = useState("");
  const [isCheckingVin, setIsCheckingVin] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [createdVehicle, setCreatedVehicle] = useState(null);
  const canCreateVehicle = hasPermission(
    currentProfile?.role,
    "vehicle:create"
  );

  function handleVinChange(event) {
    setVin(normalizeVin(event.target.value));
    setErrorMessage("");
    setShowVehicleForm(false);
    setCreatedVehicle(null);
  }

  async function handleContinue(event) {
    event.preventDefault();

    const normalizedVin = normalizeVin(vin);

    if (!canCreateVehicle) {
      setErrorMessage("Your role does not have permission to create vehicles.");
      setShowVehicleForm(false);
      return;
    }

    if (!normalizedVin) {
      setErrorMessage("Enter a VIN to start intake.");
      setShowVehicleForm(false);
      return;
    }

    setIsCheckingVin(true);
    setErrorMessage("");
    setShowVehicleForm(false);
    setCreatedVehicle(null);

    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, stock_number, vin")
        .ilike("vin", normalizedVin)
        .maybeSingle();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setErrorMessage("This VIN already exists in inventory.");
        return;
      }

      setVin(normalizedVin);
      setShowVehicleForm(true);
    } catch (error) {
      setErrorMessage(error.message ?? "Unable to check this VIN.");
    } finally {
      setIsCheckingVin(false);
    }
  }

  function handleVehicleAdded(vehicle) {
    setCreatedVehicle(vehicle ?? { vin });
    setShowVehicleForm(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Intake Workflow
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-950">
              Start Vehicle Intake
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Camera VIN scanning will be added later. For now, enter VIN
              manually.
            </p>
          </div>

          <form
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            onSubmit={handleContinue}
          >
            <label className="block" htmlFor="intake-vin">
              <span className="text-sm font-medium text-slate-700">VIN</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-slate-900 shadow-sm outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                id="intake-vin"
                maxLength={17}
                onChange={handleVinChange}
                placeholder="Enter 17-character VIN"
                type="text"
                value={vin}
              />
            </label>

            {errorMessage && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            {!canCreateVehicle && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Your role can view intake, but cannot create vehicles.
              </div>
            )}

            <button
              className="mt-4 w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isCheckingVin || !canCreateVehicle}
              type="submit"
            >
              {isCheckingVin ? "Checking VIN..." : "Continue to Vehicle Form"}
            </button>
          </form>
        </div>
      </section>

      {showVehicleForm && canCreateVehicle && (
        <AddVehicleForm
          initialValues={{ vin }}
          key={vin}
          onVehicleAdded={handleVehicleAdded}
        />
      )}

      {createdVehicle && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-emerald-950">
            Vehicle intake created
          </h2>
          <p className="mt-2 text-sm text-emerald-800">
            VIN {createdVehicle.vin ?? vin} was added to inventory.
          </p>
          <button
            className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            onClick={onViewVehicles}
            type="button"
          >
            View Vehicles
          </button>
        </section>
      )}
    </div>
  );
}

export default IntakePage;
