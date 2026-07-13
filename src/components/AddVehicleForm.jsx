import { useEffect, useMemo, useState } from "react";
import {
  buttonClassNames,
  cardClassNames,
  formControlClassNames,
} from "./ui/uiStyles";
import AppIcon from "./ui/AppIcon";
import VehicleAutocompleteInput from "./VehicleAutocompleteInput";
import VehicleColorPicker from "./VehicleColorPicker";
import {
  compressImageFile,
  defaultPhotoCompressionOptions,
} from "../lib/imageCompression";
import { supabase } from "../lib/supabaseClient";
import {
  fetchVehicleCatalogEntries,
  getMakeSuggestions,
  getModelSuggestions,
  getTrimSuggestions,
  recordVehicleCatalogEntrySafely,
} from "../lib/vehicleCatalog";
import {
  getVehicleColorHexForName,
  normalizeVehicleColorHex,
} from "../lib/vehicleColorDisplay";
import { vehicleOriginOptions } from "../lib/vehicleOrigin";
import {
  buildPrebookingPayload,
  prebookingPaymentMethods,
  validatePrebookingForm,
  vehiclePrebookingColumns,
} from "../lib/vehiclePrebookings";

const emptyForm = {
  vin: "",
  year: "",
  make: "",
  model: "",
  trim: "",
  mileage: "",
  color: "",
  color_hex: "",
  title_status: "unknown",
  vehicle_origin: "unknown",
  purchase_price: "",
  target_sale_price: "",
  notes: "",
};

