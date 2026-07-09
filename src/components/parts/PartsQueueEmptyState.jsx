import AppIcon from "../ui/AppIcon";

const emptyMessages = {
  all: {
    body: "Parts added inside work orders will appear here.",
    title: "No parts found.",
  },
  needs_po: {
    body: 'Parts marked "Needs to Buy" will appear here until a purchase order is created.',
    title: "No parts need purchase orders right now.",
  },
  ordered: {
    body: "Parts with linked purchase orders will appear here.",
    title: "No ordered parts found.",
  },
  pending_review: {
    body: "Needs-to-buy parts waiting for review will appear here.",
    title: "No parts are pending review.",
  },
  received: {
    body: "Received or installed parts will appear here.",
    title: "No received parts found.",
  },
  returned: {
    body: "Returned parts stay visible here with undo and reorder actions.",
    title: "No returned parts found.",
  },
};

function PartsQueueEmptyState({
  activeTab,
  hasFilters = false,
  hasSearch,
  onClearSearch,
}) {
  const hasQuery = hasSearch || hasFilters;
  const message = hasQuery
    ? {
        body: hasFilters
          ? "Try clearing filters or selecting another vendor/vehicle."
          : "Try searching by VIN, stock number, vehicle, part, or vendor.",
        title: "No matching records found.",
      }
    : emptyMessages[activeTab] ?? emptyMessages.all;
  const clearLabel = hasFilters ? "Clear Filters" : "Clear Search";

  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white/90 p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <AppIcon name="box" size={24} />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">
        {message.title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {message.body}
      </p>
      {hasQuery && onClearSearch && (
        <button
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          onClick={onClearSearch}
          type="button"
        >
          {clearLabel}
        </button>
      )}
    </section>
  );
}

export default PartsQueueEmptyState;
