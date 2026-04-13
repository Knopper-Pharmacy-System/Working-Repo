import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BranchAnalyticsData,
  BranchRecord,
  DateFilterState,
  DatePreset,
  DepartmentBreakdownPoint,
  FastMovingRow,
  KpiOverview,
  OverviewCharts,
  ProductCatalogRow,
  QuickInsights,
  ReportType,
  SalesRow,
  UploadedReportSummary,
  UploadHistoryEntry,
} from "../types";
import { parseExcelReport } from "../utils/reportParsers";

type UploadOptions = {
  suppressWarnings?: boolean;
  branchId?: string;
};

type CreateBranchInput = {
  name: string;
  code: string;
};

type PersistedSalesAnalyticsState = {
  branches: BranchRecord[];
  selectedBranchId: string;
  branchData: Record<string, BranchAnalyticsData>;
  uploadHistory: UploadHistoryEntry[];
  activeTab: string;
  dateFilter: DateFilterState;
};

type SalesAnalyticsState = {
  branches: BranchRecord[];
  selectedBranchId: string;
  selectedBranch: string;
  branchData: Record<string, BranchAnalyticsData>;
  uploadHistory: UploadHistoryEntry[];
  summaries: UploadedReportSummary[];
  salesRows: SalesRow[];
  fastMovingRows: FastMovingRow[];
  productRows: ProductCatalogRow[];
  isUploading: boolean;
  uploadError: string | null;
  activeTab: string;
  dateFilter: DateFilterState;
  setActiveTab: (tab: string) => void;
  setDatePreset: (preset: DatePreset) => void;
  setCustomDateRange: (fromDate: string, toDate: string) => void;
  clearDateFilter: () => void;
  getDateFilterLabel: () => string;
  getFilteredSalesRows: () => SalesRow[];
  setSelectedBranch: (branchId: string) => void;
  createBranch: (input: CreateBranchInput) => BranchRecord | null;
  getAvailableBranches: () => BranchRecord[];
  getSelectedBranch: () => BranchRecord | null;
  getUploadHistory: () => UploadHistoryEntry[];
  ingestFiles: (files: File[], options?: UploadOptions) => Promise<void>;
  restoreUpload: (uploadId: string) => void;
  clearAll: () => void;
  removeReport: (type: ReportType) => void;
  getLoadedReportTypes: () => ReportType[];
  getMissingReportTypes: () => ReportType[];
  hasMinimumOverviewData: () => boolean;
  getOverviewKpis: () => KpiOverview;
  getQuickInsights: () => QuickInsights;
  getOverviewCharts: () => OverviewCharts;
};

const REQUIRED_REPORTS: ReportType[] = ["sales", "fastMoving", "productCatalog"];
const DEFAULT_BRANCH_NAME = "Door 11 & 12 Pavillion 7";
const DEFAULT_BRANCH_CODE = "D11-12-P7";
const DEFAULT_DATE_FILTER: DateFilterState = {
  preset: "all-time",
  fromDate: "",
  toDate: "",
};

const emptyKpis: KpiOverview = {
  totalGrossSales: 0,
  totalNetProfit: 0,
  totalUnitsSold: 0,
  discountPercent: 0,
  transactionCount: 0,
  averageTransactionValue: 0,
};

const emptyInsights: QuickInsights = {
  topSellingItem: "No data yet",
  bestCashier: "No data yet",
  highestSalesDate: "No data yet",
};

const emptyCharts: OverviewCharts = {
  salesTrend: [],
  topProducts: [],
  departmentBreakdown: [],
};

const createEmptyBranchData = (): BranchAnalyticsData => ({
  summaries: [],
  salesRows: [],
  fastMovingRows: [],
  productRows: [],
});

const normalizeItemKey = (value: string) => value.trim().toUpperCase().replace(/\.0+$/, "");

const toIsoDateOnly = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (value: Date, amount: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
};

