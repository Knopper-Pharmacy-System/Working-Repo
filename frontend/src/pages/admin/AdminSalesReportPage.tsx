import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  Download,
  Printer,
  RefreshCw,
  CreditCard,
  Wallet,
  TrendingUp,
  Receipt,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminFooter from "../../components/admin/AdminFooter";
import { getToken } from "../../hooks/useAuth";

type DailySalesSummary = {
  total_transactions: number;
  gross_revenue: number;
  total_refunds_given: number;
  net_revenue: number;
  total_vat_collected: number;
  total_discounts_given: number;
};

type DailySalesResponse = {
  branch_id: number;
  report_date: string;
  summary: DailySalesSummary;
  payment_breakdown: Record<string, number>;
};

type ShiftHistoryItem = {
  shift_id: number;
  username: string;
  full_name: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

type ShiftHistoryResponse = {
  status: string;
  branch_id: number;
  total_records: number;
  shifts: ShiftHistoryItem[];
};

type ShiftReportResponse = {
  shift_details: {
    shift_id: number;
    cashier: string;
    status: string;
    opened_at: string;
    closed_at: string;
  };
  financial_summary: {
    total_transactions: number;
    gross_revenue: number;
    total_refunds_given: number;
    net_revenue: number;
    total_vat_collected: number;
    total_discounts_given: number;
  };
  payment_breakdown: Record<string, number>;
};

type TrendPoint = {
  date: string;
  label: string;
  net: number;
  gross: number;
  tx: number;
};

type ShiftPerformanceRow = {
  shiftId: number;
  cashier: string;
  status: string;
  transactions: number;
  netRevenue: number;
  grossRevenue: number;
};

type FilterBranch = {
  branch_id: number;
  branch_name: string;
  branch_code: string;
};

type FilterCashier = {
  user_id: number;
  full_name: string;
};

type SalesComparisonSlice = {
  transactions: number;
  gross: number;
  refunds: number;
  net: number;
};

type ExtraTopProduct = {
  product_id: number;
  product_name: string;
  category: string;
  units_sold: number;
  net_sales: number;
};

type ExtraTopCategory = {
  category: string;
  net_sales: number;
  share_percent: number;
};

type ExtraRefundReason = {
  reason: string;
  count: number;
  amount: number;
};

type ExtraDiscountByCashier = {
  cashier: string;
  discounts: number;
  transactions: number;
};

type ExtraReconciliationRow = {
  shift_id: number;
  cashier: string;
  status: string;
  expected_cash: number | null;
  actual_cash: number | null;
  discrepancy: number | null;
  cash_sales: number;
  non_cash_sales: number;
};

type ExtraAlert = {
  type: "warning" | "info";
  message: string;
};

type SalesDashboardExtrasResponse = {
  filters: {
    branch_id: number | null;
    cashier_id: number | null;
    date: string;
  };
  comparison: {
    today: SalesComparisonSlice;
    yesterday: SalesComparisonSlice;
    this_week: SalesComparisonSlice;
    last_week: SalesComparisonSlice;
  };
  hourly_sales: Array<{
    hour: number;
    label: string;
    transactions: number;
    gross: number;
  }>;
  top_products: ExtraTopProduct[];
  top_categories: ExtraTopCategory[];
  refund_analytics: {
    refund_count: number;
    refund_amount: number;
    void_count: number;
    refund_by_reason: ExtraRefundReason[];
    discount_by_cashier: ExtraDiscountByCashier[];
  };
  profit_view: {
    net_sales: number;
    estimated_cogs: number;
    estimated_gross_profit: number;
  };
  reconciliation: ExtraReconciliationRow[];
  alerts: ExtraAlert[];
};

type TransactionRow = {
  sale_id: number;
  sale_time: string;
  cashier: string;
  payment_method: string;
  customer_type: string;
  total_amount: number;
  discount_total: number;
  refunded_amount: number;
  is_voided: boolean;
};

type TransactionsResponse = {
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  transactions: TransactionRow[];
};

const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

const PANEL_CARD_STYLE = {
  background:
    "linear-gradient(180deg, rgba(250,252,255,0.98) 0%, rgba(233,240,253,0.95) 100%)",
  border: "1px solid rgba(77,108,196,0.22)",
  boxShadow:
    "0 18px 48px rgba(1,24,84,0.16), inset 0 1px 0 rgba(255,255,255,0.88)",
};

const METRIC_CARD_STYLE = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(233,241,255,0.96) 100%)",
  border: "1px solid rgba(77,108,196,0.24)",
  boxShadow:
    "0 18px 42px rgba(1,24,84,0.18), inset 0 1px 0 rgba(255,255,255,0.88)",
};

const TABLE_CARD_STYLE = {
  border: "1px solid rgba(115,139,205,0.24)",
  background: "linear-gradient(180deg, #ffffff 0%, #f4f7ff 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(11,37,97,0.09)",
};

