import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Download,
  Edit2,
  ShoppingCart,
  X,
  ChevronDown,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Package,
  MapPin,
  Tag,
  Building2,
  User,
  Hash,
  Layers,
  Calendar,
  RefreshCw,
  CalendarClock,
  Boxes,
  Pill,
  Syringe,
} from "lucide-react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminFooter from "../../components/admin/AdminFooter";
import { getToken } from "../../hooks/useAuth";

// --- Types -------------------------------------------------------------------

type Classification =
  | "Medicines Supplies"
  | "Medical Supplies"
  | "Groceries Supplies";

type StatusType = "In Stock" | "Low" | "Critical";

type BranchOption = {
  id: number;
  label: string;
};

type ApiInventoryItem = {
  inventory_id: number;
  product_id: number;
  product_name?: string;
  product_name_official?: string;
  category?: string;
  barcode?: string | null;
  barcode_value?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  quantity_on_hand: number;
  price?: number;
  gondola_code?: string | null;
  supplier?: string;
};

interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  location: string;
  classification: Classification;
  supplier: string;
  branch: string;
  stock: number;
  maxStock: number;
  price: number;
  expiry: string;
}

// --- Config / Constants ------------------------------------------------------

const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

const BRANCHES: BranchOption[] = [
  { id: 1, label: "BMC MAIN" },
  { id: 2, label: "DIVERSION BRANCH" },
  { id: 3, label: "PANGANIBAN BRANCH" },
];

const CLASSIFICATIONS: Classification[] = [
  "Medicines Supplies",
  "Medical Supplies",
  "Groceries Supplies",
];
const ITEMS_PER_PAGE = 7;

const CLASS_COLORS: Record<Classification, string> = {
  "Medicines Supplies": "#00aeff",
  "Medical Supplies": "#00c354",
  "Groceries Supplies": "#ffc057",
};

// --- Helpers -----------------------------------------------------------------

function getStatus(stock: number): StatusType {
  if (stock < 5) return "Critical";
  if (stock < 10) return "Low";
  return "In Stock";
}

function getStockColor(stock: number): string {
  if (stock < 5) return "#f10000";
  if (stock < 10) return "#f3bf2c";
  return "#00bf2c";
}

const formatDate = (isoDate?: string | null): string => {
  if (!isoDate) return "No Expiry";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "No Expiry";
  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const isPlaceholderBarcode = (value?: string | null) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return true;
  const normalized = raw.toUpperCase();
  if (
    /^[-‐‑–—―\s]+$/u.test(raw) ||
    normalized === "N/A" ||
    normalized === "NA" ||
    normalized === "NONE" ||
    !/[0-9A-Z]/i.test(raw)
  ) {
    return true;
  }
  return false;
};

const sanitizeBarcode = (...values: Array<string | null | undefined>) => {
  for (const candidate of values) {
    if (!isPlaceholderBarcode(candidate)) {
      return String(candidate).trim();
    }
  }
  return "No Barcode";
};

const normalizeClassification = (category?: string): Classification => {
  const normalized = (category || "").trim().toUpperCase();
  if (normalized === "MEDICINE") return "Medicines Supplies";
  if (normalized === "GROCERY") return "Groceries Supplies";
  return "Medical Supplies";
};

// --- Sub-components ----------------------------------------------------------

function ClassBadge({ label }: { label: Classification }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-white whitespace-nowrap"
      style={{ background: CLASS_COLORS[label], fontSize: "10px" }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: StatusType }) {
  const styles: Record<StatusType, { bg: string; color: string }> = {
    Critical: { bg: "rgba(255,0,0,0.25)", color: "red" },
    Low: { bg: "rgba(243,191,44,0.32)", color: "#c89400" },
    "In Stock": { bg: "rgba(0,191,44,0.25)", color: "#00bf2c" },
  };
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color, fontSize: "12px" }}
    >
      {status}
    </span>
  );
}

function StockBar({ stock, maxStock }: { stock: number; maxStock: number }) {
  const pct = Math.min(100, (stock / Math.max(1, maxStock)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-full overflow-hidden"
        style={{
          background: "#d9d9d9",
          height: "6px",
          width: "44px",
          flexShrink: 0,
        }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: pct + "%", background: getStockColor(stock) }}
        />
      </div>
      <span
        className="text-sm tabular-nums"
        style={{ color: getStockColor(stock), minWidth: "20px" }}
      >
        {stock}
      </span>
    </div>
  );
}

// --- Add / Edit Slide-over Drawer --------------------------------------------

interface ItemFormData {
  name: string;
  sku: string;
  barcode: string;
  location: string;
  classification: Classification;
  supplier: string;
  branch: string;
  stock: string;
  maxStock: string;
  price: string;
  expiry: string;
}

