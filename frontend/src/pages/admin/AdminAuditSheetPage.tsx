import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Filter,
  Download,
  Printer,
  ChevronDown,
  CheckCircle,
  XCircle,
  Edit2,
  AlertTriangle,
  Save,
  Check,
  X,
} from "lucide-react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminFooter from "../../components/admin/AdminFooter";
import { getToken } from "../../hooks/useAuth";

// --- Types -------------------------------------------------------------------

type Classification =
  | "Medicines Supplies"
  | "Groceries Supplies"
  | "Medical Supplies";

interface AuditItem {
  id: number;
  name: string;
  sku: string;
  location: string;
  classification: Classification;
  supplier: string;
  physicalQty: number;
  systemQty: number;
}

interface DiscrepancyEntry {
  id: number;
  name: string;
  sku: string;
  supplier: string;
  systemQty: number;
  physicalQty: number;
  variance: number;
  accepted: boolean;
}

interface ApiInventoryItem {
  inventory_id: number;
  product_id: number;
  product_name?: string;
  product_name_official?: string;
  category?: string;
  barcode?: string | null;
  quantity_on_hand: number;
  gondola_code?: string;
}

// --- Mock Data ----------------------------------------------------------------

const INITIAL_ITEMS: AuditItem[] = [
  {
    id: 1,
    name: "AICE 2N1 Vanilla Chocolate Sundae 800ML",
    sku: "8.89E+12",
    location: "A4",
    classification: "Groceries Supplies",
    supplier: "AICE Ice cream | Runheng Inc.",
    physicalQty: 10,
    systemQty: 10,
  },
  {
    id: 2,
    name: "Paracetamol 500MG Tab (ALVEDON)",
    sku: "101674",
    location: "B4",
    classification: "Medicines Supplies",
    supplier: "Milaor Trading Corporation",
    physicalQty: 3,
    systemQty: 4,
  },
  {
    id: 3,
    name: "20CC Syringe (ANY BRAND)",
    sku: "2.02E+11",
    location: "C4",
    classification: "Medical Supplies",
    supplier: "VMED Medical Co",
    physicalQty: 8,
    systemQty: 8,
  },
  {
    id: 4,
    name: "Paracetamol 500MG Tab (BIOGESIC) 500S",
    sku: "34981",
    location: "A3",
    classification: "Medicines Supplies",
    supplier: "Zuellig Pharma Corporation",
    physicalQty: 6,
    systemQty: 4,
  },
  {
    id: 5,
    name: "Biogesic Suspension 60ML",
    sku: "78432",
    location: "B2",
    classification: "Medicines Supplies",
    supplier: "Unilab Inc.",
    physicalQty: 0,
    systemQty: 5,
  },
  {
    id: 6,
    name: "Amoxicillin 500MG Cap (AMOXIL)",
    sku: "56712",
    location: "C1",
    classification: "Medicines Supplies",
    supplier: "Zuellig Pharma Corporation",
    physicalQty: 2,
    systemQty: 3,
  },
];

const INITIAL_DISCREPANCY: DiscrepancyEntry[] = [
  {
    id: 2,
    name: "Paracetamol 500MG Tab (ALVEDON)",
    sku: "34981",
    supplier: "Milaor Trading Corporation",
    systemQty: 4,
    physicalQty: 3,
    variance: -1,
    accepted: false,
  },
  {
    id: 4,
    name: "Paracetamol 500MG Tab (BIOGESIC) 500S",
    sku: "34981",
    supplier: "Zuellig Pharma Corporation",
    systemQty: 4,
    physicalQty: 6,
    variance: 2,
    accepted: false,
  },
  {
    id: 5,
    name: "Biogesic Suspension 60ML",
    sku: "78432",
    supplier: "Unilab Inc.",
    systemQty: 5,
    physicalQty: 0,
    variance: -5,
    accepted: false,
  },
  {
    id: 6,
    name: "Amoxicillin 500MG Cap (AMOXIL)",
    sku: "56712",
    supplier: "Zuellig Pharma Corporation",
    systemQty: 3,
    physicalQty: 2,
    variance: -1,
    accepted: false,
  },
];

const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

