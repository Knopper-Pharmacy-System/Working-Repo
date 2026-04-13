import { useMemo } from "react";
import { useSalesAnalyticsStore } from "../store/useSalesAnalyticsStore";
import { MANAGER_PANEL_SOFT_STYLE, MANAGER_PANEL_STYLE } from "./theme";

const number = (value: number) => value.toLocaleString("en-PH", { maximumFractionDigits: 2 });

type StockRiskRow = {
  itemCode: string;
  description: string;
  currentStock: number;
  reorderPoint: number;
  avgDailyUnits: number;
  daysToStockout: number;
  riskLevel: "high" | "medium" | "low";
};

const normalizeItemKey = (value: string) => value.trim().toUpperCase().replace(/\.0+$/, "");

export default function InventoryInsightsView() {
  const salesRows = useSalesAnalyticsStore((state) => state.getFilteredSalesRows());
  const productRows = useSalesAnalyticsStore((state) => state.productRows);

  const stockRisk = useMemo<StockRiskRow[]>(() => {
    if (!productRows.length) return [];

    const byItem = new Map<string, { units: number; dates: Set<string> }>();
    salesRows.forEach((row) => {
      const key = normalizeItemKey(row.itemCode || row.description);
      if (!key) return;

      const current = byItem.get(key) ?? { units: 0, dates: new Set<string>() };
      current.units += row.qtySold;
      if (row.date) current.dates.add(row.date);
      byItem.set(key, current);
    });

    return productRows
      .map((product) => {
        const key = normalizeItemKey(product.itemCode || product.description);
        const sales = byItem.get(key);
        const activeDays = Math.max(1, sales?.dates.size ?? 0);
        const avgDailyUnits = sales ? sales.units / activeDays : 0;
        const daysToStockout = avgDailyUnits > 0 ? product.currentStock / avgDailyUnits : Number.POSITIVE_INFINITY;

        let riskLevel: StockRiskRow["riskLevel"] = "low";
        if (product.currentStock <= product.reorderPoint || daysToStockout <= 7) riskLevel = "high";
        else if (daysToStockout <= 14) riskLevel = "medium";

        return {
          itemCode: product.itemCode,
          description: product.description,
          currentStock: product.currentStock,
          reorderPoint: product.reorderPoint,
          avgDailyUnits,
          daysToStockout,
          riskLevel,
        };
      })
      .sort((a, b) => a.daysToStockout - b.daysToStockout)
      .slice(0, 25);
  }, [salesRows, productRows]);

  const highRiskCount = stockRisk.filter((item) => item.riskLevel === "high").length;
  const mediumRiskCount = stockRisk.filter((item) => item.riskLevel === "medium").length;

  if (!productRows.length) {
    return (
      <section className="rounded-2xl p-6" style={MANAGER_PANEL_STYLE}>
        <h3 className="text-lg font-bold text-slate-900">Inventory Insights</h3>
        <p className="mt-2 text-sm text-slate-600">
          Upload Product Details first. Then upload Sales Transaction report for velocity-based stockout predictions.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm" style={MANAGER_PANEL_STYLE}>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            High risk items
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{number(highRiskCount)}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm" style={MANAGER_PANEL_STYLE}>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Medium risk items
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{number(mediumRiskCount)}</p>
        </article>
        <article className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm" style={MANAGER_PANEL_STYLE}>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Catalog analyzed
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{number(productRows.length)}</p>
        </article>
      </div>

      <article className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm" style={MANAGER_PANEL_SOFT_STYLE}>
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          Reorder and stockout watchlist
        </p>
        <p className="text-xs text-slate-600">Prioritized by estimated days to stockout based on recent sales velocity</p>

        <div className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Current Stock</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Reorder Point</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Avg Daily Units</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Days to Stockout</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {stockRisk.map((row) => (
                <tr key={`${row.itemCode}-${row.description}`} className="transition hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-900">{row.description || row.itemCode || "Unknown item"}</td>
                  <td className="px-3 py-2 text-slate-600">{number(row.currentStock)}</td>
                  <td className="px-3 py-2 text-slate-600">{number(row.reorderPoint)}</td>
                  <td className="px-3 py-2 text-slate-600">{number(row.avgDailyUnits)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {Number.isFinite(row.daysToStockout) ? number(row.daysToStockout) : "No sales baseline"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        row.riskLevel === "high"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : row.riskLevel === "medium"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {row.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
