import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Download,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  FileText,
  ChevronDown,
} from "lucide-react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import { getPurchaseOrders } from "../../api/procurement";

// --- Types -------------------------------------------------------------------

type POStatus =
  | "Draft"
  | "Pending"
  | "Approved"
  | "Partial"
  | "Delivered"
  | "Cancelled";

type PayTerm = "COD" | "7 Days" | "15 Days" | "30 Days" | "90 Days";

interface PurchaseOrder {
  id: string;
  date: string;
  supplier: string;
  deliverTo: string;
  itemCount: number;
  subtotal: number;
  total: number;
  payTerm: PayTerm;
  status: POStatus;
  expectedDate: string;
  refDoc: string;
}

// --- Mock Data ---------------------------------------------------------------

const ITEMS_PER_PAGE = 8;

const STATUS_STYLES: Record<POStatus, { bg: string; color: string }> = {
  Draft: { bg: "#e6e6e6", color: "#707070" },
  Pending: { bg: "rgba(255,209,80,0.28)", color: "#c89400" },
  Approved: { bg: "rgba(21,54,239,0.12)", color: "#1536ef" },
  Partial: { bg: "rgba(255,140,0,0.18)", color: "#c86a00" },
  Delivered: { bg: "rgba(12,134,40,0.14)", color: "#0c8628" },
  Cancelled: { bg: "rgba(241,0,0,0.12)", color: "#d40000" },
};

// --- Helpers -----------------------------------------------------------------

