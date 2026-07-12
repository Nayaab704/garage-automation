import { PART_QUEUE_TABS } from "../../lib/partWorkflowUtils";
import useActiveTabScroll from "../../hooks/useActiveTabScroll";

function PartsQueueTabs({ activeTab, counts = {}, onChange }) {
  const tabRefs = useActiveTabScroll(activeTab);

  return (
    <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
      {PART_QUEUE_TABS.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition sm:text-sm ${
              isActive
                ? "bg-emerald-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            }`}
            key={tab.key}
            onClick={() => onChange(tab.key)}
            ref={(element) => {
              tabRefs.current[tab.key] = element;
            }}
            type="button"
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] ${
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
