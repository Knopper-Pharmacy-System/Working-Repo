import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Calendar,
  Clock,
  LogOut,
  Receipt as ReceiptIcon,
  User,
} from "lucide-react";
import logoOutline from "../../assets/logo_outline.png";
import bannerLogo from "../../assets/banner_logo.png";
import {
  clearSuspendedTransaction,
  type CompletedTransaction,
  type ElectronicJournalEntry,
  closeShiftWithBalance,
  db,
  getActiveShift,
  getCompletedTransactionsByCashier,
  getCompletedTransactionByReceipt,
  getCurrentBranchName,
  getElectronicJournalEntries,
  getRecentCompletedTransactions,
  getReturnRecordsByReceipt,
  getSuspendedTransaction,
  logElectronicJournal,
  deductInventoryStock,
  getLastClosedShift,
  recordCompletedTransaction,
  recordReturnVoid,
  restoreInventoryStock,
  startShift,
  suspendTransaction,
  updateActiveShiftOpeningBalance,
  verifyManagerPin,
} from "../../features/pos/api/db"; // Enable Dexie for offline support
import { getSessionLoginPassword, getTerminalLockState, logout, setTerminalLockState } from "../../hooks/useAuth";
import InventoryModal from "../../components/pos/InventoryModal";
import CartDisplay from "../../components/pos/CartDisplay";
import OpeningBalanceModal from "../../components/pos/OpeningBalanceModal";
import ManagerAuthModal from "../../components/pos/ManagerAuthModal";
import ClosingBalanceModal from "../../components/pos/ClosingBalanceModal";
import CheckoutModal from "../../components/pos/CheckoutModal";
import TerminalLockModal from "../../components/pos/TerminalLockModal";

const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "MEDICINE", label: "Medicine" },
  { value: "GROCERY", label: "Grocery" },
  { value: "MEDICAL_SUPPLIES", label: "Medical Supplies" },
];

const DISCOUNT_TYPES = [
  "#1",
  "#2",
  "#3",
  "#4",
];

const DISCOUNT_RATES = [0, 0.20, 0.10, 0];
const SENIOR_DISCOUNT_INDEX = 1;
const ITEMS_PER_PAGE = 50;
const INITIAL_SEQUENCE_NUMBER = 1;
const RETURN_REASONS = [
  "Wrong Item",
  "Damaged Product",
  "Expired Product",
  "Pricing Error",
  "Customer Request",
  "Other",
];

const toPaddedTransactionNumber = (value: number) =>
  Math.max(INITIAL_SEQUENCE_NUMBER, Number.isFinite(value) ? Math.floor(value) : INITIAL_SEQUENCE_NUMBER)
    .toString()
    .padStart(9, "0");

const parseStoredSequence = (storageKey: string) => {
  const rawValue = localStorage.getItem(storageKey);
  const parsedValue = Number.parseInt(rawValue ?? "", 10);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : INITIAL_SEQUENCE_NUMBER;
};

const getCurrentBranchIdFromToken = () => {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return 1;

    const payload = token.split(".")[1];
    if (!payload) return 1;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddingLength = (4 - (normalized.length % 4 || 4)) % 4;
    const padded = normalized + "=".repeat(paddingLength);
    const decoded = JSON.parse(atob(padded));
    const branchId = Number(decoded?.branch);
    return Number.isFinite(branchId) && branchId > 0 ? branchId : 1;
  } catch {
    return 1;
  }
};

type CartItem = {
  id: number;
  description: string;
  quantity: number;
  price: number;
  total: number;
  inventoryId?: number;
};

type SelectedItem = {
  id: number;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  total: number;
  stock: number; // available stock
};

type InventoryItem = {
  id: number;              // inventory_id
  name: string;            // product_name_official
  productId?: number;
  barcode: string;
  category?: string;
  expiry: string | null;   // expiry_date as string
  quantity: number;        // quantity_on_hand
  price: number;           // price_regular
  gondola: string;         // gondola_code
};

const getInventoryBarcodeValue = (item: {
  qr?: string;
  qr_code?: string;
  barcode?: string;
  barcode_value?: string;
  barcodeValue?: string;
  product_barcode?: string;
  primary_barcode?: string;
  Barcode?: string;
  BARCODE?: string;
}) => {
  const candidates = [
    item.barcode,
    item.barcode_value,
    item.barcodeValue,
    item.product_barcode,
    item.primary_barcode,
    item.Barcode,
    item.BARCODE,
    item.qr,
    item.qr_code,
  ];

  for (const candidate of candidates) {
    const value = typeof candidate === "string" ? candidate.trim() : "";
    if (!value) continue;
    const normalized = value.toUpperCase();
    if (
      /^[-‐‑–—―\s]+$/u.test(value) ||
      normalized === "N/A" ||
      normalized === "NA" ||
      normalized === "NONE" ||
      !/[0-9A-Z]/i.test(value)
    ) {
      continue;
    }
    return value;
  }

  return "";
};