function fmtMoney(n: number) {
  return (
    "PHP " +
    n.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function StatusBadge({ status }: { status: POStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full whitespace-nowrap font-semibold"
      style={{ background: s.bg, color: s.color, fontSize: "12px" }}
    >
      {status}
    </span>
  );
}

// --- Sub-component: KPI Card -------------------------------------------------

function KpiCard({
  label,
  value,
  icon,
  iconBg,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  sub?: string;
}) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl"
      style={{
        background: "#fff",
        border: "1px solid rgba(47,47,47,0.1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold" style={{ color: "#9aabbf" }}>
          {label}
        </span>
        <span
          className="font-extrabold"
          style={{ color: "#001d63", fontSize: "22px" }}
        >
          {value}
        </span>
        {sub && (
          <span className="text-xs" style={{ color: "#9aabbf" }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---------------------------------------------------------------

export default function AdminPurchaseOrderList() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  const [activeTab, setActiveTab] = useState<POStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<keyof PurchaseOrder>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const h = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", h);
    window.addEventListener("offline", h);
    return () => {
      window.removeEventListener("online", h);
      window.removeEventListener("offline", h);
    };
  }, []);

  useEffect(() => {
    const fetchPurchaseOrders = async () => {
      try {
        const orders = await getPurchaseOrders();
        // Transform the data to match the expected format
        const transformedOrders: PurchaseOrder[] = orders.map(order => ({
          id: `PO-${order.order_id}`,
          date: order.order_date,
          supplier: order.supplier,
          deliverTo: order.branch,
          itemCount: 0, // We'll need to get this from the API or calculate it
          subtotal: order.total_amount,
          total: order.total_amount,
          payTerm: "COD" as PayTerm, // Default value, should come from API
          status: order.status as POStatus,
          expectedDate: order.order_date, // Default to order date
          refDoc: `REF-${order.order_id}`,
        }));
        setPurchaseOrders(transformedOrders);
      } catch (err) {
        console.error('Failed to fetch purchase orders:', err);
        setPurchaseOrders([]);
      }
    };

    fetchPurchaseOrders();
  }, []);

  // -- Stats --
  const totalOrders = purchaseOrders.length;
  const pendingCount = purchaseOrders.filter((p) => p.status === "Pending").length;
  const approvedCount = purchaseOrders.filter(
    (p) => p.status === "Approved",
  ).length;
  const deliveredCount = purchaseOrders.filter(
    (p) => p.status === "Delivered",
  ).length;

  // -- Filter + search --
  const filtered = useMemo(() => {
    let data = purchaseOrders;
    if (activeTab !== "All") data = data.filter((p) => p.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.supplier.toLowerCase().includes(q) ||
          p.deliverTo.toLowerCase().includes(q) ||
          p.refDoc.toLowerCase().includes(q),
      );
    }
    // Sort
    data = [...data].sort((a, b) => {
      const av = a[sortField] as string | number;
      const bv = b[sortField] as string | number;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [activeTab, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  function handleSort(field: keyof PurchaseOrder) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  const TABS: (POStatus | "All")[] = [
    "All",
    "Draft",
    "Pending",
    "Approved",
    "Partial",
    "Delivered",
    "Cancelled",
  ];

  const tabCount = (tab: POStatus | "All") =>
    tab === "All"
      ? purchaseOrders.length
      : purchaseOrders.filter((p) => p.status === tab).length;

  const renderSortIcon = (field: keyof PurchaseOrder) =>
    sortField === field ? (
      <ChevronDown
        size={11}
        className="inline ml-0.5"
        style={{
          transform: sortDir === "asc" ? "rotate(180deg)" : "none",
          color: "#062d8c",
        }}
      />
    ) : null;

  const thStyle =
    "px-3 py-2.5 text-left font-semibold whitespace-nowrap cursor-pointer select-none";
  const thColor = { color: "#001d63", fontSize: "13px" };

  return (
    <div
      className="min-h-screen w-full overflow-y-auto overflow-x-hidden"
      style={{
        background: "linear-gradient(180deg, #062d8c 40%, #3266e6 100%)",
      }}
    >
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItem="PO List"
        onNavigate={() => {}}
      />

      <div className="relative z-10 w-full max-w-450 mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 flex flex-col gap-5">
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          currentTime={currentTime}
          isOnline={isOnline}
        />

        {/* Main Card */}
        <div
          className="rounded-2xl pb-6 flex flex-col gap-0"
          style={{
            background: "#f0f0f0",
            border: "1px solid rgba(47,47,47,0.68)",
            boxShadow: "0 0 50px 0px #062d8c",
          }}
        >
          {/* Top bar */}
          <div className="px-7 pt-6 pb-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 mb-3">
              <span
                className="text-xs font-semibold"
                style={{ color: "#5a7ab5" }}
              >
                Ordering and Deliveries
              </span>
              <ChevronRight size={13} style={{ color: "#5a7ab5" }} />
              <span
                className="text-xs font-semibold"
                style={{ color: "#062d8c" }}
              >
                Purchase Orders
              </span>
            </div>

            {/* Title + New PO */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1
                className="font-extrabold"
                style={{ color: "#062d8c", fontSize: "22px" }}
              >
                Purchase Orders
              </h1>
              <button
                onClick={() => navigate("/admin/purchase-order")}
                className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
                style={{
                  background: "#1536ef",
                  boxShadow: "0 4px 12px rgba(21,54,239,0.3)",
                }}
              >
                <Plus size={15} />
                New Purchase Order
              </button>
            </div>
          </div>

          {/* Divider */}
          <div
            className="mx-7"
            style={{ borderTop: "1px solid rgba(47,47,47,0.12)" }}
          />

          <div className="px-7 pt-5 flex flex-col gap-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total Orders"
                value={totalOrders}
                sub="All time"
                iconBg="rgba(21,54,239,0.1)"
                icon={<ShoppingCart size={20} style={{ color: "#1536ef" }} />}
              />
              <KpiCard
                label="Pending Approval"
                value={pendingCount}
                sub="Awaiting review"
                iconBg="rgba(255,209,80,0.28)"
                icon={<Clock size={20} style={{ color: "#c89400" }} />}
              />
              <KpiCard
                label="Approved"
                value={approvedCount}
                sub="Ready to ship"
                iconBg="rgba(21,54,239,0.1)"
                icon={<CheckCircle size={20} style={{ color: "#1536ef" }} />}
              />
              <KpiCard
                label="Delivered"
                value={deliveredCount}
                sub="This month"
                iconBg="rgba(12,134,40,0.14)"
                icon={<Truck size={20} style={{ color: "#0c8628" }} />}
              />
            </div>

            {/* Filter Tabs + Search Row */}
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                background: "#fff",
                border: "1px solid rgba(47,47,47,0.1)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              {/* Tabs */}
              <div className="flex items-center gap-1 flex-wrap">
                {TABS.map((tab) => {
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setPage(1);
                      }}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: active ? "#062d8c" : "transparent",
                        color: active ? "#fff" : "#707070",
                      }}
                    >
                      {tab}
                      <span
                        className="px-1.5 py-0.5 rounded-full"
                        style={{
                          background: active
                            ? "rgba(255,255,255,0.2)"
                            : "#e1e7f5",
                          color: active ? "#fff" : "#062d8c",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        {tabCount(tab)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search + Export */}
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className="flex items-center gap-2 h-9 px-3 rounded-lg flex-1"
                  style={{
                    background: "#f5f4f4",
                    border: "1px solid #e0e0e0",
                    minWidth: "200px",
                  }}
                >
                  <Search size={14} style={{ color: "#9aabbf" }} />
                  <input
                    type="text"
                    placeholder="Search by PO#, supplier, branch, ref doc..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="flex-1 text-sm bg-transparent outline-none"
                    style={{ color: "#001d63" }}
                  />
                </div>
                <button
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
                  style={{
                    background: "#e1e7f5",
                    color: "#062d8c",
                    border: "1px solid #c5d2e8",
                  }}
                >
                  <Download size={13} />
                  Export
                </button>
              </div>
            </div>

            {/* Table */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "#fff",
                border: "1px solid rgba(47,47,47,0.1)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <div className="overflow-x-auto">
                <table
                  className="w-full text-sm border-collapse"
                  style={{ minWidth: "900px" }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#e1e7f5",
                        borderBottom: "1px solid #dbdee4",
                      }}
                    >
                      <th className={thStyle} style={thColor}>
                        #
                      </th>
                      <th
                        className={thStyle}
                        style={thColor}
                        onClick={() => handleSort("id")}
                      >
                        PO Number {renderSortIcon("id")}
                      </th>
                      <th
                        className={thStyle}
                        style={thColor}
                        onClick={() => handleSort("date")}
                      >
                        Date {renderSortIcon("date")}
                      </th>
                      <th
                        className={thStyle}
                        style={thColor}
                        onClick={() => handleSort("supplier")}
                      >
                        Supplier {renderSortIcon("supplier")}
                      </th>
                      <th
                        className={thStyle}
                        style={thColor}
                        onClick={() => handleSort("deliverTo")}
                      >
                        Deliver To {renderSortIcon("deliverTo")}
                      </th>
                      <th className={thStyle + " text-center"} style={thColor}>
                        Items
                      </th>
                      <th
                        className={thStyle + " text-right"}
                        style={thColor}
                        onClick={() => handleSort("total")}
                      >
                        Total {renderSortIcon("total")}
                      </th>
                      <th className={thStyle} style={thColor}>
                        Pay Term
                      </th>
                      <th className={thStyle} style={thColor}>
                        Status
                      </th>
                      <th className={thStyle + " text-center"} style={thColor}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="text-center py-12"
                          style={{ color: "#aaa" }}
                        >
                          No purchase orders found.
                        </td>
                      </tr>
                    ) : (
                      paged.map((po, idx) => {
                        const rowBg = idx % 2 === 0 ? "#f5f4f4" : "#e6e6e6";
                        return (
                          <tr
                            key={po.id}
                            style={{ background: rowBg }}
                            className="hover:brightness-95 transition-all cursor-pointer"
                            onClick={() =>
                              navigate(`/admin/purchase-order/${po.id}`)
                            }
                          >
                            {/* # */}
                            <td
                              className="px-3 py-2.5 text-center w-8"
                              style={{ color: "#9aabbf", fontSize: "12px" }}
                            >
                              {(page - 1) * ITEMS_PER_PAGE + idx + 1}
                            </td>
                            {/* PO Number */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <FileText
                                  size={13}
                                  style={{ color: "#1536ef" }}
                                />
                                <span
                                  className="font-bold"
                                  style={{ color: "#1536ef", fontSize: "13px" }}
                                >
                                  {po.id}
                                </span>
                              </div>
                              <span
                                className="text-xs"
                                style={{ color: "#9aabbf" }}
                              >
                                {po.refDoc}
                              </span>
                            </td>
                            {/* Date */}
                            <td
                              className="px-3 py-2.5"
                              style={{ color: "#001d63", fontSize: "13px" }}
                            >
                              <div>{po.date}</div>
                              <span
                                className="text-xs"
                                style={{ color: "#9aabbf" }}
                              >
                                Exp: {po.expectedDate}
                              </span>
                            </td>
                            {/* Supplier */}
                            <td
                              className="px-3 py-2.5"
                              style={{ maxWidth: "180px" }}
                            >
                              <div
                                className="truncate font-semibold"
                                style={{ color: "#001d63", fontSize: "13px" }}
                                title={po.supplier}
                              >
                                {po.supplier}
                              </div>
                            </td>
                            {/* Deliver To */}
                            <td className="px-3 py-2.5">
                              <span
                                className="px-2 py-0.5 rounded text-xs font-semibold"
                                style={{
                                  background: "#e1e7f5",
                                  color: "#062d8c",
                                }}
                              >
                                {po.deliverTo}
                              </span>
                            </td>
                            {/* Items */}
                            <td
                              className="px-3 py-2.5 text-center"
                              style={{ color: "#001d63", fontSize: "13px" }}
                            >
                              {po.itemCount}
                            </td>
                            {/* Total */}
                            <td
                              className="px-3 py-2.5 text-right font-semibold"
                              style={{ color: "#001d63", fontSize: "13px" }}
                            >
                              {fmtMoney(po.total)}
                            </td>
                            {/* Pay Term */}
                            <td
                              className="px-3 py-2.5"
                              style={{ color: "#001d63", fontSize: "13px" }}
                            >
                              {po.payTerm}
                            </td>
                            {/* Status */}
                            <td className="px-3 py-2.5">
                              <StatusBadge status={po.status} />
                            </td>
                            {/* Actions */}
                            <td
                              className="px-3 py-2.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  title="View"
                                  onClick={() =>
                                    navigate(`/admin/purchase-order/${po.id}`)
                                  }
                                  className="w-7 h-7 rounded flex items-center justify-center hover:opacity-80 transition-opacity"
                                  style={{
                                    background: "rgba(21,54,239,0.1)",
                                    color: "#1536ef",
                                  }}
                                >
                                  <Eye size={13} />
                                </button>
                                {(po.status === "Draft" ||
                                  po.status === "Pending") && (
                                  <button
                                    title="Edit"
                                    onClick={() =>
                                      navigate("/admin/purchase-order")
                                    }
                                    className="w-7 h-7 rounded flex items-center justify-center hover:opacity-80 transition-opacity"
                                    style={{
                                      background: "rgba(255,209,80,0.25)",
                                      color: "#c89400",
                                    }}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}
                                {po.status === "Draft" && (
                                  <button
                                    title="Delete"
                                    className="w-7 h-7 rounded flex items-center justify-center hover:opacity-80 transition-opacity"
                                    style={{
                                      background: "rgba(241,0,0,0.1)",
                                      color: "#d40000",
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                                {(po.status === "Approved" ||
                                  po.status === "Partial") && (
                                  <button
                                    title="Receive Delivery"
                                    onClick={() =>
                                      navigate("/admin/receive-delivery")
                                    }
                                    className="w-7 h-7 rounded flex items-center justify-center hover:opacity-80 transition-opacity"
                                    style={{
                                      background: "rgba(12,134,40,0.12)",
                                      color: "#0c8628",
                                    }}
                                  >
                                    <Truck size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: "1px solid #e1e7f5" }}
              >
                <span className="text-xs" style={{ color: "#9aabbf" }}>
                  Showing{" "}
                  {Math.min((page - 1) * ITEMS_PER_PAGE + 1, filtered.length)}
                  {" - "}
                  {Math.min(page * ITEMS_PER_PAGE, filtered.length)}
                  {" of "}
                  {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-30 hover:opacity-80 transition-opacity"
                    style={{ background: "#e1e7f5", color: "#062d8c" }}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className="w-7 h-7 rounded text-xs font-bold transition-all"
                        style={{
                          background: p === page ? "#062d8c" : "#e1e7f5",
                          color: p === page ? "#fff" : "#062d8c",
                        }}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-30 hover:opacity-80 transition-opacity"
                    style={{ background: "#e1e7f5", color: "#062d8c" }}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="text-center pb-4"
          style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}
        >
          Knopper POS Admin Dashboard &middot; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
