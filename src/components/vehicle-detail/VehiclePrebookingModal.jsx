import { useEffect, useMemo, useState } from "react";
import FormActions from "../ui/FormActions";
import FormMessage from "../ui/FormMessage";
import ModalShell from "../ui/ModalShell";
import { buttonClassNames, formControlClassNames } from "../ui/uiStyles";
import { logVehicleActivity } from "../../lib/activityLogger";
import { supabase } from "../../lib/supabaseClient";
import {
  buildPrebookingPayload,
  emptyToNull,
  normalizePrebookingStatus,
  prebookingPaymentMethods,
  prebookingStatuses,
  validatePrebookingForm,
  vehiclePrebookingColumns,
} from "../../lib/vehiclePrebookings";

const emptyForm = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  deposit_amount: "",
  payment_method: "",
  deposit_date: "",
  status: "active",
  notes: "",
  refund_amount: "",
  refund_date: "",
};

function formDataFromPrebooking(prebooking) {
  return {
    ...emptyForm,
    customer_name: prebooking?.customer_name ?? "",
    customer_phone: prebooking?.customer_phone ?? "",
    customer_email: prebooking?.customer_email ?? "",
    deposit_amount:
      prebooking?.deposit_amount === null ||
      prebooking?.deposit_amount === undefined
        ? ""
        : String(prebooking.deposit_amount),
    payment_method: prebooking?.payment_method ?? "",
    deposit_date: prebooking?.deposit_date ?? "",
    status: normalizePrebookingStatus(prebooking?.status),
    notes: prebooking?.notes ?? "",
    refund_amount:
      prebooking?.refund_amount === null ||
      prebooking?.refund_amount === undefined
        ? ""
        : String(prebooking.refund_amount),
    refund_date: prebooking?.refund_date ?? "",
  };
}

async function savePrebookingRecord({
  currentProfile,
  formData,
  prebooking,
  vehicleId,
}) {
  const payload = buildPrebookingPayload(formData, {
    currentProfile,
    vehicleId,
  });

  if (prebooking?.id) {
    return supabase
      .from("vehicle_prebookings")
      .update(payload)
      .eq("id", prebooking.id)
      .select(vehiclePrebookingColumns)
      .single();
  }

  const insertPayload = {
    ...payload,
    created_by: currentProfile?.id ?? null,
  };
  const insertResponse = await supabase
    .from("vehicle_prebookings")
    .insert([insertPayload])
    .select(vehiclePrebookingColumns)
    .single();

  if (insertResponse.error?.code !== "23505") {
    return insertResponse;
  }

  const existingResponse = await supabase
    .from("vehicle_prebookings")
    .select(vehiclePrebookingColumns)
    .eq("vehicle_id", vehicleId)
    .eq("status", "active")
    .maybeSingle();

  if (existingResponse.error || !existingResponse.data?.id) {
    return insertResponse;
  }

  return supabase
    .from("vehicle_prebookings")
    .update(payload)
    .eq("id", existingResponse.data.id)
    .select(vehiclePrebookingColumns)
    .single();
}

