import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, PackageSearch, RefreshCw, Search, Tag, Wifi, WifiOff, X } from "lucide-react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminFooter from "../../components/admin/AdminFooter";
import { getToken } from "../../hooks/useAuth";

type BranchOption = { id: number; label: string };
type ApiInventoryItem = {
  inventory_id: number;
  product_id: number;
  product_name?: string;
  product_name_official?: string;
  category?: string;
  category_type?: string;
  classification?: string;
  barcode?: string | null;
  barcode_value?: string | null;
  quantity_on_hand: number;
  price?: number;
  gondola_code?: string | null;
};
type ProductRow = {
  id: number;
  productId: number;
  name: string;
  shortName: string;
  longName: string;
  category: string;
  barcode: string;
  price: number;
  priceWholesale: number;
  priceSenior: number;
  priceType: "regular" | "wholesale" | "senior";
  allowDiscount: boolean;
  stock: number;
  location: string;
};

type ProductDetailsTab = "basic" | "supplier" | "pricing" | "supplierList";

type PriceLevel = {
  levelNo: number;
  label: string;
  purpose: string;
  price: number;
  isDefault: boolean;
};

type SupplierEntry = {
  id: string;
  name: string;
  costPerUnit: number;
};

type ApiProductDetails = {
  product_id: number;
  long_description: string;
  short_description: string;
  price_regular: number;
  price_wholesale: number;
  price_senior: number;
  is_active: boolean;
  taxable: boolean;
  category_type: string;
  barcode: string;
  branch_id: number;
  gondola_code: string;
  reorder_level: number;
  target_stock_level: number;
  pricing_levels: Array<{
    level_no: number;
    label: string;
    purpose: string;
    price: number;
    is_default: boolean;
  }>;
  suppliers: Array<{
    link_id?: number;
    supplier_id?: number;
    name: string;
    cost_per_unit: number;
  }>;
};

type ProductEditorDraft = {
  id: number;
  productId: number;
  itemCode: string;
  generateBarcode: boolean;
  longDescription: string;
  shortDescription: string;
  gondola: string;
  categoryType: string;
  departmentCode: string;
  classificationCode: string;
  categoryCode: string;
  subCategoryCode: string;
  itemType: "Outright" | "Consignment";
  itemForm: "Stock" | "Assembled";
  isActive: boolean;
  trackInventory: boolean;
  linkedBarcode: boolean;
  withSerial: boolean;
  withExpiry: boolean;
  seniorCitizenDiscount: boolean;
  allowDecimalQuantity: boolean;
  warehousePcCs: boolean;
  excludeInValuePoints: boolean;
  wholesalePromo: boolean;
  historyCreatedAt: string;
  historyCreatedBy: string;
  historyLastDelivery: string;
  historyLastSold: string;
  historyLastInventory: string;
  historyLastAdjustment: string;
  supplierCode: string;
  supplierName: string;
  purchaseUnit: "PC" | "BOX" | "CASE";
  packaging: number;
  taxable: boolean;
  supplierCostGross: number;
  discounts: [number, number, number, number, number];
  addOns: [number, number, number, number, number];
  reorderPoint: number;
  stockingLevel: number;
  minimumOrder: number;
  onOrder: number;
  supplierUnitCost: number;
  priceLevels: PriceLevel[];
  markupPercent: number;
  sellingPrice: number;
  unitPackaging: string;
  suppliers: SupplierEntry[];
};

const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;
const BRANCHES: BranchOption[] = [
  { id: 1, label: "BMC MAIN" },
  { id: 2, label: "DIVERSION BRANCH" },
  { id: 3, label: "PANGANIBAN BRANCH" },
];
const CATEGORY_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "MEDICINE", label: "Medicine" },
  { value: "GROCERY", label: "Grocery" },
  { value: "MEDICAL_SUPPLIES", label: "Medical Supplies" },
] as const;
const PAGE_SIZE = 50;
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
const PRODUCT_TABS: Array<{ id: ProductDetailsTab; label: string }> = [
  { id: "basic", label: "Basic Info" },
  { id: "supplier", label: "Supplier Info" },
  { id: "pricing", label: "Pricing Info" },
  { id: "supplierList", label: "Supplier List" },
];

const PURCHASE_UNITS: Array<ProductEditorDraft["purchaseUnit"]> = ["PC", "BOX", "CASE"];

const DEFAULT_PRICE_LEVELS = [
  { levelNo: 1, label: "Retail", purpose: "Default retail price", isDefault: true },
  { levelNo: 2, label: "Wholesale", purpose: "Box/wholesale price", isDefault: true },
  { levelNo: 3, label: "Senior/PWD", purpose: "Discounted price", isDefault: true },
];

const toNumberOrZero = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const generateSystemBarcode = (productId: number) => {
  const stamp = Date.now().toString().slice(-6);
  return `SYS${String(productId).padStart(6, "0")}${stamp}`;
};

const roundTo2 = (value: number) => Number(value.toFixed(2));

const formatTime = (value: Date) =>
  value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const computeNetCost = (draft: ProductEditorDraft) => {
  const discountPercent = draft.discounts.reduce((sum, value) => sum + value, 0);
  const addonValue = draft.addOns.reduce((sum, value) => sum + value, 0);
  const discounted = draft.supplierCostGross * (1 - discountPercent / 100);
  const taxableTotal = draft.taxable ? discounted * 1.12 : discounted;
  return Math.max(0, roundTo2(taxableTotal + addonValue));
};

const computeMarkupPercent = (sellingPrice: number, unitNetCost: number) => {
  if (unitNetCost <= 0) return 0;
  return roundTo2(((sellingPrice - unitNetCost) / unitNetCost) * 100);
};

