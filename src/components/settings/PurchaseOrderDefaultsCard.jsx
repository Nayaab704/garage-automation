import { useEffect, useState } from "react";
import {
  DEFAULT_PO_SHIPPING_COST_FALLBACK,
  fetchDefaultPoShippingCost,
  PO_SHIPPING_QUICK_OPTIONS,
  updateDefaultPoShippingCost,
} from "../../lib/appSettings";
import { isAdminOrManagerRole } from "../../lib/permissions";

function getShippingQuickSelection(value) {
  const numberValue = Number(value);
  return PO_SHIPPING_QUICK_OPTIONS.includes(numberValue)
    ? numberValue
    : "custom";
}

function PurchaseOrderDefaultsCard({ currentProfile }) {
  const [shippingCost, setShippingCost] = useState(
    String(DEFAULT_PO_SHIPPING_COST_FALLBACK)
  );
  const [selectedOption, setSelectedOption] = useState(
    DEFAULT_PO_SHIPPING_COST_FALLBACK
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const canManageDefaults = isAdminOrManagerRole(currentProfile?.role);

  useEffect(() => {
    let isMounted = true;

    async function loadDefaultShippingCost() {
      if (!canManageDefaults) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await fetchDefaultPoShippingCost();

      if (!isMounted) {
        return;
      }

      setShippingCost(String(data));
      setSelectedOption(getShippingQuickSelection(data));
      setErrorMessage(
        error ? "Could not load the saved default. Showing $0." : ""
      );
      setIsLoading(false);
    }

    loadDefaultShippingCost();

    return () => {
      isMounted = false;
    };
  }, [canManageDefaults]);

  if (!canManageDefaults) {
    return null;
  }

  function handleQuickSelect(value) {
    setShippingCost(String(value));
    setSelectedOption(value);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleShippingCostChange(event) {
    const { value } = event.target;
    setShippingCost(value);
    setSelectedOption(getShippingQuickSelection(value));
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedValue = shippingCost.trim();
    const numberValue = Number(trimmedValue);

    if (
      trimmedValue === "" ||
      !Number.isFinite(numberValue) ||
      numberValue < 0
    ) {
      setErrorMessage("Default shipping must be 0 or greater.");
      setSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await updateDefaultPoShippingCost({
        currentProfileId: currentProfile?.id,
        value: numberValue,
      });

      if (error) {
        setErrorMessage(
          error.message || "Could not save the PO shipping default."
        );
        return;
      }

      const savedValue = Number(data?.value ?? numberValue);
      setShippingCost(String(savedValue));
      setSelectedOption(getShippingQuickSelection(savedValue));
      setSuccessMessage("Default PO shipping updated.");
    } catch (error) {
      setErrorMessage(
        error.message ?? "Could not save the PO shipping default."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-black text-slate-950">
        Purchase Order Defaults
      </h2>

      <form
        className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,20rem)_1fr_auto] lg:items-end"
        onSubmit={handleSubmit}
      >
        <label className="block" htmlFor="default-po-shipping-cost">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Default Shipping Cost
          </span>
          <input
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold tabular-nums text-slate-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading || isSaving}
            id="default-po-shipping-cost"
            min="0"
            onChange={handleShippingCostChange}
            step="0.01"
            type="number"
            value={shippingCost}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {PO_SHIPPING_QUICK_OPTIONS.map((option) => (
            <button
              aria-pressed={selectedOption === option}
              className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                selectedOption === option
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              disabled={isLoading || isSaving}
              key={option}
              onClick={() => handleQuickSelect(option)}
              type="button"
            >
              ${option}
            </button>
          ))}
          <button
            aria-pressed={selectedOption === "custom"}
            className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
              selectedOption === "custom"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            disabled={isLoading || isSaving}
            onClick={() => setSelectedOption("custom")}
            type="button"
          >
            Custom
          </button>
        </div>

        <button
          className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
          disabled={isLoading || isSaving}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save Default"}
        </button>
      </form>

      {errorMessage && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}
    </section>
  );
}

export default PurchaseOrderDefaultsCard;