const BRANCH_ID_BY_NAME: Record<string, number> = {
  "BMC MAIN": 1,
  "DIVERSION BRANCH": 2,
  "PANGANIBAN BRANCH": 3,
};
const ITEMS_PER_PAGE = 20;

const AUDIT_BRANCHES = [
  "BMC MAIN",
  "DIVERSION BRANCH",
  "PANGANIBAN BRANCH",
] as const;
const REASONS = [
  "Damaged Goods",
  "Expired Items",
  "Counting Error",
  "Delivery Variance",
  "System Sync Error",
] as const;

const CLASS_COLORS: Record<Classification, string> = {
  "Groceries Supplies": "#ffc057",
  "Medicines Supplies": "#00aeff",
  "Medical Supplies": "#00c354",
};

const mapCategoryToClassification = (category?: string): Classification => {
  const normalizedCategory = (category || "").trim().toUpperCase();
  if (normalizedCategory === "MEDICINE") return "Medicines Supplies";
  if (normalizedCategory === "GROCERY") return "Groceries Supplies";
  return "Medical Supplies";
};

// --- Sub-components ----------------------------------------------------------

function ClassBadge({ label }: { label: Classification }) {
  return (
    <span
      className="inline-block px-2 py-1 rounded text-xs text-white whitespace-nowrap"
      style={{ background: CLASS_COLORS[label] }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ variance }: { variance: number }) {
  if (variance === 0)
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap"
        style={{ background: "#9cffb2", color: "#00bf2c" }}
      >
        <CheckCircle size={12} />
        Match
      </span>
    );
  if (variance < 0)
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap"
        style={{ background: "rgba(243,44,44,0.32)", color: "red" }}
      >
        <XCircle size={12} />
        Critical
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap"
      style={{ background: "rgba(0,74,255,0.18)", color: "#004aff" }}
    >
      <CheckCircle size={12} />
      Overage
    </span>
  );
}

function VarianceBadge({ value }: { value: number }) {
  if (value === 0)
    return (
      <span className="font-semibold text-sm" style={{ color: "#00bf2c" }}>
        0
      </span>
    );
  if (value < 0)
    return (
      <span className="font-semibold text-sm" style={{ color: "red" }}>
        {value}
      </span>
    );
  return (
    <span className="font-semibold text-sm" style={{ color: "#004aff" }}>
      +{value}
    </span>
  );
}

// --- Main Page ---------------------------------------------------------------

