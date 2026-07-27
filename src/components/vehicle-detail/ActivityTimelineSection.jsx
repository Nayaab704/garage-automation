import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function formatActionLabel(action) {
  if (!action) {
    return "Activity logged";
  }

  if (action.includes(" ")) {
    return action;
  }

  return action
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDetailLabel(key) {
  return key
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    const nestedSummary = Object.entries(value)
      .filter(([, nestedValue]) => nestedValue !== null && nestedValue !== "")
      .map(
        ([nestedKey, nestedValue]) =>
          `${formatDetailLabel(nestedKey)}: ${formatDetailValue(nestedValue)}`
      )
      .join(", ");

    return nestedSummary || "Not available";
  }

  return String(value)
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getDetailEntries(details) {
  if (!details || typeof details !== "object") {
    return [];
  }

  return Object.entries(details)
    .filter(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      return (
        !normalizedKey.endsWith("id") &&
        value !== null &&
        value !== undefined &&
        value !== ""
      );
    })
    .slice(0, 4);
}

function ActivityDetails({ details }) {
  const entries = getDetailEntries(details);

  if (entries.length === 0) {
    return (
      <p className="mt-1 text-sm text-zinc-500">
        No additional details recorded.
      </p>
    );
  }

  return (
    <dl className="mt-3 flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <div
          className="rounded-md bg-zinc-50 px-3 py-2"
          key={key}
        >
          <dt className="text-xs font-medium text-zinc-500">
            {formatDetailLabel(key)}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-zinc-800">
            {formatDetailValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TimelineItem({ activity, isLast }) {
  return (
    <li className="relative flex gap-4">
      {!isLast && (
        <div className="absolute left-2 top-5 h-full w-px bg-zinc-200" />
      )}
      <div className="relative mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-950 ring-4 ring-white" />

      <article className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="font-bold text-zinc-950">
            {formatActionLabel(activity.action)}
          </h3>
          <time className="text-sm text-zinc-500">
            {formatDateTime(activity.created_at)}
          </time>
        </div>

        <ActivityDetails details={activity.details} />
      </article>
    </li>
  );
}

function ActivityTimelineSection({ refreshKey = 0, vehicleId }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchActivities() {
      if (!vehicleId) {
        setActivities([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await supabase
          .from("activity_logs_visible")
          .select("id, action, details, created_at")
          .eq("vehicle_id", vehicleId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!isMounted) {
          return;
        }

        if (error) {
          setActivities([]);
          setErrorMessage(error.message);
          return;
        }

        setActivities(data ?? []);
      } catch (error) {
        if (isMounted) {
          setActivities([]);
          setErrorMessage(error.message ?? "Something went wrong.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchActivities();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, vehicleId]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-950">
            Activity Timeline
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Latest important actions for this vehicle.
          </p>
        </div>

        <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
          {activities.length}
        </span>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          Loading activity timeline...
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && activities.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          No activity has been logged for this vehicle yet.
        </div>
      )}

      {!isLoading && !errorMessage && activities.length > 0 && (
        <ol className="space-y-3">
          {activities.map((activity, index) => (
            <TimelineItem
              activity={activity}
              isLast={index === activities.length - 1}
              key={activity.id ?? index}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

export default ActivityTimelineSection;
