import { CalendarDays, FilterX } from "lucide-react";
import { useSalesAnalyticsStore } from "../store/useSalesAnalyticsStore";
import type { DatePreset } from "../types";
import { MANAGER_PANEL_SOFT_STYLE } from "./theme";

const PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "This Week" },
  { id: "last-week", label: "Last Week" },
  { id: "this-month", label: "This Month" },
  { id: "last-month", label: "Last Month" },
  { id: "this-year", label: "This Year" },
  { id: "last-year", label: "Last Year" },
  { id: "all-time", label: "All Time" },
];

export default function DateRangeFilter() {
  const dateFilter = useSalesAnalyticsStore((state) => state.dateFilter);
  const setDatePreset = useSalesAnalyticsStore((state) => state.setDatePreset);
  const setCustomDateRange = useSalesAnalyticsStore((state) => state.setCustomDateRange);
  const clearDateFilter = useSalesAnalyticsStore((state) => state.clearDateFilter);
  const getDateFilterLabel = useSalesAnalyticsStore((state) => state.getDateFilterLabel);

  const fromDate = dateFilter.fromDate || "";
  const toDate = dateFilter.toDate || "";

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm"
      style={MANAGER_PANEL_SOFT_STYLE}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
            <CalendarDays size={14} />
            Date Range Filter
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{getDateFilterLabel()}</p>
        </div>

        <button
          type="button"
          onClick={clearDateFilter}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
        >
          <FilterX size={14} />
          Reset
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = dateFilter.preset === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDatePreset(preset.id)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                active
                  ? "border-blue-300 bg-blue-100 text-blue-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">From Date</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setCustomDateRange(event.target.value, toDate)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">To Date</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setCustomDateRange(fromDate, event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400"
          />
        </label>
      </div>
    </section>
  );
}