const getInventoryDisplayName = (item: {
  name?: string;
  product_name?: string;
  product_name_official?: string;
}) => {
  const rawName = item.product_name_official || item.product_name || item.name || "Unnamed Product";
  return rawName.trim().toLowerCase() === "unnamed" ? "Unnamed Product" : rawName;
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

const matchesSelectedCategory = (itemCategory: string | undefined, selectedCategory: string) => {
  if (!selectedCategory) return true;
  const normalizedItem = normalizeInventoryCategory(itemCategory);
  const normalizedSelected = normalizeInventoryCategory(selectedCategory);

  if (normalizedItem === normalizedSelected) {
    return true;
  }

  if (normalizedSelected === "MEDICAL_SUPPLIES") {
    return normalizedItem !== "" && normalizedItem !== "MEDICINE" && normalizedItem !== "GROCERY";
  }

  return false;
};

type InventoryNavigationEvent = Pick<globalThis.KeyboardEvent, "key" | "ctrlKey" | "preventDefault">;
type StockFilter = "all-stock" | "in-stock" | "low-stock" | "out-of-stock";
type ReadingType = "X" | "Z";

type ToastType = "info" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ReadingSummary = {
  type: ReadingType;
  generatedAt: number;
  totalTransactions: number;
  totalSales: number;
  totalDiscount: number;
  totalAddOn: number;
  netSales: number;
  tenderTotal: number;
  cashCount: number;
};

type VoidMode = "single" | "all" | "selected";
type ActionInputMode = "add-on" | "department" | "pickup";

type VoidSelection = {
  selected: boolean;
  quantity: number;
  replacementProduct: string;
};

type SeniorDiscountDetails = {
  idNumber: string;
  name: string;
  discountLimit: number | null;
};

type ReadingInputState = {
  isOpen: boolean;
  type: ReadingType;
  cashCountInput: string;
  error: string | null;
};

function CashierPosPage() {
  const currentBranchName = getCurrentBranchName();
  const [currentBranchId] = useState<number>(() => getCurrentBranchIdFromToken());
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("pos_cartItems");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentItemDescription, setCurrentItemDescription] = useState("");
  const [addOn, setAddOn] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("pos_addOn");
      return saved ? Number(saved) : 0;
    } catch { return 0; }
  });
  const [terminalId] = useState("001");
  const [invoiceSequence, setInvoiceSequence] = useState<number>(() =>
    parseStoredSequence("pos_invoiceSequence")
  );
  const [transactionSequence, setTransactionSequence] = useState<number>(() =>
    parseStoredSequence("pos_transactionSequence")
  );
  const invoiceNo = toPaddedTransactionNumber(invoiceSequence);
  const transNo = toPaddedTransactionNumber(transactionSequence);
  const [cashierName] = useState(() => localStorage.getItem("cashier_username") || "Cashier");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounterRef = useRef(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isCheckingShift, setIsCheckingShift] = useState(true);
  const [isEditingOpeningBalance, setIsEditingOpeningBalance] = useState(false);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [lastClosingBalance, setLastClosingBalance] = useState<number | null>(null);
  const [discountTypeIndex, setDiscountTypeIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("pos_discountTypeIndex");
      return saved ? Number(saved) : 0;
    } catch { return 0; }
  });
  const discountTypeLabel = DISCOUNT_TYPES[discountTypeIndex];

  // Manager approval modal state
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [isAuthorizingManager, setIsAuthorizingManager] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [isLiveVoidModalOpen, setIsLiveVoidModalOpen] = useState(false);
  const [isLiveVoidSubmitting, setIsLiveVoidSubmitting] = useState(false);
  const [liveVoidPin, setLiveVoidPin] = useState("");
  const [liveVoidError, setLiveVoidError] = useState<string | null>(null);
  const [liveVoidItem, setLiveVoidItem] = useState<CartItem | null>(null);
  const [pendingAction, setPendingAction] = useState<"discount" | "return" | "payment" | "price_override" | "cancel" | "void_previous" | null>(null);
  const [isKeybindHelpOpen, setIsKeybindHelpOpen] = useState(false);
  const [isClosingBalanceOpen, setIsClosingBalanceOpen] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [isReceiptConfirmOpen, setIsReceiptConfirmOpen] = useState(false);
  const [receiptEnabled, setReceiptEnabled] = useState(true);
  const [lastTenderedAmount, setLastTenderedAmount] = useState(0);
  const [lastChangeAmount, setLastChangeAmount] = useState(0);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [actionInputModal, setActionInputModal] = useState<{
    isOpen: boolean;
    mode: ActionInputMode;
    value: string;
    error: string | null;
  }>({
    isOpen: false,
    mode: "add-on",
    value: "",
    error: null,
  });
  const [readingInputState, setReadingInputState] = useState<ReadingInputState>({
    isOpen: false,
    type: "X",
    cashCountInput: "0",
    error: null,
  });
  const [isSeniorDiscountModalOpen, setIsSeniorDiscountModalOpen] = useState(false);
  const [seniorCitizenIdNumber, setSeniorCitizenIdNumber] = useState("");
  const [seniorCitizenName, setSeniorCitizenName] = useState("");
  const [seniorDiscountLimitInput, setSeniorDiscountLimitInput] = useState("");
  const [seniorDiscountError, setSeniorDiscountError] = useState<string | null>(null);
  const [seniorDiscountDetails, setSeniorDiscountDetails] = useState<SeniorDiscountDetails | null>(null);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [journalEntries, setJournalEntries] = useState<ElectronicJournalEntry[]>([]);
  const [isLoadingJournal, setIsLoadingJournal] = useState(false);
  const [isReadingReportOpen, setIsReadingReportOpen] = useState(false);
  const [isGeneratingReading, setIsGeneratingReading] = useState(false);
  const [readingSummary, setReadingSummary] = useState<ReadingSummary | null>(null);
  const [isSignOffOpen, setIsSignOffOpen] = useState(false);
  const [isTerminalLocked, setIsTerminalLocked] = useState(() => getTerminalLockState());
  const [isUnlockingTerminal, setIsUnlockingTerminal] = useState(false);
  const [terminalLockError, setTerminalLockError] = useState<string | null>(null);
  const [isReturnsOpen, setIsReturnsOpen] = useState(false);
  const [isRecallListOpen, setIsRecallListOpen] = useState(false);
  const [isLoadingRecallList, setIsLoadingRecallList] = useState(false);
  const [isCheckingReceipt, setIsCheckingReceipt] = useState(false);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [returnReceiptNo, setReturnReceiptNo] = useState("");
  const [selectedReturnItemId, setSelectedReturnItemId] = useState<number | null>(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [voidMode, setVoidMode] = useState<VoidMode>("single");
  const [voidSelections, setVoidSelections] = useState<Record<number, VoidSelection>>({});
  const [replacementProduct, setReplacementProduct] = useState("");
  const [voidReason, setVoidReason] = useState(RETURN_REASONS[0]);
  const [returnManagerPin, setReturnManagerPin] = useState("");
  const [returnFlowError, setReturnFlowError] = useState<string | null>(null);
  const [recalledCompletedTransactions, setRecalledCompletedTransactions] = useState<CompletedTransaction[]>([]);
  const [voidedReceiptNos, setVoidedReceiptNos] = useState<Set<string>>(new Set());
  const [selectedCompletedTransaction, setSelectedCompletedTransaction] =
    useState<CompletedTransaction | null>(null);

  // Inventory modal
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("MEDICINE");
  const [stockFilter, setStockFilter] = useState<StockFilter>("in-stock");
  const [showBarcodeColumn, setShowBarcodeColumn] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedInventoryIndex, setSelectedInventoryIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalInventoryCount, setTotalInventoryCount] = useState(0);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const lastAddToCartAtRef = useRef(0);
  const lastSelectItemAtRef = useRef<{ itemId: number; at: number } | null>(null);
  const inventorySearchRef = useRef<HTMLInputElement | null>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const actionInputRef = useRef<HTMLInputElement | null>(null);
  const readingCashInputRef = useRef<HTMLInputElement | null>(null);
  const seniorIdInputRef = useRef<HTMLInputElement | null>(null);
  const seniorNameInputRef = useRef<HTMLInputElement | null>(null);
  const seniorLimitInputRef = useRef<HTMLInputElement | null>(null);
  const seniorSubmitButtonRef = useRef<HTMLButtonElement | null>(null);
  const totalInventoryPages = Math.max(1, Math.ceil(totalInventoryCount / ITEMS_PER_PAGE));
  const hasPreviousInventoryPage = currentPage > 0;
  const hasNextInventoryPage = currentPage + 1 < totalInventoryPages;

  const resetReturnsState = useCallback(() => {
    setReturnReceiptNo("");
    setSelectedReturnItemId(null);
    setReturnQuantity(1);
    setVoidMode("single");
    setVoidSelections({});
    setReplacementProduct("");
    setVoidReason(RETURN_REASONS[0]);
    setReturnManagerPin("");
    setReturnFlowError(null);
    setRecalledCompletedTransactions([]);
    setSelectedCompletedTransaction(null);
  }, []);

  const resetCurrentSaleState = useCallback(() => {
    setCartItems([]);
    setAddOn(0);
    setDiscountTypeIndex(0);
    setCurrentItemDescription("");
    setCurrentQuantity(1);
    setSelectedItems([]);
    setInventorySearch("");
    setInventoryItems([]);
    setSelectedInventoryIndex(0);
    setCurrentPage(0);
    setTotalInventoryCount(0);
    setShowInventoryModal(false);
    setIsSeniorDiscountModalOpen(false);
    setSeniorCitizenIdNumber("");
    setSeniorCitizenName("");
    setSeniorDiscountLimitInput("");
    setSeniorDiscountError(null);
    setSeniorDiscountDetails(null);
    localStorage.removeItem("pos_cartItems");
    localStorage.removeItem("pos_addOn");
    localStorage.removeItem("pos_discountTypeIndex");
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastCounterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleSuspendTransaction = useCallback(async () => {
    if (cartItems.length === 0) {
      showToast("No cart items to suspend.", "error");
      return;
    }

    try {
      await suspendTransaction({
        branchName: currentBranchName,
        cashierName,
        cartItems,
        addOn,
        discountTypeIndex,
        currentItemDescription,
      });

      resetCurrentSaleState();
      showToast("Transaction suspended. Press Shift+F9 to recall suspended cart.", "success");
      window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
    } catch (err) {
      console.error("Failed to suspend transaction:", err);
      showToast("Could not suspend transaction. Please try again.", "error");
    }
  }, [
    addOn,
    cartItems,
    cashierName,
    currentBranchName,
    currentItemDescription,
    discountTypeIndex,
    resetCurrentSaleState,
  ]);

  const handleRecallTransaction = useCallback(async () => {
    try {
      const suspended = await getSuspendedTransaction(currentBranchName, cashierName);
      if (!suspended) {
        showToast("No suspended transaction found.", "error");
        return;
      }

      setCartItems(suspended.cartItems);
      setAddOn(suspended.addOn);
      setDiscountTypeIndex(suspended.discountTypeIndex);
      showToast("Suspended transaction recalled.", "success");
      setCurrentItemDescription(suspended.currentItemDescription || "");
      setCurrentQuantity(1);
      setSelectedItems([]);
      setShowInventoryModal(false);
      await clearSuspendedTransaction(currentBranchName, cashierName);
      window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
    } catch (err) {
      console.error("Failed to recall transaction:", err);
      showToast("Could not recall suspended transaction. Please try again.", "error");
    }
  }, [cashierName, currentBranchName]);

  const handleOpenReturns = useCallback(() => {
    setIsReturnsOpen(true);
    setIsRecallListOpen(false);
    setIsKeybindHelpOpen(false);
    setShowInventoryModal(false);
    setReturnFlowError(null);
  }, []);

  const applyTransactionToReturns = useCallback((transaction: CompletedTransaction) => {
    setSelectedCompletedTransaction(transaction);
    setReturnReceiptNo(transaction.receiptNo);
    setSelectedReturnItemId(transaction.cartItems[0]?.id ?? null);
    setReturnQuantity(1);
    setVoidMode("single");
    setReplacementProduct("");
    const initialSelections: Record<number, VoidSelection> = {};
    transaction.cartItems.forEach((item) => {
      initialSelections[item.id] = {
        selected: false,
        quantity: 1,
        replacementProduct: "",
      };
    });
    setVoidSelections(initialSelections);
    setReturnFlowError(null);
    setIsReturnsOpen(true);
    setIsRecallListOpen(false);
    setIsKeybindHelpOpen(false);
    setShowInventoryModal(false);
  }, []);

  const handleOpenRecallListPopup = useCallback(async () => {
    setIsLoadingRecallList(true);
    setReturnFlowError(null);

    try {
      const recentTransactions = await getRecentCompletedTransactions(currentBranchName, 12);
      setRecalledCompletedTransactions(recentTransactions);

      const statusPairs = await Promise.all(
        recentTransactions.map(async (transaction) => {
          const voidRecords = await getReturnRecordsByReceipt(transaction.receiptNo, currentBranchName);
          return [transaction.receiptNo, voidRecords.length > 0] as const;
        })
      );
      setVoidedReceiptNos(
        new Set(
          statusPairs
            .filter(([, hasVoid]) => hasVoid)
            .map(([receiptNo]) => receiptNo)
        )
      );

      if (recentTransactions.length === 0) {
        showToast("No previous transactions found for this branch.", "info");
        setIsRecallListOpen(false);
        return;
      }

      setIsRecallListOpen(true);
      setIsKeybindHelpOpen(false);
      setShowInventoryModal(false);
    } catch (err) {
      console.error("Failed to open recall list:", err);
      showToast("Could not load previous transactions.", "error");
      setIsRecallListOpen(false);
    } finally {
      setIsLoadingRecallList(false);
    }
  }, [currentBranchName]);

  const appendJournal = useCallback(async (keyLabel: string, action: string, details?: string) => {
    try {
      await logElectronicJournal({
        branchName: currentBranchName,
        cashierName,
        keyLabel,
        action,
        details,
      });
    } catch (err) {
      console.error("Failed to write electronic journal entry:", err);
    }
  }, [cashierName, currentBranchName]);

  const generateReadingSummary = useCallback(async (type: ReadingType, cashCount: number) => {
    setIsGeneratingReading(true);
    try {
      const activeShift = await getActiveShift(currentBranchName);
      const defaultStart = new Date();
      defaultStart.setHours(0, 0, 0, 0);
      const fromTimestamp = activeShift?.openedAt ?? defaultStart.getTime();

      const transactions = await getCompletedTransactionsByCashier({
        branchName: currentBranchName,
        cashierName,
        fromTimestamp,
      });

      const totalSales = transactions.reduce((sum, item) => sum + item.subtotal, 0);
      const totalDiscount = transactions.reduce((sum, item) => sum + item.discount, 0);
      const totalAddOn = transactions.reduce((sum, item) => sum + item.addOn, 0);
      const netSales = transactions.reduce((sum, item) => sum + item.amountDue, 0);

      const summary: ReadingSummary = {
        type,
        generatedAt: Date.now(),
        totalTransactions: transactions.length,
        totalSales,
        totalDiscount,
        totalAddOn,
        netSales,
        tenderTotal: netSales,
        cashCount,
      };

      setReadingSummary(summary);
      setIsReadingReportOpen(true);
      await appendJournal(
        type,
        type === "X" ? "X Reading" : "Z Reading",
        `Transactions: ${summary.totalTransactions}, Net Sales: ${summary.netSales.toFixed(2)}, Cash Count: ${summary.cashCount.toFixed(2)}`
      );
      return summary;
    } finally {
      setIsGeneratingReading(false);
    }
  }, [appendJournal, cashierName, currentBranchName]);

  const handleOpenElectronicJournal = useCallback(async () => {
    setIsLoadingJournal(true);
    try {
      const entries = await getElectronicJournalEntries(currentBranchName, cashierName, 300);
      setJournalEntries(entries);
      setIsJournalOpen(true);
      await appendJournal("F11", "Electronic Journal Opened", `Entries loaded: ${entries.length}`);
    } catch (err) {
      console.error("Failed to load electronic journal:", err);
      showToast("Could not load electronic journal.", "error");
    } finally {
      setIsLoadingJournal(false);
    }
  }, [appendJournal, cashierName, currentBranchName]);

  const handleRefreshOnlineShortcut = useCallback(async () => {
    const nowOnline = navigator.onLine;
    setIsOnline(nowOnline);
    showToast(nowOnline ? "System refreshed. Online mode active." : "System refreshed. Offline mode active.", nowOnline ? "success" : "info");
    await appendJournal("F1", "Refresh/Online", nowOnline ? "Online" : "Offline");
  }, [appendJournal]);

  const handleItemDiscountShortcut = useCallback(async () => {
    setDiscountTypeIndex((prev) => {
      const next = (prev + 1) % DISCOUNT_TYPES.length;
      void appendJournal("F2", "Discount Type", `Switched to discount type ${DISCOUNT_TYPES[next]}`);
      return next;
    });
  }, [appendJournal]);

  const handleSubtotalDiscountShortcut = useCallback(async () => {
    if (cartItems.length === 0) {
      showToast("No items in cart to apply a discount to.", "error");
      return;
    }
    setPendingAction("discount");
    setManagerError(null);
    setIsManagerModalOpen(true);
    await appendJournal("F3", "Subtotal Discount", "Manager PIN requested to apply subtotal discount.");
  }, [appendJournal, cartItems.length]);

  const openActionInputModal = useCallback((mode: ActionInputMode, value: string) => {
    setActionInputModal({
      isOpen: true,
      mode,
      value,
      error: null,
    });
    window.setTimeout(() => actionInputRef.current?.focus(), 0);
  }, []);

  const handleAddOnShortcut = useCallback(async () => {
    openActionInputModal("add-on", String(addOn));
  }, [addOn, openActionInputModal]);

  const handleConfirmActionInputModal = useCallback(async () => {
    const trimmed = actionInputModal.value.trim();

    if (actionInputModal.mode === "department") {
      if (!trimmed) {
        setActionInputModal((prev) => ({ ...prev, error: "Department code is required." }));
        return;
      }
      setActionInputModal((prev) => ({ ...prev, isOpen: false, error: null }));
      showToast(`Open Department: ${trimmed}`, "info");
      await appendJournal("POS", "Open Department", trimmed);
      return;
    }

    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setActionInputModal((prev) => ({
        ...prev,
        error: prev.mode === "pickup" ? "Invalid pickup amount." : "Invalid add-on amount.",
      }));
      return;
    }

    if (actionInputModal.mode === "pickup") {
      setActionInputModal((prev) => ({ ...prev, isOpen: false, error: null }));
      await appendJournal("POS", "Pick Up", `Pickup amount: ${numericValue.toFixed(2)}`);
      showToast(`Pickup logged: PHP ${numericValue.toFixed(2)}`, "success");
      return;
    }

    setAddOn(numericValue);
    setActionInputModal((prev) => ({ ...prev, isOpen: false, error: null }));
    await appendJournal("POS", "Add-on Amount", `Set add-on to ${numericValue.toFixed(2)}`);
  }, [actionInputModal.mode, actionInputModal.value, appendJournal, showToast]);

  const handleLiveItemVoidShortcut = useCallback(async () => {
    if (cartItems.length === 0) {
      showToast("No cart item to void.", "error");
      return;
    }

    const lastItem = cartItems[cartItems.length - 1];
    setLiveVoidItem(lastItem);
    setLiveVoidPin("");
    setLiveVoidError(null);
    setIsLiveVoidModalOpen(true);
    await appendJournal("F6", "Live Item Void Requested", `Pending manager approval for ${lastItem.description}`);
  }, [appendJournal, cartItems, showToast]);

  const handleConfirmLiveVoid = useCallback(async () => {
    if (!liveVoidItem) {
      setLiveVoidError("No item selected for void.");
      return;
    }

    if (!liveVoidPin.trim()) {
      setLiveVoidError("Manager PIN is required.");
      return;
    }

    setIsLiveVoidSubmitting(true);
    setLiveVoidError(null);

    try {
      const approved = await verifyManagerPin(liveVoidPin.trim());
      if (!approved) {
        setLiveVoidError("Invalid manager PIN.");
        return;
      }

      setCartItems((prev) => prev.filter((item) => item.id !== liveVoidItem.id));

      // Close immediately after successful approval and cart update.
      setIsLiveVoidModalOpen(false);
      setLiveVoidItem(null);
      setLiveVoidPin("");
      setLiveVoidError(null);
      window.setTimeout(() => barcodeInputRef.current?.focus(), 0);

      void appendJournal(
        "F6",
        "Live Item Void",
        `Voided ${liveVoidItem.description} (Qty: ${liveVoidItem.quantity}) with manager approval.`
      );

      showToast(`Voided ${liveVoidItem.description}.`, "success");
    } catch (err) {
      console.error("Live item void failed:", err);
      setLiveVoidError("Unable to void item. Please try again.");
    } finally {
      setIsLiveVoidSubmitting(false);
    }
  }, [appendJournal, liveVoidItem, liveVoidPin, showToast]);

  const handleTransactionCancelShortcut = useCallback(async () => {
    if (cartItems.length === 0) {
      showToast("No active transaction to cancel.", "error");
      return;
    }

    setPendingAction("cancel");
    setManagerError(null);
    setIsManagerModalOpen(true);
    await appendJournal("F7", "Transaction Cancel Requested", "Manager PIN required to cancel transaction.");
  }, [appendJournal, cartItems.length]);

  const handleVoidPreviousTransactionShortcut = useCallback(async () => {
    setPendingAction("void_previous");
    setManagerError(null);
    setIsManagerModalOpen(true);
    await appendJournal("F8", "Void Previous Transaction Requested", "Manager PIN required.");
  }, [appendJournal]);

  const handleSuspendRecallShortcut = useCallback(async () => {
    if (cartItems.length > 0) {
      await handleSuspendTransaction();
      await appendJournal("F9", "Suspend Transaction", `Items: ${cartItems.length}`);
      return;
    }

    await handleRecallTransaction();
    await appendJournal("F9", "Recall Transaction", "Recall attempted for suspended cart.");
  }, [appendJournal, cartItems.length, handleRecallTransaction, handleSuspendTransaction]);

  const handlePriceOverrideShortcut = useCallback(async () => {
    setPendingAction("price_override");
    setManagerError(null);
    setIsManagerModalOpen(true);
    await appendJournal("F10", "Price Override Requested", "Awaiting manager approval.");
  }, [appendJournal]);

  const handleXReadingShortcut = useCallback(async () => {
    const runningSubtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
    const runningDiscount = runningSubtotal * DISCOUNT_RATES[discountTypeIndex];
    const runningAmountDue = runningSubtotal - runningDiscount + addOn;
    setReadingInputState({
      isOpen: true,
      type: "X",
      cashCountInput: runningAmountDue.toFixed(2),
      error: null,
    });
    window.setTimeout(() => readingCashInputRef.current?.focus(), 0);
  }, [addOn, cartItems, discountTypeIndex]);

  const handleZReadingShortcut = useCallback(async () => {
    setReadingInputState({
      isOpen: true,
      type: "Z",
      cashCountInput: "0",
      error: null,
    });
    window.setTimeout(() => readingCashInputRef.current?.focus(), 0);
  }, []);

  const handleConfirmReadingInput = useCallback(async () => {
    const finalCash = Number(readingInputState.cashCountInput);
    if (!Number.isFinite(finalCash) || finalCash < 0) {
      setReadingInputState((prev) => ({ ...prev, error: "Cash count must be a valid non-negative number." }));
      return;
    }

    const readingType = readingInputState.type;
    setReadingInputState((prev) => ({ ...prev, isOpen: false, error: null }));
    await generateReadingSummary(readingType, finalCash);

    if (readingType === "X") {
      showToast("X Reading generated.", "success");
      return;
    }

    if (shiftId) {
      await closeShiftWithBalance(shiftId, finalCash);
      setShiftId(null);
      setIsDrawerOpen(true);
    }

    resetCurrentSaleState();
    setIsSignOffOpen(true);
    await appendJournal("POS", "Z Reading Finalized", `Final Cash: ${finalCash.toFixed(2)}`);
  }, [appendJournal, generateReadingSummary, readingInputState.cashCountInput, readingInputState.type, resetCurrentSaleState, shiftId, showToast]);

  const handleNoSaleShortcut = useCallback(async () => {
    showToast("No Sale triggered. Cash drawer opened.", "info");
    await appendJournal("H", "No Sale", "Cash drawer opened without sale.");
  }, [appendJournal]);

  const handleOpenDepartmentShortcut = useCallback(async () => {
    openActionInputModal("department", "GENERAL");
  }, [openActionInputModal]);

  const handlePickupShortcut = useCallback(async () => {
    openActionInputModal("pickup", "0");
  }, [openActionInputModal]);

  const handleReprintShortcut = useCallback(async () => {
    setIsReceiptConfirmOpen(true);
    await appendJournal("R", "Reprint", "Receipt reprint requested.");
  }, [appendJournal]);

  const handlePriceLevelShortcut = useCallback(async () => {
    setDiscountTypeIndex((prev) => (prev + 1) % DISCOUNT_TYPES.length);
    await appendJournal("E", "Price Level", "Cycled price/discount level.");
  }, [appendJournal]);

  const handleReceiptToggleShortcut = useCallback(async () => {
    setReceiptEnabled((prev) => {
      const next = !prev;
      void appendJournal("T", "Receipt Toggle", next ? "Receipt ON" : "Receipt OFF");
      return next;
    });
  }, [appendJournal]);

  const handleRecallPreviousTransactions = useCallback(async () => {
    try {
      const recentTransactions = await getRecentCompletedTransactions(currentBranchName, 8);
      setRecalledCompletedTransactions(recentTransactions);

      const statusPairs = await Promise.all(
        recentTransactions.map(async (transaction) => {
          const voidRecords = await getReturnRecordsByReceipt(transaction.receiptNo, currentBranchName);
          return [transaction.receiptNo, voidRecords.length > 0] as const;
        })
      );
      setVoidedReceiptNos(
        new Set(
          statusPairs
            .filter(([, hasVoid]) => hasVoid)
            .map(([receiptNo]) => receiptNo)
        )
      );

      if (recentTransactions.length === 0) {
        setReturnFlowError("No previous transactions found for this branch.");
        return;
      }

      const latest = recentTransactions[0];
      setSelectedCompletedTransaction(latest);
      setReturnReceiptNo(latest.receiptNo);
      setSelectedReturnItemId(latest.cartItems[0]?.id ?? null);
      setReturnQuantity(1);
      setVoidMode("single");
      setReplacementProduct("");
      const initialSelections: Record<number, VoidSelection> = {};
      latest.cartItems.forEach((item) => {
        initialSelections[item.id] = {
          selected: false,
          quantity: 1,
          replacementProduct: "",
        };
      });
      setVoidSelections(initialSelections);
      setReturnFlowError(null);
      await appendJournal("F9", "Recall Previous Transactions", `Loaded ${recentTransactions.length} records.`);
    } catch (err) {
      console.error("Failed to recall previous transactions:", err);
      setReturnFlowError("Could not load previous transactions.");
    }
  }, [appendJournal, currentBranchName]);

  const handleCheckReceiptForReturn = useCallback(async () => {
    if (!returnReceiptNo.trim()) {
      setReturnFlowError("Enter a receipt number first.");
      return;
    }

    setIsCheckingReceipt(true);
    setReturnFlowError(null);

    try {
      const transaction = await getCompletedTransactionByReceipt(
        returnReceiptNo.trim(),
        currentBranchName
      );

      if (!transaction) {
        setSelectedCompletedTransaction(null);
        setSelectedReturnItemId(null);
        setReturnFlowError("Receipt not found in previous transactions.");
        return;
      }

      setSelectedCompletedTransaction(transaction);
      setSelectedReturnItemId(transaction.cartItems[0]?.id ?? null);
      setReturnQuantity(1);
      setVoidMode("single");
      setReplacementProduct("");
      const initialSelections: Record<number, VoidSelection> = {};
      transaction.cartItems.forEach((item) => {
        initialSelections[item.id] = {
          selected: false,
          quantity: 1,
          replacementProduct: "",
        };
      });
      setVoidSelections(initialSelections);

      const voidRecords = await getReturnRecordsByReceipt(transaction.receiptNo, currentBranchName);
      if (voidRecords.length > 0) {
        setVoidedReceiptNos((prev) => {
          const next = new Set(prev);
          next.add(transaction.receiptNo);
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to check receipt:", err);
      setReturnFlowError("Could not check receipt. Try again.");
    } finally {
      setIsCheckingReceipt(false);
    }
  }, [currentBranchName, returnReceiptNo]);

  const handleReturnReceiptToCart = useCallback(async () => {
    if (!selectedCompletedTransaction) {
      setReturnFlowError("Check or select a receipt first.");
      return;
    }

    const now = Date.now();
    const restoredItems: CartItem[] = selectedCompletedTransaction.cartItems.map((item, index) => ({
      id: now + index + Math.random(),
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      total: Number.isFinite(item.total) ? item.total : item.price * item.quantity,
      inventoryId: item.inventoryId,
    }));

    if (restoredItems.length === 0) {
      setReturnFlowError("No items found on the selected receipt.");
      return;
    }

    setCartItems((prev) => [...prev, ...restoredItems]);
    showToast(`Returned ${restoredItems.length} item(s) to cart from receipt #${selectedCompletedTransaction.receiptNo}.`, "success");
    void appendJournal(
      "F4",
      "Return To Cart",
      `Loaded ${restoredItems.length} item(s) from receipt #${selectedCompletedTransaction.receiptNo} back to current cart.`
    );

    setIsReturnsOpen(false);
    resetReturnsState();
    window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
  }, [appendJournal, resetReturnsState, selectedCompletedTransaction, showToast]);

  const handleConfirmVoidReturn = useCallback(async () => {
    if (!selectedCompletedTransaction) {
      setReturnFlowError("Check a receipt before confirming void.");
      return;
    }

    if (!voidReason.trim()) {
      setReturnFlowError("Reason for void is required.");
      return;
    }

    if (!returnManagerPin.trim()) {
      setReturnFlowError("Manager PIN is required.");
      return;
    }

    // Determine items to void
    const itemsToVoid: Array<{ description: string; quantity: number; inventoryId?: number; replacementProduct?: string }> = [];
    const priorVoidRecords = await getReturnRecordsByReceipt(
      selectedCompletedTransaction.receiptNo,
      currentBranchName
    );
    const alreadyVoidedByInventoryId = new Map<number, number>();
    const alreadyVoidedByProduct = new Map<string, number>();
    for (const record of priorVoidRecords) {
      if (record.inventoryId != null) {
        alreadyVoidedByInventoryId.set(
          record.inventoryId,
          (alreadyVoidedByInventoryId.get(record.inventoryId) ?? 0) + record.quantity
        );
      } else {
        alreadyVoidedByProduct.set(
          record.originalProduct,
          (alreadyVoidedByProduct.get(record.originalProduct) ?? 0) + record.quantity
        );
      }
    }

    if (voidMode === "all") {
      for (const item of selectedCompletedTransaction.cartItems) {
        const alreadyVoided = item.inventoryId != null
          ? (alreadyVoidedByInventoryId.get(item.inventoryId) ?? 0)
          : (alreadyVoidedByProduct.get(item.description) ?? 0);
        const remainingQty = Math.max(0, item.quantity - alreadyVoided);
        if (remainingQty > 0) {
          itemsToVoid.push({ description: item.description, quantity: remainingQty, inventoryId: item.inventoryId });
        }
      }
      if (itemsToVoid.length === 0) {
        setReturnFlowError("All items in this receipt are already fully voided.");
        return;
      }
    } else if (voidMode === "selected") {
      const selectedItems = selectedCompletedTransaction.cartItems.filter((item) => voidSelections[item.id]?.selected);
      if (selectedItems.length === 0) {
        setReturnFlowError("Select at least one product to void.");
        return;
      }

      for (const selectedItem of selectedItems) {
        const selectedConfig = voidSelections[selectedItem.id];
        const selectedQty = Number(selectedConfig?.quantity ?? 1);
        const alreadyVoided = selectedItem.inventoryId != null
          ? (alreadyVoidedByInventoryId.get(selectedItem.inventoryId) ?? 0)
          : (alreadyVoidedByProduct.get(selectedItem.description) ?? 0);
        const remainingQty = Math.max(0, selectedItem.quantity - alreadyVoided);

        if (remainingQty <= 0) {
          setReturnFlowError(`${selectedItem.description} is already fully voided.`);
          return;
        }

        if (!Number.isFinite(selectedQty) || selectedQty < 1 || selectedQty > remainingQty) {
          setReturnFlowError(`${selectedItem.description}: quantity must be between 1 and ${remainingQty}.`);
          return;
        }

        itemsToVoid.push({
          description: selectedItem.description,
          quantity: selectedQty,
          inventoryId: selectedItem.inventoryId,
          replacementProduct: selectedConfig?.replacementProduct?.trim() || undefined,
        });
      }
    } else {
      const selectedItem = selectedCompletedTransaction.cartItems.find(
        (item) => item.id === selectedReturnItemId
      );
      if (!selectedItem) {
        setReturnFlowError("Select a product from the receipt.");
        return;
      }
      const alreadyVoided = selectedItem.inventoryId != null
        ? (alreadyVoidedByInventoryId.get(selectedItem.inventoryId) ?? 0)
        : (alreadyVoidedByProduct.get(selectedItem.description) ?? 0);
      const remainingQty = Math.max(0, selectedItem.quantity - alreadyVoided);
      if (remainingQty <= 0) {
        setReturnFlowError("Selected product is already fully voided.");
        return;
      }
      if (returnQuantity < 1 || returnQuantity > remainingQty) {
        setReturnFlowError(`Return quantity must be between 1 and ${remainingQty}.`);
        return;
      }
      itemsToVoid.push({
        description: selectedItem.description,
        quantity: returnQuantity,
        inventoryId: selectedItem.inventoryId,
        replacementProduct: replacementProduct.trim() || undefined,
      });
    }

    setIsProcessingReturn(true);
    setReturnFlowError(null);

    try {
      const approved = await verifyManagerPin(returnManagerPin.trim());
      if (!approved) {
        setReturnFlowError("Invalid manager PIN.");
        return;
      }

      // Record a void entry for each voided item
      for (const voided of itemsToVoid) {
        await recordReturnVoid({
          receiptNo: selectedCompletedTransaction.receiptNo,
          transactionNo: selectedCompletedTransaction.transactionNo,
          branchName: currentBranchName,
          cashierName,
          originalProduct: voided.description,
          inventoryId: voided.inventoryId,
          quantity: voided.quantity,
          replacementProduct: voided.replacementProduct,
          reason: voidReason,
          approvedBy: "Manager PIN",
        });
      }

      // Restore inventory stock for all voided items
      await restoreInventoryStock(itemsToVoid);

      // Mark this receipt as having voids for the indicator
      setVoidedReceiptNos((prev) => {
        const next = new Set(prev);
        next.add(selectedCompletedTransaction.receiptNo);
        return next;
      });

      const summary = voidMode === "all"
        ? `All ${itemsToVoid.length} item(s) voided on receipt #${selectedCompletedTransaction.receiptNo}.`
        : voidMode === "selected"
          ? `Voided ${itemsToVoid.length} selected item(s) on receipt #${selectedCompletedTransaction.receiptNo}.`
          : `Voided ${itemsToVoid[0].quantity}x ${itemsToVoid[0].description} on receipt #${selectedCompletedTransaction.receiptNo}.`;

      void appendJournal("F4", "Return/Void", summary);
      showToast(summary, "success");
      setIsReturnsOpen(false);
      resetReturnsState();
      window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
    } catch (err) {
      console.error("Failed to confirm return/void:", err);
      setReturnFlowError("Could not confirm return. Please try again.");
    } finally {
      setIsProcessingReturn(false);
    }
  }, [
    appendJournal,
    cashierName,
    currentBranchName,
    replacementProduct,
    resetReturnsState,
    returnManagerPin,
    returnQuantity,
    selectedCompletedTransaction,
    selectedReturnItemId,
    voidMode,
    voidSelections,
    voidReason,
  ]);

  const applyStockFilter = (items: any[]) => {
    const getQty = (item: any) => Number(item.quantity ?? item.quantity_on_hand ?? 0);

    if (stockFilter === "all-stock") {
      return items;
    }

    if (stockFilter === "in-stock") {
      return items.filter((item) => getQty(item) > 0);
    }

    if (stockFilter === "low-stock") {
      return items.filter((item) => {
        const qty = getQty(item);
        return qty > 0 && qty <= 10;
      });
    }

    return items.filter((item) => getQty(item) <= 0);
  };

  // Persist cart state to localStorage
  useEffect(() => { localStorage.setItem("pos_cartItems", JSON.stringify(cartItems)); }, [cartItems]);
  useEffect(() => { localStorage.setItem("pos_addOn", String(addOn)); }, [addOn]);
  useEffect(() => { localStorage.setItem("pos_discountTypeIndex", String(discountTypeIndex)); }, [discountTypeIndex]);
  useEffect(() => { localStorage.setItem("pos_invoiceSequence", String(invoiceSequence)); }, [invoiceSequence]);
  useEffect(() => { localStorage.setItem("pos_transactionSequence", String(transactionSequence)); }, [transactionSequence]);
  useEffect(() => { setTerminalLockState(isTerminalLocked); }, [isTerminalLocked]);

  // Check for active shift on mount.
  useEffect(() => {
    let mounted = true;
    const checkActiveShift = async () => {
      try {
        const active = await getActiveShift(currentBranchName);
        if (!mounted) return;

        if (active) {
          setShiftId(active.shiftId);
          setIsDrawerOpen(false);
        } else {
          setIsDrawerOpen(true);
          // Load last closing balance for Load Data button
          try {
            const last = await getLastClosedShift(currentBranchName);
            if (mounted && last?.closingBalance != null) {
              setLastClosingBalance(last.closingBalance);
            }
          } catch { /* non-critical */ }
        }
      } catch (err) {
        console.error("Failed to check shift status:", err);
        if (mounted) setIsDrawerOpen(true);
      } finally {
        if (mounted) {
          setIsCheckingShift(false);
        }
      }
    };

    checkActiveShift();
    return () => {
      mounted = false;
    };
  }, [currentBranchName]);

  // Background load all inventory after login
  useEffect(() => {
    const loadAllInventory = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        // Check if we already have items
        const count = await db.inventory.count();
        if (count > 1000) {
          const sample = await db.inventory.limit(20).toArray();
          const hasBarcodeData = sample.some((item) => Boolean(item.barcode || item.barcode_value || item.qr || item.qr_code));
          if (hasBarcodeData) return;
        }

        let allItems: any[] = [];
        let offset = 0;
        const limit = 500;
        const maxPages = 25;
        let pageCount = 0;
        let previousPageSignature = "";

        while (true) {
          if (pageCount >= maxPages) break;
          const res = await fetch(`${API_BASE_URL}/inventory/branch/${currentBranchId}?limit=${limit}&offset=${offset}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) break;
          const data = await res.json();
          if (!Array.isArray(data) || data.length === 0) break;

          const currentPageSignature = `${data.length}:${String(data[0]?.inventory_id ?? data[0]?.id ?? "none")}`;
          if (currentPageSignature === previousPageSignature) {
            break;
          }
          previousPageSignature = currentPageSignature;

          allItems.push(...data);
          pageCount += 1;
          offset += limit;
          if (data.length < limit) break;
        }

        await db.inventory.clear();
        await db.inventory.bulkAdd(allItems.map(i => ({ ...i, sync_status: "synced", timestamp: Date.now() })));
        console.log(`Loaded ${allItems.length} items in background`);
      } catch (err) {
        console.error("Background inventory load failed:", err);
      }
    };

    loadAllInventory();
  }, []);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentDate(now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).replace(",", "").toUpperCase());
      setCurrentTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Online/offline status
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  // Clear selected items when modal closes
  useEffect(() => {
    if (!showInventoryModal) {
      setSelectedItems([]);
    }
  }, [showInventoryModal]);

  const [inventoryCache, setInventoryCache] = useState<any[]>([]);

  // Refresh inventory cache whenever modal opens
  useEffect(() => {
    const loadFullInventory = async () => {
      if (!showInventoryModal) return;
      setIsLoading(true);

      try {
        const cached = await db.inventory.toArray();
        setInventoryCache(cached);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load inventory cache:', err);
        setIsLoading(false);
      }
    };

    loadFullInventory();
  }, [showInventoryModal]);

  // Fast local search with useMemo
  const filteredInventory = useMemo(() => {
    if (inventoryCache.length === 0) return [];

    let results = inventoryCache;

    // Apply search filter
    if (inventorySearch.trim()) {
      const searchTerm = inventorySearch.trim().toLowerCase();
      results = results.filter(item => {
        const name = (item.product_name_official || item.product_name || item.name || '').toLowerCase();
        const barcode = getInventoryBarcodeValue(item).toLowerCase();
        return name.includes(searchTerm) || barcode.includes(searchTerm);
      });
    }

    // Apply category filter
    if (selectedCategory) {
      results = results.filter(item => matchesSelectedCategory(item.category, selectedCategory));
    }

    // Apply stock filter (only if not in search mode)
    if (!inventorySearch.trim()) {
      results = applyStockFilter(results);
    }

    return results;
  }, [inventorySearch, selectedCategory, stockFilter, inventoryCache]);

  // Update displayed items when filteredInventory or pagination changes
  useEffect(() => {
    if (!showInventoryModal) return;

    const sourceItems = filteredInventory;
    const pageStart = currentPage * ITEMS_PER_PAGE;
    const pagedItems = sourceItems.slice(pageStart, pageStart + ITEMS_PER_PAGE);

    const displayItems = pagedItems.map(item => ({
      id: item.id!,
      name: getInventoryDisplayName(item),
      description: item.product_name_official || "",
      productId: item.product_id || item.productId,
      barcode: getInventoryBarcodeValue(item),
      expiry: item.expiry_date || item.expiry || null,
      quantity: item.quantity_on_hand ?? item.quantity ?? 0,
      price: item.price_regular || item.price || 0,
      gondola: item.gondola_code || item.gondola || "—",
      category: item.category,
    }));

    setInventoryItems(displayItems);
    setTotalInventoryCount(sourceItems.length);
    setSelectedInventoryIndex((previousIndex) => {
      if (displayItems.length === 0) return 0;
      return Math.min(previousIndex, displayItems.length - 1);
    });
  }, [filteredInventory, currentPage, showInventoryModal]);

  // Reset states when modal opens
  useEffect(() => {
    if (showInventoryModal) {
      setCurrentPage(0);
      setInventorySearch("");
      setSelectedCategory("");
      setStockFilter("in-stock");
      setShowBarcodeColumn(false);
      setSelectedInventoryIndex(0);
      setTimeout(() => inventorySearchRef.current?.focus(), 100);
    }
  }, [showInventoryModal]);

  useEffect(() => {
    if (currentPage !== 0) {
      setCurrentPage(0);
    }
    setSelectedInventoryIndex(0);
  }, [stockFilter]);
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedInventoryIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent | Event) => {
      if (e instanceof KeyboardEvent) {
        if (isTerminalLocked) return;
        const target = e.target as HTMLElement | null;
        const isTypingTarget = Boolean(target?.closest("input, textarea, [contenteditable='true']"));

        if (e.key === "Tab") {
          if (!isTypingTarget) {
            e.preventDefault();
            setIsKeybindHelpOpen((prev) => !prev);
          }
          return;
        }

        if (e.key.toLowerCase() === "l") {
          if (!isTypingTarget && !showInventoryModal && !isManagerModalOpen && !isLiveVoidModalOpen && !isCheckoutOpen && !isReceiptConfirmOpen && !isKeybindHelpOpen && !actionInputModal.isOpen && !readingInputState.isOpen) {
            e.preventDefault();
            setTerminalLockError(null);
            setIsTerminalLocked(true);
            void appendJournal("L", "Lock", "Terminal locked.");
          }
          return;
        }

        if (isKeybindHelpOpen && e.key === "Escape") {
          e.preventDefault();
          setIsKeybindHelpOpen(false);
          return;
        }

        if (isRecallListOpen && e.key === "Escape") {
          e.preventDefault();
          setIsRecallListOpen(false);
          return;
        }

        if (isDrawerOpen) return;

        if (e.ctrlKey && e.key.toLowerCase() === "d") {
          e.preventDefault();
          if (shiftId && !isEditingOpeningBalance && !showInventoryModal && !isManagerModalOpen) {
            setIsEditingOpeningBalance(true);
          }
          return;
        }

        if (e.ctrlKey && e.key.toLowerCase() === "x") {
          e.preventDefault();
          if (shiftId && !isClosingBalanceOpen && !showInventoryModal && !isManagerModalOpen && !isEditingOpeningBalance) {
            if (cartItems.length > 0) {
              showToast("Finish or clear cart before closing shift.", "error");
            } else {
              setIsClosingBalanceOpen(true);
            }
          }
          return;
        }

        if (e.key === "F1") {
          e.preventDefault();
          void handleRefreshOnlineShortcut();
          return;
        }

        if (e.key === "F2") {
          e.preventDefault();
          void handleItemDiscountShortcut();
          return;
        }

        if (e.key === "F3") {
          e.preventDefault();
          void handleSubtotalDiscountShortcut();
          return;
        }

        if (e.key === "F4") {
          e.preventDefault();
          handleOpenReturns();
          void appendJournal("F4", "Return", "Opened returns module.");
          return;
        }

        if (e.key === " ") {
          if (!isTypingTarget && !showInventoryModal && !isManagerModalOpen && !isLiveVoidModalOpen && !isCheckoutOpen && !isKeybindHelpOpen && !actionInputModal.isOpen && !readingInputState.isOpen) {
            e.preventDefault();
            setInventorySearch("");
            setSelectedCategory("MEDICINE");
            setSelectedInventoryIndex(0);
            setInventoryItems([]);
            setCurrentPage(0);
            setShowInventoryModal(true);
            void appendJournal("Space", "Item List", "Opened item list/inventory search.");
          }
          return;
        }

        if (e.key === "F5") {
          e.preventDefault();
          void handleAddOnShortcut();
          return;
        }

        if (e.key === "F6") {
          e.preventDefault();
          void handleLiveItemVoidShortcut();
          return;
        }

        if (e.key === "F7") {
          e.preventDefault();
          void handleTransactionCancelShortcut();
          return;
        }

        if (e.key === "F8") {
          e.preventDefault();
          void handleVoidPreviousTransactionShortcut();
          return;
        }

        if (e.key === "F9") {
          e.preventDefault();
          if (isReturnsOpen) {
            void handleRecallPreviousTransactions();
          } else {
            void handleSuspendRecallShortcut();
          }
          return;
        }

        if (e.key === "F10") {
          e.preventDefault();
          void handlePriceOverrideShortcut();
          return;
        }

        if (e.key === "F11") {
          e.preventDefault();
          void handleOpenElectronicJournal();
          return;
        }

        if (e.key === "Enter") {
          if (!isTypingTarget && !showInventoryModal && !isManagerModalOpen && !isLiveVoidModalOpen && !actionInputModal.isOpen && !readingInputState.isOpen) {
            e.preventDefault();
            barcodeInputRef.current?.focus();
          }
          return;
        }

        if (e.key === "F12") {
          e.preventDefault();
          handlePayment();
          return;
        }

        if (isTypingTarget) {
          return;
        }

        const keyUpper = e.key.length === 1 ? e.key.toUpperCase() : "";
        if (!keyUpper) {
          return;
        }

        if (keyUpper === "H") {
          e.preventDefault();
          void handleNoSaleShortcut();
          return;
        }

        if (keyUpper === "O") {
          e.preventDefault();
          void handleOpenDepartmentShortcut();
          return;
        }

        if (keyUpper === "P") {
          e.preventDefault();
          void handlePickupShortcut();
          return;
        }

        if (keyUpper === "R") {
          e.preventDefault();
          void handleReprintShortcut();
          return;
        }

        if (keyUpper === "L") {
          e.preventDefault();
          setTerminalLockError(null);
          setIsTerminalLocked(true);
          void appendJournal("L", "Lock", "Terminal locked.");
          return;
        }

        if (keyUpper === "E") {
          e.preventDefault();
          void handlePriceLevelShortcut();
          return;
        }

        if (keyUpper === "X") {
          e.preventDefault();
          void handleXReadingShortcut();
          return;
        }

        if (keyUpper === "Z") {
          e.preventDefault();
          void handleZReadingShortcut();
          return;
        }

        if (keyUpper === "T") {
          e.preventDefault();
          void handleReceiptToggleShortcut();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    actionInputModal.isOpen,
    appendJournal,
    cartItems,
    discountTypeIndex,
    handleAddOnShortcut,
    handleItemDiscountShortcut,
    handleLiveItemVoidShortcut,
    handleNoSaleShortcut,
    handleOpenDepartmentShortcut,
    handleOpenElectronicJournal,
    handleRecallPreviousTransactions,
    handleReprintShortcut,
    handleRefreshOnlineShortcut,
    handlePriceLevelShortcut,
    handlePriceOverrideShortcut,
    handlePickupShortcut,
    handleSubtotalDiscountShortcut,
    handleSuspendRecallShortcut,
    handleTransactionCancelShortcut,
    handleVoidPreviousTransactionShortcut,
    handleXReadingShortcut,
    handleZReadingShortcut,
    handleReceiptToggleShortcut,
    handleOpenReturns,
    isCheckoutOpen,
    isClosingBalanceOpen,
    isDrawerOpen,
    isEditingOpeningBalance,
    isJournalOpen,
    isKeybindHelpOpen,
    isLiveVoidModalOpen,
    isManagerModalOpen,
    isLoadingJournal,
    isReceiptConfirmOpen,
    isReturnsOpen,
    isTerminalLocked,
    readingInputState.isOpen,
    shiftId,
    showInventoryModal,
  ]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const discount = subtotal * DISCOUNT_RATES[discountTypeIndex];
  const amountDue = subtotal - discount + addOn;

  const handleConfirmSeniorDiscountDetails = useCallback(async () => {
    const idNumber = seniorCitizenIdNumber.trim();
    const name = seniorCitizenName.trim();
    const trimmedLimit = seniorDiscountLimitInput.trim();
    const parsedLimit = trimmedLimit ? Number(trimmedLimit) : null;

    if (!idNumber) {
      setSeniorDiscountError("Senior Citizen ID no. is required.");
      return;
    }

    if (!name) {
      setSeniorDiscountError("Senior Citizen name is required.");
      return;
    }

    if (parsedLimit !== null && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      setSeniorDiscountError("Discount limit must be a valid number greater than 0 when provided.");
      return;
    }

    if (parsedLimit !== null && discount > parsedLimit) {
      setSeniorDiscountError(`Computed discount (PHP ${discount.toFixed(2)}) exceeds entered limit.`);
      return;
    }

    const details: SeniorDiscountDetails = {
      idNumber,
      name,
      discountLimit: parsedLimit,
    };

    setSeniorDiscountDetails(details);
    setSeniorDiscountError(null);
    setIsSeniorDiscountModalOpen(false);
    setIsCheckoutOpen(true);
    await appendJournal(
      "F12",
      "Senior Discount Verification",
      `ID: ${idNumber}, Name: ${name}, Limit: ${parsedLimit == null ? "N/A" : parsedLimit.toFixed(2)}`
    );
  }, [appendJournal, discount, seniorCitizenIdNumber, seniorCitizenName, seniorDiscountLimitInput]);

  const addItemToSelected = (item: InventoryItem) => {
    const now = Date.now();
    const lastSelection = lastSelectItemAtRef.current;
    if (lastSelection && lastSelection.itemId === item.id && now - lastSelection.at < 180) {
      return;
    }
    lastSelectItemAtRef.current = { itemId: item.id, at: now };

    setSelectedItems(prev => {
      // Check if item already exists
      const existingIndex = prev.findIndex(i => i.id === item.id);
      if (existingIndex >= 0) {
        // Update quantity if already exists
        const updated = [...prev];
        const newQuantity = updated[existingIndex].quantity + currentQuantity;
        if (newQuantity > item.quantity) {
          showToast(`Cannot add more items. Only ${item.quantity} available.`, "error");
          return prev;
        }
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQuantity,
          total: newQuantity * item.price
        };
        return updated;
      }
      
      // Add new item
      if (currentQuantity > item.quantity) {
        showToast(`Not enough stock. Only ${item.quantity} available.`, "error");
        return prev;
      }
      
      const newSelectedItem: SelectedItem = {
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        price: item.price,
        quantity: currentQuantity,
        total: currentQuantity * item.price,
        stock: item.quantity
      };
      
      return [...prev, newSelectedItem];
    });
  };

  const removeItemFromSelected = (id: number) => {
    setSelectedItems(prev => prev.filter(item => item.id !== id));
  };

  const updateSelectedItemQuantity = (id: number, newQuantity: number) => {
    setSelectedItems(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, quantity: Math.max(1, Math.min(newQuantity, item.stock)), total: Math.max(1, Math.min(newQuantity, item.stock)) * item.price }
          : item
      )
    );
  };

  const addSelectedToCart = () => {
    const now = Date.now();
    if (now - lastAddToCartAtRef.current < 250) {
      return;
    }
    lastAddToCartAtRef.current = now;

    if (selectedItems.length === 0) {
      return;
    }

    selectedItems.forEach(item => {
      const normalizedBarcode = item.barcode.trim();
      const newCartItem: CartItem = {
        id: Date.now() + Math.random(), // Ensure unique IDs
        description: `${normalizedBarcode ? `[${normalizedBarcode}] ` : ""}${item.name}`,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        inventoryId: item.id,
      };

      setCartItems(prev => [...prev, newCartItem]);
    });

    setSelectedItems([]);
    setCurrentItemDescription("");
    setCurrentQuantity(1);
    setShowInventoryModal(false);
  };

  const handleDirectAddToCart = useCallback((item: { id: number; name: string; barcode: string; price: number; stock: number }) => {
    const normalizedBarcode = item.barcode.trim();
    const newCartItem: CartItem = {
      id: Date.now() + Math.random(),
      description: `${normalizedBarcode ? `[${normalizedBarcode}] ` : ""}${item.name}`,
      quantity: 1,
      price: item.price,
      total: item.price,
      inventoryId: item.id,
    };
    setCartItems(prev => [...prev, newCartItem]);
  }, []);

  const updateCartItemPrice = (id: number, newPrice: number) => {
    setCartItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, price: newPrice, total: newPrice * item.quantity } : item
      )
    );
  };

  const handleKeyPress = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // You could implement manual entry logic here if needed
    }
  };

  const handleModalKeyDown = (e: InventoryNavigationEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (inventoryItems.length === 0) return;
      if (selectedInventoryIndex >= inventoryItems.length - 1) {
        if (hasNextInventoryPage) {
          setCurrentPage((page) => page + 1);
          setSelectedInventoryIndex(0);
        }
        return;
      }

      setSelectedInventoryIndex((index) => Math.min(index + 1, inventoryItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (inventoryItems.length === 0) return;
      if (selectedInventoryIndex <= 0) {
        if (hasPreviousInventoryPage) {
          setCurrentPage((page) => page - 1);
          setSelectedInventoryIndex(ITEMS_PER_PAGE - 1);
        }
        return;
      }

      setSelectedInventoryIndex((index) => Math.max(index - 1, 0));
    } else if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      addSelectedToCart();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (inventoryItems[selectedInventoryIndex]) {
        addItemToSelected(inventoryItems[selectedInventoryIndex]);
      }
    } else if (e.key === "Escape") {
      setShowInventoryModal(false);
    }
  };

  const handlePayment = useCallback(async () => {
    if (isDrawerOpen) {
      showToast("Open station first before accepting payments.", "error");
      return;
    }

    if (cartItems.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }

    // Discount types #2, #3, #4 require manager approval before showing checkout
    if (discountTypeIndex > 0) {
      setPendingAction("payment");
      setManagerError(null);
      setIsManagerModalOpen(true);
      return;
    }

    void appendJournal("F12", "Payment", "Checkout opened.");
    setIsCheckoutOpen(true);
  }, [appendJournal, cartItems, isDrawerOpen, discountTypeIndex]);

  const processPayment = useCallback(async (tendered: number) => {
    setIsCheckoutOpen(false);
    setIsLoading(true);
    const change = tendered - amountDue;

    try {
      // TODO: Send sale to backend (SALES_HEADERS + SALES_DETAILS)
      await new Promise(r => setTimeout(r, 800));

      await recordCompletedTransaction({
        receiptNo: invoiceNo,
        transactionNo: transNo,
        branchName: currentBranchName,
        cashierName,
        cartItems,
        subtotal,
        discount,
        addOn,
        amountDue,
      });

      await deductInventoryStock(
        cartItems.map((item) => ({
          inventoryId: item.inventoryId,
          quantity: item.quantity,
        }))
      );

      setLastTenderedAmount(tendered);
      setLastChangeAmount(change);
      setCartItems([]);
      setAddOn(0);
      setDiscountTypeIndex(0);
      setSeniorCitizenIdNumber("");
      setSeniorCitizenName("");
      setSeniorDiscountLimitInput("");
      setSeniorDiscountError(null);
      setSeniorDiscountDetails(null);
      setInvoiceSequence((previous) => previous + 1);
      setTransactionSequence((previous) => previous + 1);
      localStorage.removeItem("pos_cartItems");
      localStorage.removeItem("pos_addOn");
      localStorage.removeItem("pos_discountTypeIndex");
      setIsReceiptConfirmOpen(receiptEnabled);
      await appendJournal("F12", "Payment Completed", `Receipt ${receiptEnabled ? "ON" : "OFF"} • Net ${amountDue.toFixed(2)} • Tendered ${tendered.toFixed(2)} • Change ${change.toFixed(2)}`);
      if (discountTypeIndex === SENIOR_DISCOUNT_INDEX && seniorDiscountDetails) {
        await appendJournal(
          "F12",
          "Senior Discount Applied",
          `Name: ${seniorDiscountDetails.name}, ID: ${seniorDiscountDetails.idNumber}, Limit: ${seniorDiscountDetails.discountLimit == null ? "N/A" : seniorDiscountDetails.discountLimit.toFixed(2)}, Actual Discount: ${discount.toFixed(2)}`
        );
      }
    } catch (err) {
      await appendJournal("F12", "Payment Failed", "Payment processing failed.");
      showToast("Payment processing failed", "error");
    } finally {
      setIsLoading(false);
    }
  }, [addOn, amountDue, appendJournal, cartItems, cashierName, currentBranchName, discount, discountTypeIndex, invoiceNo, receiptEnabled, seniorDiscountDetails, subtotal, transNo]);

  const handleOpenStation = async (amount: number) => {
    setIsOpeningShift(true);

    try {
      if (isEditingOpeningBalance) {
        const updated = await updateActiveShiftOpeningBalance(amount, currentBranchName);
        if (!updated) {
          showToast("No active shift found to update.", "error");
          return;
        }

        setIsEditingOpeningBalance(false);
        showToast("Opening balance updated.", "success");
      } else {
        const shift = await startShift(amount, currentBranchName);
        setShiftId(shift.shiftId);
        setIsDrawerOpen(false);
      }

      window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
    } catch (err) {
      console.error("Failed to open shift:", err);
      showToast(isEditingOpeningBalance ? "Could not update opening balance. Please try again." : "Could not open station. Please try again.", "error");
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleResetSavedOpeningBalance = async () => {
    setIsOpeningShift(true);

    try {
      const updated = await updateActiveShiftOpeningBalance(0, currentBranchName);
      if (!updated) {
        showToast("No active shift found to reset.", "error");
        return;
      }

      setIsEditingOpeningBalance(false);
      showToast("Opening balance reset to PHP 0.00.", "success");
      window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
    } catch (err) {
      console.error("Failed to reset opening balance:", err);
      showToast("Could not reset opening balance. Please try again.", "error");
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleCloseShift = async (amount: number) => {
    if (!shiftId) {
      showToast("No active shift to close.", "error");
      return;
    }

    if (cartItems.length > 0) {
      showToast("Finish or clear cart before closing shift.", "error");
      return;
    }

    setIsClosingShift(true);

    try {
      const closed = await closeShiftWithBalance(shiftId, amount);
      if (!closed) {
        showToast("Could not close shift.", "error");
        return;
      }

      setIsClosingBalanceOpen(false);
      setShiftId(null);
      setDiscountTypeIndex(0);
      setAddOn(0);
      localStorage.removeItem("pos_cartItems");
      localStorage.removeItem("pos_addOn");
      localStorage.removeItem("pos_discountTypeIndex");
      setIsDrawerOpen(true);
      showToast("Shift closed successfully.", "success");
    } catch (err) {
      console.error("Failed to close shift:", err);
      showToast("Could not close shift. Please try again.", "error");
    } finally {
      setIsClosingShift(false);
    }
  };

  const handleManagerAuthorize = async (pin: string) => {
    setIsAuthorizingManager(true);
    setManagerError(null);

    try {
      const isAuthorized = await verifyManagerPin(pin);
      if (!isAuthorized) {
        setManagerError("Unauthorized: invalid manager PIN.");
        return;
      }

      if (pendingAction === "cancel") {
        setIsManagerModalOpen(false);
        setPendingAction(null);
        resetCurrentSaleState();
        void appendJournal("F7", "Transaction Cancel", "Current transaction cleared by manager.");
        showToast("Transaction cancelled.", "success");
        window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
        return;
      }

      if (pendingAction === "void_previous") {
        setIsManagerModalOpen(false);
        setPendingAction(null);
        await handleOpenRecallListPopup();
        void appendJournal("F8", "Void Previous Transaction", "Opened recall list popup.");
        return;
      }

      if (pendingAction === "return") {
        showToast("Return action authorized. Continue with return workflow.", "info");
      }

      if (pendingAction === "discount") {
        // Discount is already reflected live via discountTypeIndex; just confirm it
        showToast(`Subtotal discount (${DISCOUNT_TYPES[discountTypeIndex]}) applied.`, "success");
        setIsManagerModalOpen(false);
        setPendingAction(null);
        void appendJournal("F3", "Subtotal Discount Applied", `Discount type ${DISCOUNT_TYPES[discountTypeIndex]} confirmed by manager.`);
        window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
        return;
      }

      if (pendingAction === "payment") {
        setIsManagerModalOpen(false);
        setPendingAction(null);
        if (discountTypeIndex === SENIOR_DISCOUNT_INDEX) {
          setSeniorDiscountError(null);
          setIsSeniorDiscountModalOpen(true);
          window.setTimeout(() => {
            seniorIdInputRef.current?.focus();
          }, 0);
        } else {
          setIsCheckoutOpen(true);
        }
        return;
      }

      if (pendingAction === "price_override") {
        setDiscountTypeIndex(3);
        showToast("Price override enabled.", "success");
      }

      setIsManagerModalOpen(false);
      setPendingAction(null);
      window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
    } catch (err) {
      console.error("Manager authorization failed:", err);
      setManagerError("Authorization failed. Try again.");
    } finally {
      setIsAuthorizingManager(false);
    }
  };

  const handleUnlockTerminal = async (password: string) => {
    setIsUnlockingTerminal(true);
    setTerminalLockError(null);

    try {
      const loginPassword = getSessionLoginPassword();
      if (!loginPassword) {
        setTerminalLockError("Login session password not found. Please log in again.");
        return;
      }

      if (password !== loginPassword) {
        setTerminalLockError("Invalid password. Please try again.");
        return;
      }

      setIsTerminalLocked(false);
      setTerminalLockError(null);
      window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
    } catch (err) {
      console.error("Terminal unlock failed:", err);
      setTerminalLockError("Unable to unlock terminal. Try again.");
    } finally {
      setIsUnlockingTerminal(false);
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-300 p-6 font-sans">
      <div className={`mx-auto grid h-full max-w-[1800px] grid-cols-[1fr_400px] gap-6 overflow-hidden transition ${(!isCheckingShift && (isDrawerOpen || isEditingOpeningBalance || isClosingBalanceOpen || isTerminalLocked)) ? "pointer-events-none blur-sm" : ""}`}>

        {/* LEFT - Transaction Area */}
        <div className="flex flex-col gap-6 overflow-hidden h-full">

          {/* Header */}
          <header className="flex shrink-0 items-center justify-between rounded-2xl bg-gradient-to-r from-[#041848] to-[#062d8c] p-5 shadow-lg">
            <img src={bannerLogo} alt="Logo" className="h-10 w-auto" />
            <div className="flex items-center gap-6">
              <div className="rounded-lg bg-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-blue-100">
                Receipt {receiptEnabled ? "ON" : "OFF"}
              </div>
              <div
                className={`relative flex h-9 items-center justify-center gap-2 rounded-xl px-4 ${
                  isOnline ? "bg-[#0c8628]" : "bg-[#cc5500]"
                }`}
              >
                <div className="pointer-events-none absolute inset-0 rounded-xl border border-[#062d8c] shadow-[0_0_40px_rgba(3,31,99,0.1)]" />
                <div className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-[#acf9be]" : "bg-white"}`} />
                <span className={`text-xs font-bold uppercase tracking-wide ${isOnline ? "text-[#acf9be]" : "text-white"}`}>
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              {isGeneratingReading && (
                <div className="rounded-lg bg-amber-400/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                  Generating Report...
                </div>
              )}
              <button onClick={logout} className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/20">
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </header>

          {/* Amount Due */}
          <div className="shrink-0 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-800 p-8 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">Amount Due</p>
            <p className="text-7xl font-black text-white">
              <span className="mr-2 text-3xl font-light text-emerald-200">PHP</span>
              {amountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>

          <CartDisplay
            cartItems={cartItems}
            currentItemDescription={currentItemDescription}
            setCurrentItemDescription={setCurrentItemDescription}
            discountTypeLabel={discountTypeLabel}
            discountTypeIndex={discountTypeIndex}
            updateCartItemPrice={updateCartItemPrice}
            handleKeyPress={handleKeyPress}
            terminalId={terminalId}
            invoiceNo={invoiceNo}
            transNo={transNo}
            setInventorySearch={setInventorySearch}
            setSelectedCategory={setSelectedCategory}
            setSelectedInventoryIndex={setSelectedInventoryIndex}
            setInventoryItems={setInventoryItems}
            setCurrentPage={setCurrentPage}
            setShowInventoryModal={setShowInventoryModal}
            barcodeInputRef={barcodeInputRef}
            onAddToCart={handleDirectAddToCart}
          />
        </div>

        {/* RIGHT - Summary */}
        <div className="flex flex-col gap-6 h-full overflow-hidden">
          <div className="shrink-0 flex items-center justify-between rounded-2xl bg-white p-6 shadow-lg border border-slate-300">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white"><ReceiptIcon className="h-5 w-5" /></div>
              <h2 className="text-lg font-black text-slate-800 uppercase">Summary</h2>
            </div>
            <span className="text-[10px] font-bold text-slate-400">#{invoiceNo}</span>
          </div>

          <div className="shrink-0 space-y-4 rounded-3xl bg-white p-8 shadow-xl border border-slate-300">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-red-600 font-bold">Discount <span className="text-xs font-normal text-slate-400">({(DISCOUNT_RATES[discountTypeIndex] * 100).toFixed(0)}%)</span></span>
              <span className="font-bold text-red-600">{discount > 0 ? `-${discount.toFixed(2)}` : "0.00"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 font-bold">Add-on</span>
              <input type="number" value={addOn} onChange={e => setAddOn(Number(e.target.value) || 0)} className="w-24 text-right bg-slate-100 border rounded p-1" />
            </div>
            <hr className="my-2 border-slate-200" />
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold uppercase text-slate-400">Total</span>
              <span className="text-3xl font-black text-[#062d8c]">₱{amountDue.toFixed(2)}</span>
            </div>
            <button
              onClick={handlePayment}
              disabled={isLoading || cartItems.length === 0}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-emerald-700 disabled:opacity-50 mt-4"
            >
              {isLoading ? "Processing..." : "PAYMENT"}
            </button>
          </div>

          {/* Branding */}
          <div className="flex-1 min-h-[120px] relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#041848] to-[#3266e6] shadow-xl flex flex-col items-center justify-center p-6">
            <img src={logoOutline} alt="Logo" className="h-20 w-20 opacity-30 mb-4" />
            <p className="text-2xl font-black text-white tracking-tighter">KNOPPER <span className="text-blue-400">POS</span></p>
            <p className="text-[10px] uppercase text-blue-200 tracking-[0.4em] mt-1">Pharmacy Edition</p>
          </div>

          {/* User info */}
          <div className="shrink-0 rounded-2xl bg-white p-6 shadow-xl border border-slate-300">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-[#062d8c]">
                <User />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Cashier</p>
                <p className="font-black text-slate-800">{cashierName}</p>
              </div>
            </div>
            <div className="flex justify-between text-[11px] font-bold text-slate-500 bg-slate-50 p-3 rounded-xl">
              <span><Calendar className="inline h-3.5 w-3.5 mr-1" />{currentDate}</span>
              <span><Clock className="inline h-3.5 w-3.5 mr-1" />{currentTime}</span>
            </div>
          </div>
        </div>
      </div>

      {isRecallListOpen && (
        <div className="fixed inset-0 z-[76] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-black text-slate-900">Recall Previous Transactions</h3>
              <button
                type="button"
                onClick={() => setIsRecallListOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-6">
              {isLoadingRecallList && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  Loading previous transactions...
                </div>
              )}

              {!isLoadingRecallList && recalledCompletedTransactions.length === 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  No previous transactions found.
                </div>
              )}

              {!isLoadingRecallList && recalledCompletedTransactions.map((transaction) => (
                <button
                  key={`${transaction.receiptNo}-${transaction.transactionNo}-${transaction.paidAt}`}
                  type="button"
                  onClick={() => applyTransactionToReturns(transaction)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-[#062d8c]">Receipt #{transaction.receiptNo}</p>
                      {voidedReceiptNos.has(transaction.receiptNo) && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-700">
                          With Voids
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">Trans No. {transaction.transactionNo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">₱{transaction.amountDue.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">{new Date(transaction.paidAt).toLocaleString()}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isReturnsOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-black text-slate-900">Returns & Previous Transaction</h3>
              <button
                type="button"
                onClick={() => {
                  setIsReturnsOpen(false);
                  resetReturnsState();
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-black uppercase tracking-wide text-[#062d8c]">Check Receipt</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={returnReceiptNo}
                    onChange={(event) => setReturnReceiptNo(event.target.value)}
                    placeholder="Enter receipt no."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCheckReceiptForReturn()}
                    disabled={isCheckingReceipt}
                    className="rounded-xl bg-[#062d8c] px-4 py-2 text-xs font-black uppercase text-white hover:bg-[#041848] disabled:opacity-60"
                  >
                    {isCheckingReceipt ? "Checking" : "Check"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleRecallPreviousTransactions()}
                  className="w-full rounded-xl border border-[#062d8c] bg-white px-4 py-2 text-xs font-black uppercase text-[#062d8c] hover:bg-blue-50"
                >
                  Recall Previous Transactions (F9)
                </button>

                <button
                  type="button"
                  onClick={() => void handleReturnReceiptToCart()}
                  disabled={!selectedCompletedTransaction}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Return Receipt Items To Cart
                </button>

                <p className="text-[11px] text-slate-500">
                  Return action: loads items from selected receipt back to current POS cart. Void action is separate on the right panel.
                </p>

                {recalledCompletedTransactions.length > 0 && (
                  <div className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                    {recalledCompletedTransactions.map((transaction) => (
                      <button
                        key={`${transaction.receiptNo}-${transaction.transactionNo}`}
                        type="button"
                        onClick={() => applyTransactionToReturns(transaction)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:bg-blue-50"
                      >
                        <span className="font-bold text-slate-700">
                          #{transaction.receiptNo}
                          {voidedReceiptNos.has(transaction.receiptNo) ? " • VOIDED" : ""}
                        </span>
                        <span className="text-slate-500">{new Date(transaction.paidAt).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-black uppercase tracking-wide text-[#062d8c]">Void Workflow (Separate From Return)</h4>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Enter Product (from receipt)</label>
                  <select
                    value={selectedReturnItemId ?? ""}
                    onChange={(event) => setSelectedReturnItemId(Number(event.target.value))}
                    disabled={!selectedCompletedTransaction || voidMode !== "single"}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#062d8c] disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {!selectedCompletedTransaction && <option value="">Select receipt first</option>}
                    {selectedCompletedTransaction?.cartItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.description} (Qty: {item.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Qty to Void</label>
                    <input
                      type="number"
                      min={1}
                      value={returnQuantity}
                      onChange={(event) => setReturnQuantity(Number(event.target.value) || 1)}
                      disabled={voidMode !== "single"}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#062d8c] disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Reason for Void</label>
                    <select
                      value={voidReason}
                      onChange={(event) => setVoidReason(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                    >
                      {RETURN_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="mb-2 text-xs font-bold uppercase text-slate-500">Void Scope</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="void-scope"
                        checked={voidMode === "single"}
                        onChange={() => setVoidMode("single")}
                      />
                      <span>Void selected product only</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="void-scope"
                        checked={voidMode === "selected"}
                        onChange={() => setVoidMode("selected")}
                      />
                      <span>Void selected multiple products</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="void-scope"
                        checked={voidMode === "all"}
                        onChange={() => setVoidMode("all")}
                      />
                      <span>Void all products in receipt</span>
                    </label>
                  </div>
                </div>

                {voidMode === "selected" && selectedCompletedTransaction && (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Select Products to Void</p>
                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {selectedCompletedTransaction.cartItems.map((item) => {
                        const selection = voidSelections[item.id] ?? { selected: false, quantity: 1, replacementProduct: "" };
                        return (
                          <div key={item.id} className="rounded-lg border border-slate-200 p-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={selection.selected}
                                onChange={(event) => {
                                  const isChecked = event.target.checked;
                                  setVoidSelections((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      selected: isChecked,
                                      quantity: prev[item.id]?.quantity ?? 1,
                                      replacementProduct: prev[item.id]?.replacementProduct ?? "",
                                    },
                                  }));
                                }}
                              />
                              <span>{item.description} (Qty: {item.quantity})</span>
                            </label>
                            {selection.selected && (
                              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={selection.quantity}
                                  onChange={(event) => {
                                    const parsedValue = Number(event.target.value);
                                    setVoidSelections((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...selection,
                                        quantity: Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 1,
                                      },
                                    }));
                                  }}
                                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#062d8c]"
                                  placeholder="Qty"
                                />
                                <input
                                  type="text"
                                  value={selection.replacementProduct}
                                  onChange={(event) => {
                                    const replacementValue = event.target.value;
                                    setVoidSelections((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...selection,
                                        replacementProduct: replacementValue,
                                      },
                                    }));
                                  }}
                                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#062d8c]"
                                  placeholder="Replacement (optional)"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">New Product</label>
                  <input
                    type="text"
                    value={replacementProduct}
                    onChange={(event) => setReplacementProduct(event.target.value)}
                    placeholder="Optional replacement product"
                    disabled={voidMode === "selected"}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                  />
                  {voidMode === "selected" && (
                    <p className="mt-1 text-[11px] text-slate-500">Use per-item replacement fields above for multi-item void.</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Manager Approval PIN</label>
                  <input
                    type="password"
                    value={returnManagerPin}
                    onChange={(event) => setReturnManagerPin(event.target.value)}
                    placeholder="Enter manager PIN"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#062d8c]"
                  />
                </div>

                {returnFlowError && (
                  <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {returnFlowError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handleConfirmVoidReturn()}
                  disabled={isProcessingReturn}
                  className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-black uppercase text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isProcessingReturn ? "Voiding..." : "Void Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isJournalOpen && (
        <div className="fixed inset-0 z-[76] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-black text-slate-900">Electronic Journal</h3>
              <button
                type="button"
                onClick={() => setIsJournalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6">
              {isLoadingJournal ? (
                <p className="text-sm font-semibold text-slate-500">Loading journal entries...</p>
              ) : journalEntries.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">No journal entries yet.</p>
              ) : (
                <div className="space-y-2">
                  {journalEntries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-[#062d8c]">{entry.action}</p>
                        <p className="text-[11px] text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
                      </div>
                      {entry.details && <p className="mt-1 text-xs text-slate-600">{entry.details}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isReadingReportOpen && readingSummary && (
        <div className="fixed inset-0 z-[76] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-black text-slate-900">{readingSummary.type} Reading Summary</h3>
              <button
                type="button"
                onClick={() => setIsReadingReportOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-6 text-sm">
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Total Transactions</span><p className="font-black text-slate-900">{readingSummary.totalTransactions}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Total Sales</span><p className="font-black text-slate-900">₱{readingSummary.totalSales.toFixed(2)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Total Discount</span><p className="font-black text-slate-900">₱{readingSummary.totalDiscount.toFixed(2)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Add-on Total</span><p className="font-black text-slate-900">₱{readingSummary.totalAddOn.toFixed(2)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Net Sales</span><p className="font-black text-slate-900">₱{readingSummary.netSales.toFixed(2)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Tender</span><p className="font-black text-slate-900">₱{readingSummary.tenderTotal.toFixed(2)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Cash Count</span><p className="font-black text-slate-900">₱{readingSummary.cashCount.toFixed(2)}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Generated</span><p className="font-black text-slate-900">{new Date(readingSummary.generatedAt).toLocaleString()}</p></div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-[#062d8c] px-4 py-2 text-xs font-black uppercase text-[#062d8c] hover:bg-blue-50"
              >
                Print {readingSummary.type} Report
              </button>
              <button
                type="button"
                onClick={() => setIsReadingReportOpen(false)}
                className="rounded-xl bg-[#062d8c] px-4 py-2 text-xs font-black uppercase text-white hover:bg-[#041848]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {isSignOffOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#041848]/90 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-white/10 p-8 text-center text-white shadow-2xl backdrop-blur-sm">
            <h3 className="text-3xl font-black">Shift Closed</h3>
            <p className="mt-2 text-sm text-blue-100">Cashier sign-off completed after Z Reading.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsSignOffOpen(false)}
                className="rounded-xl bg-white px-5 py-2 text-xs font-black uppercase text-[#062d8c] hover:bg-blue-50"
              >
                Back to POS
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-white/40 px-5 py-2 text-xs font-black uppercase text-white hover:bg-white/10"
              >
                Sign Off Now
              </button>
            </div>
          </div>
        </div>
      )}

      {isLiveVoidModalOpen && (
        <div className="fixed inset-0 z-[78] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-red-700 to-red-600 px-6 py-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-100">Manager Approval Required</p>
              <h3 className="mt-1 text-xl font-black">Live Item Void</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-xs font-bold uppercase text-red-600">Item To Void</p>
                <p className="mt-2 text-sm font-black text-slate-900">{liveVoidItem?.description || "No item selected"}</p>
                {liveVoidItem && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                    <span>Qty: <strong>{liveVoidItem.quantity}</strong></span>
                    <span>Price: <strong>₱{liveVoidItem.price.toFixed(2)}</strong></span>
                    <span>Total: <strong>₱{liveVoidItem.total.toFixed(2)}</strong></span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Manager PIN</label>
                <input
                  type="password"
                  value={liveVoidPin}
                  onChange={(event) => setLiveVoidPin(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleConfirmLiveVoid();
                    }
                  }}
                  placeholder="Enter manager PIN"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500"
                  autoFocus
                />
              </div>

              {liveVoidError && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {liveVoidError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLiveVoidModalOpen(false);
                    setLiveVoidItem(null);
                    setLiveVoidPin("");
                    setLiveVoidError(null);
                    window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
                  }}
                  disabled={isLiveVoidSubmitting}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black uppercase text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmLiveVoid()}
                  disabled={isLiveVoidSubmitting}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-black uppercase text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isLiveVoidSubmitting ? "Verifying..." : "Approve Void"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <InventoryModal
        showInventoryModal={showInventoryModal}
        inventorySearch={inventorySearch}
        setInventorySearch={setInventorySearch}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        showBarcodeColumn={showBarcodeColumn}
        setShowBarcodeColumn={setShowBarcodeColumn}
        isSearchMode={Boolean(inventorySearch.trim())}
        inventoryItems={inventoryItems}
        isLoading={isLoading}
        selectedInventoryIndex={selectedInventoryIndex}
        setSelectedInventoryIndex={setSelectedInventoryIndex}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalInventoryPages}
        inventorySearchRef={inventorySearchRef}
        selectedItemRef={selectedItemRef}
        handleModalKeyDown={handleModalKeyDown}
        addItemToSelected={addItemToSelected}
        selectedItems={selectedItems}
        removeItemFromSelected={removeItemFromSelected}
        updateSelectedItemQuantity={updateSelectedItemQuantity}
        addSelectedToCart={addSelectedToCart}
        CATEGORIES={CATEGORIES}
      />

      <OpeningBalanceModal
        isOpen={!isCheckingShift && (isDrawerOpen || isEditingOpeningBalance)}
        isSubmitting={isOpeningShift}
        onSubmit={handleOpenStation}
        onResetSaved={isEditingOpeningBalance ? handleResetSavedOpeningBalance : undefined}
        lastClosingBalance={!isEditingOpeningBalance ? lastClosingBalance : null}
        title={isEditingOpeningBalance ? "Edit Opening Balance" : "Opening Balance"}
        description={isEditingOpeningBalance ? "Correct the shift opening balance amount." : "Count your bills and coins to start this cashier shift."}
        actionLabel={isEditingOpeningBalance ? "Save Balance" : "Open Station"}
      />

      <ManagerAuthModal
        isOpen={isManagerModalOpen}
        title="Manager PIN Required"
        description={
          pendingAction === "payment"
            ? `Authorize payment with ${DISCOUNT_TYPES[discountTypeIndex]} discount applied.`
            : pendingAction === "discount"
              ? `Apply ${DISCOUNT_TYPES[discountTypeIndex]} subtotal discount to the current transaction.`
              : pendingAction === "price_override"
                ? "Authorize price override (F10)."
                : pendingAction === "cancel"
                  ? "Authorize cancellation of the entire current transaction."
                  : pendingAction === "void_previous"
                    ? "Authorize void of a previous transaction."
                    : "Authorize special cashier action."
        }
        isSubmitting={isAuthorizingManager}
        error={managerError}
        onClose={() => {
          setIsManagerModalOpen(false);
          setPendingAction(null);
          setManagerError(null);
        }}
        onAuthorize={handleManagerAuthorize}
      />

      <ClosingBalanceModal
        isOpen={isClosingBalanceOpen}
        isSubmitting={isClosingShift}
        onSubmit={handleCloseShift}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        cartItems={cartItems}
        subtotal={subtotal}
        discount={discount}
        discountTypeLabel={discountTypeLabel}
        discountRate={DISCOUNT_RATES[discountTypeIndex]}
        addOn={addOn}
        amountDue={amountDue}
        isProcessing={isLoading}
        onClose={() => setIsCheckoutOpen(false)}
        onConfirm={(tendered) => processPayment(tendered)}
      />

      {isSeniorDiscountModalOpen && (
        <div className="fixed inset-0 z-[79] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#0f766e] to-[#115e59] px-6 py-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">Required Before Payment</p>
              <h3 className="mt-1 text-xl font-black">Senior Citizen Discount Details</h3>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Senior Citizen ID No.</label>
                <input
                  id="senior-id-number"
                  ref={seniorIdInputRef}
                  type="text"
                  value={seniorCitizenIdNumber}
                  onChange={(event) => setSeniorCitizenIdNumber(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      seniorNameInputRef.current?.focus();
                    }
                  }}
                  placeholder="Enter SC ID number"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#0f766e]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Senior Citizen Name</label>
                <input
                  ref={seniorNameInputRef}
                  type="text"
                  value={seniorCitizenName}
                  onChange={(event) => setSeniorCitizenName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      seniorLimitInputRef.current?.focus();
                    }
                  }}
                  placeholder="Enter full name"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#0f766e]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Discount Limit (Optional)</label>
                <input
                  ref={seniorLimitInputRef}
                  type="number"
                  min={0}
                  step="0.01"
                  value={seniorDiscountLimitInput}
                  onChange={(event) => setSeniorDiscountLimitInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      seniorSubmitButtonRef.current?.focus();
                    }
                  }}
                  placeholder="Optional allowed discount amount"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#0f766e]"
                />
                <p className="mt-1 text-[11px] text-slate-500">Current computed senior discount: PHP {discount.toFixed(2)}</p>
              </div>

              {seniorDiscountError && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {seniorDiscountError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSeniorDiscountModalOpen(false);
                    setSeniorDiscountError(null);
                    setPendingAction(null);
                  }}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black uppercase text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  ref={seniorSubmitButtonRef}
                  type="button"
                  onClick={() => void handleConfirmSeniorDiscountDetails()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleConfirmSeniorDiscountDetails();
                    }
                  }}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black uppercase text-white hover:bg-emerald-700"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {actionInputModal.isOpen && (
        <div className="fixed inset-0 z-[79] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#062d8c] to-[#041848] px-6 py-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">POS Input</p>
              <h3 className="mt-1 text-xl font-black">
                {actionInputModal.mode === "add-on"
                  ? "Add-on Amount"
                  : actionInputModal.mode === "department"
                    ? "Open Department"
                    : "Pick Up Amount"}
              </h3>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
                  {actionInputModal.mode === "department" ? "Department Code" : "Amount"}
                </label>
                <input
                  ref={actionInputRef}
                  type={actionInputModal.mode === "department" ? "text" : "number"}
                  min={actionInputModal.mode === "department" ? undefined : 0}
                  step={actionInputModal.mode === "department" ? undefined : "0.01"}
                  value={actionInputModal.value}
                  onChange={(event) =>
                    setActionInputModal((prev) => ({ ...prev, value: event.target.value, error: null }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleConfirmActionInputModal();
                    }
                  }}
                  placeholder={
                    actionInputModal.mode === "add-on"
                      ? "Enter add-on amount"
                      : actionInputModal.mode === "department"
                        ? "Enter department code"
                        : "Enter pickup amount"
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#062d8c]"
                />
              </div>

              {actionInputModal.error && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {actionInputModal.error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActionInputModal((prev) => ({ ...prev, isOpen: false, error: null }))}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black uppercase text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmActionInputModal()}
                  className="flex-1 rounded-xl bg-[#062d8c] px-4 py-3 text-sm font-black uppercase text-white hover:bg-[#041848]"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {readingInputState.isOpen && (
        <div className="fixed inset-0 z-[79] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-700 to-amber-600 px-6 py-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">Reading Setup</p>
              <h3 className="mt-1 text-xl font-black">{readingInputState.type} Reading Input</h3>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm text-slate-600">
                {readingInputState.type === "Z"
                  ? "Enter final cash count. Confirming will generate Z Reading and close the shift."
                  : "Enter current cash count to generate X Reading summary."}
              </p>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Cash Count</label>
                <input
                  ref={readingCashInputRef}
                  type="number"
                  min={0}
                  step="0.01"
                  value={readingInputState.cashCountInput}
                  onChange={(event) =>
                    setReadingInputState((prev) => ({ ...prev, cashCountInput: event.target.value, error: null }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleConfirmReadingInput();
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-amber-600"
                />
              </div>

              {readingInputState.error && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {readingInputState.error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReadingInputState((prev) => ({ ...prev, isOpen: false, error: null }))}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black uppercase text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmReadingInput()}
                  className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-black uppercase text-white hover:bg-amber-700"
                >
                  Confirm {readingInputState.type} Reading
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TerminalLockModal
        isOpen={isTerminalLocked}
        isSubmitting={isUnlockingTerminal}
        error={terminalLockError}
        onUnlock={handleUnlockTerminal}
      />

      {/* Receipt Confirmation */}
      {isReceiptConfirmOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          tabIndex={-1}
          ref={el => el?.focus()}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); setIsReceiptConfirmOpen(false); /* TODO: trigger receipt print */ }
            if (e.key === "Escape") { e.preventDefault(); setIsReceiptConfirmOpen(false); }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-900">Payment Successful</h3>
            <div className="mt-2 mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-left space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Tendered</span><span className="font-bold text-slate-800">₱{lastTenderedAmount.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Change</span><span className="font-black text-emerald-700">₱{lastChangeAmount.toFixed(2)}</span></div>
            </div>
            <p className="mb-6 text-sm text-slate-500">Print a receipt for this transaction?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsReceiptConfirmOpen(false)}
                className="flex-1 rounded-xl border-2 border-slate-200 py-3 font-bold text-slate-600 hover:bg-slate-50"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  // TODO: trigger receipt print
                  setIsReceiptConfirmOpen(false);
                }}
                className="flex-1 rounded-xl bg-[#062d8c] py-3 font-bold text-white hover:bg-[#041848]"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {isKeybindHelpOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-6">
              <h3 className="text-2xl font-black text-slate-900">Keyboard Shortcuts</h3>
              <p className="mt-1 text-sm text-slate-500">Press Tab or Esc to close this guide.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 p-6 text-sm md:grid-cols-2">
              <div title="Toggle this keyboard shortcut reference guide" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Open this keybind guide</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">Tab</kbd></div>
              <div title="Open the item list / inventory search to find and add products" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Open Item List</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">Space</kbd></div>
              <div title="Sync and refresh inventory data from the online server" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Refresh / Online</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F1</kbd></div>
              <div title="Cycle through discount types 1 → 2 → 3 → 4 → 1" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Switch Discount Type</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F2</kbd></div>
              <div title="Apply the selected discount type to the subtotal (requires manager PIN)" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Apply Subtotal Discount</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F3</kbd></div>
              <div title="Open the Returns module to process item returns or voids" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Return</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F4</kbd></div>
              <div title="Add an extra charge or fee amount on top of the current total" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Add-on Amount</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F5</kbd></div>
              <div title="Remove or void the currently selected item from the active cart" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Live Item Void</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F6</kbd></div>
              <div title="Cancel and clear the entire current transaction" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Transaction Cancel</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F7</kbd></div>
              <div title="Look up and void a previously completed transaction" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Void Previous Transaction</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F8</kbd></div>
              <div title="Suspend the current cart to hold it, or recall a previously suspended transaction" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Suspend &amp; Recall</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F9</kbd></div>
              <div title="Override the price of the currently selected item (requires manager PIN)" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Price Override</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F10</kbd></div>
              <div title="View the electronic journal log of all actions taken this session" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Electronic Journal</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F11</kbd></div>
              <div title="Open the payment/checkout screen to complete the transaction" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Payment</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">F12</kbd></div>
              <div title="Open the cash drawer without a sale (no-sale event is logged)" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">No Sale</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">H</kbd></div>
              <div title="Open the department/category selection for a department-level sale" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Open Department</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">O</kbd></div>
              <div title="Record a cash pickup from the drawer (reduces cash-on-hand count)" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Pick Up</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">P</kbd></div>
              <div title="Reprint the receipt for the last completed transaction" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Reprint</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">R</kbd></div>
              <div title="Lock this terminal — requires manager PIN to unlock" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Lock Terminal</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">L</kbd></div>
              <div title="Switch the active price level (e.g. regular, senior, wholesale)" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Price Level</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">E</kbd></div>
              <div title="Generate an X Reading — mid-shift sales summary without closing the shift" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">X Reading</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">X</kbd></div>
              <div title="Generate a Z Reading — end-of-shift report that closes and resets the shift" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Z Reading</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">Z</kbd></div>
              <div title="Toggle receipt printing on or off for subsequent transactions" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Receipt On / Off</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">T</kbd></div>
              <div title="Close or dismiss the currently open popup or modal" className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 cursor-help"><span className="font-medium text-slate-700">Close popup</span><kbd className="rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">Esc</kbd></div>
            </div>
          </div>
        </div>
      )}
      {/* Toast notifications - bottom right */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl text-sm font-semibold max-w-sm
              ${toast.type === "success" ? "bg-emerald-600 text-white" : ""}
              ${toast.type === "error" ? "bg-red-600 text-white" : ""}
              ${toast.type === "info" ? "bg-slate-800 text-white" : ""}
            `}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="shrink-0 text-white/70 hover:text-white leading-none"
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CashierPosPage;