export default function AdminAuditSheet() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastSync, setLastSync] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("BMC MAIN");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [isApplyingAdjustment, setIsApplyingAdjustment] = useState(false);

  const [items, setItems] = useState<AuditItem[]>(INITIAL_ITEMS);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");

  const [scanSku, setScanSku] = useState("");
  const [correctQty, setCorrectQty] = useState("0");
  const [adjReason, setAdjReason] = useState("");

  const [discrepancy, setDiscrepancy] =
    useState<DiscrepancyEntry[]>(INITIAL_DISCREPANCY);

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
    const fetchBranchInventory = async () => {
      const branchId = BRANCH_ID_BY_NAME[selectedBranch];
      if (!branchId) {
        setItemsError("Invalid branch selected.");
        return;
      }

      const token = getToken();
      if (!token) {
        setItemsError("No auth token found. Please log in again.");
        return;
      }

      setIsLoadingItems(true);
      setItemsError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/inventory/branch/${branchId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setItemsError(data.message || data.error || "Failed to load inventory.");
          return;
        }

        const mappedItems: AuditItem[] = (data as ApiInventoryItem[]).map((item) => ({
          id: Number(item.inventory_id),
          name:
            item.product_name_official ||
            item.product_name ||
            `Product #${item.product_id}`,
          sku: item.barcode ? String(item.barcode) : String(item.product_id),
          location: item.gondola_code || "—",
          classification: mapCategoryToClassification(item.category),
          supplier: "—",
          physicalQty: Number(item.quantity_on_hand || 0),
          systemQty: Number(item.quantity_on_hand || 0),
        }));

        setItems(mappedItems);
        setDiscrepancy([]);
        setLastSync(new Date());
      } catch {
        setItemsError("Network error while loading inventory.");
      } finally {
        setIsLoadingItems(false);
      }
    };

    fetchBranchInventory();
  }, [selectedBranch]);

  const stats = useMemo(
    () => ({
      total: items.length,
      lowStocks: items.filter((i) => i.physicalQty > 0 && i.physicalQty < 5)
        .length,
      zeroStocks: items.filter((i) => i.physicalQty === 0).length,
      matched: items.filter((i) => i.physicalQty === i.systemQty).length,
      discrepancy: items.filter((i) => i.physicalQty !== i.systemQty).length,
    }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return items;

    return items.filter((item) => {
      return (
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.sku.toLowerCase().includes(normalizedSearch) ||
        item.location.toLowerCase().includes(normalizedSearch) ||
        item.classification.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [items, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const pageStart =
    filteredItems.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  function startEdit(item: AuditItem) {
    setEditingId(item.id);
    setEditQty(String(item.physicalQty));
  }

  async function persistAuditAdjustment(
    target: AuditItem,
    newQty: number,
    reason: string,
  ): Promise<boolean> {
    const token = getToken();
    if (!token) {
      setItemsError("No auth token found. Please log in again.");
      return false;
    }

    const branchId = BRANCH_ID_BY_NAME[selectedBranch];
    if (!branchId) {
      setItemsError("Invalid branch selected.");
      return false;
    }

    setIsApplyingAdjustment(true);
    setItemsError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/inventory/audit-adjustment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inventory_id: target.id,
          branch_id: branchId,
          physical_qty: newQty,
          reason,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setItemsError(
          data.message || data.error || "Failed to apply inventory adjustment.",
        );
        return false;
      }

      setLastSync(new Date());
      return true;
    } catch {
      setItemsError("Network error while applying adjustment.");
      return false;
    } finally {
      setIsApplyingAdjustment(false);
    }
  }

  async function commitEdit(id: number) {
    const newQty = Math.max(0, parseInt(editQty, 10) || 0);
    const target = items.find((item) => item.id === id);
    if (!target) return;

    const variance = newQty - target.systemQty;
    const applied = await persistAuditAdjustment(target, newQty, "Counting Error");
    if (!applied) return;

    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, physicalQty: newQty, systemQty: newQty } : i,
      ),
    );

    if (variance !== 0) {
      setDiscrepancy((prev) => {
        const exists = prev.find((entry) => entry.id === id);
        const entry: DiscrepancyEntry = {
          id: target.id,
          name: target.name,
          sku: target.sku,
          supplier: target.supplier,
          systemQty: target.systemQty,
          physicalQty: newQty,
          variance,
          accepted: exists?.accepted ?? false,
        };

        if (exists) return prev.map((item) => (item.id === id ? entry : item));
        return [entry, ...prev];
      });
    }

    setEditingId(null);
  }

  async function applyAdjustment() {
    const target = items.find(
      (i) =>
        i.sku === scanSku ||
        i.name.toLowerCase().includes(scanSku.toLowerCase()),
    );
    if (!target) {
      alert("No item found for SKU: " + scanSku);
      return;
    }
    const newQty = Math.max(0, parseInt(correctQty, 10) || 0);
    const variance = newQty - target.systemQty;
    const applied = await persistAuditAdjustment(
      target,
      newQty,
      adjReason || "Count correction",
    );
    if (!applied) return;

    setItems((prev) =>
      prev.map((i) =>
        i.id === target.id ? { ...i, physicalQty: newQty, systemQty: newQty } : i,
      ),
    );

    setDiscrepancy((prev) => {
      const exists = prev.find((entry) => entry.id === target.id);
      if (variance === 0) return prev.filter((entry) => entry.id !== target.id);

      const entry: DiscrepancyEntry = {
        id: target.id,
        name: target.name,
        sku: target.sku,
        supplier: target.supplier,
        systemQty: target.systemQty,
        physicalQty: newQty,
        variance,
        accepted: exists?.accepted ?? false,
      };

      if (exists) return prev.map((item) => (item.id === target.id ? entry : item));
      return [entry, ...prev];
    });

    setScanSku("");
    setCorrectQty("0");
    setAdjReason("");
  }

  function acceptDiscrepancy(id: number) {
    setDiscrepancy((prev) =>
      prev.map((e) => (e.id === id ? { ...e, accepted: true } : e)),
    );
  }

  function reviewDiscrepancy(id: number) {
    const entry = discrepancy.find((e) => e.id === id);
    if (!entry) return;
    setScanSku(entry.sku);
    setCorrectQty(String(entry.physicalQty));
  }

  return (
    <div
      className="min-h-screen w-full overflow-y-auto overflow-x-hidden relative"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 60% -10%, rgba(99,145,255,0.18) 0%, transparent 70%), linear-gradient(160deg, #041e6e 0%, #062d8c 35%, #0b3fbe 65%, #1d57d2 100%)",
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
        activeItem="Audit Sheet"
        onNavigate={(item) => {
          if (item === "Dashboard" || item === "Overview") navigate("/");
        }}
      />

      <div className="relative z-10 w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 flex flex-col gap-5">
        {/* Header */}
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          currentTime={currentTime}
          lastSync={lastSync}
          isOnline={isOnline}
        />

        {itemsError && (
          <div
            className="px-4 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: "rgba(230,4,4,0.12)",
              color: "#a30000",
              border: "1px solid rgba(230,4,4,0.25)",
            }}
          >
            {itemsError}
          </div>
        )}

        {/* Main Card */}
        <div
          className="rounded-2xl flex flex-col gap-5"
          style={{
            background: "#f3f3f3",
            boxShadow: "0 4px 32px rgba(0,0,0,0.22)",
          }}
        >
          {/* --- Top bar ---------------------------------------------------- */}
          <div className="px-7 pt-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="font-bold"
                style={{ color: "#001d63", fontSize: "22px" }}
              >
                Inventory Count Sheet
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "#707070" }}>
                Electronic Inventory Verification - Physical Audit
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Branch selector */}
              <div
                className="relative flex items-center gap-2 h-10 px-4 rounded-xl"
                style={{
                  background: "#fff",
                  border: "1px solid #dad8d8",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                >
                  {AUDIT_BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <span
                  className="text-sm font-semibold pointer-events-none"
                  style={{ color: "#062d8c" }}
                >
                  {selectedBranch}
                </span>
                <ChevronDown
                  size={14}
                  style={{ color: "#062d8c" }}
                  className="pointer-events-none"
                />
              </div>

              {/* Filter */}
              <button
                className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                style={{
                  background: "#f2f2f2",
                  color: "#5f5f5f",
                  border: "1px solid #dad8d8",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <Filter size={16} />
                Filter
              </button>

              {/* Export */}
              <button
                className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                style={{
                  background: "#f2f2f2",
                  color: "#5f5f5f",
                  border: "1px solid #dad8d8",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <Download size={16} />
                Export
              </button>

              {/* Print */}
              <button
                className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                style={{
                  background: "#f2f2f2",
                  color: "#5f5f5f",
                  border: "1px solid #dad8d8",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <Printer size={16} />
                Print
              </button>
            </div>
          </div>

          {/* --- KPI Cards -------------------------------------------------- */}
          <div className="px-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                label: "TOTAL ITEMS:",
                value: stats.total,
                bg: "#e2f2ff",
              },
              {
                label: "LOW STOCKS:",
                value: stats.lowStocks,
                bg: "rgba(243,191,44,0.32)",
              },
              {
                label: "ZERO STOCKS:",
                value: stats.zeroStocks,
                bg: "rgba(243,44,44,0.32)",
              },
              {
                label: "MATCHED:",
                value: stats.matched,
                bg: "rgba(0,191,44,0.1)",
              },
              {
                label: "DISCREPANCY:",
                value: stats.discrepancy,
                bg: "rgba(137,121,255,0.33)",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
                style={{
                  background: card.bg,
                  boxShadow:
                    "inset 0px 4px 4px rgba(0,0,0,0.25), 0px 4px 4px rgba(0,0,0,0.25)",
                }}
              >
                <span
                  className="text-sm font-bold leading-snug"
                  style={{ color: "#636363" }}
                >
                  {card.label}
                </span>
                <span
                  className="text-xl font-bold shrink-0"
                  style={{ color: "#636363" }}
                >
                  {card.value}
                </span>
              </div>
            ))}
          </div>

          {/* --- Inventory Table -------------------------------------------- */}
          <div className="px-7 overflow-x-auto">
            <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search item, SKU, location, classification..."
                className="h-10 w-full sm:w-[360px] rounded-xl px-4 text-sm outline-none"
                style={{
                  border: "1px solid #c9cfdb",
                  color: "#001d63",
                  background: "#fff",
                }}
              />
            </div>
            {isLoadingItems && (
              <div className="mb-3 text-sm font-semibold" style={{ color: "#4f5f87" }}>
                Loading branch inventory...
              </div>
            )}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(47,47,47,0.4)" }}
            >
              <table
                className="w-full text-sm border-collapse"
                style={{ minWidth: "860px" }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#e1e7f5",
                      borderBottom: "1px solid #dbdee4",
                    }}
                  >
                    {[
                      "Item",
                      "SKU",
                      "Location",
                      "Classifications",
                      "Supplier",
                      "Quantity",
                      "Variance",
                      "Status",
                      "Actions",
                    ].map((col) => (
                      <th
                        key={col}
                        className={`px-4 py-2.5 text-left whitespace-nowrap font-semibold ${
                          ["Quantity", "Variance"].includes(col)
                            ? "text-center"
                            : ""
                        }`}
                        style={{ color: "#001d63", fontSize: "13px" }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, idx) => {
                    const variance = item.physicalQty - item.systemQty;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          background: idx % 2 === 0 ? "#f5f4f4" : "#e6e6e6",
                        }}
                        className="transition-colors hover:brightness-95"
                      >
                        {/* Item */}
                        <td
                          className="px-4 py-2"
                          style={{ color: "#001d63", maxWidth: "220px" }}
                        >
                          <input
                            readOnly
                            value={item.name}
                            className="w-full bg-transparent border border-[#a8a5a5] rounded-md px-1.5 py-0.5 text-sm cursor-default outline-none"
                            style={{ color: "#001d63", minWidth: "160px" }}
                          />
                        </td>

                        {/* SKU */}
                        <td className="px-3 py-2">
                          <span
                            className="inline-block px-2 py-0.5 rounded border text-sm whitespace-nowrap"
                            style={{
                              border: "1px solid #a8a5a5",
                              color: "#001d63",
                              background: "transparent",
                            }}
                          >
                            {item.sku}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="px-3 py-2">
                          <span
                            className="inline-block px-2 py-0.5 rounded border text-sm"
                            style={{
                              border: "1px solid #a8a5a5",
                              color: "#001d63",
                              background: "transparent",
                            }}
                          >
                            {item.location}
                          </span>
                        </td>

                        {/* Classification */}
                        <td className="px-3 py-2">
                          <ClassBadge label={item.classification} />
                        </td>

                        {/* Supplier */}
                        <td
                          className="px-3 py-2 whitespace-nowrap"
                          style={{ color: "#001d63" }}
                        >
                          {item.supplier}
                        </td>

                        {/* Quantity (editable) */}
                        <td className="px-3 py-2 text-center">
                          {editingId === item.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                className="w-16 text-center border rounded-md px-1 py-0.5 text-sm outline-none"
                                style={{
                                  border: "1px solid #1133f2",
                                  color: "#001d63",
                                }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitEdit(item.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                              />
                              <button
                                onClick={() => commitEdit(item.id)}
                                className="text-green-600 hover:opacity-80"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-red-500 hover:opacity-80"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="inline-block px-3 py-0.5 rounded border font-semibold text-sm cursor-text"
                              style={{
                                border: "1px solid #a8a5a5",
                                color: "black",
                                background: "transparent",
                              }}
                              onDoubleClick={() => startEdit(item)}
                              title="Double-click to edit"
                            >
                              {item.physicalQty}
                            </span>
                          )}
                        </td>

                        {/* Variance */}
                        <td className="px-3 py-2 text-center">
                          <VarianceBadge value={variance} />
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2">
                          <StatusBadge variance={variance} />
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 rounded transition-opacity hover:opacity-70"
                            title="Edit quantity"
                          >
                            <Edit2 size={16} style={{ color: "#1133f2" }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: "#4f5f87" }}>
                Showing {pageStart}-{pageEnd} of {filteredItems.length} items
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3 rounded-lg text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    color: "#1f3a8a",
                  }}
                >
                  Previous
                </button>
                <span className="text-xs font-bold" style={{ color: "#1f3a8a" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="h-8 px-3 rounded-lg text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    color: "#1f3a8a",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* --- Physical Audit Control ------------------------------------- */}
          <div className="px-7 pb-2">
            <div
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{
                background: "#eef2fc",
                border: "1px solid #d6d6d6",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            >
              {/* Section header */}
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2
                    className="font-bold"
                    style={{ color: "#062d8c", fontSize: "17px" }}
                  >
                    Physical Audit Control
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "#707070" }}>
                    Perform manual adjustment and review discrepancy before
                    submission
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{
                      background: "rgba(243,191,44,0.25)",
                      color: "#b39200",
                      border: "1px solid rgba(243,191,44,0.4)",
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ background: "#f3bf2c" }}
                    />
                    DRAFT
                  </span>
                  <span
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{
                      background: "rgba(3,53,175,0.15)",
                      color: "#0335af",
                      border: "1px solid rgba(3,53,175,0.25)",
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ background: "#0335af" }}
                    />
                    ADMIN
                  </span>
                </div>
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Adjustment Form */}
                <div
                  className="rounded-xl p-5 flex flex-col gap-4"
                  style={{
                    background: "rgba(238,246,253,0.8)",
                    border: "1px solid #d6d6d6",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.08)",
                  }}
                >
                  <h3
                    className="font-bold"
                    style={{ color: "#062d8c", fontSize: "16px" }}
                  >
                    Adjustment Form
                  </h3>

                  {/* Scan SKU */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs" style={{ color: "#707070" }}>
                      Scan SKU
                    </label>
                    <input
                      type="text"
                      placeholder="Enter or scan SKU"
                      value={scanSku}
                      onChange={(e) => setScanSku(e.target.value)}
                      className="h-10 px-4 rounded-xl outline-none text-sm"
                      style={{
                        background: "transparent",
                        border: "1px solid #dad8d8",
                        color: "#3f5a9e",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    />
                  </div>

                  {/* Correct Quantity */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs" style={{ color: "#707070" }}>
                      Correct Quantity
                    </label>
                    <input
                      type="number"
                      value={correctQty}
                      onChange={(e) => setCorrectQty(e.target.value)}
                      className="h-10 px-4 rounded-xl outline-none text-sm"
                      style={{
                        background: "transparent",
                        border: "1px solid #dad8d8",
                        color: "#3f5a9e",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    />
                  </div>

                  {/* Reason for Adjustment */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs" style={{ color: "#707070" }}>
                      Reason for Adjustment
                    </label>
                    <div
                      className="relative h-10 rounded-xl"
                      style={{
                        border: "1px solid #dad8d8",
                        background: "transparent",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    >
                      <select
                        value={adjReason}
                        onChange={(e) => setAdjReason(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                      >
                        <option value="">Select Reason</option>
                        {REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-between h-full px-4 pointer-events-none">
                        <span className="text-sm" style={{ color: "#3f5a9e" }}>
                          {adjReason || "Select Reason"}
                        </span>
                        <ChevronDown size={16} style={{ color: "#062d8c" }} />
                      </div>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <button
                    onClick={applyAdjustment}
                    disabled={isApplyingAdjustment}
                    className="h-10 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
                    style={{
                      background: "#002379",
                      border: "1px solid #dad8d8",
                      boxShadow: "0 4px 8px rgba(0,0,0,0.12)",
                      opacity: isApplyingAdjustment ? 0.7 : 1,
                    }}
                  >
                    {isApplyingAdjustment ? "Applying..." : "Apply Adjustment"}
                  </button>
                </div>

                {/* Discrepancy Report */}
                <div
                  className="rounded-xl p-5 flex flex-col gap-3"
                  style={{
                    background: "rgba(238,246,253,0.8)",
                    border: "1px solid #d6d6d6",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.08)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={17} style={{ color: "#e05a00" }} />
                    <h3
                      className="font-bold"
                      style={{ color: "#e05a00", fontSize: "16px" }}
                    >
                      Discrepancy Report
                    </h3>
                  </div>

                  <div
                    className="overflow-y-auto flex flex-col gap-2.5"
                    style={{ maxHeight: "230px" }}
                  >
                    {discrepancy.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 opacity-50">
                        <CheckCircle size={28} style={{ color: "#00bf2c" }} />
                        <p
                          className="text-sm mt-2"
                          style={{ color: "#636363" }}
                        >
                          No discrepancies found
                        </p>
                      </div>
                    ) : (
                      discrepancy.map((entry) => {
                        const isNeg = entry.variance < 0;
                        const isPos = entry.variance > 0;
                        return (
                          <div
                            key={entry.id}
                            className="rounded-xl p-3 relative"
                            style={{
                              background: entry.accepted
                                ? "rgba(200,255,215,0.35)"
                                : "rgba(255,220,220,0.35)",
                              border: entry.accepted
                                ? "0.7px solid #b0ffc8"
                                : "0.7px solid #ffd0d0",
                            }}
                          >
                            {/* Variance badge */}
                            <span
                              className="absolute top-3 right-3 inline-flex items-center justify-center min-w-8.5 h-5 px-2 rounded-full text-xs font-bold"
                              style={{
                                background: isNeg
                                  ? "rgba(243,44,44,0.32)"
                                  : isPos
                                    ? "rgba(0,74,255,0.28)"
                                    : "rgba(0,191,44,0.2)",
                                color: isNeg
                                  ? "#f32c2c"
                                  : isPos
                                    ? "#004aff"
                                    : "#00bf2c",
                              }}
                            >
                              {entry.variance > 0
                                ? "+" + entry.variance
                                : entry.variance}
                            </span>

                            <p
                              className="font-semibold text-sm pr-10 leading-snug"
                              style={{ color: "#001d63" }}
                            >
                              {entry.name}
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "#707070" }}
                            >
                              SKU: {entry.sku} | Supplier: {entry.supplier}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <p
                                className="text-sm"
                                style={{ color: "#001d63" }}
                              >
                                System:
                                <strong>{entry.systemQty}</strong>| Physical:
                                <strong>{entry.physicalQty}</strong>
                              </p>
                              {!entry.accepted && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => acceptDiscrepancy(entry.id)}
                                    className="px-3 py-1 rounded-md text-xs font-bold text-white transition-opacity hover:opacity-80"
                                    style={{
                                      background: "#04ea39",
                                      border: "1px solid #02df35",
                                      boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
                                    }}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => reviewDiscrepancy(entry.id)}
                                    className="px-3 py-1 rounded-md text-xs font-bold text-white transition-opacity hover:opacity-80"
                                    style={{
                                      background: "#aeaeae",
                                      border: "1px solid #a7a7a7",
                                      boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
                                    }}
                                  >
                                    Review
                                  </button>
                                </div>
                              )}
                              {entry.accepted && (
                                <span
                                  className="flex items-center gap-1 text-xs font-bold"
                                  style={{ color: "#00bf2c" }}
                                >
                                  <CheckCircle size={13} /> Accepted
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* --- Footer ----------------------------------------------------- */}
          <div
            className="flex items-center justify-end gap-3 px-7 py-5"
            style={{ borderTop: "1px solid #e0e0e0" }}
          >
            <button
              onClick={() => navigate("/")}
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-gray-100"
              style={{
                color: "#001d63",
                border: "1px solid #d0d0d0",
                background: "#fff",
              }}
            >
              Cancel
            </button>
            <button
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "#1133f2" }}
              onClick={() => alert("Audit saved as draft!")}
            >
              <Save size={15} />
              Save Draft
            </button>
            <button
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "#00bf2c" }}
              onClick={() => alert("Audit submitted successfully!")}
            >
              <CheckCircle size={15} />
              Submit Audit
            </button>
          </div>
        </div>

        <AdminFooter lastSync={lastSync} />
      </div>
    </div>
  );
}