function VehiclePrebookingModal({
  currentProfile,
  onClose,
  onSaved,
  prebooking,
  vehicle,
  vehicleId,
}) {
  const [loadedPrebooking, setLoadedPrebooking] = useState(prebooking ?? null);
  const [formData, setFormData] = useState(() =>
    formDataFromPrebooking(prebooking)
  );
  const [isLoading, setIsLoading] = useState(Boolean(prebooking?.id));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const recordVehicleId = vehicleId ?? prebooking?.vehicle_id ?? vehicle?.id;
  const normalizedStatus = normalizePrebookingStatus(formData.status);
  const title = prebooking?.id ? "Prebooking Details" : "Add Prebooking";
  const vehicleLabel = useMemo(() => {
    const titleParts = [vehicle?.year, vehicle?.make, vehicle?.model].filter(
      Boolean
    );
    const titleText = titleParts.join(" ");

    return [vehicle?.stock_number, titleText].filter(Boolean).join(" · ");
  }, [vehicle]);

  useEffect(() => {
    let isMounted = true;

    async function loadPrebooking() {
      if (!prebooking?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await supabase
          .from("vehicle_prebookings")
          .select(vehiclePrebookingColumns)
          .eq("id", prebooking.id)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Could not load prebooking:", error);
          setErrorMessage("Could not load prebooking details.");
          return;
        }

        const nextPrebooking = data ?? prebooking;
        setLoadedPrebooking(nextPrebooking);
        setFormData(formDataFromPrebooking(nextPrebooking));
      } catch (error) {
        if (isMounted) {
          console.error("Could not load prebooking:", error);
          setErrorMessage("Could not load prebooking details.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPrebooking();

    return () => {
      isMounted = false;
    };
  }, [prebooking]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function saveWithForm(nextFormData) {
    if (isSubmitting) {
      return;
    }

    if (!recordVehicleId) {
      setErrorMessage("Unable to save a prebooking without a vehicle.");
      return;
    }

    const validationMessage = validatePrebookingForm(nextFormData);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { data, error } = await savePrebookingRecord({
        currentProfile,
        formData: nextFormData,
        prebooking: loadedPrebooking,
        vehicleId: recordVehicleId,
      });

      if (error) {
        console.error("Could not save prebooking:", error);
        setErrorMessage("Could not save prebooking. Please try again.");
        return;
      }

      const savedPrebooking = data ?? {
        ...loadedPrebooking,
        ...buildPrebookingPayload(nextFormData, {
          currentProfile,
          vehicleId: recordVehicleId,
        }),
      };
      setLoadedPrebooking(savedPrebooking);
      setFormData(formDataFromPrebooking(savedPrebooking));

      await logVehicleActivity({
        vehicleId: recordVehicleId,
        action: loadedPrebooking?.id
          ? "Prebooking updated"
          : "Prebooking added",
        details: {
          customer_name: emptyToNull(nextFormData.customer_name),
          deposit_amount: Number(nextFormData.deposit_amount || 0),
          payment_method: emptyToNull(nextFormData.payment_method),
          status: normalizePrebookingStatus(nextFormData.status),
        },
      });

      await onSaved?.(savedPrebooking);
      onClose();
    } catch (error) {
      console.error("Could not save prebooking:", error);
      setErrorMessage("Could not save prebooking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await saveWithForm(formData);
  }

  async function handleStatusAction(nextStatus) {
    const nextFormData = {
      ...formData,
      status: nextStatus,
      refund_date:
        nextStatus === "refunded" && !formData.refund_date
          ? new Date().toISOString().slice(0, 10)
          : formData.refund_date,
    };

    setFormData(nextFormData);
    await saveWithForm(nextFormData);
  }

  return (
    <ModalShell
      description={vehicleLabel || "Record reservation and deposit details."}
      isCloseDisabled={isSubmitting}
      onClose={onClose}
      size="lg"
      title={title}
    >
      {isLoading ? (
        <p className="text-sm font-semibold text-slate-600">
          Loading prebooking details...
        </p>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="prebooking-customer-name">
              <span className={formControlClassNames.label}>
                Customer Name
              </span>
              <input
                className={formControlClassNames.input}
                id="prebooking-customer-name"
                name="customer_name"
                onChange={handleChange}
                type="text"
                value={formData.customer_name}
              />
            </label>

            <label className="block" htmlFor="prebooking-phone">
              <span className={formControlClassNames.label}>Phone</span>
              <input
                className={formControlClassNames.input}
                id="prebooking-phone"
                name="customer_phone"
                onChange={handleChange}
                type="tel"
                value={formData.customer_phone}
              />
            </label>

            <label className="block" htmlFor="prebooking-email">
              <span className={formControlClassNames.label}>Email</span>
              <input
                className={formControlClassNames.input}
                id="prebooking-email"
                name="customer_email"
                onChange={handleChange}
                type="email"
                value={formData.customer_email}
              />
            </label>

            <label className="block" htmlFor="prebooking-status">
              <span className={formControlClassNames.label}>Status</span>
              <select
                className={formControlClassNames.select}
                id="prebooking-status"
                name="status"
                onChange={handleChange}
                value={formData.status}
              >
                {prebookingStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="prebooking-deposit-amount">
              <span className={formControlClassNames.label}>
                Deposit Amount
              </span>
              <input
                className={formControlClassNames.input}
                id="prebooking-deposit-amount"
                min="0"
                name="deposit_amount"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={formData.deposit_amount}
              />
            </label>

            <label className="block" htmlFor="prebooking-payment-method">
              <span className={formControlClassNames.label}>
                Payment Method
              </span>
              <select
                className={formControlClassNames.select}
                id="prebooking-payment-method"
                name="payment_method"
                onChange={handleChange}
                value={formData.payment_method}
              >
                {prebookingPaymentMethods.map((method) => (
                  <option key={method.value || "empty"} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block" htmlFor="prebooking-deposit-date">
              <span className={formControlClassNames.label}>Deposit Date</span>
              <input
                className={formControlClassNames.input}
                id="prebooking-deposit-date"
                name="deposit_date"
                onChange={handleChange}
                type="date"
                value={formData.deposit_date}
              />
            </label>

            {normalizedStatus === "refunded" && (
              <>
                <label className="block" htmlFor="prebooking-refund-amount">
                  <span className={formControlClassNames.label}>
                    Refund Amount
                  </span>
                  <input
                    className={formControlClassNames.input}
                    id="prebooking-refund-amount"
                    min="0"
                    name="refund_amount"
                    onChange={handleChange}
                    step="0.01"
                    type="number"
                    value={formData.refund_amount}
                  />
                </label>

                <label className="block" htmlFor="prebooking-refund-date">
                  <span className={formControlClassNames.label}>
                    Refund Date
                  </span>
                  <input
                    className={formControlClassNames.input}
                    id="prebooking-refund-date"
                    name="refund_date"
                    onChange={handleChange}
                    type="date"
                    value={formData.refund_date}
                  />
                </label>
              </>
            )}

            <label className="block sm:col-span-2" htmlFor="prebooking-notes">
              <span className={formControlClassNames.label}>Notes</span>
              <textarea
                className={formControlClassNames.textarea}
                id="prebooking-notes"
                name="notes"
                onChange={handleChange}
                value={formData.notes}
              />
            </label>
          </fieldset>

          <FormMessage tone="error">{errorMessage}</FormMessage>

          {loadedPrebooking?.id && normalizedStatus === "active" && (
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:justify-end">
              <button
                className={`w-full sm:w-auto ${buttonClassNames.secondary}`}
                disabled={isSubmitting}
                onClick={() => handleStatusAction("cancelled")}
                type="button"
              >
                Mark Cancelled
              </button>
              <button
                className={`w-full sm:w-auto ${buttonClassNames.secondary}`}
                disabled={isSubmitting}
                onClick={() => handleStatusAction("refunded")}
                type="button"
              >
                Mark Refunded
              </button>
            </div>
          )}

          <FormActions
            isSubmitting={isSubmitting}
            onCancel={onClose}
            submitLabel="Save"
            submittingLabel="Saving..."
          />
        </form>
      )}
    </ModalShell>
  );
}

export default VehiclePrebookingModal;
