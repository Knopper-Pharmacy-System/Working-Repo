import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminFooter from "../../components/admin/AdminFooter";
import { getToken } from "../../hooks/useAuth";

type BranchOption = { id: number; label: string };
type ApiInventoryItem = {
  inventory_id: number;
  product_name?: string;
  product_name_official?: string;
  quantity_on_hand: number;
  expiry_date?: string | null;
};
type NearExpiryResponse = {
  total_count: number;
  items: Array<{
    product_name: string;
    expiry_date: string;
    quantity: number;
    status: string;
  }>;
};
type AuditLogResponse = {
  logs: Array<{
    date_time: string;
    performed_by: string;
    product: string;
    action_type: string;
    quantity: number;
    details: string;
  }>;
};
const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;
const BRANCHES: BranchOption[] = [
  { id: 1, label: "BMC MAIN" },
  { id: 2, label: "DIVERSION BRANCH" },
  { id: 3, label: "PANGANIBAN BRANCH" },
];
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

export default function AdminAlertsPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastSync, setLastSync] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [inventoryItems, setInventoryItems] = useState<ApiInventoryItem[]>([]);
  const [nearExpiry, setNearExpiry] = useState<NearExpiryResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogResponse["logs"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = getToken();
        if (!token) {
          setError("No auth token found. Please log in again.");
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const [inventoryResponse, expiryResponse, auditResponse] =
          await Promise.all([
            fetch(`${API_BASE_URL}/inventory/branch/${selectedBranchId}`, {
              headers,
            }),
            fetch(`${API_BASE_URL}/inventory/near-expiry`, { headers }),
            fetch(`${API_BASE_URL}/admin/audit-log/${selectedBranchId}`, {
              headers,
            }),
          ]);
        const inventoryPayload = await inventoryResponse.json();
        const expiryPayload = await expiryResponse.json();
        const auditPayload = await auditResponse.json();
        if (!inventoryResponse.ok) {
          setError(
            inventoryPayload.message ||
              inventoryPayload.error ||
              "Failed to load inventory alerts.",
          );
          setInventoryItems([]);
        } else {
          setInventoryItems(
            Array.isArray(inventoryPayload) ? inventoryPayload : [],
          );
        }
        setNearExpiry(
          expiryResponse.ok ? (expiryPayload as NearExpiryResponse) : null,
        );
        setAuditLogs(
          auditResponse.ok
            ? ((auditPayload.logs || []) as AuditLogResponse["logs"])
            : [],
        );
        setLastSync(new Date());
      } catch {
        setError("Network error while loading alerts.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [refreshVersion, selectedBranchId]);

  const critical = useMemo(
    () =>
      inventoryItems.filter((item) => Number(item.quantity_on_hand || 0) < 5),
    [inventoryItems],
  );
  const low = useMemo(
    () =>
      inventoryItems.filter(
        (item) =>
          Number(item.quantity_on_hand || 0) >= 5 &&
          Number(item.quantity_on_hand || 0) < 10,
      ),
    [inventoryItems],
  );

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
        activeItem="Alerts"
      />
      <div className="relative z-10 w-full max-w-450 mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 flex flex-col gap-5">
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
              Alert Center
            </p>
            <h2
              className="font-bold text-2xl tracking-wide mt-1"
              style={{ color: "rgba(245,249,255,0.96)" }}
            >
              Alerts
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "rgba(218,232,255,0.74)" }}
            >
              Critical stock, near expiry items, and audit events that need
              attention.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="relative flex items-center gap-2 h-11 px-4 rounded-2xl"
              style={{
                minWidth: "220px",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(226,235,255,0.93) 100%)",
                border: "1px solid rgba(112,136,214,0.34)",
                boxShadow:
                  "0 16px 32px rgba(3,31,99,0.22), inset 0 1px 0 rgba(255,255,255,0.85)",
              }}
            >
              <p className="font-semibold text-sm truncate flex-1 text-center text-[#103182]">
                {BRANCHES.find((branch) => branch.id === selectedBranchId)
                  ?.label || "Branch"}
              </p>
              <ChevronDown size={16} className="text-[#103182] shrink-0" />
              <select
                value={selectedBranchId}
                onChange={(event) =>
                  setSelectedBranchId(Number(event.target.value))
                }
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                {BRANCHES.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setRefreshVersion((value) => value + 1)}
              className="h-11 px-4 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 flex items-center gap-2"
              style={{
                background: "linear-gradient(180deg, #2449ff 0%, #1133f2 100%)",
                border: "1px solid rgba(183,205,255,0.28)",
                boxShadow: "0 12px 24px rgba(2,24,95,0.28)",
              }}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>
        {error ? (
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
        ) : null}
        <div className="rounded-[28px] p-5 sm:p-6" style={PANEL_CARD_STYLE}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}>
              <p
                className="text-base font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Critical
              </p>
              <p
                className="mt-2 leading-none"
                style={{ color: "#c62828", fontSize: "3rem", fontWeight: 800 }}
              >
                {critical.length}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <ShieldAlert size={14} /> Qty below 5
              </div>
            </div>
            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}>
              <p
                className="text-base font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Low Stock
              </p>
              <p
                className="mt-2 leading-none"
                style={{ color: "#c89400", fontSize: "3rem", fontWeight: 800 }}
              >
                {low.length}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <AlertTriangle size={14} /> Qty below 10
              </div>
            </div>
            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}>
              <p
                className="text-base font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Near Expiry
              </p>
              <p
                className="mt-2 leading-none"
                style={{ color: "#1536ef", fontSize: "3rem", fontWeight: 800 }}
              >
                {nearExpiry?.total_count ?? 0}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <AlertTriangle size={14} /> Current token branch feed
              </div>
            </div>
            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}>
              <p
                className="text-base font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Audit Events
              </p>
              <p
                className="mt-2 leading-none"
                style={{ color: "#00a83d", fontSize: "3rem", fontWeight: 800 }}
              >
                {auditLogs.length}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <ShieldCheck size={14} /> Adjustment trail
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div
              className="rounded-xl overflow-hidden"
              style={TABLE_CARD_STYLE}
            >
              <div className="px-4 py-3 border-b border-[#dbe3f7]">
                <p className="text-sm font-bold text-[#062d8c]">
                  Critical Items
                </p>
              </div>
              <div className="divide-y divide-[#dbe3f7]">
                {isLoading ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    Loading alerts...
                  </div>
                ) : critical.slice(0, 8).length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No critical items.
                  </div>
                ) : (
                  critical.slice(0, 8).map((item) => (
                    <div key={item.inventory_id} className="px-4 py-3">
                      <p className="text-sm font-semibold text-[#001d63]">
                        {item.product_name_official ||
                          item.product_name ||
                          "Unnamed Product"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Qty {item.quantity_on_hand}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={TABLE_CARD_STYLE}
            >
              <div className="px-4 py-3 border-b border-[#dbe3f7]">
                <p className="text-sm font-bold text-[#062d8c]">Near Expiry</p>
              </div>
              <div className="divide-y divide-[#dbe3f7]">
                {(nearExpiry?.items || []).slice(0, 8).length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No near-expiry items.
                  </div>
                ) : (
                  (nearExpiry?.items || []).slice(0, 8).map((item, index) => (
                    <div
                      key={`${item.product_name}-${index}`}
                      className="px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-[#001d63]">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.expiry_date} · Qty {item.quantity}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={TABLE_CARD_STYLE}
            >
              <div className="px-4 py-3 border-b border-[#dbe3f7]">
                <p className="text-sm font-bold text-[#062d8c]">
                  Recent Audit Trail
                </p>
              </div>
              <div className="divide-y divide-[#dbe3f7]">
                {auditLogs.slice(0, 8).length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No audit events.
                  </div>
                ) : (
                  auditLogs.slice(0, 8).map((log, index) => (
                    <div
                      key={`${log.date_time}-${index}`}
                      className="px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-[#001d63]">
                        {log.product}
                      </p>
                      <p className="text-xs text-slate-500">
                        {log.action_type} by {log.performed_by}
                      </p>
                      <p className="text-xs text-slate-500">{log.date_time}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        <AdminFooter lastSync={lastSync} />
      </div>
    </div>
  );
}