const computeGrossMarginPercent = (sellingPrice: number, unitNetCost: number) => {
  if (sellingPrice <= 0) return 0;
  return roundTo2(((sellingPrice - unitNetCost) / sellingPrice) * 100);
};

const getPriceByLevel = (levels: PriceLevel[], levelNo: number, fallback = 0) => {
  const hit = levels.find((item) => item.levelNo === levelNo);
  return hit ? roundTo2(hit.price) : roundTo2(fallback);
};

const createDraftFromProduct = (product: ProductRow): ProductEditorDraft => {
  const nowLabel = new Date().toLocaleString();
  const generatedCode = product.barcode === "No Barcode" ? `SKU-${product.productId}` : product.barcode;
  const initialPriceLevels: ProductEditorDraft["priceLevels"] = [
    { ...DEFAULT_PRICE_LEVELS[0], price: roundTo2(product.price) },
    { ...DEFAULT_PRICE_LEVELS[1], price: roundTo2(product.priceWholesale) },
    { ...DEFAULT_PRICE_LEVELS[2], price: roundTo2(product.priceSenior) },
  ];

  return {
    id: product.id,
    productId: product.productId,
    itemCode: generatedCode,
    generateBarcode: product.barcode === "No Barcode",
    longDescription: product.longName,
    shortDescription: product.shortName,
    gondola: product.location,
    categoryType: normalizeInventoryCategory(product.category) || "EQUIPMENT",
    departmentCode: "1000",
    classificationCode: "1100",
    categoryCode: "1110",
    subCategoryCode: "1111",
    itemType: "Outright",
    itemForm: "Stock",
    isActive: true,
    trackInventory: true,
    linkedBarcode: product.barcode !== "No Barcode",
    withSerial: false,
    withExpiry: false,
    seniorCitizenDiscount: product.allowDiscount,
    allowDecimalQuantity: false,
    warehousePcCs: false,
    excludeInValuePoints: false,
    wholesalePromo: false,
    historyCreatedAt: nowLabel,
    historyCreatedBy: "System",
    historyLastDelivery: "No delivery recorded",
    historyLastSold: "No sale recorded",
    historyLastInventory: nowLabel,
    historyLastAdjustment: "No adjustment recorded",
    supplierCode: `SUP-${String(product.productId).padStart(4, "0")}`,
    supplierName: "Default Supplier",
    purchaseUnit: "PC",
    packaging: 1,
    taxable: true,
    supplierCostGross: roundTo2(product.price * 0.7),
    discounts: [0, 0, 0, 0, 0],
    addOns: [0, 0, 0, 0, 0],
    reorderPoint: 10,
    stockingLevel: Math.max(product.stock, 20),
    minimumOrder: 1,
    onOrder: 0,
    supplierUnitCost: roundTo2(product.price * 0.7),
    priceLevels: initialPriceLevels,
    markupPercent: 30,
    sellingPrice: product.price,
    unitPackaging: "PC x 1",
    suppliers: [
      {
        id: `temp-${product.productId}-1`,
        name: "Default Supplier",
        costPerUnit: roundTo2(product.price * 0.7),
      },
    ],
  };
};

const applyDraftToProduct = (draft: ProductEditorDraft): ProductRow => ({
  id: draft.id,
  productId: draft.productId,
  name: draft.longDescription.trim() || "Unnamed Product",
  shortName: draft.shortDescription.trim() || (draft.longDescription.trim() || "Unnamed Product").slice(0, 24),
  longName: draft.longDescription.trim() || "Unnamed Product",
  category: [draft.departmentCode, draft.classificationCode, draft.categoryCode, draft.subCategoryCode].join("/"),
  barcode: draft.itemCode.trim() || "No Barcode",
  price: roundTo2(draft.sellingPrice),
  priceWholesale: getPriceByLevel(draft.priceLevels, 2, draft.sellingPrice),
  priceSenior: getPriceByLevel(draft.priceLevels, 3, draft.sellingPrice),
  priceType: "regular",
  allowDiscount: draft.seniorCitizenDiscount,
  stock: draft.stockingLevel,
  location: draft.gondola.trim() || "—",
});

const sanitizeBarcode = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (
      trimmed &&
      !/^[-‐‑–—―\s]+$/u.test(trimmed) &&
      /[0-9A-Z]/i.test(trimmed)
    ) {
      return trimmed;
    }
  }
  return "No Barcode";
};

const normalizeInventoryCategory = (value?: string) => {
  const normalized = (value || "").trim().toUpperCase();
  if (!normalized) return "";

  if (normalized === "MEDICINE") return "MEDICINE";
  if (normalized === "GROCERY") return "GROCERY";

  if (
    normalized === "EQUIPMENT" ||
    normalized.includes("EQUIP") ||
    normalized.includes("MEDICAL") ||
    normalized.includes("SUPPL") ||
    normalized === "MEDICAL/MEDICINES SUPPLIES" ||
    normalized === "MEDICAL_SUPPLIES" ||
    normalized === "MEDICALSUPPLIES"
  ) {
    return "MEDICAL_SUPPLIES";
  }

  return normalized;
};

const matchesCategoryFilter = (productCategory: string, selectedFilter: string) => {
  if (selectedFilter === "ALL") return true;
  return normalizeInventoryCategory(productCategory) === selectedFilter;
};

const toBackendCategoryType = (value: string) => {
  const normalized = normalizeInventoryCategory(value);
  if (normalized === "MEDICINE" || normalized === "GROCERY" || normalized === "EQUIPMENT") {
    return normalized;
  }
  return "EQUIPMENT";
};

