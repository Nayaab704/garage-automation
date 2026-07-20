import { useState } from "react";
import AddVehicleForm from "../components/AddVehicleForm";
import IntakeAutomotiveBackground from "../components/intake/IntakeAutomotiveBackground";
import IntakeVinStep from "../components/intake/IntakeVinStep";
import { buttonClassNames, cardClassNames } from "../components/ui/uiStyles";
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

  function handleBackToVin() {
    setErrorMessage("");
    setShowVehicleForm(false);
  }

  const isVinStep = !showVehicleForm && !createdVehicle;

  return (
    <div
      className={`relative ${
        isVinStep
          ? "-mx-4 -my-5 min-h-[calc(100svh-8rem)] overflow-hidden bg-slate-100 px-3 py-4 sm:-mx-6 sm:px-6 sm:py-6 lg:-mx-8 lg:min-h-[calc(100svh-4rem)] lg:px-8"
          : "px-1 py-5 sm:px-3 lg:px-6"
      }`}
    >
      {isVinStep && <IntakeAutomotiveBackground />}

      <div
        className={`relative z-10 mx-auto w-full max-w-4xl ${
          isVinStep
            ? "flex min-h-[calc(100svh-9rem)] flex-col justify-center py-2 sm:min-h-[calc(100svh-9.5rem)] lg:min-h-[calc(100svh-6rem)]"
            : ""
        }`}
      >
        {isVinStep && (
          <IntakeVinStep
            canCreateVehicle={canCreateVehicle}
            errorMessage={errorMessage}
            isCheckingVin={isCheckingVin}
            onSubmit={handleContinue}
            onVinChange={handleVinChange}
            vin={vin}
          />
        )}

        {showVehicleForm && canCreateVehicle && (
          <div className="mx-auto max-w-4xl">
            <AddVehicleForm
              currentProfile={currentProfile}
              initialValues={{ vin }}
              key={vin}
              onBack={handleBackToVin}
              onVehicleAdded={handleVehicleAdded}
            />
          </div>
        )}

        {createdVehicle && (
          <section className={`mx-auto max-w-2xl p-6 ${cardClassNames.elevated}`}>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
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
              {createdVehicle.photoSaveWarning && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                  {createdVehicle.photoSaveWarning}
                </div>
              )}
              {createdVehicle.prebookingSaveWarning && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                  {createdVehicle.prebookingSaveWarning}
                </div>
              )}
              {createdVehicle.prebooking?.id && (
                <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm font-semibold text-violet-900">
                  Prebooking saved for this vehicle.
                </div>
              )}
              <button
                className={`mt-4 ${buttonClassNames.primary}`}
                onClick={onViewVehicles}
                type="button"
              >
                View Vehicles
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default IntakePage;