const emptyPrebookingForm = {
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

const basicFields = [
  {
    name: "vin",
    label: "VIN",
    placeholder: "17-character VIN",
    type: "text",
    maxLength: 17,
    inputClassName: "font-mono uppercase tracking-wide",
    layoutClassName: "md:col-span-2",
  },
  {
    name: "year",
    label: "Year",
    min: "1900",
    placeholder: "2020",
    step: "1",
    type: "number",
  },
  {
    name: "make",
    label: "Make",
    placeholder: "Toyota",
    required: true,
    type: "text",
  },
  {
    name: "model",
    label: "Model",
    placeholder: "Camry",
    required: true,
    type: "text",
  },
  { name: "trim", label: "Trim", placeholder: "LE", type: "text" },
  {
    name: "color",
    label: "Color",
    layoutClassName: "md:col-span-2",
    placeholder: "White",
    type: "text",
  },
  {
    name: "mileage",
    label: "Mileage",
    min: "0",
    placeholder: "85000",
    step: "1",
    type: "number",
  },
];

const purchaseNumberFields = [
  {
    name: "purchase_price",
    label: "Purchase Price",
    min: "0",
    placeholder: "0.00",
    step: "0.01",
  },
  {
    name: "target_sale_price",
    label: "Target Sale Price",
    min: "0",
    placeholder: "0.00",
    step: "0.01",
  },
];

const titleStatusOptions = [
  { value: "clean", label: "Clean Title" },
  { value: "salvage", label: "Salvage" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "flood", label: "Flood" },
  { value: "unknown", label: "Unknown" },
];

const allowedTitleStatuses = titleStatusOptions.map((option) => option.value);
const allowedVehicleOrigins = vehicleOriginOptions.map((option) => option.value);
const catalogFieldNames = new Set(["make", "model", "trim"]);

const intakeInputClassName =
  "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
const intakeTextareaClassName =
  "mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
const photoInputActionClassName =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-100";
const disabledPhotoInputActionClassName =
  "pointer-events-none cursor-not-allowed opacity-60";
const photoSaveFailureMessage =
  "Vehicle was created, but the photo could not be saved. Please open the vehicle and add the main photo again.";
const prebookingSaveFailureMessage =
  "Vehicle was created, but the prebooking details could not be saved. Open the vehicle to add the prebooking again.";

function emptyToNull(value) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function numberOrNull(value) {
  const trimmedValue = String(value ?? "").trim();

  if (trimmedValue === "") {
    return null;
  }

  const numberValue = Number(trimmedValue);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function decimalOrZero(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeVin(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .toUpperCase()
    .slice(0, 17);
}

function getValidTitleStatus(value) {
  return allowedTitleStatuses.includes(value) ? value : "unknown";
}

function getValidVehicleOrigin(value) {
  return allowedVehicleOrigins.includes(value) ? value : "unknown";
}

function buildInitialFormData(initialValues = {}) {
  return {
    ...emptyForm,
    ...initialValues,
    vin: normalizeVin(initialValues.vin),
    title_status: getValidTitleStatus(
      initialValues.title_status ?? emptyForm.title_status
    ),
    vehicle_origin: getValidVehicleOrigin(
      initialValues.vehicle_origin ?? emptyForm.vehicle_origin
    ),
  };
}

function buildVehiclePayload(formData) {
  const colorHex =
    normalizeVehicleColorHex(formData.color_hex) ||
    getVehicleColorHexForName(formData.color);

  return {
    vin: emptyToNull(normalizeVin(formData.vin)),
    year: numberOrNull(formData.year),
    make: emptyToNull(formData.make),
    model: emptyToNull(formData.model),
    trim: emptyToNull(formData.trim),
    mileage: numberOrNull(formData.mileage),
    color: emptyToNull(formData.color),
    color_hex: emptyToNull(colorHex),
    title_status: getValidTitleStatus(formData.title_status),
    vehicle_origin: getValidVehicleOrigin(formData.vehicle_origin),
    purchase_price: decimalOrZero(formData.purchase_price),
    status: "inspection",
    target_sale_price: decimalOrZero(formData.target_sale_price),
    notes: emptyToNull(formData.notes),
  };
}

async function saveVehiclePrebooking(vehicleId, formData, currentProfile) {
  const payload = {
    ...buildPrebookingPayload(
      {
        ...emptyPrebookingForm,
        ...formData,
        status: "active",
      },
      {
        currentProfile,
        vehicleId,
      }
    ),
    created_by: currentProfile?.id ?? null,
  };

  return supabase
    .from("vehicle_prebookings")
    .insert([payload])
    .select(vehiclePrebookingColumns)
    .single();
}

function cleanFileName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
}

function buildPhotoPath(vehicleId, fileName) {
  const timestamp = Date.now();
  return `vehicles/${vehicleId}/${timestamp}-${cleanFileName(fileName)}`;
}

async function cleanupUploadedFile(photoPath) {
  await supabase.storage.from("vehicle-photos").remove([photoPath]);
}

async function saveMainVehiclePhoto(
  vehicle,
  selectedPhoto,
  { onStatusChange } = {}
) {
  onStatusChange?.("Compressing photo...");
  const uploadPhoto = await compressImageFile(
    selectedPhoto,
    defaultPhotoCompressionOptions
  );
  onStatusChange?.("Uploading photo...");
  const photoPath = buildPhotoPath(vehicle.id, uploadPhoto.name);

  const uploadResponse = await supabase.storage
    .from("vehicle-photos")
    .upload(photoPath, uploadPhoto, {
      cacheControl: "3600",
      contentType: uploadPhoto.type,
      upsert: false,
    });

  if (uploadResponse.error) {
    console.error("Could not upload intake vehicle photo:", uploadResponse.error);
    throw new Error("Photo upload failed.");
  }

  const publicUrlResponse = supabase.storage
    .from("vehicle-photos")
    .getPublicUrl(photoPath);

  const photo = {
    vehicle_id: vehicle.id,
    photo_url: publicUrlResponse.data.publicUrl,
    photo_path: photoPath,
    photo_type: "general",
    caption: "Main vehicle photo",
  };

  const insertResponse = await supabase
    .from("vehicle_photos")
    .insert([photo])
    .select("*")
    .single();

  if (insertResponse.error) {
    try {
      await cleanupUploadedFile(photoPath);
    } catch (cleanupError) {
      console.error("Could not clean up intake vehicle photo:", cleanupError);
    }

    console.error("Could not save intake vehicle photo:", insertResponse.error);
    throw new Error("Photo record failed.");
  }

  const savedPhoto = insertResponse.data;

  if (!savedPhoto?.id) {
    console.error("Intake vehicle photo was saved without an id:", savedPhoto);
    throw new Error("Photo record missing id.");
  }

  const primaryPhotoResponse = await supabase
    .from("vehicles")
    .update({ primary_photo_id: savedPhoto.id })
    .eq("id", vehicle.id)
    .select("id, stock_number, vin, primary_photo_id")
    .single();

  if (
    primaryPhotoResponse.error ||
    primaryPhotoResponse.data?.primary_photo_id !== savedPhoto.id
  ) {
    console.error(
      "Could not set intake vehicle main photo:",
      primaryPhotoResponse.error ?? primaryPhotoResponse.data
    );
    throw new Error("Primary photo update failed.");
  }

  return {
    photo: savedPhoto,
    vehicle: primaryPhotoResponse.data,
  };
}

function IntakeFormSection({ children, description, icon, title }) {
  return (
    <fieldset className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <legend className="sr-only">{title}</legend>
      <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
          <AppIcon name={icon} size={19} />
        </span>
        <div>
          <h3 className="text-base font-black text-slate-950">{title}</h3>
          {description && (
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </fieldset>
  );
}

function IntakeFieldGrid({ children }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function AddVehicleForm({
  currentProfile,
  initialValues = {},
  onBack,
  onVehicleAdded,
}) {
  const [formData, setFormData] = useState(() =>
    buildInitialFormData(initialValues)
  );
  const [isPrebooked, setIsPrebooked] = useState(false);
  const [prebookingFormData, setPrebookingFormData] = useState(
    emptyPrebookingForm
  );
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [vehicleCatalogEntries, setVehicleCatalogEntries] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const photoPreviewUrl = useMemo(
    () => (selectedPhoto ? URL.createObjectURL(selectedPhoto) : ""),
    [selectedPhoto]
  );

  useEffect(() => {
    if (!photoPreviewUrl) {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    let isMounted = true;

    async function loadVehicleCatalogEntries() {
      setIsCatalogLoading(true);

      try {
        const entries = await fetchVehicleCatalogEntries();

        if (isMounted) {
          setVehicleCatalogEntries(entries);
        }
      } catch (error) {
        console.warn("Could not load vehicle catalog suggestions:", error);
      } finally {
        if (isMounted) {
          setIsCatalogLoading(false);
        }
      }
    }

    loadVehicleCatalogEntries();

    return () => {
      isMounted = false;
    };
  }, []);

  const makeSuggestions = useMemo(
    () => getMakeSuggestions(vehicleCatalogEntries, formData.make),
    [formData.make, vehicleCatalogEntries]
  );
  const modelSuggestions = useMemo(
    () =>
      getModelSuggestions(vehicleCatalogEntries, formData.make, formData.model),
    [formData.make, formData.model, vehicleCatalogEntries]
  );
  const trimSuggestions = useMemo(
    () =>
      getTrimSuggestions(
        vehicleCatalogEntries,
        formData.make,
        formData.model,
        formData.trim
      ),
    [formData.make, formData.model, formData.trim, vehicleCatalogEntries]
  );
  const catalogSuggestionsByField = {
    make: makeSuggestions,
    model: modelSuggestions,
    trim: trimSuggestions,
  };

  function handleChange(event) {
    const { name, value } = event.target;
    const nextValue = name === "vin" ? normalizeVin(value) : value;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: nextValue,
    }));
  }

  function handleCatalogFieldChange(name, value) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleColorChange({ colorHex, colorName }) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      color: colorName,
      color_hex: colorHex,
    }));
  }

  function handlePrebookingChange(event) {
    const { name, value } = event.target;

    setPrebookingFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handlePrebookingToggle(event) {
    setIsPrebooked(event.target.checked);
    setErrorMessage("");
  }

  function handlePhotoChange(event) {
    const photo = event.target.files?.[0] ?? null;

    if (!photo) {
      return;
    }

    if (!photo.type.startsWith("image/")) {
      setSelectedPhoto(null);
      setPhotoInputKey((currentKey) => currentKey + 1);
      setErrorMessage("Please choose an image file.");
      event.target.value = "";
      return;
    }

    setSelectedPhoto(photo);
    setErrorMessage("");
    event.target.value = "";
  }

  function handleRemovePhoto() {
    setSelectedPhoto(null);
    setPhotoInputKey((currentKey) => currentKey + 1);
    setErrorMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!selectedPhoto) {
      setErrorMessage("Please add a vehicle photo before creating the vehicle.");
      setSuccessMessage("");
      return;
    }

    if (!selectedPhoto.type.startsWith("image/")) {
      setErrorMessage("Please choose an image file.");
      setSuccessMessage("");
      return;
    }

    if (isPrebooked) {
      const validationMessage = validatePrebookingForm(prebookingFormData);

      if (validationMessage) {
        setErrorMessage(validationMessage);
        setSuccessMessage("");
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitStatus("Creating vehicle...");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const vehiclePayload = buildVehiclePayload(formData);
      const { data, error } = await supabase
        .from("vehicles")
        .insert([vehiclePayload])
        .select("id, stock_number, vin")
        .single();

      if (error) {
        console.error("Failed to create vehicle", error);
        setErrorMessage(
          "Could not create vehicle. Please check the details and try again."
        );
      } else {
        let savedVehicle = data;
        let savedPrebooking = null;

        void recordVehicleCatalogEntrySafely(vehiclePayload);

        if (isPrebooked) {
          setSubmitStatus("Saving prebooking...");
          const prebookingResponse = await saveVehiclePrebooking(
            data.id,
            prebookingFormData,
            currentProfile
          );

          if (prebookingResponse.error) {
            console.error(
              "Failed to save intake prebooking",
              prebookingResponse.error
            );
            await onVehicleAdded?.({
              ...data,
              prebookingSaveWarning: prebookingSaveFailureMessage,
            });
            return;
          }

          savedPrebooking = prebookingResponse.data;
        }

        try {
          const photoResult = await saveMainVehiclePhoto(data, selectedPhoto, {
            onStatusChange: setSubmitStatus,
          });
          savedVehicle = {
            ...data,
            ...photoResult.vehicle,
            primary_photo_id: photoResult.photo.id,
            prebooking: savedPrebooking,
          };
        } catch (photoError) {
          console.error("Failed to save intake vehicle photo", photoError);
          await onVehicleAdded?.({
            ...data,
            prebooking: savedPrebooking,
            photoSaveWarning: photoSaveFailureMessage,
          });
          return;
        }

        setFormData(buildInitialFormData(initialValues));
        setIsPrebooked(false);
        setPrebookingFormData(emptyPrebookingForm);
        setSelectedPhoto(null);
        setPhotoInputKey((currentKey) => currentKey + 1);
        setSuccessMessage(
          savedVehicle?.stock_number
            ? `Vehicle added successfully. Stock number: ${savedVehicle.stock_number}.`
            : "Vehicle added successfully."
        );
        await onVehicleAdded?.(savedVehicle);
      }
    } catch (error) {
      console.error("Failed to create vehicle", error);
      setErrorMessage(
        "Could not create vehicle. Please check the details and try again."
      );
    } finally {
      setIsSubmitting(false);
      setSubmitStatus("");
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl pb-6">
      <div className={`overflow-hidden bg-white/95 ${cardClassNames.elevated}`}>
        <div className="border-b border-slate-100 bg-gradient-to-br from-white via-blue-50/50 to-white p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {onBack && (
              <button
                className={`shrink-0 ${buttonClassNames.secondary}`}
                disabled={isSubmitting}
                onClick={onBack}
                type="button"
              >
                <AppIcon className="rotate-180" name="chevron-right" size={18} />
                Back to VIN
              </button>
            )}

            {formData.vin && (
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-3 py-1.5 text-xs font-black text-blue-800 shadow-sm">
                <AppIcon name="scan" size={14} />
                <span className="text-slate-500">VIN</span>
                <span className="truncate font-mono tracking-wide">
                  {formData.vin}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
              <AppIcon name="vehicle" size={24} />
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                Vehicle Details
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Complete the vehicle information before creating the record.
              </p>
              <p className="mt-2 inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
                Stock number will be generated automatically.
              </p>
            </div>
          </div>
        </div>

        <form
          className="space-y-4 bg-slate-50/70 p-4 sm:space-y-5 sm:p-6"
          onSubmit={handleSubmit}
        >
          <IntakeFormSection
            description="VIN stays editable. Add the core inventory details used across the app."
            icon="car"
            title="Basic Details"
          >
            <IntakeFieldGrid>
              {basicFields.map((field) => {
                if (field.name === "color") {
                  return (
                    <VehicleColorPicker
                      className={field.layoutClassName ?? ""}
                      colorHex={formData.color_hex}
                      colorName={formData.color}
                      disabled={isSubmitting}
                      key={field.name}
                      label={field.label}
                      onChange={handleColorChange}
                    />
                  );
                }

                if (catalogFieldNames.has(field.name)) {
                  return (
                    <VehicleAutocompleteInput
                      className={field.layoutClassName ?? ""}
                      id={field.name}
                      inputClassName={`${intakeInputClassName} ${
                        field.inputClassName ?? ""
                      }`}
                      key={field.name}
                      label={field.label}
                      loading={isCatalogLoading}
                      name={field.name}
                      onValueChange={handleCatalogFieldChange}
                      placeholder={field.placeholder}
                      required={field.required}
                      suggestions={catalogSuggestionsByField[field.name]}
                      value={formData[field.name]}
                    />
                  );
                }

                return (
                  <label
                    className={`block ${field.layoutClassName ?? ""}`}
                    htmlFor={field.name}
                    key={field.name}
                  >
                    <span className={formControlClassNames.label}>
                      {field.label}
                    </span>
                    <input
                      className={`${intakeInputClassName} ${
                        field.inputClassName ?? ""
                      }`}
                      id={field.name}
                      maxLength={field.maxLength}
                      min={field.min}
                      name={field.name}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      required={field.required}
                      step={field.step}
                      type={field.type}
                      value={formData[field.name]}
                    />
                  </label>
                );
              })}
            </IntakeFieldGrid>
          </IntakeFormSection>

          <IntakeFormSection
            description="Add a clear photo of the vehicle. This will be used as the main vehicle photo."
            icon="camera"
            title="Vehicle Photo"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <input
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={isSubmitting}
                  id="vehicle-main-photo-camera"
                  key={`camera-${photoInputKey}`}
                  onChange={handlePhotoChange}
                  type="file"
                />
                <label
                  aria-disabled={isSubmitting}
                  className={`${photoInputActionClassName} ${
                    isSubmitting ? disabledPhotoInputActionClassName : ""
                  }`}
                  htmlFor="vehicle-main-photo-camera"
                >
                  <AppIcon name="camera" size={18} />
                  Take Photo
                </label>

                <input
                  accept="image/*"
                  className="sr-only"
                  disabled={isSubmitting}
                  id="vehicle-main-photo-upload"
                  key={`upload-${photoInputKey}`}
                  onChange={handlePhotoChange}
                  type="file"
                />
                <label
                  aria-disabled={isSubmitting}
                  className={`${photoInputActionClassName} ${
                    isSubmitting ? disabledPhotoInputActionClassName : ""
                  }`}
                  htmlFor="vehicle-main-photo-upload"
                >
                  <AppIcon name="file" size={18} />
                  Upload Photo
                </label>
              </div>

              {selectedPhoto && (
                <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 sm:flex-row sm:items-center">
                  {photoPreviewUrl && (
                    <img
                      alt="Selected main vehicle photo"
                      className="h-28 w-full rounded-2xl object-cover sm:h-24 sm:w-32"
                      src={photoPreviewUrl}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-blue-950">
                      Main vehicle photo
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-blue-800">
                      {selectedPhoto.name}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label
                        aria-disabled={isSubmitting}
                        className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 text-sm font-black text-blue-800 shadow-sm transition hover:bg-blue-50 ${
                          isSubmitting ? disabledPhotoInputActionClassName : ""
                        }`}
                        htmlFor="vehicle-main-photo-camera"
                      >
                        Retake / Replace
                      </label>
                      <button
                        className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSubmitting}
                        onClick={handleRemovePhoto}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </IntakeFormSection>

          <IntakeFormSection
            description="Add purchase context, title information, and any notes needed later."
            icon="dollar"
            title="Purchase / Admin Details"
          >
            <IntakeFieldGrid>
              {purchaseNumberFields.map((field) => (
                <label className="block" htmlFor={field.name} key={field.name}>
                  <span className={formControlClassNames.label}>
                    {field.label}
                  </span>
                  <input
                    className={intakeInputClassName}
                    id={field.name}
                    min={field.min}
                    name={field.name}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    step={field.step}
                    type="number"
                    value={formData[field.name]}
                  />
                </label>
              ))}

              <label className="block" htmlFor="title_status">
                <span className={formControlClassNames.label}>Title Status</span>
                <select
                  className={intakeInputClassName}
                  id="title_status"
                  name="title_status"
                  onChange={handleChange}
                  value={formData.title_status}
                >
                  {titleStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block" htmlFor="vehicle_origin">
                <span className={formControlClassNames.label}>
                  Vehicle Origin
                </span>
                <select
                  className={intakeInputClassName}
                  id="vehicle_origin"
                  name="vehicle_origin"
                  onChange={handleChange}
                  value={formData.vehicle_origin}
                >
                  {vehicleOriginOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2" htmlFor="notes">
                <span className={formControlClassNames.label}>Notes</span>
                <textarea
                  className={intakeTextareaClassName}
                  id="notes"
                  name="notes"
                  onChange={handleChange}
                  placeholder="Optional intake notes"
                  value={formData.notes}
                />
              </label>
            </IntakeFieldGrid>
          </IntakeFormSection>

          <IntakeFormSection
            description="Mark this vehicle as reserved for a customer without changing its workflow status."
            icon="dollar"
            title="Prebooking"
          >
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-slate-900 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="block text-sm font-black text-slate-950">
                    Prebooked
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    Mark this vehicle as reserved for a customer.
                  </span>
                </span>
                <input
                  checked={isPrebooked}
                  className="h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-200"
                  disabled={isSubmitting}
                  onChange={handlePrebookingToggle}
                  type="checkbox"
                />
              </label>

              {isPrebooked && (
                <IntakeFieldGrid>
                  <label className="block" htmlFor="prebooking-customer-name">
                    <span className={formControlClassNames.label}>
                      Customer Name
                    </span>
                    <input
                      className={intakeInputClassName}
                      id="prebooking-customer-name"
                      name="customer_name"
                      onChange={handlePrebookingChange}
                      placeholder="Optional"
                      type="text"
                      value={prebookingFormData.customer_name}
                    />
                  </label>

                  <label className="block" htmlFor="prebooking-phone">
                    <span className={formControlClassNames.label}>Phone</span>
                    <input
                      className={intakeInputClassName}
                      id="prebooking-phone"
                      name="customer_phone"
                      onChange={handlePrebookingChange}
                      placeholder="Optional"
                      type="tel"
                      value={prebookingFormData.customer_phone}
                    />
                  </label>

                  <label className="block" htmlFor="prebooking-deposit">
                    <span className={formControlClassNames.label}>
                      Deposit Amount
                    </span>
                    <input
                      className={intakeInputClassName}
                      id="prebooking-deposit"
                      min="0"
                      name="deposit_amount"
                      onChange={handlePrebookingChange}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={prebookingFormData.deposit_amount}
                    />
                  </label>

                  <label className="block" htmlFor="prebooking-payment-method">
                    <span className={formControlClassNames.label}>
                      Payment Method
                    </span>
                    <select
                      className={intakeInputClassName}
                      id="prebooking-payment-method"
                      name="payment_method"
                      onChange={handlePrebookingChange}
                      value={prebookingFormData.payment_method}
                    >
                      {prebookingPaymentMethods.map((method) => (
                        <option
                          key={method.value || "empty"}
                          value={method.value}
                        >
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label
                    className="block md:col-span-2"
                    htmlFor="prebooking-notes"
                  >
                    <span className={formControlClassNames.label}>Notes</span>
                    <textarea
                      className={intakeTextareaClassName}
                      id="prebooking-notes"
                      name="notes"
                      onChange={handlePrebookingChange}
                      placeholder="Optional prebooking notes"
                      value={prebookingFormData.notes}
                    />
                  </label>
                </IntakeFieldGrid>
              )}
            </div>
          </IntakeFormSection>

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
            <p className="mb-3 text-xs font-semibold text-slate-500 sm:mb-0">
              Create Vehicle will add this record to inventory.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {onBack && (
                <button
                  className={`w-full sm:w-auto ${buttonClassNames.secondary}`}
                  disabled={isSubmitting}
                  onClick={onBack}
                  type="button"
                >
                  Back
                </button>
              )}

              <button
                className={`w-full sm:w-auto ${buttonClassNames.primary}`}
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? submitStatus || "Creating vehicle..." : "Create Vehicle"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

export default AddVehicleForm;