export default function AdminProductsPage() {
  const [searchParams] = useSearchParams();
  const initialBranchId = Number(searchParams.get("branch") || "1");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastSync, setLastSync] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(
    Number.isFinite(initialBranchId) ? initialBranchId : 1,
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [editingProduct, setEditingProduct] = useState<ProductEditorDraft | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ProductDetailsTab>("basic");
  const [gondolaOptions, setGondolaOptions] = useState<string[]>([]);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

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
    const loadProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = getToken();
        if (!token) {
          setError("No auth token found. Please log in again.");
          setProducts([]);
          return;
        }
        const response = await fetch(
          `${API_BASE_URL}/inventory/branch/${selectedBranchId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const payload = await response.json();
        if (!response.ok) {
          setError(
            payload.message || payload.error || "Failed to load products.",
          );
          setProducts([]);
          return;
        }
        const rows = (Array.isArray(payload) ? payload : []).map((item: ApiInventoryItem) => ({
          id: Number(item.inventory_id),
          productId: Number(item.product_id || item.inventory_id),
          name: item.product_name_official || item.product_name || "Unnamed Product",
          shortName: (item.product_name_official || item.product_name || "Unnamed Product").slice(0, 24),
          longName: item.product_name_official || item.product_name || "Unnamed Product",
          category: item.category || item.category_type || item.classification || "Uncategorized",
          barcode: sanitizeBarcode(item.barcode, item.barcode_value),
          price: Number(item.price || 0),
          priceWholesale: Number(item.price || 0),
          priceSenior: Number(item.price || 0),
          priceType: "regular" as const,
          allowDiscount: true,
          stock: Number(item.quantity_on_hand || 0),
          location: item.gondola_code || "—",
        }));
        setProducts(rows);
        setCurrentPage(0);
        setLastSync(new Date());
      } catch {
        setError("Network error while loading products.");
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };
    void loadProducts();
  }, [refreshVersion, selectedBranchId]);

  useEffect(() => {
    const loadGondolas = async () => {
      try {
        const token = getToken();
        if (!token) return;
        const response = await fetch(`${API_BASE_URL}/inventory/branch/${selectedBranchId}/gondolas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) {
          setGondolaOptions([]);
          return;
        }
        setGondolaOptions(Array.isArray(payload?.gondolas) ? payload.gondolas : []);
      } catch {
        setGondolaOptions([]);
      }
    };
    void loadGondolas();
  }, [selectedBranchId]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      if (!matchesCategoryFilter(product.category, selectedCategoryFilter)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        product.name,
        product.shortName,
        product.longName,
        product.category,
        product.barcode,
        product.location,
        String(product.productId),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [products, searchQuery, selectedCategoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);
  const paginatedProducts = useMemo(() => {
    const start = safeCurrentPage * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedBranchId, selectedCategoryFilter]);

  const openProductModal = async (product: ProductRow) => {
    setSelectedTab("basic");
    setEditingProduct(createDraftFromProduct(product));
    setIsProductModalOpen(true);

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE_URL}/products/${product.productId}/details?branch_id=${selectedBranchId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payload: ApiProductDetails = await response.json();
      if (!response.ok) return;

      const sortedLevels = (Array.isArray(payload.pricing_levels) ? payload.pricing_levels : [])
        .map((level) => ({
          levelNo: Number(level.level_no),
          label: level.label || `Level ${level.level_no}`,
          purpose: level.purpose || "Custom pricing",
          price: toNumberOrZero(level.price),
          isDefault: Boolean(level.is_default),
        }))
        .filter((level) => level.levelNo > 0)
        .sort((a, b) => a.levelNo - b.levelNo);

      const defaultLevel1 = sortedLevels.find((level) => level.levelNo === 1)?.price ?? product.price;
      const defaultLevel2 = sortedLevels.find((level) => level.levelNo === 2)?.price ?? product.priceWholesale;
      const defaultLevel3 = sortedLevels.find((level) => level.levelNo === 3)?.price ?? product.priceSenior;

      const normalizedLevels = sortedLevels.length > 0
        ? sortedLevels
        : [
            { ...DEFAULT_PRICE_LEVELS[0], price: defaultLevel1 },
            { ...DEFAULT_PRICE_LEVELS[1], price: defaultLevel2 },
            { ...DEFAULT_PRICE_LEVELS[2], price: defaultLevel3 },
          ];

      setEditingProduct((prev) => {
        if (!prev) return prev;
        const unitNetCost = computeNetCost(prev);
        const retailPrice = getPriceByLevel(normalizedLevels, 1, prev.sellingPrice);
        return {
          ...prev,
          itemCode: payload.barcode || prev.itemCode,
          longDescription: payload.long_description || prev.longDescription,
          shortDescription: payload.short_description || prev.shortDescription,
          gondola: payload.gondola_code || prev.gondola,
          categoryType: payload.category_type || prev.categoryType,
          isActive: payload.is_active,
          taxable: payload.taxable,
          reorderPoint: toNumberOrZero(payload.reorder_level),
          stockingLevel: toNumberOrZero(payload.target_stock_level),
          priceLevels: normalizedLevels,
          sellingPrice: retailPrice,
          markupPercent: computeMarkupPercent(retailPrice, unitNetCost),
          suppliers: (Array.isArray(payload.suppliers) ? payload.suppliers : []).map((supplier, index) => ({
            id: `sup-${supplier.supplier_id || index}-${Date.now()}-${index}`,
            name: supplier.name || "",
            costPerUnit: toNumberOrZero(supplier.cost_per_unit),
          })),
        };
      });
    } catch {
      // Keep base draft if details fetch fails.
    }
  };

  const saveProductEdit = async () => {
    if (!editingProduct) return;
    const token = getToken();
    if (!token) {
      setError("No auth token found. Please log in again.");
      return;
    }

    setIsSavingProduct(true);
    setError(null);

    const payload = {
      branch_id: selectedBranchId,
      item_code: editingProduct.itemCode,
      long_description: editingProduct.longDescription,
      short_description: editingProduct.shortDescription,
      gondola_code: editingProduct.gondola,
      reorder_level: editingProduct.reorderPoint,
      target_stock_level: editingProduct.stockingLevel,
      is_active: editingProduct.isActive,
      taxable: editingProduct.taxable,
      category_type: toBackendCategoryType(editingProduct.categoryType),
      price_regular: getPriceByLevel(editingProduct.priceLevels, 1, editingProduct.sellingPrice),
      price_wholesale: getPriceByLevel(editingProduct.priceLevels, 2, editingProduct.sellingPrice),
      price_senior: getPriceByLevel(editingProduct.priceLevels, 3, editingProduct.sellingPrice),
      pricing_levels: editingProduct.priceLevels
        .slice()
        .sort((a, b) => a.levelNo - b.levelNo)
        .map((level) => ({
          level_no: level.levelNo,
          label: level.label,
          purpose: level.purpose,
          price: toNumberOrZero(level.price),
        })),
      suppliers: editingProduct.suppliers
        .map((supplier) => ({
          name: supplier.name.trim(),
          cost_per_unit: toNumberOrZero(supplier.costPerUnit),
        }))
        .filter((supplier) => supplier.name),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/products/${editingProduct.productId}/details`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json();
      if (!response.ok) {
        setError(responseData.message || responseData.error || "Failed to save product details.");
        return;
      }

      const nextProduct = applyDraftToProduct(editingProduct);
      setProducts((prev) => prev.map((product) => (product.id === nextProduct.id ? nextProduct : product)));
      setLastSync(new Date());
      closeProductModal();
    } catch {
      setError("Network error while saving product details.");
    } finally {
      setIsSavingProduct(false);
    }
  };

  useEffect(() => {
    if (!isProductModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeProductModal();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isProductModalOpen]);

  const totalStock = filteredProducts.reduce(
    (sum, product) => sum + product.stock,
    0,
  );
  const totalValue = filteredProducts.reduce(
    (sum, product) => sum + product.stock * product.price,
    0,
  );
  const selectedBranchLabel =
    BRANCHES.find((branch) => branch.id === selectedBranchId)?.label ||
    "Unknown Branch";

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
        activeItem="Products"
      />
      <div className="relative z-10 w-full max-w-450 mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-6 pb-20 lg:pb-6 flex flex-col gap-5">
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
              Products Workspace
            </p>
            <h2
              className="font-bold text-2xl tracking-wide mt-1"
              style={{ color: "rgba(245,249,255,0.96)" }}
            >
              Product Catalog
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "rgba(218,232,255,0.74)" }}
            >
              Branch catalog, barcode coverage, pricing, and stock visibility.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                {selectedBranchLabel}
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

        <div className="rounded-[28px] p-4 sm:p-5 lg:p-6" style={PANEL_CARD_STYLE}>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            <div className="rounded-xl p-3 sm:p-4 lg:p-5" style={METRIC_CARD_STYLE}>
              <p
                className="text-sm sm:text-base font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Products
              </p>
              <p
                className="mt-2 leading-none"
                style={{ color: "#062d8c", fontSize: "clamp(1.3rem, 5vw, 2.4rem)", fontWeight: 800 }}
              >
                {filteredProducts.length}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <PackageSearch size={14} /> Catalog items
              </div>
            </div>
            <div className="rounded-xl p-3 sm:p-4 lg:p-5" style={METRIC_CARD_STYLE}>
              <p
                className="text-sm sm:text-base font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Units
              </p>
              <p
                className="mt-2 leading-none"
                style={{ color: "#1536ef", fontSize: "clamp(1.3rem, 5vw, 2.4rem)", fontWeight: 800 }}
              >
                {totalStock.toLocaleString()}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Tag size={14} /> Stock on hand
              </div>
            </div>
            <div className="rounded-xl p-3 sm:p-4 lg:p-5" style={METRIC_CARD_STYLE}>
              <p
                className="text-sm sm:text-base font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Catalog Value
              </p>
              <p
                className="mt-2 leading-none"
                style={{
                  color: "#00a83d",
                  fontSize: "clamp(1.1rem, 4.5vw, 2rem)",
                  fontWeight: 800,
                }}
              >{`₱${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Tag size={14} /> Estimated value
              </div>
            </div>
          </div>

          <div
            className="mb-3 sm:mb-4 flex h-9 sm:h-11 items-center gap-2 rounded-2xl px-3 sm:px-4"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(242,246,255,0.94) 100%)",
              border: "1px solid rgba(112,136,214,0.28)",
            }}
          >
            <Search size={14} className="text-[#707070] flex-shrink-0" />
            <input
              type="text"
              placeholder="Search product, barcode, category..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="flex-1 bg-transparent text-xs sm:text-sm outline-none text-[#001d63]"
            />
          </div>

          <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSelectedCategoryFilter(filter.value)}
                className={`rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-bold uppercase transition-colors ${
                  selectedCategoryFilter === filter.value
                    ? "bg-[#062d8c] text-white"
                    : "bg-white text-[#12337f] border border-[#c7d6fb] hover:bg-blue-50"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="hidden lg:block overflow-x-auto rounded-xl" style={TABLE_CARD_STYLE}>
            <table className="w-full min-w-245 text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#e8eefb] text-[#062d8c] border-b border-[#dbe3f7]">
                  {[
                    "Name",
                    "Product ID",
                    "Category",
                    "Barcode",
                    "Location",
                    "Price",
                    "Stock",
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-2 sm:px-3 py-2 text-left text-xs font-bold"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">Loading products...</td></tr> : filteredProducts.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">No products found.</td></tr> : paginatedProducts.map((product, index) => (
                  <tr
                    key={product.id}
                    onClick={() => openProductModal(product)}
                    className="cursor-pointer transition-colors hover:bg-[#e2ebff]"
                    style={{ background: index % 2 === 0 ? '#f7f9ff' : '#edf2ff' }}
                    title="Click to edit product details"
                  >
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#001d63] font-semibold text-xs sm:text-sm">{product.name}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#001d63] text-xs sm:text-sm">{product.productId}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#001d63] text-xs sm:text-sm">{product.category}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#001d63] font-mono text-xs sm:text-sm">{product.barcode}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#001d63] text-xs sm:text-sm">{product.location}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#001d63] text-xs sm:text-sm">{product.price.toFixed(2)}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[#001d63] text-xs sm:text-sm">{product.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="block lg:hidden">
            <div className="space-y-4">
              {isLoading ? (
                <p className="text-center py-10 text-slate-500">Loading products...</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-center py-10 text-slate-500">No products found.</p>
              ) : (
                paginatedProducts.map((product, index) => (
                  <div
                    key={product.id}
                    onClick={() => openProductModal(product)}
                    className="rounded-xl p-4 cursor-pointer transition-colors hover:bg-[#e2ebff]"
                    style={{
                      ...METRIC_CARD_STYLE,
                      background: index % 2 === 0 ? '#f7f9ff' : '#edf2ff',
                    }}
                    title="Click to edit product details"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-sm text-[#062d8c] flex-1">{product.name}</h3>
                      <span className="text-xs text-slate-500 ml-2">ID: {product.productId}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div><strong>Category:</strong> {product.category}</div>
                      <div><strong>Barcode:</strong> {product.barcode}</div>
                      <div><strong>Location:</strong> {product.location}</div>
                      <div><strong>Price:</strong> ₱{product.price.toFixed(2)}</div>
                      <div className="col-span-2"><strong>Stock:</strong> {product.stock}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-[#dbe3f7] bg-white/80 px-4 py-3 text-sm text-[#12337f]">
            <p className="font-semibold">
              Showing {filteredProducts.length === 0 ? 0 : safeCurrentPage * PAGE_SIZE + 1} to {Math.min((safeCurrentPage + 1) * PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length} products
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                disabled={safeCurrentPage === 0}
                className="rounded-lg border border-[#c7d6fb] bg-white px-3 py-1.5 text-xs font-bold uppercase hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-xs font-bold uppercase tracking-wide text-[#4b5f95]">
                Page {safeCurrentPage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
                disabled={safeCurrentPage >= totalPages - 1}
                className="rounded-lg border border-[#c7d6fb] bg-white px-3 py-1.5 text-xs font-bold uppercase hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {isProductModalOpen && editingProduct ? (
          <div
            className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/55 backdrop-blur-[3px] p-4"
          >
            <div
              className="flex max-h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[28px] border border-[#d7e2ff] bg-gradient-to-b from-[#fbfdff] via-[#f4f8ff] to-[#eef4ff] shadow-[0_38px_80px_rgba(2,23,77,0.48)]"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d8e3ff] bg-gradient-to-r from-[#fdfefe] via-[#f3f7ff] to-[#eaf2ff] px-6 py-4">
                <div>
                  <h3 className="text-xl font-black text-[#062d8c]">Product Details</h3>
                  <p className="mt-0.5 text-xs font-semibold tracking-[0.18em] uppercase text-[#4460ab]">Catalog Master Form</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline-flex rounded-full border border-[#bdd0ff] bg-[#eef4ff] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#153f9f]">
                    SKU {editingProduct.productId}
                  </span>
                <button
                  type="button"
                  onClick={closeProductModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#afc6ff] bg-white text-[#27438d] transition-all hover:-translate-y-[1px] hover:bg-[#eff4ff]"
                  aria-label="Close product modal"
                >
                  <X size={16} />
                </button>
                </div>
              </div>

              <div className="flex flex-1 min-h-0 flex-col p-6 pt-5">
                <div className="rounded-2xl border border-[#d5e1ff] bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_14px_28px_rgba(7,29,98,0.08)]">
                  <p className="mb-3 text-[11px] font-black tracking-[0.18em] uppercase text-[#3557a7]">Header Information</p>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Item Code</label>
                    <input
                      type="text"
                      value={editingProduct.itemCode}
                      onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, itemCode: event.target.value } : prev))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                    />
                  </div>
                  <div className="xl:col-span-2">
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Long Description</label>
                    <input
                      type="text"
                      value={editingProduct.longDescription}
                      onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, longDescription: event.target.value } : prev))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Short Description</label>
                    <input
                      type="text"
                      value={editingProduct.shortDescription}
                      onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, shortDescription: event.target.value } : prev))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Gondola</label>
                    <select
                      value={editingProduct.gondola}
                      onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, gondola: event.target.value } : prev))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                    >
                      {gondolaOptions.length === 0 ? <option value="">No gondola options</option> : null}
                      {gondolaOptions.map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end pb-2 xl:col-span-2">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-[#d5e1ff] bg-[#f5f8ff] px-3 py-2 text-sm font-semibold text-[#24448e]">
                      <input
                        type="checkbox"
                        checked={editingProduct.generateBarcode}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setEditingProduct((prev) => {
                            if (!prev) return prev;
                            const nextCode = enabled && (!prev.itemCode || prev.itemCode === "No Barcode")
                              ? generateSystemBarcode(prev.productId)
                              : prev.itemCode;
                            return { ...prev, generateBarcode: enabled, itemCode: nextCode };
                          });
                        }}
                      />
                      Generate Barcode
                    </label>
                  </div>
                </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[#d5e1ff] bg-white/85 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                  {PRODUCT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedTab(tab.id)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-[0.08em] transition-all ${
                        selectedTab === tab.id
                          ? "bg-gradient-to-r from-[#103aa3] to-[#1e55d8] text-white shadow-[0_10px_20px_rgba(8,37,114,0.32)]"
                          : "bg-white text-[#12337f] border border-[#c7d6fb] hover:-translate-y-[1px] hover:bg-[#f2f6ff]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex-1 min-h-0 overflow-y-auto pr-1">
                {selectedTab === "basic" ? (
                  <div className="grid gap-5 rounded-2xl border border-[#d5e1ff] bg-white/90 p-4 lg:grid-cols-3 shadow-[0_14px_28px_rgba(7,29,98,0.08)]">
                    <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Department</label>
                        <input type="text" value={editingProduct.departmentCode} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, departmentCode: event.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Classification</label>
                        <input type="text" value={editingProduct.classificationCode} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, classificationCode: event.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Category</label>
                        <input type="text" value={editingProduct.categoryCode} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, categoryCode: event.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Sub-Category</label>
                        <input type="text" value={editingProduct.subCategoryCode} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, subCategoryCode: event.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Item Type</label>
                        <select value={editingProduct.itemType} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, itemType: event.target.value as ProductEditorDraft["itemType"] } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]">
                          <option value="Outright">Outright</option>
                          <option value="Consignment">Consignment</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Item Form</label>
                        <div className="flex h-[42px] items-center gap-5 rounded-xl border border-slate-300 px-3">
                          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="radio" checked={editingProduct.itemForm === "Stock"} onChange={() => setEditingProduct((prev) => (prev ? { ...prev, itemForm: "Stock" } : prev))} />Stock</label>
                          <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="radio" checked={editingProduct.itemForm === "Assembled"} onChange={() => setEditingProduct((prev) => (prev ? { ...prev, itemForm: "Assembled" } : prev))} />Assembled</label>
                        </div>
                      </div>

                      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase text-slate-500 mb-2">Item Options</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!editingProduct.isActive} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, isActive: !event.target.checked } : prev))} />In Active?</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingProduct.trackInventory} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, trackInventory: event.target.checked } : prev))} />Track Inventory?</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingProduct.linkedBarcode} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, linkedBarcode: event.target.checked } : prev))} />W/ Linked Barcode?</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingProduct.withSerial} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, withSerial: event.target.checked } : prev))} />With Serial?</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingProduct.withExpiry} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, withExpiry: event.target.checked } : prev))} />With Expiry?</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingProduct.seniorCitizenDiscount} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, seniorCitizenDiscount: event.target.checked } : prev))} />Senior Citizen Discount?</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingProduct.allowDecimalQuantity} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, allowDecimalQuantity: event.target.checked } : prev))} />Allow Decimal Quantity?</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingProduct.warehousePcCs} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, warehousePcCs: event.target.checked } : prev))} />Warehouse PC/CS?</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingProduct.excludeInValuePoints} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, excludeInValuePoints: event.target.checked } : prev))} />Exclude in Value Points?</label>
                          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingProduct.wholesalePromo} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, wholesalePromo: event.target.checked } : prev))} />Wholesale Promo?</label>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#cfdbfb] bg-gradient-to-b from-[#f9fbff] to-[#eff4ff] p-4">
                      <p className="text-xs font-bold uppercase text-slate-500 mb-2">History</p>
                      <div className="space-y-2 text-sm text-slate-700">
                        <p><span className="font-semibold">Date/Time Created:</span> {editingProduct.historyCreatedAt}</p>
                        <p><span className="font-semibold">Created By:</span> {editingProduct.historyCreatedBy}</p>
                        <p><span className="font-semibold">Last Delivery:</span> {editingProduct.historyLastDelivery}</p>
                        <p><span className="font-semibold">Last Sold:</span> {editingProduct.historyLastSold}</p>
                        <p><span className="font-semibold">Last Inventory:</span> {editingProduct.historyLastInventory}</p>
                        <p><span className="font-semibold">Last Adjustment:</span> {editingProduct.historyLastAdjustment}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedTab === "supplier" ? (
                  <div className="rounded-2xl border border-[#d5e1ff] bg-white/90 p-4 shadow-[0_14px_28px_rgba(7,29,98,0.08)]">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Supplier Code</label>
                        <input type="text" value={editingProduct.supplierCode} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, supplierCode: event.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Supplier Name</label>
                        <input type="text" value={editingProduct.supplierName} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, supplierName: event.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Purchase Unit</label>
                        <select value={editingProduct.purchaseUnit} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, purchaseUnit: event.target.value as ProductEditorDraft["purchaseUnit"] } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]">
                          {PURCHASE_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Packaging</label>
                        <input type="number" min={0} step="0.01" value={editingProduct.packaging} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, packaging: toNumberOrZero(event.target.value) } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="inline-flex items-center gap-2 rounded-lg border border-[#d5e1ff] bg-[#f6f9ff] px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={editingProduct.taxable} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, taxable: event.target.checked } : prev))} />Taxable?</label>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-[#cfdbfb] bg-gradient-to-b from-[#f9fbff] to-[#eff4ff] p-3">
                      <p className="text-[11px] font-black tracking-[0.12em] uppercase text-[#3557a7]">Costing</p>
                      <div className="mt-3 grid gap-3 lg:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Supplier Cost (Gross)</label>
                          <input type="number" min={0} step="0.01" value={editingProduct.supplierCostGross} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, supplierCostGross: toNumberOrZero(event.target.value) } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                        </div>
                        <div className="rounded-xl border border-[#d8e3ff] bg-white p-3">
                          <p className="mb-2 text-xs font-black uppercase text-[#38539c]">Discounts (%)</p>
                          <div className="grid grid-cols-5 gap-2">
                            {editingProduct.discounts.map((value, index) => (
                              <div key={`disc-${index}`}>
                                <label className="mb-1 block text-[11px] font-bold text-slate-500">D{index + 1}</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={value}
                                  onChange={(event) =>
                                    setEditingProduct((prev) => {
                                      if (!prev) return prev;
                                      const next = [...prev.discounts] as ProductEditorDraft["discounts"];
                                      next[index] = toNumberOrZero(event.target.value);
                                      return { ...prev, discounts: next };
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-[#062d8c]"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-xl border border-[#d8e3ff] bg-white p-3">
                          <p className="mb-2 text-xs font-black uppercase text-[#38539c]">Add-ons</p>
                          <div className="grid grid-cols-5 gap-2">
                            {editingProduct.addOns.map((value, index) => (
                              <div key={`addon-${index}`}>
                                <label className="mb-1 block text-[11px] font-bold text-slate-500">A{index + 1}</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={value}
                                  onChange={(event) =>
                                    setEditingProduct((prev) => {
                                      if (!prev) return prev;
                                      const next = [...prev.addOns] as ProductEditorDraft["addOns"];
                                      next[index] = toNumberOrZero(event.target.value);
                                      return { ...prev, addOns: next };
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-[#062d8c]"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl border border-[#b9ccff] bg-white px-4 py-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Net Cost</p>
                        <p className="text-2xl font-black text-[#062d8c]">{computeNetCost(editingProduct).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-[#cfdbfb] bg-gradient-to-b from-[#f9fbff] to-[#eff4ff] p-3">
                      <p className="text-[11px] font-black tracking-[0.12em] uppercase text-[#3557a7]">Inventory Levels</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Reorder Point</label>
                          <input type="number" min={0} value={editingProduct.reorderPoint} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, reorderPoint: toNumberOrZero(event.target.value) } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Stocking Level</label>
                          <input type="number" min={0} value={editingProduct.stockingLevel} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, stockingLevel: toNumberOrZero(event.target.value) } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Minimum Order</label>
                          <input type="number" min={0} value={editingProduct.minimumOrder} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, minimumOrder: toNumberOrZero(event.target.value) } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">On Order</label>
                          <input type="number" min={0} value={editingProduct.onOrder} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, onOrder: toNumberOrZero(event.target.value) } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedTab === "pricing" ? (
                  <div className="rounded-2xl border border-[#d5e1ff] bg-white/90 p-4 shadow-[0_14px_28px_rgba(7,29,98,0.08)]">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Supplier Unit Cost</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editingProduct.supplierUnitCost}
                        onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, supplierUnitCost: toNumberOrZero(event.target.value) } : prev))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Unit & Packaging</label>
                      <input type="text" value={editingProduct.unitPackaging} onChange={(event) => setEditingProduct((prev) => (prev ? { ...prev, unitPackaging: event.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Markup (%)</label>
                      <input type="number" min={0} step="0.01" value={editingProduct.markupPercent} onChange={(event) => {
                        const markup = toNumberOrZero(event.target.value);
                        setEditingProduct((prev) => {
                          if (!prev) return prev;
                          const unitNetCost = computeNetCost(prev);
                          const computedSelling = roundTo2(unitNetCost * (1 + markup / 100));
                          const nextLevels = prev.priceLevels.map((level) => (
                            level.levelNo === 1 ? { ...level, price: computedSelling } : level
                          ));
                          return { ...prev, markupPercent: markup, sellingPrice: computedSelling, priceLevels: nextLevels };
                        });
                      }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Selling Price</label>
                      <input type="number" min={0} step="0.01" value={editingProduct.sellingPrice} onChange={(event) => {
                        const selling = toNumberOrZero(event.target.value);
                        setEditingProduct((prev) => {
                          if (!prev) return prev;
                          const nextLevels = prev.priceLevels.map((level) => (
                            level.levelNo === 1 ? { ...level, price: selling } : level
                          ));
                          return { ...prev, sellingPrice: selling, markupPercent: computeMarkupPercent(selling, computeNetCost(prev)), priceLevels: nextLevels };
                        });
                      }} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]" />
                    </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-[#cfdbfb] bg-gradient-to-b from-[#f9fbff] to-[#eff4ff] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-black tracking-[0.12em] uppercase text-[#3557a7]">Price Levels</p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct((prev) => {
                              if (!prev) return prev;
                              const nextLevelNo = prev.priceLevels.length > 0
                                ? Math.max(...prev.priceLevels.map((level) => level.levelNo)) + 1
                                : 4;
                              return {
                                ...prev,
                                priceLevels: [
                                  ...prev.priceLevels,
                                  {
                                    levelNo: nextLevelNo,
                                    label: `Level ${nextLevelNo}`,
                                    purpose: "Custom pricing",
                                    price: 0,
                                    isDefault: false,
                                  },
                                ],
                              };
                            });
                          }}
                          className="rounded-lg border border-[#b7cafc] bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-[#27438d] hover:bg-[#eef4ff]"
                        >
                          Add Price Level
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {editingProduct.priceLevels
                          .slice()
                          .sort((a, b) => a.levelNo - b.levelNo)
                          .map((level) => (
                            <div key={`price-level-${level.levelNo}`} className="rounded-xl border border-[#d8e3ff] bg-white p-2.5">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs font-black uppercase text-[#3557a7]">Level {level.levelNo}</p>
                                {level.isDefault ? (
                                  <span className="rounded-full bg-[#edf3ff] px-2 py-0.5 text-[11px] font-bold text-[#38539c]">Default</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingProduct((prev) => {
                                        if (!prev) return prev;
                                        return {
                                          ...prev,
                                          priceLevels: prev.priceLevels.filter((entry) => entry.levelNo !== level.levelNo),
                                        };
                                      })
                                    }
                                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold uppercase text-red-700 hover:bg-red-100"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>

                              <div className="grid gap-2">
                                <label className="text-[11px] font-bold uppercase text-slate-500">Price/Name Type</label>
                                <input
                                  type="text"
                                  value={level.label}
                                  onChange={(event) =>
                                    setEditingProduct((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        priceLevels: prev.priceLevels.map((entry) =>
                                          entry.levelNo === level.levelNo
                                            ? { ...entry, label: event.target.value, purpose: event.target.value || entry.purpose }
                                            : entry
                                        ),
                                      };
                                    })
                                  }
                                  placeholder="Retail Price"
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                                />
                                <label className="text-[11px] font-bold uppercase text-slate-500">Price</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={level.price}
                                  onChange={(event) =>
                                    setEditingProduct((prev) => {
                                      if (!prev) return prev;
                                      const nextValue = toNumberOrZero(event.target.value);
                                      const nextLevels = prev.priceLevels.map((entry) =>
                                        entry.levelNo === level.levelNo ? { ...entry, price: nextValue } : entry
                                      );
                                      if (level.levelNo === 1) {
                                        return {
                                          ...prev,
                                          priceLevels: nextLevels,
                                          sellingPrice: nextValue,
                                          markupPercent: computeMarkupPercent(nextValue, computeNetCost(prev)),
                                        };
                                      }
                                      return { ...prev, priceLevels: nextLevels };
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-[#cfdbfb] bg-gradient-to-b from-[#f9fbff] to-[#eff4ff] px-4 py-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Computed Markup / Gross Margin</p>
                      <p className="text-2xl font-black text-[#062d8c]">
                        {computeMarkupPercent(editingProduct.sellingPrice, computeNetCost(editingProduct)).toFixed(2)}% / {computeGrossMarginPercent(editingProduct.sellingPrice, computeNetCost(editingProduct)).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ) : null}

                {selectedTab === "supplierList" ? (
                  <div className="rounded-2xl border border-[#d5e1ff] bg-white/90 p-3 shadow-[0_14px_28px_rgba(7,29,98,0.08)]">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[11px] font-black tracking-[0.12em] uppercase text-[#3557a7]">Supplier List</p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              suppliers: [
                                ...prev.suppliers,
                                {
                                  id: `sup-new-${Date.now()}`,
                                  name: "",
                                  costPerUnit: 0,
                                },
                              ],
                            };
                          });
                        }}
                        className="rounded-lg border border-[#b7cafc] bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-[#27438d] hover:bg-[#eef4ff]"
                      >
                        Add Supplier
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-[#d8e3ff]">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#eef3ff] to-[#e5eeff] text-[#062d8c] border-b border-[#dbe3f7]">
                          {["Supplier Name", "Cost Per Unit", "Actions"].map((label) => (
                            <th key={label} className="px-3 py-2 text-left text-xs font-bold uppercase">{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {editingProduct.suppliers.map((supplier, index) => (
                          <tr key={supplier.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f8faff]"}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={supplier.name}
                                onChange={(event) =>
                                  setEditingProduct((prev) => {
                                    if (!prev) return prev;
                                    return {
                                      ...prev,
                                      suppliers: prev.suppliers.map((entry) =>
                                        entry.id === supplier.id ? { ...entry, name: event.target.value } : entry
                                      ),
                                    };
                                  })
                                }
                                placeholder="Supplier name"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={supplier.costPerUnit}
                                onChange={(event) =>
                                  setEditingProduct((prev) => {
                                    if (!prev) return prev;
                                    return {
                                      ...prev,
                                      suppliers: prev.suppliers.map((entry) =>
                                        entry.id === supplier.id
                                          ? { ...entry, costPerUnit: toNumberOrZero(event.target.value) }
                                          : entry
                                      ),
                                    };
                                  })
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingProduct((prev) => {
                                    if (!prev) return prev;
                                    return {
                                      ...prev,
                                      suppliers: prev.suppliers.filter((entry) => entry.id !== supplier.id),
                                    };
                                  })
                                }
                                className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold uppercase text-red-700 hover:bg-red-100"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                        {editingProduct.suppliers.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-4 text-center text-sm text-slate-500">No suppliers. Click Add Supplier.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                    </div>
                  </div>
                ) : null}
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#d8e3ff] bg-gradient-to-r from-[#fdfefe] via-[#f4f8ff] to-[#edf4ff] px-6 py-4">
                <button
                  type="button"
                  onClick={closeProductModal}
                  className="rounded-xl border border-[#b9ccff] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#35539f] transition-all hover:-translate-y-[1px] hover:bg-[#eff4ff]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveProductEdit}
                  disabled={isSavingProduct}
                  className="rounded-xl bg-gradient-to-r from-[#0e3ca8] to-[#2a63e8] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white shadow-[0_12px_24px_rgba(8,37,114,0.35)] transition-all hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingProduct ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <AdminFooter lastSync={lastSync} />

        <div className="block xl:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex items-center justify-between z-50 shadow-lg">
          <div className="text-xs text-slate-600">
            Sync: {lastSync ? formatTime(lastSync) : "--:--:--"}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">STATUS:</span>
            <div
              className={`flex items-center gap-1.5 h-8 px-3 rounded-xl ${
                isOnline ? "bg-[#0c8628]" : "bg-[#cc5500]"
              }`}
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span
                className={`text-xs font-semibold ${
                  isOnline ? "text-[#acf9be]" : "text-white"
                }`}
              >
                {isOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