const EMPTY_FORM: ItemFormData = {
  name: "",
  sku: "",
  barcode: "",
  location: "",
  classification: "Medicines Supplies",
  supplier: "",
  branch: "BMC MAIN",
  stock: "",
  maxStock: "50",
  price: "",
  expiry: "",
};

interface FieldError {
  name?: string;
  sku?: string;
  supplier?: string;
  stock?: string;
  maxStock?: string;
  price?: string;
  expiry?: string;
}

function validateForm(form: ItemFormData): FieldError {
  const errors: FieldError = {};
  if (!form.name.trim()) errors.name = "Item name is required.";
  if (!form.sku.trim()) errors.sku = "SKU is required.";
  if (!form.supplier.trim()) errors.supplier = "Supplier is required.";
  const stock = parseInt(form.stock);
  const maxStock = parseInt(form.maxStock);
  const price = parseFloat(form.price);
  if (form.stock === "" || isNaN(stock) || stock < 0)
    errors.stock = "Enter a valid stock qty (>= 0).";
  if (form.maxStock === "" || isNaN(maxStock) || maxStock < 1)
    errors.maxStock = "Max stock must be at least 1.";
  if (!errors.stock && !errors.maxStock && stock > maxStock)
    errors.stock = "Stock cannot exceed max stock.";
  if (form.price === "" || isNaN(price) || price < 0)
    errors.price = "Enter a valid price.";
  if (!form.expiry.trim()) errors.expiry = "Expiry date is required.";
  else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.expiry.trim()))
    errors.expiry = "Use format MM/DD/YYYY.";
  return errors;
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="fixed bottom-6 right-6 z-100 flex items-center gap-3 px-5 py-3.5 rounded-2xl"
      style={{
        background: "#0c8628",
        color: "#fff",
        minWidth: "300px",
        boxShadow: "0 8px 32px rgba(12,134,40,0.45)",
        animation: "slideUp 0.3s ease",
      }}
    >
      <CheckCircle size={18} color="#fff" />
      <span className="text-sm font-semibold">{message}</span>
    </div>
  );
}

function DrawerSection({
  title,
  icon,
}: {
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "rgba(21,54,239,0.1)" }}
      >
        {icon}
      </span>
      <span
        className="font-bold text-xs uppercase tracking-wider"
        style={{ color: "#062d8c" }}
      >
        {title}
      </span>
      <div className="flex-1 h-px ml-1" style={{ background: "#e1e7f5" }} />
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold" style={{ color: "#707070" }}>
        {label}
        {required && <span style={{ color: "#d40000" }}> *</span>}
      </label>
      {children}
      {error && (
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: "#d40000" }}
        >
          <AlertTriangle size={10} />
          {error}
        </span>
      )}
    </div>
  );
}

