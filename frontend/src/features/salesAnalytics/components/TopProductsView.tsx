import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSalesAnalyticsStore } from "../store/useSalesAnalyticsStore";
import { MANAGER_PANEL_SOFT_STYLE, MANAGER_PANEL_STYLE } from "./theme";

const money = (value: number) =>
  `PHP ${value.toLocaleString("en-PH", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export default function TopProductsView() {
  const salesRows = useSalesAnalyticsStore((state) => state.getFilteredSalesRows());
  const fastMovingRows = useSalesAnalyticsStore((state) => state.fastMovingRows);
  const dateFilterPreset = useSalesAnalyticsStore((state) => state.dateFilter.preset);

  const combinedTopProducts = useMemo(() => {
    const map = new Map<string, { qty: number; gross: number }>();

    salesRows.forEach((row) => {
      const key = row.description || row.itemCode || "Unknown item";
      const current = map.get(key) ?? { qty: 0, gross: 0 };
      current.qty += row.qtySold;
      current.gross += row.grossSales;
      map.set(key, current);
    });

    if (dateFilterPreset === "all-time") {
      fastMovingRows.forEach((row) => {
        const key = row.description || row.itemCode || "Unknown item";
        const current = map.get(key) ?? { qty: 0, gross: 0 };
        current.qty += row.qtySold;
        current.gross += row.grossSales;
        map.set(key, current);
      });
    }

    return Array.from(map.entries())
      .map(([item, values]) => ({
        item,
        qtySold: values.qty,
        grossSales: values.gross,
      }))
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 15);
  }, [salesRows, fastMovingRows, dateFilterPreset]);

  if (!combinedTopProducts.length) {
    return (
      <section className="rounded-2xl p-6" style={MANAGER_PANEL_STYLE}>
        <h3 className="text-lg font-bold text-slate-900">Top Products</h3>
        <p className="mt-2 text-sm text-slate-600">
          Upload Sales Transaction and Fast Moving reports to generate blended top-product rankings.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <article className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm" style={MANAGER_PANEL_SOFT_STYLE}>
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Top products by quantity
        </p>
        <p className="text-xs text-slate-600">Merged from sales transactions and fast-moving report</p>
        <div className="mt-3 h-80 w-full">
          <ResponsiveContainer>
            <BarChart data={combinedTopProducts.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.24)" />
              <XAxis type="number" tick={{ fill: "#475569", fontSize: 11 }} />
              <YAxis type="category" dataKey="item" width={170} tick={{ fill: "#475569", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid rgba(148,163,184,0.35)",
                  borderRadius: 12,
                  color: "#0f172a",
                }}
              />
              <Bar dataKey="qtySold" fill="#4f8cff" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm" style={MANAGER_PANEL_SOFT_STYLE}>
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Product leaderboard
        </p>
        <p className="text-xs text-slate-600">Quantity and gross sales contribution</p>
        <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
          {combinedTopProducts.map((product, index) => (
            <div key={product.item} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Rank #{index + 1}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{product.item}</p>
              <p className="text-xs text-slate-600">Qty sold: {product.qtySold.toLocaleString("en-PH")}</p>
              <p className="text-xs text-slate-600">Gross sales: {money(product.grossSales)}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
