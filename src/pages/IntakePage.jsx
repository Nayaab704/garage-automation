import { useState } from "react";
import AddVehicleForm from "../components/AddVehicleForm";
import AppIcon from "../components/ui/AppIcon";
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
    <div className="mx-auto max-w-3xl space-y-4">
      {!showVehicleForm && !createdVehicle && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <AppIcon name="car" size={26} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-950">Enter VIN</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter the vehicle VIN to start a new record.
              </p>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={handleContinue}
          >
            <label className="block" htmlFor="intake-vin">
              <span className="text-sm font-bold text-slate-700">VIN</span>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-mono text-base uppercase tracking-wide text-slate-950 shadow-sm outline-none transition placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                id="intake-vin"
                maxLength={17}
                onChange={handleVinChange}
                placeholder="17-character VIN"
                type="text"
                value={vin}
              />
              <span className="mt-2 block text-xs text-slate-400">
                VIN is editable on the vehicle details step.
              </span>
            </label>

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            {!canCreateVehicle && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Your role can view intake, but cannot create vehicles.
              </div>
            )}

            <button
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isCheckingVin || !canCreateVehicle}
              type="submit"
            >
              {isCheckingVin ? "Checking VIN..." : "Continue"}
            </button>
          </form>
        </section>
      )}

      {showVehicleForm && canCreateVehicle && (
        <AddVehicleForm
          initialValues={{ vin }}
          key={vin}
          onVehicleAdded={handleVehicleAdded}
        />
      )}

      {createdVehicle && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h2 className="text-lg font-black text-emerald-950">
            Vehicle intake created
          </h2>
          <p className="mt-2 text-sm text-emerald-800">
            VIN {createdVehicle.vin ?? vin} was added to inventory.
          </p>
          {createdVehicle.stock_number && (
            <p className="mt-1 text-sm font-semibold text-emerald-900">
              Stock number: {createdVehicle.stock_number}
            </p>
          )}
          <button
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
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