function ItemDrawer({
  mode,
  initial,
  onSave,
  onClose,
}: {
  mode: "add" | "edit";
  initial: ItemFormData;
  onSave: (data: ItemFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ItemFormData>(initial);
  const [errors, setErrors] = useState<FieldError>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof ItemFormData, boolean>>
  >({});

  function field(key: keyof ItemFormData, value: string) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched[key]) {
      const e = validateForm(next);
      setErrors((prev) => ({ ...prev, [key]: e[key as keyof FieldError] }));
    }
  }

  function touch(key: keyof ItemFormData) {
    setTouched((prev) => ({ ...prev, [key]: true }));
    const e = validateForm(form);
    setErrors((prev) => ({ ...prev, [key]: e[key as keyof FieldError] }));
  }

  function handleSubmit() {
    const allTouched: Partial<Record<keyof ItemFormData, boolean>> = {
      name: true,
      sku: true,
      supplier: true,
      stock: true,
      maxStock: true,
      price: true,
      expiry: true,
    };
    setTouched(allTouched);
    const e = validateForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSave(form);
  }

  const previewStock = parseInt(form.stock) || 0;
  const previewMax = parseInt(form.maxStock) || 50;
  const previewPrice = parseFloat(form.price) || 0;
  const previewStatus =
    previewStock < 5 ? "Critical" : previewStock < 10 ? "Low" : "In Stock";
  const previewStatusColor =
    previewStock < 5 ? "#f10000" : previewStock < 10 ? "#c89400" : "#0c8628";
  const previewStatusBg =
    previewStock < 5
      ? "rgba(241,0,0,0.1)"
      : previewStock < 10
        ? "rgba(243,191,44,0.15)"
        : "rgba(12,134,40,0.1)";
  const previewPct = Math.min(
    100,
    previewMax > 0 ? (previewStock / previewMax) * 100 : 0,
  );
  const previewBarColor =
    previewStock < 5 ? "#f10000" : previewStock < 10 ? "#f3bf2c" : "#00bf2c";
  const errorCount = Object.keys(errors).filter(
    (k) => !!errors[k as keyof FieldError],
  ).length;

  const inputBase = {
    border: "1px solid #dad8d8",
    color: "#001d63",
    background: "#fff",
    outline: "none",
    fontSize: "13px",
  } as React.CSSProperties;
  const inputErr = {
    ...inputBase,
    border: "1px solid #f10000",
    background: "#fff8f8",
  } as React.CSSProperties;
  const cls = "w-full h-9 px-3 rounded-lg transition-colors";

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: "500px",
          background: "#fff",
          boxShadow: "-8px 0 40px rgba(6,45,140,0.22)",
          overflowY: "hidden",
        }}
      >
        <div
          className="px-6 py-5 flex items-center justify-between shrink-0"
          style={{ background: "#062d8c" }}
        >
          <div className="flex flex-col gap-1">
            <span
              className="font-extrabold text-white"
              style={{ fontSize: "16px" }}
            >
              {mode === "add" ? "Add New Item" : "Edit Item"}
            </span>
            <span
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {mode === "add"
                ? "Fill in the details to add a product to inventory"
                : `Editing: ${initial.name || "Item"}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <X size={16} color="#fff" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          <div>
            <DrawerSection
              title="Basic Information"
              icon={<Package size={13} style={{ color: "#1536ef" }} />}
            />
            <div className="flex flex-col gap-3">
              <Field label="Item Name" required error={errors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                  onBlur={() => touch("name")}
                  placeholder="e.g. Paracetamol 500MG Tab (ALVEDON)"
                  className={cls}
                  style={errors.name ? inputErr : inputBase}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU" required error={errors.sku}>
                  <div className="relative">
                    <Hash
                      size={12}
                      className="absolute left-2.5 top-2.75 pointer-events-none"
                      style={{ color: "#9aabbf" }}
                    />
                    <input
                      type="text"
                      value={form.sku}
                      onChange={(e) => field("sku", e.target.value)}
                      onBlur={() => touch("sku")}
                      placeholder="e.g. 101674"
                      className="w-full h-9 pl-7 pr-3 rounded-lg transition-colors"
                      style={errors.sku ? inputErr : inputBase}
                    />
                  </div>
                </Field>
                <Field label="Location (Shelf)">
                  <div className="relative">
                    <MapPin
                      size={12}
                      className="absolute left-2.5 top-2.75 pointer-events-none"
                      style={{ color: "#9aabbf" }}
                    />
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => field("location", e.target.value)}
                      placeholder="e.g. A4"
                      className="w-full h-9 pl-7 pr-3 rounded-lg"
                      style={inputBase}
                    />
                  </div>
                </Field>
              </div>

              <Field label="Supplier" required error={errors.supplier}>
                <div className="relative">
                  <User
                    size={12}
                    className="absolute left-2.5 top-2.75 pointer-events-none"
                    style={{ color: "#9aabbf" }}
                  />
                  <input
                    type="text"
                    value={form.supplier}
                    onChange={(e) => field("supplier", e.target.value)}
                    onBlur={() => touch("supplier")}
                    placeholder="e.g. Zuellig Pharma Corporation"
                    className="w-full h-9 pl-7 pr-3 rounded-lg transition-colors"
                    style={errors.supplier ? inputErr : inputBase}
                  />
                </div>
              </Field>
            </div>
          </div>

          <div>
            <DrawerSection
              title="Classification & Branch"
              icon={<Tag size={13} style={{ color: "#1536ef" }} />}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Classification">
                <div className="relative">
                  <select
                    value={form.classification}
                    onChange={(e) =>
                      field("classification", e.target.value as Classification)
                    }
                    className="w-full h-9 px-3 pr-8 rounded-lg appearance-none cursor-pointer"
                    style={inputBase}
                  >
                    {CLASSIFICATIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2.5 top-2.75 pointer-events-none"
                    style={{ color: "#062d8c" }}
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: CLASS_COLORS[form.classification] }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: CLASS_COLORS[form.classification] }}
                  >
                    {form.classification}
                  </span>
                </div>
              </Field>

              <Field label="Branch">
                <div className="relative">
                  <Building2
                    size={12}
                    className="absolute left-2.5 top-2.75 pointer-events-none"
                    style={{ color: "#9aabbf" }}
                  />
                  <select
                    value={form.branch}
                    onChange={(e) => field("branch", e.target.value)}
                    className="w-full h-9 pl-7 pr-8 rounded-lg appearance-none cursor-pointer"
                    style={inputBase}
                  >
                    {BRANCHES.map((b) => (
                      <option key={b.id} value={b.label}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="absolute right-2.5 top-2.75 pointer-events-none"
                    style={{ color: "#062d8c" }}
                  />
                </div>
              </Field>
            </div>
          </div>

          <div>
            <DrawerSection
              title="Stock & Pricing"
              icon={<Layers size={13} style={{ color: "#1536ef" }} />}
            />
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Stock Qty" required error={errors.stock}>
                  <input
                    type="number"
                    value={form.stock}
                    min={0}
                    onChange={(e) => field("stock", e.target.value)}
                    onBlur={() => touch("stock")}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-lg text-center transition-colors"
                    style={errors.stock ? inputErr : inputBase}
                  />
                </Field>
                <Field label="Max Stock" required error={errors.maxStock}>
                  <input
                    type="number"
                    value={form.maxStock}
                    min={1}
                    onChange={(e) => field("maxStock", e.target.value)}
                    onBlur={() => touch("maxStock")}
                    placeholder="50"
                    className="w-full h-9 px-3 rounded-lg text-center transition-colors"
                    style={errors.maxStock ? inputErr : inputBase}
                  />
                </Field>
                <Field label="Price (PHP)" required error={errors.price}>
                  <div className="relative">
                    <span
                      className="absolute left-2 top-2.25 text-xs font-bold pointer-events-none"
                      style={{ color: "#9aabbf" }}
                    >
                      PHP
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.price}
                      min={0}
                      onChange={(e) => field("price", e.target.value)}
                      onBlur={() => touch("price")}
                      placeholder="0.00"
                      className="w-full h-9 pl-9 pr-2 rounded-lg transition-colors"
                      style={errors.price ? inputErr : inputBase}
                    />
                  </div>
                </Field>
              </div>

              <Field label="Expiry Date" required error={errors.expiry}>
                <div className="relative">
                  <Calendar
                    size={12}
                    className="absolute left-2.5 top-2.75 pointer-events-none"
                    style={{ color: "#9aabbf" }}
                  />
                  <input
                    type="text"
                    value={form.expiry}
                    onChange={(e) => field("expiry", e.target.value)}
                    onBlur={() => touch("expiry")}
                    placeholder="MM/DD/YYYY"
                    className="w-full h-9 pl-7 pr-3 rounded-lg transition-colors"
                    style={errors.expiry ? inputErr : inputBase}
                  />
                </div>
              </Field>
            </div>
          </div>

          <div>
            <DrawerSection
              title="Live Preview"
              icon={<CheckCircle size={13} style={{ color: "#1536ef" }} />}
            />
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: "#f0f5ff", border: "1.5px dashed #c5d2e8" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span
                    className="font-bold truncate"
                    style={{ color: "#001d63", fontSize: "13px" }}
                  >
                    {form.name.trim() ? (
                      form.name
                    ) : (
                      <span style={{ color: "#bbb" }}>
                        Item name will appear here
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-white"
                      style={{
                        background: CLASS_COLORS[form.classification],
                        fontSize: "10px",
                      }}
                    >
                      {form.classification}
                    </span>
                    {form.sku.trim() && (
                      <span className="text-xs" style={{ color: "#9aabbf" }}>
                        SKU: {form.sku}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0"
                  style={{
                    background: previewStatusBg,
                    color: previewStatusColor,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: previewStatusColor }}
                  />
                  {previewStatus}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#9aabbf" }}>
                    Stock Level
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: "#001d63" }}
                  >
                    {previewStock} / {previewMax} units
                  </span>
                </div>
                <div
                  className="w-full rounded-full overflow-hidden"
                  style={{ height: "8px", background: "#d9d9d9" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${previewPct}%`,
                      background: previewBarColor,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  {
                    label: "Price",
                    value:
                      previewPrice > 0 ? `PHP ${previewPrice.toFixed(2)}` : "—",
                  },
                  { label: "Branch", value: form.branch || "—" },
                  { label: "Expiry", value: form.expiry || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs" style={{ color: "#9aabbf" }}>
                      {label}
                    </span>
                    <span
                      className="text-xs font-semibold truncate"
                      style={{ color: "#001d63" }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs pb-2" style={{ color: "#aaa" }}>
            Fields marked <span style={{ color: "#d40000" }}>*</span> are
            required.
          </p>
        </div>

        <div
          className="px-6 py-4 flex items-center gap-3 shrink-0"
          style={{ borderTop: "1px solid #e1e7f5", background: "#fafafa" }}
        >
          {errorCount > 0 && (
            <span
              className="flex items-center gap-1.5 text-xs flex-1"
              style={{ color: "#d40000" }}
            >
              <AlertTriangle size={12} /> Fix {errorCount} error
              {errorCount > 1 ? "s" : ""} to continue.
            </span>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="h-10 px-5 rounded-xl text-sm font-bold hover:opacity-80 transition-opacity"
              style={{
                background: "#efefef",
                color: "#555",
                border: "1px solid #dad8d8",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={{
                background: "#1536ef",
                boxShadow: "0 4px 12px rgba(21,54,239,0.35)",
              }}
            >
              {mode === "add" ? <Plus size={14} /> : <CheckCircle size={14} />}{" "}
              {mode === "add" ? "Add to Inventory" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// --- Main Page ---------------------------------------------------------------

export default function AdminInventoryPage() {
  const [searchParams] = useSearchParams();
  const branchFromQuery = Number(searchParams.get("branch") || "1");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [selectedBranchId, setSelectedBranchId] = useState<number>(
    Number.isFinite(branchFromQuery) &&
      BRANCHES.some((b) => b.id === branchFromQuery)
      ? branchFromQuery
      : 1,
  );

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Clocks/Status
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

  // Fetch Inventory Data
  useEffect(() => {
    const loadInventory = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = getToken();
        if (!token) {
          setError("No auth token found. Please log in again.");
          setItems([]);
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/inventory/branch/${selectedBranchId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        const data = await response.json();
        if (!response.ok) {
          setError(data.message || data.error || "Failed to load inventory.");
          setItems([]);
          return;
        }

        const selectedBranchObj = BRANCHES.find(
          (b) => b.id === selectedBranchId,
        );

        const rows: InventoryItem[] = (Array.isArray(data) ? data : []).map(
          (item: ApiInventoryItem) => {
            const stock = Number(item.quantity_on_hand || 0);
            return {
              id: Number(item.inventory_id),
              name:
                item.product_name_official ||
                item.product_name ||
                "Unnamed Product",
              sku: String(item.product_id || item.inventory_id || "—"),
              barcode: sanitizeBarcode(item.barcode, item.barcode_value),
              location: item.gondola_code || "—",
              classification: normalizeClassification(item.category),
              supplier: item.supplier || "Unknown Supplier", // fallback if no supplier
              branch: selectedBranchObj?.label || "BMC MAIN",
              stock,
              maxStock: Math.max(20, stock * 2), // Mocking maxStock
              price: Number(item.price || 0),
              expiry: formatDate(item.expiry_date),
            };
          },
        );

        setItems(rows);
      } catch {
        setError("Network error while loading inventory.");
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInventory();
  }, [refreshVersion, selectedBranchId]);

  const selectedBranchLabel =
    BRANCHES.find((b) => b.id === selectedBranchId)?.label || "BMC MAIN";

  // Derived data
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return items.filter(
      (i) =>
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.supplier.toLowerCase().includes(q) ||
        i.barcode.toLowerCase().includes(q) ||
        i.classification.toLowerCase().includes(q),
    );
  }, [items, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / ITEMS_PER_PAGE),
  );
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = filteredItems.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const categorySummary = useMemo(() => {
    return CLASSIFICATIONS.map((cat) => {
      const sub = items.filter((i) => i.classification === cat);
      const totalValue = sub.reduce((s, i) => s + i.stock * i.price, 0);
      return { cat, count: sub.length, totalValue };
    });
  }, [items]);

  const criticalCount = items.filter((item) => item.stock < 5).length;
  const lowCount = items.filter(
    (item) => item.stock >= 5 && item.stock < 10,
  ).length;
  const totalUnits = items.reduce((sum, item) => sum + item.stock, 0);

  // Handlers
  function openAddModal() {
    setEditTarget(null);
    setModalMode("add");
  }

  function openEditModal(item: InventoryItem) {
    setEditTarget(item);
    setModalMode("edit");
  }

  function handleSave(data: ItemFormData) {
    if (modalMode === "add") {
      const newItem: InventoryItem = {
        id: Math.max(0, ...items.map((i) => i.id)) + 1,
        name: data.name.trim(),
        sku: data.sku.trim(),
        barcode: data.barcode || "No Barcode",
        location: data.location.trim(),
        classification: data.classification,
        supplier: data.supplier.trim(),
        branch: data.branch,
        stock: parseInt(data.stock) || 0,
        maxStock: parseInt(data.maxStock) || 50,
        price: parseFloat(data.price) || 0,
        expiry: data.expiry.trim(),
      };
      setItems((prev) => [newItem, ...prev]);
      setToast(`"${newItem.name}" added to inventory successfully.`);
    } else if (modalMode === "edit" && editTarget) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editTarget.id
            ? {
                ...i,
                name: data.name.trim(),
                sku: data.sku.trim(),
                location: data.location.trim(),
                classification: data.classification,
                supplier: data.supplier.trim(),
                branch: data.branch,
                stock: parseInt(data.stock) || i.stock, // keep original if invalid
                maxStock: parseInt(data.maxStock) || i.maxStock,
                price: parseFloat(data.price) || 0,
                expiry: data.expiry.trim(),
              }
            : i,
        ),
      );
      setToast(`"${data.name.trim()}" updated successfully.`);
    }
    setModalMode(null);
    setEditTarget(null);
    setCurrentPage(1);
  }

  function handleReorder(item: InventoryItem) {
    alert("Reorder request placed for: " + item.name);
  }

  const modalInitial: ItemFormData = editTarget
    ? {
        name: editTarget.name,
        sku: editTarget.sku,
        barcode: editTarget.barcode,
        location: editTarget.location,
        classification: editTarget.classification,
        supplier: editTarget.supplier,
        branch: editTarget.branch,
        stock: String(editTarget.stock),
        maxStock: String(editTarget.maxStock),
        price: String(editTarget.price),
        expiry: editTarget.expiry,
      }
    : EMPTY_FORM;

  // Category card config
  const CATEGORY_CARDS = [
    {
      key: "Medicines Supplies" as Classification,
      label: "Medicines",
      icon: <Pill size={30} color="#001955" />,
      gradient:
        "linear-gradient(-21deg, rgba(98,184,255,0.4) 58%, rgba(155,210,255,0.4) 84%)",
    },
    {
      key: "Medical Supplies" as Classification,
      label: "Medical Supplies",
      icon: <Syringe size={30} color="#001955" />,
      gradient:
        "linear-gradient(-21deg, rgba(172,249,190,0.5) 58%, rgba(173,252,191,0.25) 84%)",
    },
    {
      key: "Groceries Supplies" as Classification,
      label: "Grocery",
      icon: <ShoppingCart size={30} color="#001955" />, // Or another lucid icon for Groceries
      gradient:
        "linear-gradient(-21deg, rgba(255,209,80,0.4) 58%, rgba(255,209,80,0.3) 72%)",
    },
  ];

  const pageNumbers = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, i) => i + 1,
  );

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
        activeItem="Inventory"
      />

      {/* Toast notification */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Add / Edit Drawer */}
      {modalMode && (
        <ItemDrawer
          mode={modalMode}
          initial={modalInitial}
          onSave={handleSave}
          onClose={() => {
            setModalMode(null);
            setEditTarget(null);
          }}
        />
      )}

      <div className="relative z-10 w-full max-w-450 mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 flex flex-col gap-5">
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          currentTime={currentTime}
          isOnline={isOnline}
        />

        <div
          className="rounded-2xl pb-5 flex flex-col gap-0"
          style={{
            background: "#f0f0f0",
            border: "1px solid rgba(47,47,47,0.68)",
            boxShadow: "0 0 50px 0px #062d8c",
          }}
        >
          {/* Top bar */}
          <div className="px-7 pt-6 pb-4 flex items-center justify-between gap-4 flex-wrap">
            <h1
              className="font-extrabold"
              style={{ color: "#062d8c", fontSize: "24px" }}
            >
              Inventory Management
            </h1>

            <div className="flex items-center gap-3">
              {/* Branch selector */}
              <div
                className="relative flex items-center gap-2 h-9 px-4 rounded-xl cursor-pointer"
                style={{
                  background: "#fff",
                  border: "1px solid #dad8d8",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                >
                  {BRANCHES.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <span
                  className="text-sm font-semibold pointer-events-none"
                  style={{ color: "#062d8c" }}
                >
                  {selectedBranchLabel}
                </span>
                <ChevronDown
                  size={13}
                  style={{ color: "#062d8c" }}
                  className="pointer-events-none"
                />
              </div>

              {/* Refresh */}
              <button
                onClick={() => setRefreshVersion((v) => v + 1)}
                className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                style={{
                  background: "#fff",
                  color: "#062d8c",
                  border: "1px solid #dad8d8",
                  boxShadow: "0 4px 4px rgba(0,0,0,0.1)",
                }}
              >
                <RefreshCw size={15} />
                Refresh
              </button>

              {/* Add Item */}
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{
                  background: "#1536ef",
                  boxShadow: "0 4px 4px rgba(0,0,0,0.1)",
                }}
              >
                <Plus size={15} />
                Add Item
              </button>

              {/* Export */}
              <button
                className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                style={{
                  background: "#f2f2f2",
                  color: "#5f5f5f",
                  border: "1px solid #dad8d8",
                  boxShadow: "0 4px 4px rgba(0,0,0,0.1)",
                }}
              >
                <Download size={15} />
                Export
              </button>
            </div>
          </div>

          {/* KPIs Box */}
          <div className="px-7 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="flex flex-col rounded-xl p-4 gap-2"
              style={{
                background: "#fff",
                border: "1px solid #dad8d8",
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              }}
            >
              <p
                className="text-xs font-extrabold uppercase"
                style={{ color: "#062d8c" }}
              >
                Total Items
              </p>
              <p
                className="text-3xl font-black"
                style={{ color: "#062d8c", lineHeight: 1 }}
              >
                {items.length}
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1">
                <Boxes size={14} /> Listed inventory rows
              </div>
            </div>

            <div
              className="flex flex-col rounded-xl p-4 gap-2"
              style={{
                background: "#fff",
                border: "1px solid #dad8d8",
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              }}
            >
              <p
                className="text-xs font-extrabold uppercase"
                style={{ color: "#062d8c" }}
              >
                Total Units
              </p>
              <p
                className="text-3xl font-black"
                style={{ color: "#062d8c", lineHeight: 1 }}
              >
                {totalUnits.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1">
                <Package size={14} /> On-hand quantity
              </div>
            </div>

            <div
              className="flex flex-col rounded-xl p-4 gap-2"
              style={{
                background: "#fff",
                border: "1px solid #dad8d8",
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              }}
            >
              <p
                className="text-xs font-extrabold uppercase"
                style={{ color: "#062d8c" }}
              >
                Low Stock
              </p>
              <p
                className="text-3xl font-black"
                style={{ color: "#c89400", lineHeight: 1 }}
              >
                {lowCount}
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1">
                <AlertTriangle size={14} /> Qty below 10
              </div>
            </div>

            <div
              className="flex flex-col rounded-xl p-4 gap-2"
              style={{
                background: "#fff",
                border: "1px solid #dad8d8",
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              }}
            >
              <p
                className="text-xs font-extrabold uppercase"
                style={{ color: "#062d8c" }}
              >
                Critical
              </p>
              <p
                className="text-3xl font-black"
                style={{ color: "#e60404", lineHeight: 1 }}
              >
                {criticalCount}
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1">
                <CalendarClock size={14} /> Qty below 5
              </div>
            </div>
          </div>

          {/* Category Summary Cards */}
          <div className="px-7 pb-4 flex gap-5 flex-wrap">
            {CATEGORY_CARDS.map(({ key, label, icon, gradient }) => {
              const summary = categorySummary.find((s) => s.cat === key);
              const count = summary?.count ?? 0;
              const value = summary?.totalValue ?? 0;
              return (
                <div
                  key={key}
                  className="flex-1 min-w-55 h-20 rounded-2xl relative overflow-hidden"
                  style={{
                    backgroundImage: gradient,
                    boxShadow: "0px 4px 4px rgba(0,0,0,0.25)",
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none rounded-2xl"
                    style={{ boxShadow: "inset 0px 4px 4px rgba(0,0,0,0.25)" }}
                  />
                  <div
                    className="absolute opacity-80"
                    style={{ left: "28px", top: "25px" }}
                  >
                    {icon}
                  </div>
                  <p
                    className="absolute font-bold"
                    style={{
                      left: "72px",
                      top: "18px",
                      color: "#001955",
                      fontSize: "20px",
                    }}
                  >
                    {label}
                  </p>
                  <p
                    className="absolute"
                    style={{
                      left: "72px",
                      top: "44px",
                      color: "#878787",
                      fontSize: "13px",
                    }}
                  >
                    PHP{" "}
                    {value.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    value
                  </p>
                  <p
                    className="absolute font-extrabold"
                    style={{
                      right: "24px",
                      top: "22px",
                      color: "#001955",
                      fontSize: "38px",
                      lineHeight: 1,
                    }}
                  >
                    {count}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="px-7 pb-3">
            <div
              className="flex items-center gap-2 h-9 px-3 rounded-xl max-w-xs"
              style={{ background: "#fff", border: "1px solid #dad8d8" }}
            >
              <Search size={14} style={{ color: "#707070" }} />
              <input
                type="text"
                placeholder="Search items, SKU, barcode, supplier..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "#001d63" }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} title="Clear search">
                  <X size={12} style={{ color: "#707070" }} />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="px-7 overflow-x-auto">
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(47,47,47,0.4)" }}
            >
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
                    {[
                      { label: "Item", cls: "text-left  w-[22%]" },
                      { label: "SKU / Barcode", cls: "text-left  w-[12%]" },
                      { label: "Location", cls: "text-left  w-[7%]" },
                      { label: "Classifications", cls: "text-left  w-[11%]" },
                      { label: "Supplier", cls: "text-left  w-[14%]" },
                      { label: "Branch", cls: "text-left  w-[10%]" },
                      { label: "Stock", cls: "text-left  w-[9%]" },
                      { label: "Price", cls: "text-right w-[7%]" },
                      { label: "Expiry", cls: "text-center w-[8%]" },
                      { label: "Status", cls: "text-center w-[7%]" },
                      { label: "Actions", cls: "text-center w-[5%]" },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-3 py-2.5 font-semibold whitespace-nowrap ${col.cls}`}
                        style={{ color: "#001d63", fontSize: "13px" }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-10 text-center text-slate-500"
                      >
                        Loading inventory...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-10 text-center text-red-600"
                      >
                        {error}
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-10 text-center text-slate-500"
                      >
                        No items found.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((item, idx) => {
                      const status = getStatus(item.stock);
                      return (
                        <tr
                          key={item.id}
                          style={{
                            background: idx % 2 === 0 ? "#f5f4f4" : "#e6e6e6",
                          }}
                          className="transition-colors hover:brightness-95"
                        >
                          <td
                            className="px-3 py-1.5"
                            style={{ color: "#001d63", fontSize: "13px" }}
                          >
                            {item.name}
                          </td>
                          <td
                            className="px-3 py-1.5"
                            style={{ color: "#001d63", fontSize: "13px" }}
                          >
                            {item.sku}
                            <br />
                            <span className="text-[10px] text-slate-500 font-mono">
                              {item.barcode}
                            </span>
                          </td>
                          <td
                            className="px-3 py-1.5"
                            style={{ color: "#001d63", fontSize: "13px" }}
                          >
                            {item.location}
                          </td>
                          <td className="px-3 py-1.5">
                            <ClassBadge label={item.classification} />
                          </td>
                          <td
                            className="px-3 py-1.5"
                            style={{ color: "#001d63", fontSize: "13px" }}
                          >
                            {item.supplier}
                          </td>
                          <td
                            className="px-3 py-1.5"
                            style={{ color: "#001d63", fontSize: "13px" }}
                          >
                            {item.branch}
                          </td>
                          <td className="px-3 py-1.5">
                            <StockBar
                              stock={item.stock}
                              maxStock={item.maxStock}
                            />
                          </td>
                          <td
                            className="px-3 py-1.5 text-right"
                            style={{ color: "#001d63", fontSize: "13px" }}
                          >
                            {item.price.toFixed(2)}
                          </td>
                          <td
                            className="px-3 py-1.5 text-center"
                            style={{ color: "#001d63", fontSize: "13px" }}
                          >
                            {item.expiry}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <StatusBadge status={status} />
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditModal(item)}
                                title="Edit"
                                className="hover:opacity-70 transition-opacity"
                              >
                                <Edit2 size={15} style={{ color: "#1133f2" }} />
                              </button>
                              <button
                                onClick={() => handleReorder(item)}
                                title="Reorder"
                                className="hover:opacity-70 transition-opacity"
                              >
                                <ShoppingCart
                                  size={15}
                                  style={{ color: "#00bf2c" }}
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table footer: showing + pagination */}
          <div className="px-7 pt-4 flex items-center justify-between flex-wrap gap-3">
            <p style={{ color: "#777", fontSize: "14px" }}>
              Showing {Math.min(pageItems.length, ITEMS_PER_PAGE)} out of{" "}
              {filteredItems.length} items
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="h-10 px-4 rounded-xl text-sm font-bold transition-opacity disabled:opacity-40 flex items-center gap-1"
                style={{
                  background: "#efefef",
                  color: "#0b0b0b",
                  border: "1px solid #dad8d8",
                  boxShadow: "0 4px 4px 3px rgba(0,0,0,0.1)",
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>

              {pageNumbers.map((pg) => (
                <button
                  key={pg}
                  onClick={() => setCurrentPage(pg)}
                  className="h-10 w-10 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
                  style={{
                    background: safePage === pg ? "#1133f2" : "#efefef",
                    color: safePage === pg ? "#eaeaea" : "#0b0b0b",
                    border: "1px solid #dad8d8",
                    boxShadow: "0 4px 4px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  {pg}
                </button>
              ))}

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={safePage >= totalPages}
                className="h-10 px-4 rounded-xl text-sm font-bold transition-opacity disabled:opacity-40 flex items-center gap-1"
                style={{
                  background: "#efefef",
                  color: "#0b0b0b",
                  border: "1px solid #dad8d8",
                  boxShadow: "0 4px 4px 3px rgba(0,0,0,0.1)",
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <AdminFooter />
      </div>
    </div>
  );
}