const startOfWeek = (value: Date) => {
  const next = new Date(value);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfWeek = (value: Date) => addDays(startOfWeek(value), 6);

const toDisplayDate = (isoDate: string) => {
  if (!isoDate) return "";
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const parseSalesDate = (value: string) => {
  const text = value.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return toIsoDateOnly(parsed);
};

const getPresetBounds = (preset: DatePreset): { fromDate: string; toDate: string } => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (preset === "all-time") return { fromDate: "", toDate: "" };

  if (preset === "today") {
    const today = toIsoDateOnly(now);
    return { fromDate: today, toDate: today };
  }

  if (preset === "yesterday") {
    const day = addDays(now, -1);
    const iso = toIsoDateOnly(day);
    return { fromDate: iso, toDate: iso };
  }

  if (preset === "this-week") {
    return {
      fromDate: toIsoDateOnly(startOfWeek(now)),
      toDate: toIsoDateOnly(endOfWeek(now)),
    };
  }

  if (preset === "last-week") {
    const currentStart = startOfWeek(now);
    return {
      fromDate: toIsoDateOnly(addDays(currentStart, -7)),
      toDate: toIsoDateOnly(addDays(currentStart, -1)),
    };
  }

  if (preset === "this-month") {
    return {
      fromDate: toIsoDateOnly(new Date(now.getFullYear(), now.getMonth(), 1)),
      toDate: toIsoDateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }

  if (preset === "last-month") {
    return {
      fromDate: toIsoDateOnly(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      toDate: toIsoDateOnly(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }

  if (preset === "this-year") {
    return {
      fromDate: toIsoDateOnly(new Date(now.getFullYear(), 0, 1)),
      toDate: toIsoDateOnly(new Date(now.getFullYear(), 11, 31)),
    };
  }

  if (preset === "last-year") {
    const year = now.getFullYear() - 1;
    return {
      fromDate: toIsoDateOnly(new Date(year, 0, 1)),
      toDate: toIsoDateOnly(new Date(year, 11, 31)),
    };
  }

  return { fromDate: "", toDate: "" };
};

const sanitizeDateFilter = (filter: DateFilterState | undefined): DateFilterState => {
  if (!filter) return DEFAULT_DATE_FILTER;
  if (filter.preset === "custom") {
    return {
      preset: "custom",
      fromDate: filter.fromDate || "",
      toDate: filter.toDate || "",
    };
  }

  if (filter.preset === "all-time") return DEFAULT_DATE_FILTER;

  const bounds = getPresetBounds(filter.preset);
  return { preset: filter.preset, fromDate: bounds.fromDate, toDate: bounds.toDate };
};

const getDateFilterLabelFromState = (filter: DateFilterState) => {
  if (filter.preset === "all-time") return "Showing data for: All Time";

  if (filter.preset === "custom") {
    if (filter.fromDate && filter.toDate) {
      return `Showing data for: ${toDisplayDate(filter.fromDate)} - ${toDisplayDate(filter.toDate)}`;
    }
    if (filter.fromDate) return `Showing data for: ${toDisplayDate(filter.fromDate)} onward`;
    if (filter.toDate) return `Showing data for: Up to ${toDisplayDate(filter.toDate)}`;
    return "Showing data for: Custom range";
  }

  return `Showing data for: ${toDisplayDate(filter.fromDate)} - ${toDisplayDate(filter.toDate)}`;
};

const normalizeBranchName = (value: string | undefined) => value?.trim() || DEFAULT_BRANCH_NAME;

const normalizeBranchCode = (value: string | undefined) => {
  const code = value?.trim();
  if (!code) return "";
  return code.toUpperCase();
};

const slugifyBranchId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "branch";

const buildUniqueBranchId = (name: string, code: string, takenIds: Set<string>) => {
  const base = slugifyBranchId(code || name);
  let candidate = base;
  let suffix = 2;

  while (takenIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  takenIds.add(candidate);
  return candidate;
};

const createBranchRecord = (name: string, code: string, takenIds: Set<string>): BranchRecord => {
  const now = new Date().toISOString();
  return {
    id: buildUniqueBranchId(name, code, takenIds),
    name: name.trim(),
    code: normalizeBranchCode(code),
    createdAt: now,
    updatedAt: now,
  };
};

const defaultBranchRecord = (): BranchRecord => {
  const takenIds = new Set<string>();
  return createBranchRecord(DEFAULT_BRANCH_NAME, DEFAULT_BRANCH_CODE, takenIds);
};

const buildSummaryFromHistory = (entry: UploadHistoryEntry): UploadedReportSummary => ({
  id: entry.summaryId,
  type: entry.fileType,
  fileName: entry.fileName,
  branchName: entry.branchName,
  purpose:
    entry.fileType === "sales"
      ? "This sales report helps you see daily performance and profit."
      : entry.fileType === "fastMoving"
        ? "Fast-moving report shows your best-selling items this week."
        : "Product details report powers your catalog and inventory insights.",
  rowsLoaded: entry.rowsLoaded,
  status: entry.status,
  warnings: entry.warnings,
  detectedBy: entry.detectedBy,
  detectionConfidence: entry.detectionConfidence,
  uploadedAt: entry.uploadedAt,
});

const getCurrentBranchData = (
  branchData: Record<string, BranchAnalyticsData>,
  branchId: string,
): BranchAnalyticsData => {
  return branchData[branchId] ?? createEmptyBranchData();
};

const syncStateForBranch = (
  state: Pick<SalesAnalyticsState, "branches" | "branchData" | "activeTab">,
  branchId: string,
  extra?: Partial<SalesAnalyticsState>,
): Pick<
  SalesAnalyticsState,
  | "selectedBranchId"
  | "selectedBranch"
  | "summaries"
  | "salesRows"
  | "fastMovingRows"
  | "productRows"
  | "uploadError"
  | "activeTab"
> &
  Partial<SalesAnalyticsState> => {
  const branch = state.branches.find((item) => item.id === branchId) ?? state.branches[0];
  const branchState = branch ? getCurrentBranchData(state.branchData, branch.id) : createEmptyBranchData();

  return {
    selectedBranchId: branch?.id ?? "",
    selectedBranch: branch?.name ?? DEFAULT_BRANCH_NAME,
    summaries: branchState.summaries,
    salesRows: branchState.salesRows,
    fastMovingRows: branchState.fastMovingRows,
    productRows: branchState.productRows,
    uploadError: null,
    activeTab: branchState.salesRows.length > 0 ? state.activeTab : "overview",
    ...extra,
  };
};

const normalizePersistedBranchData = (
  branchData: Record<string, BranchAnalyticsData> | undefined,
  branches: BranchRecord[],
) => {
  const normalized: Record<string, BranchAnalyticsData> = {};

  branches.forEach((branch) => {
    const data = branchData?.[branch.id] ?? createEmptyBranchData();
    normalized[branch.id] = {
      summaries: data.summaries.map((summary) => ({
        ...summary,
        branchName: summary.branchName || branch.name,
      })),
      salesRows: data.salesRows ?? [],
      fastMovingRows: data.fastMovingRows ?? [],
      productRows: data.productRows ?? [],
    };
  });

  return normalized;
};

const buildLegacyState = (persistedState: Partial<SalesAnalyticsState>) => {
  const legacyBranchData =
    persistedState.branchData && Object.keys(persistedState.branchData).length > 0
      ? persistedState.branchData
      : {};

  const selectedName = normalizeBranchName(persistedState.selectedBranch);
  const branchNames = Array.from(
    new Set([
      DEFAULT_BRANCH_NAME,
      selectedName,
      ...Object.keys(legacyBranchData),
    ]),
  );

  const takenIds = new Set<string>();
  const branches = branchNames.map((branchName) => {
    if (branchName === DEFAULT_BRANCH_NAME) {
      return createBranchRecord(DEFAULT_BRANCH_NAME, DEFAULT_BRANCH_CODE, takenIds);
    }

    const derivedCode = slugifyBranchId(branchName)
      .split("-")
      .filter(Boolean)
      .map((part) => part.slice(0, 1))
      .join("")
      .slice(0, 6)
      .toUpperCase();

    return createBranchRecord(branchName, derivedCode || branchName.slice(0, 6).toUpperCase(), takenIds);
  });

  const branchData: Record<string, BranchAnalyticsData> = {};
  branches.forEach((branch) => {
    const legacy = legacyBranchData[branch.name] ?? createEmptyBranchData();
    branchData[branch.id] = {
      summaries: legacy.summaries.map((summary) => ({
        ...summary,
        branchName: summary.branchName || branch.name,
      })),
      salesRows: legacy.salesRows ?? [],
      fastMovingRows: legacy.fastMovingRows ?? [],
      productRows: legacy.productRows ?? [],
    };
  });
  const selectedBranch = branches.find((branch) => branch.name === selectedName) ?? branches[0];

  return {
    branches,
    branchData,
    selectedBranchId: selectedBranch?.id ?? branches[0]?.id ?? "",
    selectedBranch: selectedBranch?.name ?? DEFAULT_BRANCH_NAME,
    uploadHistory: persistedState.uploadHistory ?? [],
    activeTab: persistedState.activeTab ?? "overview",
    dateFilter: sanitizeDateFilter((persistedState as { dateFilter?: DateFilterState }).dateFilter),
  };
};

const normalizePersistedState = (
  persistedState: Partial<SalesAnalyticsState> & {
    branches?: BranchRecord[];
    branchData?: Record<string, BranchAnalyticsData>;
  },
): PersistedSalesAnalyticsState => {
  if (persistedState.branches && persistedState.branches.length > 0) {
    const branches = persistedState.branches;
    const branchData = normalizePersistedBranchData(persistedState.branchData, branches);
    const selectedBranchId =
      persistedState.selectedBranchId && branches.some((branch) => branch.id === persistedState.selectedBranchId)
        ? persistedState.selectedBranchId
        : branches[0].id;

    return {
      branches,
      selectedBranchId,
      branchData,
      uploadHistory: persistedState.uploadHistory ?? [],
      activeTab: persistedState.activeTab ?? "overview",
      dateFilter: sanitizeDateFilter((persistedState as { dateFilter?: DateFilterState }).dateFilter),
    };
  }

  return {
    ...buildLegacyState(persistedState),
  };
};

const mergeBranchSummary = (
  summaries: UploadedReportSummary[],
  summary: UploadedReportSummary,
) => {
  const map = new Map<ReportType, UploadedReportSummary>();
  summaries.forEach((item) => map.set(item.type, item));
  map.set(summary.type, summary);

  return Array.from(map.values()).sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
};

const appendUploadHistory = (
  history: UploadHistoryEntry[],
  entries: UploadHistoryEntry[],
) => {
  return [...entries, ...history].sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
};

const findBranchById = (branches: BranchRecord[], branchId: string) =>
  branches.find((branch) => branch.id === branchId) ?? null;

export const useSalesAnalyticsStore = create<SalesAnalyticsState>()(
  persist(
    (set, get) => {
      const defaultBranch = defaultBranchRecord();

      return {
        branches: [defaultBranch],
        selectedBranchId: defaultBranch.id,
        selectedBranch: defaultBranch.name,
        branchData: {
          [defaultBranch.id]: createEmptyBranchData(),
        },
        uploadHistory: [],
        summaries: [],
        salesRows: [],
        fastMovingRows: [],
        productRows: [],
        isUploading: false,
        uploadError: null,
        activeTab: "overview",
        dateFilter: DEFAULT_DATE_FILTER,

        setActiveTab: (tab) => set({ activeTab: tab }),

        setDatePreset: (preset) => {
          const bounds = getPresetBounds(preset);
          set({
            dateFilter:
              preset === "all-time"
                ? DEFAULT_DATE_FILTER
                : {
                    preset,
                    fromDate: bounds.fromDate,
                    toDate: bounds.toDate,
                  },
          });
        },

        setCustomDateRange: (fromDate, toDate) => {
          set({
            dateFilter: {
              preset: "custom",
              fromDate: fromDate || "",
              toDate: toDate || "",
            },
          });
        },

        clearDateFilter: () => {
          set({ dateFilter: DEFAULT_DATE_FILTER });
        },

        getDateFilterLabel: () => {
          return getDateFilterLabelFromState(get().dateFilter);
        },

        getFilteredSalesRows: () => {
          const { salesRows, dateFilter } = get();
          if (!salesRows.length) return [];
          if (dateFilter.preset === "all-time") return salesRows;

          let fromDate = dateFilter.fromDate || "";
          let toDate = dateFilter.toDate || "";

          if (fromDate && toDate && fromDate > toDate) {
            const temp = fromDate;
            fromDate = toDate;
            toDate = temp;
          }

          return salesRows.filter((row) => {
            const date = parseSalesDate(row.date);
            if (!date) return false;
            if (fromDate && date < fromDate) return false;
            if (toDate && date > toDate) return false;
            return true;
          });
        },

        setSelectedBranch: (branchId) => {
          set((state) => {
            const targetBranch = findBranchById(state.branches, branchId);
            if (!targetBranch) return state;

            return {
              ...state,
              ...syncStateForBranch(state, targetBranch.id),
            };
          });
        },

        createBranch: ({ name, code }) => {
          const cleanName = name.trim();
          const cleanCode = normalizeBranchCode(code);
          if (!cleanName || !cleanCode) return null;

          const existing = get().branches.find(
            (branch) =>
              branch.name.toLowerCase() === cleanName.toLowerCase() ||
              branch.code.toLowerCase() === cleanCode.toLowerCase(),
          );

          if (existing) {
            set((state) => ({
              ...state,
              ...syncStateForBranch(state, existing.id),
            }));
            return existing;
          }

          const takenIds = new Set(get().branches.map((branch) => branch.id));
          const branch = createBranchRecord(cleanName, cleanCode, takenIds);

          set((state) => ({
            ...state,
            branches: [...state.branches, branch],
            branchData: {
              ...state.branchData,
              [branch.id]: createEmptyBranchData(),
            },
            ...syncStateForBranch(
              {
                ...state,
                branches: [...state.branches, branch],
                branchData: {
                  ...state.branchData,
                  [branch.id]: createEmptyBranchData(),
                },
              },
              branch.id,
            ),
          }));

          return branch;
        },

        getAvailableBranches: () => get().branches,

        getSelectedBranch: () => {
          const state = get();
          return state.branches.find((branch) => branch.id === state.selectedBranchId) ?? null;
        },

        getUploadHistory: () => get().uploadHistory,

        ingestFiles: async (files, options) => {
          if (!files.length) return;

          set({ isUploading: true, uploadError: null });

          try {
            const parsedResults = await Promise.all(files.map((file) => parseExcelReport(file)));
            const activeState = get();
            const branchId = options?.branchId ?? activeState.selectedBranchId;
            const branch = findBranchById(activeState.branches, branchId) ?? activeState.branches[0];

            if (!branch) {
              throw new Error("No branch is available for upload.");
            }

            const results = options?.suppressWarnings
              ? parsedResults.map((result) => ({
                  ...result,
                  summary: {
                    ...result.summary,
                    warnings: [],
                    status: (result.summary.rowsLoaded > 0 ? "success" : "error") as UploadedReportSummary["status"],
                  },
                }))
              : parsedResults;

            const historyEntries: UploadHistoryEntry[] = [];

            const nextState = (() => {
              const branchState = getCurrentBranchData(activeState.branchData, branch.id);
              let salesRows = branchState.salesRows;
              let fastMovingRows = branchState.fastMovingRows;
              let productRows = branchState.productRows;
              let summaries = [...branchState.summaries];

              results.forEach((result) => {
                const summaryWithBranch = {
                  ...result.summary,
                  branchName: branch.name,
                };

                summaries = mergeBranchSummary(summaries, summaryWithBranch);

                if (result.type === "sales") {
                  salesRows = result.salesRows ?? [];
                } else if (result.type === "fastMoving") {
                  fastMovingRows = result.fastMovingRows ?? [];
                } else {
                  productRows = result.productRows ?? [];
                }

                historyEntries.push({
                  id: `${branch.id}-${result.summary.id}`,
                  branchId: branch.id,
                  branchName: branch.name,
                  branchCode: branch.code,
                  fileName: result.summary.fileName,
                  fileType: result.type,
                  rowsLoaded: result.summary.rowsLoaded,
                  status: summaryWithBranch.status,
                  warnings: summaryWithBranch.warnings,
                  detectedBy: summaryWithBranch.detectedBy,
                  detectionConfidence: summaryWithBranch.detectionConfidence,
                  uploadedAt: summaryWithBranch.uploadedAt,
                  summaryId: summaryWithBranch.id,
                  salesRows: result.salesRows,
                  fastMovingRows: result.fastMovingRows,
                  productRows: result.productRows,
                });
              });

              return {
                branchState: {
                  summaries,
                  salesRows,
                  fastMovingRows,
                  productRows,
                },
              };
            })();

            set((state) => {
              const updatedBranchData = {
                ...state.branchData,
                [branch.id]: nextState.branchState,
              };

              const updatedState: SalesAnalyticsState = {
                ...state,
                branches: state.branches.map((item) =>
                  item.id === branch.id ? { ...item, updatedAt: new Date().toISOString() } : item,
                ),
                branchData: updatedBranchData,
                uploadHistory: appendUploadHistory(state.uploadHistory, historyEntries),
              };

              return {
                ...updatedState,
                ...syncStateForBranch(updatedState, branch.id),
                isUploading: false,
              };
            });
          } catch {
            set({
              isUploading: false,
              uploadError: "We could not parse one of the files. Please verify the template and try again.",
            });
          }
        },

        restoreUpload: (uploadId) => {
          set((state) => {
            const upload = state.uploadHistory.find((entry) => entry.id === uploadId);
            if (!upload) return state;

            const existingBranch = findBranchById(state.branches, upload.branchId);
            const branch =
              existingBranch ??
              createBranchRecord(upload.branchName, upload.branchCode, new Set(state.branches.map((item) => item.id)));

            const branchState = getCurrentBranchData(state.branchData, branch.id);
            const summary = buildSummaryFromHistory(upload);
            const summaries = mergeBranchSummary(branchState.summaries, summary);

            const nextBranchState: BranchAnalyticsData = {
              summaries,
              salesRows: upload.fileType === "sales" ? upload.salesRows ?? [] : branchState.salesRows,
              fastMovingRows:
                upload.fileType === "fastMoving" ? upload.fastMovingRows ?? [] : branchState.fastMovingRows,
              productRows:
                upload.fileType === "productCatalog" ? upload.productRows ?? [] : branchState.productRows,
            };

            const branches = existingBranch
              ? state.branches.map((item) => (item.id === branch.id ? { ...item, updatedAt: new Date().toISOString() } : item))
              : [...state.branches, branch];

            const branchData = {
              ...state.branchData,
              [branch.id]: nextBranchState,
            };

            return {
              ...state,
              branches,
              branchData,
              ...syncStateForBranch(
                {
                  ...state,
                  branches,
                  branchData,
                  activeTab: state.activeTab,
                },
                branch.id,
              ),
            };
          });
        },

        clearAll: () =>
          set((state) => {
            const branchId = state.selectedBranchId;
            const clearedBranchData = createEmptyBranchData();
            const branchData = {
              ...state.branchData,
              [branchId]: clearedBranchData,
            };

            return {
              ...state,
              branchData,
              ...syncStateForBranch({ ...state, branchData, activeTab: "overview" }, branchId),
            };
          }),

        removeReport: (type) =>
          set((state) => {
            const branchId = state.selectedBranchId;
            const currentBranchData = getCurrentBranchData(state.branchData, branchId);

            const updatedBranchData: BranchAnalyticsData = {
              summaries: currentBranchData.summaries.filter((summary) => summary.type !== type),
              salesRows: type === "sales" ? [] : currentBranchData.salesRows,
              fastMovingRows: type === "fastMoving" ? [] : currentBranchData.fastMovingRows,
              productRows: type === "productCatalog" ? [] : currentBranchData.productRows,
            };

            const branchData = {
              ...state.branchData,
              [branchId]: updatedBranchData,
            };

            return {
              ...state,
              branchData,
              ...syncStateForBranch({ ...state, branchData, activeTab: state.activeTab }, branchId),
            };
          }),

        getLoadedReportTypes: () => {
          const { salesRows, fastMovingRows, productRows } = get();
          const loaded: ReportType[] = [];
          if (salesRows.length > 0) loaded.push("sales");
          if (fastMovingRows.length > 0) loaded.push("fastMoving");
          if (productRows.length > 0) loaded.push("productCatalog");
          return loaded;
        },

        getMissingReportTypes: () => {
          const loaded = new Set(get().getLoadedReportTypes());
          return REQUIRED_REPORTS.filter((type) => !loaded.has(type));
        },

        hasMinimumOverviewData: () => get().getFilteredSalesRows().length > 0,

        getOverviewKpis: () => {
          const salesRows = get().getFilteredSalesRows();
          if (!salesRows.length) return emptyKpis;

          const totalGrossSales = salesRows.reduce((sum, row) => sum + row.grossSales, 0);
          const totalNetProfit = salesRows.reduce((sum, row) => sum + row.netProfit, 0);
          const totalUnitsSold = salesRows.reduce((sum, row) => sum + row.qtySold, 0);
          const totalDiscount = salesRows.reduce((sum, row) => sum + row.discountAmount, 0);
          const transactionCount = new Set(
            salesRows
              .map((row) => row.transactionNo.trim())
              .filter((transactionNo) => transactionNo.length > 0),
          ).size;

          const safeTxCount = transactionCount > 0 ? transactionCount : 1;

          return {
            totalGrossSales,
            totalNetProfit,
            totalUnitsSold,
            discountPercent: totalGrossSales > 0 ? (totalDiscount / totalGrossSales) * 100 : 0,
            transactionCount,
            averageTransactionValue: totalGrossSales / safeTxCount,
          };
        },

        getQuickInsights: () => {
          const salesRows = get().getFilteredSalesRows();
          if (!salesRows.length) return emptyInsights;

          const byItem = new Map<string, number>();
          const byCashier = new Map<string, number>();
          const byDate = new Map<string, number>();

          salesRows.forEach((row) => {
            const itemKey = row.description || row.itemCode || "Unknown item";
            byItem.set(itemKey, (byItem.get(itemKey) ?? 0) + row.qtySold);

            const cashierKey = row.cashier || "Unknown cashier";
            byCashier.set(cashierKey, (byCashier.get(cashierKey) ?? 0) + row.grossSales);

            const dateKey = row.date || "Unknown date";
            byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + row.grossSales);
          });

          const topSellingItem =
            Array.from(byItem.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No data yet";
          const bestCashier =
            Array.from(byCashier.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No data yet";
          const highestSalesDate =
            Array.from(byDate.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No data yet";

          return {
            topSellingItem,
            bestCashier,
            highestSalesDate,
          };
        },

        getOverviewCharts: () => {
          const salesRows = get().getFilteredSalesRows();
          const { productRows } = get();
          if (!salesRows.length) return emptyCharts;

          const trendByDate = new Map<string, { grossSales: number; netProfit: number; units: number }>();
          salesRows.forEach((row) => {
            const current = trendByDate.get(row.date) ?? { grossSales: 0, netProfit: 0, units: 0 };
            current.grossSales += row.grossSales;
            current.netProfit += row.netProfit;
            current.units += row.qtySold;
            trendByDate.set(row.date, current);
          });

          const topProductsByQty = new Map<string, number>();
          salesRows.forEach((row) => {
            const label = row.description || row.itemCode || "Unknown item";
            topProductsByQty.set(label, (topProductsByQty.get(label) ?? 0) + row.qtySold);
          });

          const productByCode = new Map<string, ProductCatalogRow>();
          productRows.forEach((row) => {
            if (row.itemCode) {
              productByCode.set(normalizeItemKey(row.itemCode), row);
            }
          });

          const departmentMap = new Map<string, number>();
          salesRows.forEach((row) => {
            const product = productByCode.get(normalizeItemKey(row.itemCode));
            const department = product?.department || "Uncategorized";
            departmentMap.set(department, (departmentMap.get(department) ?? 0) + row.grossSales);
          });

          return {
            salesTrend: Array.from(trendByDate.entries())
              .map(([date, value]) => ({ date, ...value }))
              .sort((a, b) => (a.date > b.date ? 1 : -1)),
            topProducts: Array.from(topProductsByQty.entries())
              .map(([item, qtySold]) => ({ item, qtySold }))
              .sort((a, b) => b.qtySold - a.qtySold)
              .slice(0, 10),
            departmentBreakdown: Array.from(departmentMap.entries())
              .map(([department, value]) => ({ department, value } satisfies DepartmentBreakdownPoint))
              .sort((a, b) => b.value - a.value),
          };
        },
      };
    },
    {
      name: "knopper-sales-analytics-v3",
      version: 3,
      partialize: (state) => ({
        branches: state.branches,
        selectedBranchId: state.selectedBranchId,
        branchData: state.branchData,
        uploadHistory: state.uploadHistory,
        activeTab: state.activeTab,
        dateFilter: state.dateFilter,
      }),
      migrate: (persistedState) => {
        return normalizePersistedState(
          persistedState as Partial<SalesAnalyticsState> & {
            branches?: BranchRecord[];
            branchData?: Record<string, BranchAnalyticsData>;
          },
        );
      },
      merge: (persistedState, currentState) => {
        const state = persistedState as PersistedSalesAnalyticsState | Partial<SalesAnalyticsState>;

        const branches = state.branches && state.branches.length > 0 ? state.branches : currentState.branches;
        const branchData = normalizePersistedBranchData(state.branchData ?? currentState.branchData, branches);

        const selectedBranchId =
          state.selectedBranchId && branches.some((branch) => branch.id === state.selectedBranchId)
            ? state.selectedBranchId
            : branches[0]?.id ?? currentState.selectedBranchId;

        const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
        const selectedBranchState = selectedBranch ? branchData[selectedBranch.id] ?? createEmptyBranchData() : createEmptyBranchData();

        return {
          ...currentState,
          ...state,
          branches,
          selectedBranchId: selectedBranch?.id ?? currentState.selectedBranchId,
          selectedBranch: selectedBranch?.name ?? currentState.selectedBranch,
          branchData,
          uploadHistory: state.uploadHistory ?? currentState.uploadHistory,
          dateFilter: sanitizeDateFilter((state as { dateFilter?: DateFilterState }).dateFilter),
          summaries: selectedBranchState.summaries,
          salesRows: selectedBranchState.salesRows,
          fastMovingRows: selectedBranchState.fastMovingRows,
          productRows: selectedBranchState.productRows,
          isUploading: false,
          uploadError: null,
        };
      },
    },
  ),
);
