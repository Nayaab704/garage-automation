import { PART_QUEUE_TABS } from "../../lib/partWorkflowUtils";

function PartsQueueTabs({ activeTab, counts = {}, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {PART_QUEUE_TABS.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black transition ${
              isActive
                ? "bg-slate-950 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            }`}
            key={tab.key}
            onClick={() => onChange(tab.key)}
            type="button"
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                isActive
                  ? "bg-white/15 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {counts[tab.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default PartsQueueTabs;
