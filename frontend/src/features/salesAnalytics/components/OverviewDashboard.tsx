import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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

const toNumericValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const PIE_COLORS = ["#60a5fa", "#38bdf8", "#22c55e", "#f59e0b", "#fb7185", "#a78bfa"];

type KpiCardProps = {
  label: string;
  value: string;
  helper: string;
  accent: "blue" | "emerald" | "amber" | "indigo";
};

type SalesTrendPoint = { date: string; grossSales: number; netProfit: number; units: number };
type TopProductPoint = { item: string; qtySold: number };
type DepartmentPoint = { department: string; value: number };

const KPI_ACCENT_CLASS: Record<KpiCardProps["accent"], string> = {
  blue: "from-blue-500 to-blue-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  indigo: "from-indigo-500 to-indigo-600",
};

function KpiCard({ label, value, helper, accent }: KpiCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm" style={MANAGER_PANEL_STYLE}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${KPI_ACCENT_CLASS[accent]}`} />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      </div>
      <p className="text-3xl font-extrabold leading-tight text-slate-800">{value}</p>
      <div className="my-2 h-px bg-slate-200" />
      <p className="text-xs text-slate-600">{helper}</p>
    </article>
  );
}

export default function OverviewDashboard() {
  const kpis = useSalesAnalyticsStore((state) => state.getOverviewKpis());
  const insights = useSalesAnalyticsStore((state) => state.getQuickInsights());
  const charts = useSalesAnalyticsStore((state) => state.getOverviewCharts());

  const safeKpis = {
    totalGrossSales: toNumericValue(kpis.totalGrossSales),
    totalNetProfit: toNumericValue(kpis.totalNetProfit),
    totalUnitsSold: toNumericValue(kpis.totalUnitsSold),
    discountPercent: toNumericValue(kpis.discountPercent),
    transactionCount: toNumericValue(kpis.transactionCount),
    averageTransactionValue: toNumericValue(kpis.averageTransactionValue),
  };

  const safeSalesTrend = Array.isArray(charts.salesTrend)
    ? charts.salesTrend.map((point: SalesTrendPoint) => ({
        date: String(point?.date ?? "Unknown"),
        grossSales: toNumericValue(point?.grossSales),
        netProfit: toNumericValue(point?.netProfit),
        units: toNumericValue(point?.units),
      }))
    : [];

  const safeTopProducts = Array.isArray(charts.topProducts)
    ? charts.topProducts.map((point: TopProductPoint) => ({
        item: String(point?.item ?? "Unknown item"),
        qtySold: toNumericValue(point?.qtySold),
      }))
    : [];

  const safeDepartments = Array.isArray(charts.departmentBreakdown)
    ? charts.departmentBreakdown
        .map((point: DepartmentPoint) => ({
          department: String(point?.department ?? "Uncategorized"),
          value: toNumericValue(point?.value),
        }))
        .filter((point: DepartmentPoint) => point.value >= 0)
    : [];

  if (!safeSalesTrend.length) {
    return (
      <section className="rounded-3xl p-10 text-center" style={MANAGER_PANEL_STYLE}>
        <h3 className="text-2xl font-bold text-slate-900">Overview will appear here</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
          Upload your Sales Transaction report first. Then we can compute total sales, profit, trends, and smart
          insights for your team.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Total Gross Sales" value={money(safeKpis.totalGrossSales)} helper="Total revenue from uploaded sales rows" accent="blue" />
        <KpiCard label="Total Net Profit" value={money(safeKpis.totalNetProfit)} helper="Gross sales minus costs and discounts" accent="emerald" />
        <KpiCard label="Total Units Sold" value={number(safeKpis.totalUnitsSold)} helper="All item quantities sold" accent="indigo" />
        <KpiCard label="Total Discount %" value={`${safeKpis.discountPercent.toFixed(2)}%`} helper="Share of gross sales used as discount" accent="amber" />
        <KpiCard label="Number of Transactions" value={number(safeKpis.transactionCount)} helper="Unique transaction numbers" accent="blue" />
        <KpiCard label="Average Transaction Value" value={money(safeKpis.averageTransactionValue)} helper="Gross sales divided by transaction count" accent="emerald" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl p-4 lg:col-span-2" style={MANAGER_PANEL_SOFT_STYLE}>
          <p className="text-sm font-semibold text-slate-900">Sales trend by date</p>
          <p className="text-xs text-slate-600">Daily gross sales and net profit over time</p>
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={safeSalesTrend}>
                <defs>
                  <linearGradient id="grossFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.24)" />
                <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 11 }} />
                <YAxis tick={{ fill: "#475569", fontSize: 11 }} />
                <Tooltip formatter={(value: unknown) => money(toNumericValue(value))} />
                <Area type="monotone" dataKey="grossSales" name="Gross Sales" stroke="#60a5fa" fill="url(#grossFill)" />
                <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#22c55e" fill="url(#profitFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl p-4" style={MANAGER_PANEL_SOFT_STYLE}>
          <p className="text-sm font-semibold text-slate-900">Quick insights</p>
          <p className="text-xs text-slate-600">Fast highlights from current uploads</p>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Top selling item
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{insights.topSellingItem}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-700">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Best performing cashier
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{insights.bestCashier}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Highest sales date
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{insights.highestSalesDate}</p>
            </div>
          </div>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl p-4" style={MANAGER_PANEL_SOFT_STYLE}>
          <p className="text-sm font-semibold text-slate-900">Top 10 products by quantity</p>
          <p className="text-xs text-slate-600">Combined from sales report and fast-moving report</p>
          <div className="mt-3 h-72 w-full">
            <ResponsiveContainer>
              <BarChart data={safeTopProducts} layout="vertical" margin={{ left: 6, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.24)" />
                <XAxis type="number" tick={{ fill: "#475569", fontSize: 11 }} />
                <YAxis type="category" dataKey="item" width={140} tick={{ fill: "#475569", fontSize: 10 }} />
                <Tooltip formatter={(value: unknown) => number(toNumericValue(value))} />
                <Bar dataKey="qtySold" name="Qty Sold" fill="#38bdf8" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl p-4" style={MANAGER_PANEL_SOFT_STYLE}>
          <p className="text-sm font-semibold text-slate-900">Department breakdown</p>
          <p className="text-xs text-slate-600">Sales value grouped by department from product catalog</p>
          <div className="mt-3 h-72 w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={safeDepartments}
                  dataKey="value"
                  nameKey="department"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={92}
                  paddingAngle={2}
                  label={({ name }) => String(name ?? "")}
                >
                  {safeDepartments.map((entry: DepartmentPoint, index: number) => (
                    <Cell key={`${entry.department}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: unknown) => money(toNumericValue(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </section>
  );
}