const PAYMENT_COLORS = ["#1d4ed8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateLabel = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

const peso = (amount: number) => `₱${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const changePercent = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const isAdminRole = () => (localStorage.getItem("user_role") || "").toLowerCase() === "admin";

export default function AdminSalesReportPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [selectedCashierId, setSelectedCashierId] = useState<string>("all");
  const [transactionPaymentFilter, setTransactionPaymentFilter] = useState<string>("ALL");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionPage, setTransactionPage] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingShift, setIsLoadingShift] = useState(false);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [dailySales, setDailySales] = useState<DailySalesResponse | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [shiftHistory, setShiftHistory] = useState<ShiftHistoryItem[]>([]);
  const [shiftPerformance, setShiftPerformance] = useState<ShiftPerformanceRow[]>([]);
  const [selectedShiftReport, setSelectedShiftReport] =
    useState<ShiftReportResponse | null>(null);
  const [reportBranches, setReportBranches] = useState<FilterBranch[]>([]);
  const [reportCashiers, setReportCashiers] = useState<FilterCashier[]>([]);
  const [salesExtras, setSalesExtras] = useState<SalesDashboardExtrasResponse | null>(null);
  const [transactionsData, setTransactionsData] = useState<TransactionsResponse | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  useEffect(() => {
    const loadFilters = async () => {
      const token = getToken();
      if (!token) return;

      const params = new URLSearchParams();
      if (selectedBranchId !== "all") {
        params.set("branch_id", selectedBranchId);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/pos/report-filters?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = (await response.json().catch(() => ({}))) as {
          branches?: FilterBranch[];
          cashiers?: FilterCashier[];
        };

        if (!response.ok) return;

        setReportBranches(Array.isArray(payload.branches) ? payload.branches : []);
        setReportCashiers(Array.isArray(payload.cashiers) ? payload.cashiers : []);

        if (selectedBranchId === "all" && !isAdminRole() && payload.branches && payload.branches.length > 0) {
          setSelectedBranchId(String(payload.branches[0].branch_id));
        }
      } catch {
        // Silent fallback keeps current page behavior.
      }
    };

    void loadFilters();
  }, [selectedBranchId]);

  useEffect(() => {
    const loadSalesDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = getToken();
        if (!token) {
          setError("No auth token found. Please log in again.");
          setDailySales(null);
          setShiftHistory([]);
          setTrend([]);
          setShiftPerformance([]);
          return;
        }

        const authHeaders = {
          Authorization: `Bearer ${token}`,
        };

        const query = new URLSearchParams({ date: selectedDate });
        if (selectedBranchId !== "all") query.set("branch_id", selectedBranchId);
        if (selectedCashierId !== "all") query.set("cashier_id", selectedCashierId);

        const [dailyResponse, shiftsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/pos/daily-sales?${query.toString()}`, {
            headers: authHeaders,
          }),
          fetch(`${API_BASE_URL}/pos/shift-history${selectedBranchId !== "all" ? `?branch_id=${selectedBranchId}` : ""}`, {
            headers: authHeaders,
          }),
        ]);

        const dailyData = await dailyResponse.json().catch(() => ({}));
        const shiftsData = await shiftsResponse.json().catch(() => ({}));

        if (!dailyResponse.ok) {
          setError(dailyData.message || dailyData.error || "Failed to load daily sales report.");
          setDailySales(null);
        } else {
          setDailySales(dailyData as DailySalesResponse);
        }

        if (!shiftsResponse.ok) {
          if (!dailyResponse.ok) {
            setError(shiftsData.message || shiftsData.error || "Failed to load shift history.");
          }
          setShiftHistory([]);
          setShiftPerformance([]);
        } else {
          const shiftRows = (shiftsData as ShiftHistoryResponse).shifts || [];
          setShiftHistory(shiftRows);

          const latestFiveShiftIds = shiftRows.slice(0, 5).map((shift) => shift.shift_id);
          const performanceReports = await Promise.all(
            latestFiveShiftIds.map(async (shiftId) => {
              try {
                const response = await fetch(`${API_BASE_URL}/pos/shift-report/${shiftId}`, {
                  headers: authHeaders,
                });
                if (!response.ok) return null;
                const data = (await response.json()) as ShiftReportResponse;
                return {
                  shiftId,
                  cashier: data.shift_details.cashier,
                  status: data.shift_details.status,
                  transactions: safeNumber(data.financial_summary.total_transactions),
                  netRevenue: safeNumber(data.financial_summary.net_revenue),
                  grossRevenue: safeNumber(data.financial_summary.gross_revenue),
                } as ShiftPerformanceRow;
              } catch {
                return null;
              }
            }),
          );

          setShiftPerformance(
            performanceReports
              .filter((row): row is ShiftPerformanceRow => row !== null)
              .sort((first, second) => second.netRevenue - first.netRevenue),
          );

          if (selectedShiftId !== null && !shiftRows.some((shift) => shift.shift_id === selectedShiftId)) {
            setSelectedShiftId(null);
            setSelectedShiftReport(null);
          }
        }

        const baseDate = new Date(selectedDate);
        const trendDates: string[] = [];
        for (let offset = 6; offset >= 0; offset -= 1) {
          const date = new Date(baseDate);
          date.setDate(baseDate.getDate() - offset);
          trendDates.push(toIsoDate(date));
        }

        const trendResponses = await Promise.all(
          trendDates.map(async (date) => {
            try {
              const response = await fetch(`${API_BASE_URL}/pos/daily-sales?date=${date}`, {
                headers: authHeaders,
              });
              if (!response.ok) {
                return { date, summary: { net_revenue: 0, gross_revenue: 0, total_transactions: 0 } };
              }
              const payload = (await response.json()) as DailySalesResponse;
              return {
                date,
                summary: {
                  net_revenue: safeNumber(payload.summary?.net_revenue),
                  gross_revenue: safeNumber(payload.summary?.gross_revenue),
                  total_transactions: safeNumber(payload.summary?.total_transactions),
                },
              };
            } catch {
              return { date, summary: { net_revenue: 0, gross_revenue: 0, total_transactions: 0 } };
            }
          }),
        );

        setTrend(
          trendResponses.map((point) => ({
            date: point.date,
            label: dateLabel(point.date),
            net: point.summary.net_revenue,
            gross: point.summary.gross_revenue,
            tx: point.summary.total_transactions,
          })),
        );

        setLastSync(new Date());
      } catch {
        setError("Network error while loading sales reports.");
        setDailySales(null);
        setShiftHistory([]);
        setTrend([]);
        setShiftPerformance([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSalesDashboard();
  }, [refreshVersion, selectedDate, selectedShiftId]);

  useEffect(() => {
    const loadExtras = async () => {
      setIsLoadingExtras(true);
      try {
        const token = getToken();
        if (!token) {
          setSalesExtras(null);
          return;
        }

        const query = new URLSearchParams({ date: selectedDate });
        if (selectedBranchId !== "all") query.set("branch_id", selectedBranchId);
        if (selectedCashierId !== "all") query.set("cashier_id", selectedCashierId);

        const response = await fetch(`${API_BASE_URL}/pos/sales-dashboard-extras?${query.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json().catch(() => null)) as SalesDashboardExtrasResponse | null;
        if (!response.ok || !payload) {
          setSalesExtras(null);
          return;
        }
        setSalesExtras(payload);
      } catch {
        setSalesExtras(null);
      } finally {
        setIsLoadingExtras(false);
      }
    };

    void loadExtras();
  }, [refreshVersion, selectedDate, selectedBranchId, selectedCashierId]);

  useEffect(() => {
    const loadTransactions = async () => {
      setIsLoadingTransactions(true);
      try {
        const token = getToken();
        if (!token) {
          setTransactionsData(null);
          return;
        }

        const query = new URLSearchParams({
          date: selectedDate,
          page: String(transactionPage),
          page_size: "15",
          payment_method: transactionPaymentFilter,
          search: transactionSearch,
        });
        if (selectedBranchId !== "all") query.set("branch_id", selectedBranchId);
        if (selectedCashierId !== "all") query.set("cashier_id", selectedCashierId);

        const response = await fetch(`${API_BASE_URL}/pos/transactions?${query.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = (await response.json().catch(() => null)) as TransactionsResponse | null;
        if (!response.ok || !payload) {
          setTransactionsData(null);
          return;
        }
        setTransactionsData(payload);
      } catch {
        setTransactionsData(null);
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    void loadTransactions();
  }, [
    selectedDate,
    selectedBranchId,
    selectedCashierId,
    transactionPage,
    transactionSearch,
    transactionPaymentFilter,
    refreshVersion,
  ]);

  useEffect(() => {
    const loadShiftReport = async () => {
      if (!selectedShiftId) {
        setSelectedShiftReport(null);
        return;
      }

      setIsLoadingShift(true);
      try {
        const token = getToken();
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/pos/shift-report/${selectedShiftId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          setSelectedShiftReport(null);
          return;
        }

        const payload = (await response.json()) as ShiftReportResponse;
        setSelectedShiftReport(payload);
      } catch {
        setSelectedShiftReport(null);
      } finally {
        setIsLoadingShift(false);
      }
    };

    void loadShiftReport();
  }, [selectedShiftId]);

  const summary = dailySales?.summary;

  const totalTransactions = safeNumber(summary?.total_transactions);
  const grossRevenue = safeNumber(summary?.gross_revenue);
  const netRevenue = safeNumber(summary?.net_revenue);
  const refunds = safeNumber(summary?.total_refunds_given);
  const discounts = safeNumber(summary?.total_discounts_given);
  const averageBasket = totalTransactions > 0 ? netRevenue / totalTransactions : 0;

  const paymentBreakdown = useMemo(() => {
    const entries = Object.entries(dailySales?.payment_breakdown || {});
    return entries.map(([method, amount], index) => ({
      name: method,
      value: safeNumber(amount),
      color: PAYMENT_COLORS[index % PAYMENT_COLORS.length],
    }));
  }, [dailySales]);

  const paymentTotal = paymentBreakdown.reduce((sum, item) => sum + item.value, 0);

  const comparison = salesExtras?.comparison;
  const hourlySales = salesExtras?.hourly_sales || [];
  const topProducts = salesExtras?.top_products || [];
  const topCategories = salesExtras?.top_categories || [];
  const refundAnalytics = salesExtras?.refund_analytics;
  const profitView = salesExtras?.profit_view;
  const reconciliation = salesExtras?.reconciliation || [];
  const alerts = salesExtras?.alerts || [];

  const todayNetChange = comparison
    ? changePercent(safeNumber(comparison.today.net), safeNumber(comparison.yesterday.net))
    : 0;
  const weekNetChange = comparison
    ? changePercent(safeNumber(comparison.this_week.net), safeNumber(comparison.last_week.net))
    : 0;

  const exportCsv = (type: "summary" | "transactions") => {
    const token = getToken();
    if (!token) return;

    const query = new URLSearchParams({ date: selectedDate });
    if (selectedBranchId !== "all") query.set("branch_id", selectedBranchId);

    const path =
      type === "summary"
        ? `${API_BASE_URL}/pos/export/daily-summary.csv?${query.toString()}`
        : `${API_BASE_URL}/pos/export/transactions.csv?${query.toString()}`;

    fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Export failed");
        const blob = await response.blob();
        const href = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = type === "summary" ? `daily-summary-${selectedDate}.csv` : `transactions-${selectedDate}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(href);
      })
      .catch(() => {
        setError("Failed to export CSV file.");
      });
  };

  return (
    <div
      className="min-h-screen w-full overflow-y-auto overflow-x-hidden relative"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(113,160,255,0.18) 0%, transparent 26%), radial-gradient(circle at top right, rgba(11,49,153,0.28) 0%, transparent 30%), linear-gradient(180deg, #041f63 0%, #0b3499 42%, #2c63e0 100%)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[320px] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
      <div
        className="absolute -top-24 -left-16 w-72 h-72 rounded-full blur-3xl pointer-events-none"
        style={{ background: "rgba(124, 160, 255, 0.18)" }}
      />
      <div
        className="absolute top-40 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: "rgba(8, 29, 96, 0.22)" }}
      />

      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItem="Sales Reports"
      />

      <div className="relative z-10 w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 sm:py-6 flex flex-col gap-4 sm:gap-5">
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          currentTime={currentTime}
          lastSync={lastSync}
          isOnline={isOnline}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-[11px] font-bold tracking-[0.35em] uppercase"
              style={{ color: "rgba(216,231,255,0.66)" }}
            >
              Sales Overview
            </p>
            <h2
              className="font-bold text-xl sm:text-2xl tracking-wide mt-1"
              style={{ color: "rgba(245,249,255,0.96)" }}
            >
              Sales Reports
            </h2>
            <p className="text-xs sm:text-sm mt-1" style={{ color: "rgba(218,232,255,0.74)" }}>
              Daily and shift-level performance from POS transactions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="relative flex items-center gap-2 h-9 sm:h-11 px-3 sm:px-4 rounded-2xl"
              style={{
                minWidth: "180px",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(226,235,255,0.93) 100%)",
                border: "1px solid rgba(112,136,214,0.34)",
                boxShadow:
                  "0 16px 32px rgba(3,31,99,0.22), inset 0 1px 0 rgba(255,255,255,0.85)",
              }}
            >
              <Calendar size={14} className="sm:w-4 sm:h-4 text-[#103182]" />
              <input
                type="date"
                value={selectedDate}
                max={toIsoDate(new Date())}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="bg-transparent outline-none text-xs sm:text-sm font-semibold text-[#103182]"
              />
              <ChevronDown size={14} className="sm:w-4 sm:h-4 text-[#103182] shrink-0" />
            </div>

            <button
              type="button"
              onClick={() => setRefreshVersion((value) => value + 1)}
              className="h-9 sm:h-11 px-3 sm:px-4 rounded-2xl text-xs sm:text-sm font-bold text-white transition-opacity hover:opacity-90 flex items-center gap-1.5 sm:gap-2"
              style={{
                background: "linear-gradient(180deg, #2449ff 0%, #1133f2 100%)",
                border: "1px solid rgba(183,205,255,0.28)",
                boxShadow: "0 12px 24px rgba(2,24,95,0.28)",
              }}
            >
              <RefreshCw size={13} className="sm:w-4 sm:h-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => exportCsv("summary")}
              className="h-9 sm:h-11 px-3 sm:px-4 rounded-2xl text-xs sm:text-sm font-bold text-[#062d8c] transition-opacity hover:opacity-90 flex items-center gap-1.5 sm:gap-2"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(235,242,255,0.96) 100%)",
                border: "1px solid rgba(183,205,255,0.8)",
              }}
            >
              <Download size={12} className="sm:w-4 sm:h-4" /> Export Summary
            </button>
            <button
              type="button"
              onClick={() => exportCsv("transactions")}
              className="h-9 sm:h-11 px-3 sm:px-4 rounded-2xl text-xs sm:text-sm font-bold text-[#062d8c] transition-opacity hover:opacity-90 flex items-center gap-1.5 sm:gap-2"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(235,242,255,0.96) 100%)",
                border: "1px solid rgba(183,205,255,0.8)",
              }}
            >
              <Download size={12} className="sm:w-4 sm:h-4" /> Export Transactions
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 sm:h-11 px-3 sm:px-4 rounded-2xl text-xs sm:text-sm font-bold text-[#062d8c] transition-opacity hover:opacity-90 flex items-center gap-1.5 sm:gap-2"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(235,242,255,0.96) 100%)",
                border: "1px solid rgba(183,205,255,0.8)",
              }}
            >
              <Printer size={12} className="sm:w-4 sm:h-4" /> Print / PDF
            </button>
          </div>
        </div>

        <div className="rounded-xl p-3 sm:p-4" style={TABLE_CARD_STYLE}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Branch</p>
              <select
                value={selectedBranchId}
                onChange={(event) => {
                  setSelectedBranchId(event.target.value);
                  setTransactionPage(1);
                }}
                className="h-9 sm:h-10 w-full rounded-xl border border-[#cfdaf7] px-3 text-xs sm:text-sm font-semibold text-[#103182] bg-white"
              >
                {isAdminRole() ? <option value="all">All Branches</option> : null}
                {reportBranches.map((branch) => (
                  <option key={branch.branch_id} value={String(branch.branch_id)}>
                    {branch.branch_name} ({branch.branch_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Cashier</p>
              <select
                value={selectedCashierId}
                onChange={(event) => {
                  setSelectedCashierId(event.target.value);
                  setTransactionPage(1);
                }}
                className="h-9 sm:h-10 w-full rounded-xl border border-[#cfdaf7] px-3 text-xs sm:text-sm font-semibold text-[#103182] bg-white"
              >
                <option value="all">All Cashiers</option>
                {reportCashiers.map((cashier) => (
                  <option key={cashier.user_id} value={String(cashier.user_id)}>
                    {cashier.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Payment</p>
              <select
                value={transactionPaymentFilter}
                onChange={(event) => {
                  setTransactionPaymentFilter(event.target.value);
                  setTransactionPage(1);
                }}
                className="h-9 sm:h-10 w-full rounded-xl border border-[#cfdaf7] px-3 text-xs sm:text-sm font-semibold text-[#103182] bg-white"
              >
                <option value="ALL">All Payments</option>
                <option value="CASH">Cash</option>
                <option value="GCASH">GCash</option>
                <option value="CARD">Card</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Receipt / Cashier Search</p>
              <input
                type="text"
                value={transactionSearch}
                onChange={(event) => {
                  setTransactionSearch(event.target.value);
                  setTransactionPage(1);
                }}
                placeholder="e.g., 1042 or Maria"
                className="h-9 sm:h-10 w-full rounded-xl border border-[#cfdaf7] px-3 text-xs sm:text-sm font-semibold text-[#103182] bg-white outline-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              background: "rgba(255,255,255,0.14)",
              color: "#f4f7ff",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            {error}
          </div>
        )}

        {alerts.length > 0 && (
          <div className="rounded-xl p-4" style={TABLE_CARD_STYLE}>
            <p className="text-sm font-bold text-[#062d8c] mb-2">KPI Alerts</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {alerts.map((item, index) => (
                <div
                  key={`${item.message}-${index}`}
                  className="rounded-lg px-3 py-2 text-sm font-semibold flex items-start gap-2"
                  style={{
                    background: item.type === "warning" ? "rgba(255,195,0,0.14)" : "rgba(17,51,242,0.12)",
                    color: item.type === "warning" ? "#7d5a00" : "#103182",
                    border: "1px solid rgba(112,136,214,0.3)",
                  }}
                >
                  <AlertTriangle size={14} className="mt-0.5" /> {item.message}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl p-4" style={TABLE_CARD_STYLE}>
            <p className="text-sm font-bold text-[#062d8c]">Today vs Yesterday</p>
            <p className="text-xs text-slate-500 mb-3">Performance change for selected filters</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                <p className="text-xs text-slate-500">Net Sales Change</p>
                <p className="font-black text-lg" style={{ color: todayNetChange >= 0 ? "#00a83d" : "#c62828" }}>
                  {isLoadingExtras ? "-" : `${todayNetChange >= 0 ? "+" : ""}${todayNetChange.toFixed(1)}%`}
                </p>
              </div>
              <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                <p className="text-xs text-slate-500">Transactions Change</p>
                <p className="font-black text-lg" style={{ color: "#1536ef" }}>
                  {isLoadingExtras || !comparison
                    ? "-"
                    : `${comparison.today.transactions - comparison.yesterday.transactions >= 0 ? "+" : ""}${comparison.today.transactions - comparison.yesterday.transactions}`}
                </p>
              </div>
              <div className="rounded-lg bg-[#f7f9ff] px-3 py-2">
                <p className="text-xs text-slate-500">Today Net</p>
                <p className="font-bold text-[#062d8c]">
                  {comparison ? peso(comparison.today.net) : "-"}
                </p>
              </div>
              <div className="rounded-lg bg-[#f7f9ff] px-3 py-2">
                <p className="text-xs text-slate-500">Yesterday Net</p>
                <p className="font-bold text-[#062d8c]">
                  {comparison ? peso(comparison.yesterday.net) : "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-4" style={TABLE_CARD_STYLE}>
            <p className="text-sm font-bold text-[#062d8c]">This Week vs Last Week</p>
            <p className="text-xs text-slate-500 mb-3">Rolling 7-day comparison</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                <p className="text-xs text-slate-500">Net Sales Change</p>
                <p className="font-black text-lg" style={{ color: weekNetChange >= 0 ? "#00a83d" : "#c62828" }}>
                  {isLoadingExtras ? "-" : `${weekNetChange >= 0 ? "+" : ""}${weekNetChange.toFixed(1)}%`}
                </p>
              </div>
              <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                <p className="text-xs text-slate-500">Transactions Change</p>
                <p className="font-black text-lg text-[#1536ef]">
                  {isLoadingExtras || !comparison
                    ? "-"
                    : `${comparison.this_week.transactions - comparison.last_week.transactions >= 0 ? "+" : ""}${comparison.this_week.transactions - comparison.last_week.transactions}`}
                </p>
              </div>
              <div className="rounded-lg bg-[#f7f9ff] px-3 py-2">
                <p className="text-xs text-slate-500">This Week Net</p>
                <p className="font-bold text-[#062d8c]">{comparison ? peso(comparison.this_week.net) : "-"}</p>
              </div>
              <div className="rounded-lg bg-[#f7f9ff] px-3 py-2">
                <p className="text-xs text-slate-500">Last Week Net</p>
                <p className="font-bold text-[#062d8c]">{comparison ? peso(comparison.last_week.net) : "-"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] p-5 sm:p-6" style={PANEL_CARD_STYLE}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}>
              <p className="text-base font-extrabold tracking-wide uppercase" style={{ color: "#062d8c" }}>
                Gross Sales
              </p>
              <p className="mt-2 leading-none" style={{ color: "#062d8c", fontSize: "2.2rem", fontWeight: 800 }}>
                {isLoading ? "—" : peso(grossRevenue)}
              </p>
              <div className="mt-3 text-xs font-semibold text-slate-600 flex items-center gap-2">
                <TrendingUp size={14} /> Before refunds
              </div>
            </div>

            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}>
              <p className="text-base font-extrabold tracking-wide uppercase" style={{ color: "#062d8c" }}>
                Net Sales
              </p>
              <p className="mt-2 leading-none" style={{ color: "#00a83d", fontSize: "2.2rem", fontWeight: 800 }}>
                {isLoading ? "—" : peso(netRevenue)}
              </p>
              <div className="mt-3 text-xs font-semibold text-slate-600 flex items-center gap-2">
                <Wallet size={14} /> After refunds
              </div>
            </div>

            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}>
              <p className="text-base font-extrabold tracking-wide uppercase" style={{ color: "#062d8c" }}>
                Transactions
              </p>
              <p className="mt-2 leading-none" style={{ color: "#1536ef", fontSize: "2.2rem", fontWeight: 800 }}>
                {isLoading ? "—" : totalTransactions.toLocaleString()}
              </p>
              <div className="mt-3 text-xs font-semibold text-slate-600 flex items-center gap-2">
                <Receipt size={14} /> Receipts issued
              </div>
            </div>

            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}>
              <p className="text-base font-extrabold tracking-wide uppercase" style={{ color: "#062d8c" }}>
                Avg Basket
              </p>
              <p className="mt-2 leading-none" style={{ color: "#c89400", fontSize: "2.2rem", fontWeight: 800 }}>
                {isLoading ? "—" : peso(averageBasket)}
              </p>
              <div className="mt-3 text-xs font-semibold text-slate-600 flex items-center gap-2">
                <CreditCard size={14} /> Net ÷ transactions
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
            <div className="xl:col-span-2 rounded-xl p-4" style={TABLE_CARD_STYLE}>
              <p className="text-sm font-bold text-[#062d8c] mb-1">7-Day Sales Trend</p>
              <p className="text-xs text-slate-500 mb-3">Net and gross revenue up to {dateLabel(selectedDate)}</p>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d8e2ff" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#6b7bb8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6b7bb8" />
                    <Tooltip
                      formatter={(value: unknown, name: unknown) => [
                        peso(safeNumber(value)),
                        String(name) === "net" ? "Net" : "Gross",
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line type="monotone" dataKey="net" stroke="#16a34a" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="gross" stroke="#1d4ed8" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl p-4" style={TABLE_CARD_STYLE}>
              <p className="text-sm font-bold text-[#062d8c] mb-1">Payment Mix</p>
              <p className="text-xs text-slate-500 mb-3">Distribution by payment method</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBreakdown.length > 0 ? paymentBreakdown : [{ name: "No Data", value: 1, color: "#cbd5e1" }]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {(paymentBreakdown.length > 0 ? paymentBreakdown : [{ color: "#cbd5e1" }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: unknown) => peso(safeNumber(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 space-y-2">
                {paymentBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-500">No payment data for this date.</p>
                ) : (
                  paymentBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="font-semibold text-slate-700">{item.name}</span>
                      </div>
                      <div className="font-bold text-[#0b2f9f]">
                        {peso(item.value)}
                        <span className="ml-1 text-slate-500 font-medium">
                          ({paymentTotal > 0 ? ((item.value / paymentTotal) * 100).toFixed(1) : "0.0"}%)
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl p-4" style={TABLE_CARD_STYLE}>
              <p className="text-sm font-bold text-[#062d8c] mb-1">Hourly Sales</p>
              <p className="text-xs text-slate-500 mb-3">Intraday gross revenue and transactions</p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlySales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d8e2ff" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#6b7bb8" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#6b7bb8" />
                    <Tooltip
                      formatter={(value: unknown, name: unknown) =>
                        String(name) === "gross" ? [peso(safeNumber(value)), "Gross"] : [safeNumber(value), "Transactions"]
                      }
                    />
                    <Bar dataKey="gross" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
            <div className="xl:col-span-2 rounded-xl overflow-hidden" style={TABLE_CARD_STYLE}>
              <div className="px-4 py-3 border-b border-[#dbe3f7]">
                <p className="text-sm font-bold text-[#062d8c]">Top Selling Products</p>
                <p className="text-xs text-slate-500">Top 10 ranked by net sales</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="bg-[#e8eefb] text-[#062d8c]">
                      <th className="px-3 py-2 text-left text-xs font-bold">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">Category</th>
                      <th className="px-3 py-2 text-right text-xs font-bold">Units</th>
                      <th className="px-3 py-2 text-right text-xs font-bold">Net Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-slate-500 text-sm">
                          No product sales data for selected filters.
                        </td>
                      </tr>
                    ) : (
                      topProducts.map((item, index) => (
                        <tr key={item.product_id} style={{ background: index % 2 === 0 ? "#f7f9ff" : "#edf2ff" }}>
                          <td className="px-3 py-2 text-[#001d63] font-semibold">{item.product_name}</td>
                          <td className="px-3 py-2 text-[#001d63]">{item.category}</td>
                          <td className="px-3 py-2 text-right text-[#001d63]">{item.units_sold.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-bold text-[#0f38c9]">{peso(item.net_sales)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl p-4" style={TABLE_CARD_STYLE}>
              <p className="text-sm font-bold text-[#062d8c] mb-1">Category Contribution</p>
              <p className="text-xs text-slate-500 mb-3">Share of net sales by category</p>
              <div className="space-y-2">
                {topCategories.length === 0 ? (
                  <p className="text-xs text-slate-500">No category data yet.</p>
                ) : (
                  topCategories.map((category) => (
                    <div key={category.category} className="rounded-lg bg-[#eef3ff] px-3 py-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#103182]">
                        <span>{category.category}</span>
                        <span>{category.share_percent.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 text-sm font-bold text-[#062d8c]">{peso(category.net_sales)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl overflow-hidden" style={TABLE_CARD_STYLE}>
              <div className="px-4 py-3 border-b border-[#dbe3f7]">
                <p className="text-sm font-bold text-[#062d8c]">Shift Performance (Recent 5)</p>
                <p className="text-xs text-slate-500">Ranked by net revenue</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px] text-sm">
                  <thead>
                    <tr className="bg-[#e8eefb] text-[#062d8c]">
                      <th className="px-3 py-2 text-left text-xs font-bold">Shift</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">Cashier</th>
                      <th className="px-3 py-2 text-left text-xs font-bold">Status</th>
                      <th className="px-3 py-2 text-right text-xs font-bold">Tx</th>
                      <th className="px-3 py-2 text-right text-xs font-bold">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-500 text-sm">
                          No shift performance data yet.
                        </td>
                      </tr>
                    ) : (
                      shiftPerformance.map((row, index) => (
                        <tr
                          key={row.shiftId}
                          className="cursor-pointer hover:brightness-95"
                          style={{ background: index % 2 === 0 ? "#f7f9ff" : "#edf2ff" }}
                          onClick={() => setSelectedShiftId(row.shiftId)}
                        >
                          <td className="px-3 py-2 text-[#001d63] font-semibold">#{row.shiftId}</td>
                          <td className="px-3 py-2 text-[#001d63]">{row.cashier}</td>
                          <td className="px-3 py-2 text-[#001d63]">{row.status}</td>
                          <td className="px-3 py-2 text-right text-[#001d63]">{row.transactions}</td>
                          <td className="px-3 py-2 text-right font-bold text-[#0f38c9]">{peso(row.netRevenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={TABLE_CARD_STYLE}>
              <div className="px-4 py-3 border-b border-[#dbe3f7] flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-[#062d8c]">Shift Details</p>
                  <p className="text-xs text-slate-500">Select a shift to inspect</p>
                </div>
                <div className="relative">
                  <select
                    value={selectedShiftId ?? ""}
                    onChange={(event) =>
                      setSelectedShiftId(event.target.value ? Number(event.target.value) : null)
                    }
                    className="h-9 rounded-xl border border-[#cfdaf7] px-3 pr-8 text-sm font-semibold text-[#103182] bg-white"
                  >
                    <option value="">Latest Shift</option>
                    {shiftHistory.slice(0, 20).map((shift) => (
                      <option key={shift.shift_id} value={shift.shift_id}>
                        Shift #{shift.shift_id} · {shift.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 space-y-3 text-sm">
                {isLoadingShift ? (
                  <p className="text-slate-500">Loading shift report...</p>
                ) : selectedShiftReport ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                        <p className="text-xs text-slate-500">Cashier</p>
                        <p className="font-bold text-[#062d8c]">{selectedShiftReport.shift_details.cashier}</p>
                      </div>
                      <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                        <p className="text-xs text-slate-500">Status</p>
                        <p className="font-bold text-[#062d8c]">{selectedShiftReport.shift_details.status}</p>
                      </div>
                      <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                        <p className="text-xs text-slate-500">Transactions</p>
                        <p className="font-bold text-[#062d8c]">
                          {selectedShiftReport.financial_summary.total_transactions}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                        <p className="text-xs text-slate-500">Net Revenue</p>
                        <p className="font-bold text-[#00a83d]">
                          {peso(selectedShiftReport.financial_summary.net_revenue)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#f7f9ff] px-3 py-2">
                      <p className="text-xs text-slate-500">Opened</p>
                      <p className="font-medium text-[#001d63]">{selectedShiftReport.shift_details.opened_at}</p>
                      <p className="text-xs text-slate-500 mt-2">Closed</p>
                      <p className="font-medium text-[#001d63]">{selectedShiftReport.shift_details.closed_at}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500">Pick a shift to view its detailed report.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={TABLE_CARD_STYLE}>
              <div className="px-4 py-3 border-b border-[#dbe3f7]">
                <p className="text-sm font-bold text-[#062d8c]">Refund and Void Analytics</p>
                <p className="text-xs text-slate-500">Refund reasons and discount concentration</p>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                    <p className="text-xs text-slate-500">Refund Count</p>
                    <p className="font-black text-[#0f38c9]">{refundAnalytics?.refund_count ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                    <p className="text-xs text-slate-500">Refund Amount</p>
                    <p className="font-black text-[#c62828]">{peso(refundAnalytics?.refund_amount ?? 0)}</p>
                  </div>
                  <div className="rounded-lg bg-[#eef3ff] px-3 py-2">
                    <p className="text-xs text-slate-500">Voided Receipts</p>
                    <p className="font-black text-[#7d5a00]">{refundAnalytics?.void_count ?? 0}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-[#f7f9ff] px-3 py-2">
                  <p className="text-xs font-bold uppercase text-slate-500 mb-2">Refund Reasons</p>
                  {(refundAnalytics?.refund_by_reason || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No refunds posted for this date.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(refundAnalytics?.refund_by_reason || []).map((item) => (
                        <div key={item.reason} className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">{item.reason}</span>
                          <span className="font-bold text-[#0b2f9f]">
                            {item.count} • {peso(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-[#f7f9ff] px-3 py-2">
                  <p className="text-xs font-bold uppercase text-slate-500 mb-2">Discounts by Cashier</p>
                  {(refundAnalytics?.discount_by_cashier || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No discount data for this selection.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(refundAnalytics?.discount_by_cashier || []).slice(0, 5).map((item) => (
                        <div key={item.cashier} className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">{item.cashier}</span>
                          <span className="font-bold text-[#0b2f9f]">
                            {peso(item.discounts)} ({item.transactions} tx)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl px-4 py-3" style={TABLE_CARD_STYLE}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estimated Net Sales</p>
              <p className="text-xl font-black text-[#0f38c9]">{peso(profitView?.net_sales ?? 0)}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={TABLE_CARD_STYLE}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estimated COGS</p>
              <p className="text-xl font-black text-[#7d5a00]">{peso(profitView?.estimated_cogs ?? 0)}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={TABLE_CARD_STYLE}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Estimated Gross Profit</p>
              <p className="text-xl font-black text-[#00a83d]">{peso(profitView?.estimated_gross_profit ?? 0)}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl overflow-hidden" style={TABLE_CARD_STYLE}>
            <div className="px-4 py-3 border-b border-[#dbe3f7]">
              <p className="text-sm font-bold text-[#062d8c]">Payment Reconciliation by Shift</p>
              <p className="text-xs text-slate-500">Expected vs actual cash and shift variance</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="bg-[#e8eefb] text-[#062d8c]">
                    <th className="px-3 py-2 text-left text-xs font-bold">Shift</th>
                    <th className="px-3 py-2 text-left text-xs font-bold">Cashier</th>
                    <th className="px-3 py-2 text-left text-xs font-bold">Status</th>
                    <th className="px-3 py-2 text-right text-xs font-bold">Cash Sales</th>
                    <th className="px-3 py-2 text-right text-xs font-bold">Non-Cash</th>
                    <th className="px-3 py-2 text-right text-xs font-bold">Expected</th>
                    <th className="px-3 py-2 text-right text-xs font-bold">Actual</th>
                    <th className="px-3 py-2 text-right text-xs font-bold">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-slate-500 text-sm">
                        No reconciliation rows available.
                      </td>
                    </tr>
                  ) : (
                    reconciliation.map((row, index) => (
                      <tr key={row.shift_id} style={{ background: index % 2 === 0 ? "#f7f9ff" : "#edf2ff" }}>
                        <td className="px-3 py-2 text-[#001d63] font-semibold">#{row.shift_id}</td>
                        <td className="px-3 py-2 text-[#001d63]">{row.cashier}</td>
                        <td className="px-3 py-2 text-[#001d63]">{row.status}</td>
                        <td className="px-3 py-2 text-right text-[#001d63]">{peso(row.cash_sales)}</td>
                        <td className="px-3 py-2 text-right text-[#001d63]">{peso(row.non_cash_sales)}</td>
                        <td className="px-3 py-2 text-right text-[#001d63]">{row.expected_cash !== null ? peso(row.expected_cash) : "-"}</td>
                        <td className="px-3 py-2 text-right text-[#001d63]">{row.actual_cash !== null ? peso(row.actual_cash) : "-"}</td>
                        <td
                          className="px-3 py-2 text-right font-bold"
                          style={{ color: row.discrepancy !== null && row.discrepancy < 0 ? "#c62828" : "#0f38c9" }}
                        >
                          {row.discrepancy !== null ? peso(row.discrepancy) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 rounded-xl overflow-hidden" style={TABLE_CARD_STYLE}>
            <div className="px-4 py-3 border-b border-[#dbe3f7] flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-[#062d8c]">Transaction Drilldown</p>
                <p className="text-xs text-slate-500">Receipt-level data for audit and investigation</p>
              </div>
              <div className="text-xs font-semibold text-slate-500">
                {transactionsData ? `${transactionsData.total_records} records` : "0 records"}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="bg-[#e8eefb] text-[#062d8c]">
                    <th className="px-3 py-2 text-left text-xs font-bold">Receipt</th>
                    <th className="px-3 py-2 text-left text-xs font-bold">Time</th>
                    <th className="px-3 py-2 text-left text-xs font-bold">Cashier</th>
                    <th className="px-3 py-2 text-left text-xs font-bold">Payment</th>
                    <th className="px-3 py-2 text-left text-xs font-bold">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-bold">Total</th>
                    <th className="px-3 py-2 text-right text-xs font-bold">Discount</th>
                    <th className="px-3 py-2 text-right text-xs font-bold">Refunded</th>
                    <th className="px-3 py-2 text-left text-xs font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingTransactions ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-slate-500 text-sm">
                        Loading transactions...
                      </td>
                    </tr>
                  ) : (transactionsData?.transactions || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-slate-500 text-sm">
                        No transactions for selected filters.
                      </td>
                    </tr>
                  ) : (
                    (transactionsData?.transactions || []).map((row, index) => (
                      <tr key={row.sale_id} style={{ background: index % 2 === 0 ? "#f7f9ff" : "#edf2ff" }}>
                        <td className="px-3 py-2 text-[#001d63] font-semibold">#{row.sale_id}</td>
                        <td className="px-3 py-2 text-[#001d63]">{row.sale_time}</td>
                        <td className="px-3 py-2 text-[#001d63]">{row.cashier}</td>
                        <td className="px-3 py-2 text-[#001d63]">{row.payment_method}</td>
                        <td className="px-3 py-2 text-[#001d63]">{row.customer_type}</td>
                        <td className="px-3 py-2 text-right font-bold text-[#0f38c9]">{peso(row.total_amount)}</td>
                        <td className="px-3 py-2 text-right text-[#7d5a00]">{peso(row.discount_total)}</td>
                        <td className="px-3 py-2 text-right text-[#c62828]">{peso(row.refunded_amount)}</td>
                        <td className="px-3 py-2 text-[#001d63]">{row.is_voided ? "Voided" : "Valid"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-[#dbe3f7] flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {transactionsData?.page || 1} of {transactionsData?.total_pages || 1}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={(transactionsData?.page || 1) <= 1}
                  onClick={() => setTransactionPage((page) => Math.max(1, page - 1))}
                  className="h-9 px-3 rounded-xl text-xs font-bold disabled:opacity-40"
                  style={{ background: "#efefef", color: "#0b0b0b", border: "1px solid #dad8d8" }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={(transactionsData?.page || 1) >= (transactionsData?.total_pages || 1)}
                  onClick={() => setTransactionPage((page) => page + 1)}
                  className="h-9 px-3 rounded-xl text-xs font-bold disabled:opacity-40"
                  style={{ background: "#efefef", color: "#0b0b0b", border: "1px solid #dad8d8" }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl px-4 py-3" style={TABLE_CARD_STYLE}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Refunds</p>
              <p className="text-xl font-black text-[#c62828]">{peso(refunds)}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={TABLE_CARD_STYLE}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Discounts</p>
              <p className="text-xl font-black text-[#c89400]">{peso(discounts)}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={TABLE_CARD_STYLE}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">VAT Collected</p>
              <p className="text-xl font-black text-[#0f38c9]">{peso(safeNumber(summary?.total_vat_collected))}</p>
            </div>
          </div>
        </div>

        <AdminFooter lastSync={lastSync} />
      </div>
    </div>
  );
}
