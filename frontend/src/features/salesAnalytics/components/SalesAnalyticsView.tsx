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

const number = (value: number) => value.toLocaleString("en-PH", { maximumFractionDigits: 2 });

export default function SalesAnalyticsView() {
  const salesRows = useSalesAnalyticsStore((state) => state.getFilteredSalesRows());

  const cashierRanking = useMemo(() => {
    const summary = new Map<string, { gross: number; profit: number; tx: Set<string> }>();

    salesRows.forEach((row) => {
      const key = row.cashier || "Unknown cashier";
      const current = summary.get(key) ?? { gross: 0, profit: 0, tx: new Set<string>() };
      current.gross += row.grossSales;
      current.profit += row.netProfit;
      if (row.transactionNo) current.tx.add(row.transactionNo);
      summary.set(key, current);
    });

    return Array.from(summary.entries())
      .map(([cashier, values]) => ({
        cashier,
        grossSales: values.gross,
        netProfit: values.profit,
        transactions: values.tx.size,
      }))
      .sort((a, b) => b.grossSales - a.grossSales)
      .slice(0, 10);
  }, [salesRows]);

  const hourlyTrend = useMemo(() => {
    const byHour = new Map<number, { gross: number; discount: number; transactions: Set<string> }>();

    salesRows.forEach((row) => {
      const hour = Number.isFinite(row.hour) ? row.hour : 0;
      const current = byHour.get(hour) ?? { gross: 0, discount: 0, transactions: new Set<string>() };
      current.gross += row.grossSales;
      current.discount += row.discountAmount;
      if (row.transactionNo) current.transactions.add(row.transactionNo);
      byHour.set(hour, current);
    });

    return Array.from(byHour.entries())
      .map(([hour, values]) => ({
        label: `${String(hour).padStart(2, "0")}:00`,
        grossSales: values.gross,
        discountAmount: values.discount,
        transactions: values.transactions.size,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [salesRows]);

  const discountAnalysis = useMemo(() => {
    const totalGross = salesRows.reduce((sum, row) => sum + row.grossSales, 0);
    const totalDiscount = salesRows.reduce((sum, row) => sum + row.discountAmount, 0);
    const withDiscount = salesRows.filter((row) => row.discountAmount > 0);

    const discountedTransactions = new Set(
      withDiscount.map((row) => row.transactionNo).filter((tx) => tx.length > 0),
    ).size;
    const totalTransactions = new Set(
      salesRows.map((row) => row.transactionNo).filter((tx) => tx.length > 0),
    ).size;

    return {
      totalDiscount,
      discountRate: totalGross > 0 ? (totalDiscount / totalGross) * 100 : 0,
      discountedTransactions,
      totalTransactions,
    };
  }, [salesRows]);

  if (!salesRows.length) {
    return (
      <section className="rounded-2xl p-6" style={MANAGER_PANEL_STYLE}>
        <h3 className="text-lg font-bold text-slate-900">Sales Analytics</h3>
        <p className="mt-2 text-sm text-slate-600">
          Upload a Sales Transaction report to unlock cashier comparison, hourly trends, and discount analysis.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm" style={MANAGER_PANEL_STYLE}>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Total discount amount
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{money(discountAnalysis.totalDiscount)}</p>
        </article>
        <article className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm" style={MANAGER_PANEL_STYLE}>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Discount rate
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">{discountAnalysis.discountRate.toFixed(2)}%</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm" style={MANAGER_PANEL_STYLE}>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Transactions with discount
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-800">
            {number(discountAnalysis.discountedTransactions)} / {number(discountAnalysis.totalTransactions)}
          </p>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl p-4 lg:col-span-2" style={MANAGER_PANEL_SOFT_STYLE}>
          <p className="text-sm font-semibold text-slate-900">Hourly gross sales trend</p>
          <p className="text-xs text-slate-600">Peak sales periods across your uploaded report</p>
          <div className="mt-3 h-72 w-full">
            <ResponsiveContainer>
              <BarChart data={hourlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.24)" />
                <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 11 }} />
                <YAxis tick={{ fill: "#475569", fontSize: 11 }} />
                <Tooltip formatter={(value: unknown) => money(Number(value || 0))} />
                <Bar dataKey="grossSales" fill="#0f766e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl p-4" style={MANAGER_PANEL_SOFT_STYLE}>
          <p className="text-sm font-semibold text-slate-900">Cashier comparison</p>
          <p className="text-xs text-slate-600">Top performers by gross sales</p>
          <div className="mt-3 max-h-72 overflow-auto space-y-2 pr-1">
            {cashierRanking.map((item) => (
              <div key={item.cashier} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{item.cashier}</p>
                <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-slate-600">
                  <p>Gross: {money(item.grossSales)}</p>
                  <p>Profit: {money(item.netProfit)}</p>
                  <p>Transactions: {number(item.transactions)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
