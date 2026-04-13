import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  AlertCircle,
  Clock,
  TrendingUp,
  Package,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminFooter from "../../components/admin/AdminFooter";
import LowStocksModal from "../../components/admin/LowStocksModal";
import NearExpiryModal from "../../components/admin/NearExpiryModal";
import { getToken } from "../../hooks/useAuth";
import {
  getDashboardMetrics as fetchDashboardMetrics,
  getLowStockItems,
  getNearExpiryItems,
  getSalesTrend,
  getStockDistribution,
  type DashboardMetrics,
  type LowStockItem,
  type NearExpiryItem,
  type SalesTrendData,
  type StockDistributionData,
} from "../../api/dashboard";

// ─── Types ─────────────────────────────────────────────────────────────────────

type TrendTab = "Week" | "Month" | "Year";

interface SalesDataPoint {
  day: string;
  sales: number;
}

interface StockSegment {
  name: string;
  value: number;
  color: string;
}

interface ApiInventoryItem {
  inventory_id: number;
  product_id: number;
  product_name: string;
  category?: string;
  barcode?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  quantity_on_hand: number;
  price?: number;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const salesTrendWeek: SalesDataPoint[] = [
  { day: "Mon", sales: 520 },
  { day: "Tue", sales: 560 },
  { day: "Wed", sales: 390 },
  { day: "Thu", sales: 620 },
  { day: "Fri", sales: 640 },
  { day: "Sat", sales: 660 },
  { day: "Sun", sales: 870 },
];

const salesTrendMonth: SalesDataPoint[] = [
  { day: "W1", sales: 18000 },
  { day: "W2", sales: 22000 },
  { day: "W3", sales: 19500 },
  { day: "W4", sales: 24000 },
];

const salesTrendYear: SalesDataPoint[] = [
  { day: "Jan", sales: 150000 },
  { day: "Feb", sales: 162000 },
  { day: "Mar", sales: 175000 },
  { day: "Apr", sales: 158000 },
  { day: "May", sales: 190000 },
  { day: "Jun", sales: 210000 },
  { day: "Jul", sales: 225000 },
  { day: "Aug", sales: 198000 },
  { day: "Sep", sales: 230000 },
  { day: "Oct", sales: 245000 },
  { day: "Nov", sales: 260000 },
  { day: "Dec", sales: 285000 },
];

const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

const BRANCHES = [
  {
    value: "BMC MAIN",
    address: "#6A J. Miranda Ave., Concepcion Pequeña, Naga City",
  },
  {
    value: "DIVERSION BRANCH",
    address: "Roxas Avenue, Diversion Road, Triangulo, Naga City",
  },
  {
    value: "PANGANIBAN BRANCH",
    address: "Door 11 & 12, Pavilion 7, Panganiban Drive, Naga City",
  },
];

const TREND_TABS: TrendTab[] = ["Week", "Month", "Year"];
const LOW_STOCK_THRESHOLD = 10;

const BRANCH_ID_BY_NAME: Record<string, number> = {
  "BMC MAIN": 1,
  "DIVERSION BRANCH": 2,
  "PANGANIBAN BRANCH": 3,
};

const METRIC_CARD_STYLE = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(233,241,255,0.96) 100%)",
  border: "1px solid rgba(77,108,196,0.24)",
  boxShadow:
    "0 18px 42px rgba(1,24,84,0.18), inset 0 1px 0 rgba(255,255,255,0.88)",
};

const PANEL_CARD_STYLE = {
  background:
    "linear-gradient(180deg, rgba(250,252,255,0.98) 0%, rgba(233,240,253,0.95) 100%)",
  border: "1px solid rgba(77,108,196,0.22)",
  boxShadow:
    "0 18px 48px rgba(1,24,84,0.16), inset 0 1px 0 rgba(255,255,255,0.88)",
};

const TABLE_CARD_STYLE = {
  border: "1px solid rgba(115,139,205,0.24)",
  background: "linear-gradient(180deg, #ffffff 0%, #f4f7ff 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(11,37,97,0.09)",
};

const formatDeltaLabel = (
  currentValue: number,
  previousValue: number | null,
  positiveLabel: string,
  negativeLabel: string,
): string => {
  if (previousValue === null) return "Baseline from first sync";
  const delta = currentValue - previousValue;
  if (delta === 0) return "No change from last sync";
  if (delta > 0) return `+${delta} ${positiveLabel} vs last sync`;
  return `${delta} ${negativeLabel} vs last sync`;
};

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [trendTab, setTrendTab] = useState<TrendTab>("Week");
  const [selectedBranch, setSelectedBranch] = useState<string>("BMC MAIN");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lowStocksModalOpen, setLowStocksModalOpen] = useState<boolean>(false);
  const [nearExpiryModalOpen, setNearExpiryModalOpen] =
    useState<boolean>(false);
  const [isKeybindHelpOpen, setIsKeybindHelpOpen] = useState<boolean>(false);
  const [inventoryItems, setInventoryItems] = useState<ApiInventoryItem[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState<number>(0);
  const [previousMetrics, setPreviousMetrics] = useState<DashboardMetrics | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [nearExpiryItems, setNearExpiryItems] = useState<NearExpiryItem[]>([]);
  const [salesTrendData, setSalesTrendData] = useState<SalesTrendData[]>([]);
  const [stockDistributionData, setStockDistributionData] = useState<StockDistributionData[]>([]);
  const branchSelectRef = useRef<HTMLSelectElement | null>(null);

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
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = Boolean(
        target?.closest("input, textarea, [contenteditable='true'], select"),
      );

      if (event.key === "Tab") {
        if (!isTypingTarget) {
          event.preventDefault();
          setIsKeybindHelpOpen((previous) => !previous);
        }
        return;
      }

      if (isKeybindHelpOpen && event.key === "Escape") {
        event.preventDefault();
        setIsKeybindHelpOpen(false);
        return;
      }

      if (isTypingTarget || isKeybindHelpOpen) return;

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleSyncNow();
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setLowStocksModalOpen(true);
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setNearExpiryModalOpen(true);
        return;
      }

      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        branchSelectRef.current?.focus();
        branchSelectRef.current?.click();
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        setTrendTab("Week");
        return;
      }

      if (event.key === "2") {
        event.preventDefault();
        setTrendTab("Month");
        return;
      }

      if (event.key === "3") {
        event.preventDefault();
        setTrendTab("Year");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isKeybindHelpOpen]);

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoadingDashboard(true);
      setDashboardError(null);
      setPreviousMetrics(dashboardMetrics);

      try {
        const branchId = BRANCH_ID_BY_NAME[selectedBranch] || 1;

        // Fetch all dashboard data in parallel
        const [
          metricsResponse,
          lowStockResponse,
          nearExpiryResponse,
          salesTrendResponse,
          stockDistributionResponse,
          inventoryResponse
        ] = await Promise.allSettled([
          fetchDashboardMetrics(branchId),
          getLowStockItems(branchId),
          getNearExpiryItems(branchId),
          getSalesTrend(branchId, trendTab.toLowerCase() as 'week' | 'month' | 'year'),
          getStockDistribution(branchId),
          // Keep the existing inventory fetch for backward compatibility
          fetch(`${API_BASE_URL}/inventory/branch/${branchId}`, {
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
          }).then(res => res.json())
        ]);

        // Handle metrics
        if (metricsResponse.status === 'fulfilled') {
          setDashboardMetrics(metricsResponse.value);
        } else {
          console.error('Failed to load dashboard metrics:', metricsResponse.reason);
        }

        // Handle low stock items
        if (lowStockResponse.status === 'fulfilled') {
          setLowStockItems(lowStockResponse.value);
        } else {
          console.error('Failed to load low stock items:', lowStockResponse.reason);
          setLowStockItems([]);
        }

        // Handle near expiry items
        if (nearExpiryResponse.status === 'fulfilled') {
          setNearExpiryItems(nearExpiryResponse.value);
        } else {
          console.error('Failed to load near expiry items:', nearExpiryResponse.reason);
          setNearExpiryItems([]);
        }

        // Handle sales trend
        if (salesTrendResponse.status === 'fulfilled') {
          setSalesTrendData(salesTrendResponse.value);
        } else {
          console.error('Failed to load sales trend:', salesTrendResponse.reason);
          setSalesTrendData([]);
        }

        // Handle stock distribution
        if (stockDistributionResponse.status === 'fulfilled') {
          setStockDistributionData(stockDistributionResponse.value);
        } else {
          console.error('Failed to load stock distribution:', stockDistributionResponse.reason);
          setStockDistributionData([]);
        }

        // Handle inventory items
        if (inventoryResponse.status === 'fulfilled') {
          const normalizedItems: ApiInventoryItem[] = Array.isArray(inventoryResponse.value)
            ? inventoryResponse.value
            : [];
          setInventoryItems(normalizedItems);
        } else {
          console.error('Failed to load inventory items:', inventoryResponse.reason);
          setInventoryItems([]);
        }

        setLastSync(new Date());
      } catch (error) {
        console.error('Dashboard loading error:', error);
        setDashboardError("Network error while loading dashboard data.");
        setInventoryItems([]);
        setLowStockItems([]);
        setNearExpiryItems([]);
        setSalesTrendData([]);
        setStockDistributionData([]);
        setDashboardMetrics(null);
      } finally {
        setIsLoadingDashboard(false);
      }
    };

    loadDashboardData();
  }, [refreshVersion, selectedBranch, trendTab]);

  const lowStockProducts = lowStockItems.map(item => ({
    inventoryId: item.inventoryId,
    name: item.name,
    quantity: item.quantity,
    reorder: item.reorder,
    status: item.status
  }));

  const nearExpiryProducts = nearExpiryItems.map(item => ({
    inventoryId: item.inventoryId,
    name: item.name,
    expiry: item.expiry,
    daysLeft: item.daysLeft
  }));

  const { lowStockCount, nearExpiryCount, totalItemUnits, inventoryValue } =
    dashboardMetrics || { lowStockCount: 0, nearExpiryCount: 0, totalItemUnits: 0, inventoryValue: 0 };

  const handleSyncNow = () => setRefreshVersion((value) => value + 1);

  const lowStockDeltaLabel = formatDeltaLabel(
    lowStockCount,
    previousMetrics?.lowStockCount ?? null,
    "items",
    "items",
  );
  const nearExpiryDeltaLabel = formatDeltaLabel(
    nearExpiryCount,
    previousMetrics?.nearExpiryCount ?? null,
    "items",
    "items",
  );
  const inventoryValueDeltaLabel = formatDeltaLabel(
    Math.round(inventoryValue),
    previousMetrics ? Math.round(previousMetrics.inventoryValue) : null,
    "value increase",
    "value decrease",
  );
  const totalItemsDeltaLabel = formatDeltaLabel(
    totalItemUnits,
    previousMetrics?.totalItemUnits ?? null,
    "units",
    "units",
  );

  const showWidgetError = Boolean(dashboardError) && !isLoadingDashboard;

  const nearExpiryIds = new Set(
    nearExpiryProducts.map((item) => item.inventoryId),
  );
  let stockHealthyCount = 0;
  let stockLowCount = 0;
  let stockNearExpiryCount = 0;

  inventoryItems.forEach((item) => {
    if (nearExpiryIds.has(Number(item.inventory_id))) {
      stockNearExpiryCount += 1;
      return;
    }

    if (Number(item.quantity_on_hand) <= LOW_STOCK_THRESHOLD) {
      stockLowCount += 1;
      return;
    }

    stockHealthyCount += 1;
  });

  const stockContribution: StockSegment[] = stockDistributionData.length > 0
    ? stockDistributionData.map(item => ({
        name: item.name,
        value: item.value,
        color: item.color
      }))
    : [
        { name: "Healthy", value: stockHealthyCount, color: "#14e644" },
        { name: "Low", value: stockLowCount, color: "#ff3b35" },
        { name: "Near Expiry", value: stockNearExpiryCount, color: "#f3bf2c" },
      ];

  const hasStockContributionData = stockContribution.some(
    (entry) => entry.value > 0,
  );
  const stockContributionChartData: StockSegment[] = hasStockContributionData
    ? stockContribution
    : [{ name: "No Data", value: 1, color: "#cbd5e1" }];

  const trendData: SalesDataPoint[] = salesTrendData.length > 0
    ? salesTrendData.map(item => ({ day: item.day, sales: item.sales }))
    : trendTab === "Week"
      ? salesTrendWeek
      : trendTab === "Month"
        ? salesTrendMonth
        : salesTrendYear;

  return (
    <div
      className="min-h-screen w-full overflow-y-auto overflow-x-hidden relative"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(113,160,255,0.18) 0%, transparent 26%), radial-gradient(circle at top right, rgba(11,49,153,0.28) 0%, transparent 30%), linear-gradient(180deg, #041f63 0%, #0b3499 42%, #2c63e0 100%)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-80 pointer-events-none"
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
      />

      <LowStocksModal
        isOpen={lowStocksModalOpen}
        onClose={() => setLowStocksModalOpen(false)}
      />

      <NearExpiryModal
        isOpen={nearExpiryModalOpen}
        onClose={() => setNearExpiryModalOpen(false)}
      />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-450 mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 flex flex-col gap-5">
        {/* ── Header Card ──────────────────────────────────────────────────── */}
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          lastSync={lastSync}
          isOnline={isOnline}
        />

        {/* ── Overview Bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-[11px] font-bold tracking-[0.35em] uppercase"
              style={{ color: "rgba(216,231,255,0.66)" }}
            >
              Dashboard Overview
            </p>
            <h2
              className="font-bold text-2xl tracking-wide mt-1"
              style={{ color: "rgba(245,249,255,0.96)" }}
            >
              Branch Inventory Overview
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "rgba(218,232,255,0.74)" }}
            >
              Real-time stock levels, expiry risk, and inventory value.
            </p>
          </div>
          <div
            className="relative flex items-center gap-2 h-11 px-4 rounded-2xl cursor-pointer transition-shadow"
            style={{
              minWidth: "200px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(226,235,255,0.93) 100%)",
              border: "1px solid rgba(112,136,214,0.34)",
              boxShadow:
                "0 16px 32px rgba(3,31,99,0.22), inset 0 1px 0 rgba(255,255,255,0.85)",
            }}
          >
            <p className="font-semibold text-sm truncate flex-1 text-center text-[#103182]">
              {selectedBranch}
            </p>
            <ChevronDown size={16} className="text-[#103182] shrink-0" />
            <select
              ref={branchSelectRef}
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              {BRANCHES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(isLoadingDashboard || dashboardError) && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              background: "rgba(255,255,255,0.14)",
              color: "#f4f7ff",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            {isLoadingDashboard
              ? `Syncing ${selectedBranch} dashboard data...`
              : dashboardError}
          </div>
        )}

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* LOW STOCK */}
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={METRIC_CARD_STYLE}
          >
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{
                background: "linear-gradient(90deg, #ff6b6b 0%, #ffb199 100%)",
              }}
            />
            <div
              className="absolute top-3 right-3 p-1.5 rounded-lg"
              style={{ background: "rgba(230,4,4,0.1)" }}
            >
              <AlertCircle size={18} style={{ color: "rgba(230,4,4,0.67)" }} />
            </div>
            <p
              className="text-base font-extrabold tracking-wide uppercase"
              style={{ color: "#062d8c" }}
            >
              LOW STOCK
            </p>
            <p
              className="text-xs font-semibold mt-0.5"
              style={{ color: "#636363" }}
            >
              Below reorder level
            </p>
            <p
              className="font-extrabold mt-2 leading-none"
              style={{ color: "#e60404", fontSize: "3rem" }}
            >
              {isLoadingDashboard ? "—" : lowStockCount.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 mt-3">
              <span
                className="font-bold"
                style={{ color: "#e60404", fontSize: "10px" }}
              >
                Urgent
              </span>
              <span
                className="ml-1"
                style={{ color: "#636363", fontSize: "10px" }}
              >
                · {isLoadingDashboard ? "Syncing..." : lowStockDeltaLabel}
              </span>
            </div>
            <button
              className="mt-3 text-xs font-bold"
              style={{
                color: "#1133f2",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => setLowStocksModalOpen(true)}
            >
              View items
            </button>
          </div>

          {/* NEAR EXPIRY */}
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={METRIC_CARD_STYLE}
          >
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{
                background: "linear-gradient(90deg, #f3bf2c 0%, #f7dd84 100%)",
              }}
            />
            <div
              className="absolute top-3 right-3 p-1.5 rounded-lg"
              style={{ background: "rgba(179,147,49,0.1)" }}
            >
              <Clock size={18} style={{ color: "#b39331" }} />
            </div>
            <p
              className="text-base font-extrabold tracking-wide uppercase"
              style={{ color: "#062d8c" }}
            >
              NEAR EXPIRY
            </p>
            <p
              className="text-xs font-semibold mt-0.5"
              style={{ color: "#636363" }}
            >
              Items expiring soon
            </p>
            <p
              className="font-extrabold mt-2 leading-none"
              style={{ color: "#b39331", fontSize: "3rem" }}
            >
              {isLoadingDashboard ? "—" : nearExpiryCount.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 mt-3">
              <span
                className="font-bold"
                style={{ color: "#b39331", fontSize: "10px" }}
              >
                Within 30 days
              </span>
              <span
                className="ml-1"
                style={{ color: "#636363", fontSize: "10px" }}
              >
                · {isLoadingDashboard ? "Syncing..." : nearExpiryDeltaLabel}
              </span>
            </div>
            <button
              className="mt-3 text-xs font-bold"
              style={{
                color: "#1133f2",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => setNearExpiryModalOpen(true)}
            >
              View items
            </button>
          </div>

          {/* INVENTORY VALUE */}
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={METRIC_CARD_STYLE}
          >
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{
                background: "linear-gradient(90deg, #00bf2c 0%, #71f39d 100%)",
              }}
            />
            <div
              className="absolute top-3 right-3 p-1.5 rounded-lg"
              style={{ background: "rgba(0,191,44,0.1)" }}
            >
              <TrendingUp size={18} style={{ color: "#00bf2c" }} />
            </div>
            <p
              className="text-base font-extrabold tracking-wide uppercase"
              style={{ color: "#062d8c" }}
            >
              INVENTORY VALUE
            </p>
            <p
              className="text-xs font-semibold mt-0.5"
              style={{ color: "#636363" }}
            >
              Current branch valuation
            </p>
            <p
              className="font-bold mt-2 leading-none"
              style={{ color: "#00bf2c", fontSize: "2.5rem" }}
            >
              {isLoadingDashboard
                ? "—"
                : `₱${Math.round(inventoryValue).toLocaleString()}`}
            </p>
            <div className="flex items-center gap-1 mt-3">
              <span
                className="font-bold tracking-wider uppercase"
                style={{ color: "#00bf2c", fontSize: "10px" }}
              >
                DB synced
              </span>
              <span
                className="ml-1"
                style={{ color: "#636363", fontSize: "10px" }}
              >
                · {isLoadingDashboard ? "Syncing..." : inventoryValueDeltaLabel}
              </span>
            </div>
            <button
              className="mt-3 text-xs font-bold"
              style={{
                color: "#1133f2",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onClick={handleSyncNow}
            >
              Sync now
            </button>
          </div>

          {/* TOTAL ITEMS */}
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={METRIC_CARD_STYLE}
          >
            <div
              className="absolute inset-x-0 top-0 h-1"
              style={{
                background: "linear-gradient(90deg, #003bcd 0%, #6fa6ff 100%)",
              }}
            />
            <div
              className="absolute top-3 right-3 p-1.5 rounded-lg"
              style={{ background: "rgba(0,59,205,0.1)" }}
            >
              <Package size={18} style={{ color: "#003bcd" }} />
            </div>
            <p
              className="text-base font-extrabold tracking-wide uppercase"
              style={{ color: "#062d8c" }}
            >
              TOTAL ITEMS
            </p>
            <p
              className="text-xs font-semibold mt-0.5"
              style={{ color: "#636363" }}
            >
              Units in selected branch
            </p>
            <p
              className="font-bold mt-2 leading-none"
              style={{ color: "#003bcd", fontSize: "3rem" }}
            >
              {isLoadingDashboard ? "—" : totalItemUnits.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 mt-3">
              <div className="flex" style={{ marginRight: "4px" }}>
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ background: "#003bcd", border: "1px solid #f0f0f0" }}
                />
                <div
                  className="w-4 h-4 rounded-full -ml-1"
                  style={{ background: "#00bf2c", border: "1px solid #f0f0f0" }}
                />
                <div
                  className="w-4 h-4 rounded-full -ml-1"
                  style={{ background: "#b39331", border: "1px solid #f0f0f0" }}
                />
              </div>
              <span style={{ color: "#636363", fontSize: "10px" }}>
                {isLoadingDashboard
                  ? "Syncing..."
                  : `${BRANCHES.length} branches configured · ${totalItemsDeltaLabel}`}
              </span>
            </div>
            <button
              className="mt-3 text-xs font-bold"
              style={{
                color: "#1133f2",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onClick={handleSyncNow}
            >
              Refresh totals
            </button>
          </div>
        </div>

        {/* ── Charts Row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sales Trend */}
          <div className="rounded-2xl p-6" style={PANEL_CARD_STYLE}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ color: "#062d8c" }}>
                Sales Trend
              </h2>
              <div className="flex gap-1">
                {TREND_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTrendTab(tab)}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                    style={{
                      background: trendTab === tab ? "#1133f2" : "transparent",
                      color: trendTab === tab ? "#f5f5f5" : "#001d63",
                      border: "1px solid #dad8d8",
                      cursor: "pointer",
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            {showWidgetError ? (
              <div
                className="h-65 flex items-center justify-center text-sm font-semibold"
                style={{ color: "#6f1d1d" }}
              >
                Unable to load sales chart.
              </div>
            ) : isLoadingDashboard ? (
              <div
                className="h-65 flex items-center justify-center text-sm font-semibold"
                style={{ color: "#4e5c88" }}
              >
                Loading chart data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={trendData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop stopColor="#926FFF" />
                      <stop offset="1" stopColor="#F02FC2" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(0,0,26,0.12)"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#54555a", fontSize: 12 }}
                    axisLine={{ stroke: "#54555a" }}
                    tickLine={{ stroke: "#54555a" }}
                  />
                  <YAxis
                    tick={{ fill: "rgba(0,0,0,0.7)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(val: unknown) => [
                      `₱${Number(val).toLocaleString()}`,
                      "Sales",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="url(#trendGrad)"
                    strokeWidth={3}
                    dot={{
                      fill: "#926fff",
                      stroke: "#f02fc2",
                      strokeWidth: 2,
                      r: 5,
                    }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Stock Contribution */}
          <div className="rounded-2xl p-6" style={PANEL_CARD_STYLE}>
            <h2 className="font-bold mb-4" style={{ color: "#062d8c" }}>
              Stock Contribution
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              {showWidgetError ? (
                <div
                  className="h-60 w-full flex items-center justify-center text-sm font-semibold"
                  style={{ color: "#6f1d1d" }}
                >
                  Unable to load stock contribution.
                </div>
              ) : isLoadingDashboard ? (
                <div
                  className="h-60 w-full flex items-center justify-center text-sm font-semibold"
                  style={{ color: "#4e5c88" }}
                >
                  Loading stock contribution...
                </div>
              ) : (
                <>
                  <div className="w-full max-w-70 h-60 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stockContributionChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={95}
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                          stroke="transparent"
                        >
                          {stockContributionChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#fff",
                            border: "1px solid #ddd",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-55">
                    {!hasStockContributionData && (
                      <p className="text-xs" style={{ color: "#636363" }}>
                        No inventory records yet for this branch.
                      </p>
                    )}
                    {stockContribution.map((entry) => (
                      <div key={entry.name} className="flex items-start gap-2">
                        <div
                          className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                          style={{ background: entry.color }}
                        />
                        <div>
                          <p className="text-xs" style={{ color: "#636363" }}>
                            {entry.name}
                          </p>
                          <p
                            className="text-sm font-bold"
                            style={{ color: entry.color }}
                          >
                            {entry.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Low Stock & Near Expiry Items ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Low Stocks Items */}
          <div className="rounded-2xl p-6 relative" style={PANEL_CARD_STYLE}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg"
                  style={{ background: "rgba(230,4,4,0.1)" }}
                >
                  <AlertCircle
                    size={18}
                    style={{ color: "rgba(230,4,4,0.67)" }}
                  />
                </div>
                <h2 className="font-bold" style={{ color: "#062d8c" }}>
                  Low Stocks Items
                </h2>
              </div>
              <button
                className="flex items-center gap-1 px-2 py-1 transition-opacity hover:opacity-70"
                onClick={() => setLowStocksModalOpen(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: "#1133f2" }}
                >
                  View All
                </span>
                <ChevronRight size={14} style={{ color: "#1133f2" }} />
              </button>
            </div>

            {/* Table */}
            <div
              className="rounded-lg overflow-hidden"
              style={TABLE_CARD_STYLE}
            >
              {/* Header */}
              <div
                className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-3"
                style={{
                  background:
                    "linear-gradient(180deg, #d6e3ff 0%, #eaf1ff 100%)",
                  borderBottom: "1px solid rgba(119,145,217,0.26)",
                }}
              >
                <p className="text-xs font-bold" style={{ color: "#062d8c" }}>
                  Product
                </p>
                <p className="text-xs font-bold" style={{ color: "#062d8c" }}>
                  Qty
                </p>
                <p className="text-xs font-bold" style={{ color: "#062d8c" }}>
                  Reorder
                </p>
                <p className="text-xs font-bold" style={{ color: "#062d8c" }}>
                  Status
                </p>
              </div>

              {!isLoadingDashboard &&
                !showWidgetError &&
                lowStockProducts.slice(0, 4).map((product, index) => (
                  <div
                    key={`${product.inventoryId}-${index}`}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-6 py-3"
                    style={{
                      borderBottom:
                        index === 3 ? "none" : "1px solid rgba(0,0,0,0.08)",
                      background: index % 2 === 0 ? "#ffffff" : "#f9fbff",
                    }}
                  >
                    <p
                      className="text-xs truncate"
                      style={{ color: "#2f2f2f" }}
                    >
                      {product.name}
                    </p>
                    <p
                      className="text-xs font-semibold"
                      style={{ color: "#2f2f2f" }}
                    >
                      {product.quantity}
                    </p>
                    <p className="text-xs" style={{ color: "#636363" }}>
                      {product.reorder}
                    </p>
                    <p
                      className="text-xs font-bold"
                      style={{
                        color:
                          product.status === "Critical"
                            ? "rgba(230,4,4,0.75)"
                            : "#f3bf2c",
                      }}
                    >
                      {product.status}
                    </p>
                  </div>
                ))}

              {isLoadingDashboard && (
                <div className="px-6 py-4 text-xs" style={{ color: "#4e5c88" }}>
                  Loading low-stock records...
                </div>
              )}

              {showWidgetError && (
                <div className="px-6 py-4 text-xs" style={{ color: "#7a1d1d" }}>
                  Unable to load low-stock records.
                </div>
              )}

              {!isLoadingDashboard &&
                !showWidgetError &&
                lowStockProducts.length === 0 && (
                  <div
                    className="px-6 py-4 text-xs"
                    style={{ color: "#636363" }}
                  >
                    No low-stock records for this branch.
                  </div>
                )}
            </div>
          </div>

          {/* Near Expiry Items */}
          <div className="rounded-2xl p-6 relative" style={PANEL_CARD_STYLE}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg"
                  style={{ background: "rgba(243,191,44,0.15)" }}
                >
                  <Clock size={18} style={{ color: "#f3bf2c" }} />
                </div>
                <h2 className="font-bold" style={{ color: "#062d8c" }}>
                  Near Expiry Items
                </h2>
              </div>
              <button
                className="flex items-center gap-1 px-2 py-1 transition-opacity hover:opacity-70"
                onClick={() => setNearExpiryModalOpen(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span
                  className="text-xs font-bold"
                  style={{ color: "#1133f2" }}
                >
                  View All
                </span>
                <ChevronRight size={14} style={{ color: "#1133f2" }} />
              </button>
            </div>

            <div
              className="rounded-lg overflow-hidden"
              style={TABLE_CARD_STYLE}
            >
              <div
                className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-6 py-3"
                style={{
                  background:
                    "linear-gradient(180deg, #d6e3ff 0%, #eaf1ff 100%)",
                  borderBottom: "1px solid rgba(119,145,217,0.26)",
                }}
              >
                <p className="text-xs font-bold" style={{ color: "#062d8c" }}>
                  Product
                </p>
                <p className="text-xs font-bold" style={{ color: "#062d8c" }}>
                  Expiry Date
                </p>
                <p className="text-xs font-bold" style={{ color: "#062d8c" }}>
                  Days Left
                </p>
              </div>

              {!isLoadingDashboard &&
                !showWidgetError &&
                nearExpiryProducts.slice(0, 4).map((product, index) => (
                  <div
                    key={`${product.inventoryId}-${index}`}
                    className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-6 py-3"
                    style={{
                      borderBottom:
                        index === 3 ? "none" : "1px solid rgba(0,0,0,0.08)",
                      background: index % 2 === 0 ? "#ffffff" : "#f9fbff",
                    }}
                  >
                    <p
                      className="text-xs truncate"
                      style={{ color: "#2f2f2f" }}
                    >
                      {product.name}
                    </p>
                    <p className="text-xs" style={{ color: "#636363" }}>
                      {product.expiry}
                    </p>
                    <p
                      className="text-xs font-semibold"
                      style={{ color: "#f3bf2c" }}
                    >
                      {product.daysLeft} days
                    </p>
                  </div>
                ))}

              {isLoadingDashboard && (
                <div className="px-6 py-4 text-xs" style={{ color: "#4e5c88" }}>
                  Loading near-expiry records...
                </div>
              )}

              {showWidgetError && (
                <div className="px-6 py-4 text-xs" style={{ color: "#7a1d1d" }}>
                  Unable to load near-expiry records.
                </div>
              )}

              {!isLoadingDashboard &&
                !showWidgetError &&
                nearExpiryProducts.length === 0 && (
                  <div
                    className="px-6 py-4 text-xs"
                    style={{ color: "#636363" }}
                  >
                    No near-expiry records for this branch.
                  </div>
                )}
            </div>
          </div>
        </div>

        <AdminFooter lastSync={lastSync} />

        {isKeybindHelpOpen && (
          <div className="fixed inset-0 z-90 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 p-6">
                <h3 className="text-2xl font-black text-slate-900">
                  Keyboard Shortcuts
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Press Tab or Esc to close this guide.
                </p>
              </div>
              <div className="space-y-2 p-6 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span>Open this keybind guide</span>
                  <kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                    Tab
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span>Close this keybind guide</span>
                  <kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                    Esc
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span>Sync dashboard data now</span>
                  <kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                    Ctrl + Shift + R
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span>Open Low Stock modal</span>
                  <kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                    Ctrl + Shift + L
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span>Open Near Expiry modal</span>
                  <kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                    Ctrl + Shift + E
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span>Focus branch selector</span>
                  <kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                    B
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <span>Set Sales Trend: Week / Month / Year</span>
                  <kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                    1 / 2 / 3
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
