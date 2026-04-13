export type ReportType = "sales" | "fastMoving" | "productCatalog";

export type DatePreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "this-year"
  | "last-year"
  | "all-time"
  | "custom";

export type DateFilterState = {
  preset: DatePreset;
  fromDate: string;
  toDate: string;
};

export type BranchRecord = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
};

export type UploadStatus = "success" | "warning" | "error";

export type UploadedReportSummary = {
  id: string;
  type: ReportType;
  fileName: string;
  branchName?: string;
  purpose: string;
  rowsLoaded: number;
  status: UploadStatus;
  warnings: string[];
  detectedBy: "filename" | "headers" | "fallback";
  detectionConfidence: number;
  uploadedAt: string;
};

export type BranchAnalyticsData = {
  summaries: UploadedReportSummary[];
  salesRows: SalesRow[];
  fastMovingRows: FastMovingRow[];
  productRows: ProductCatalogRow[];
};

export type UploadHistoryEntry = {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  fileName: string;
  fileType: ReportType;
  rowsLoaded: number;
  status: UploadStatus;
  warnings: string[];
  detectedBy: UploadedReportSummary["detectedBy"];
  detectionConfidence: number;
  uploadedAt: string;
  summaryId: string;
  salesRows?: SalesRow[];
  fastMovingRows?: FastMovingRow[];
  productRows?: ProductCatalogRow[];
};

export type SalesRow = {
  date: string;
  hour: number;
  cashier: string;
  transactionNo: string;
  itemCode: string;
  description: string;
  qtySold: number;
  grossSales: number;
  netProfit: number;
  discountAmount: number;
};

export type FastMovingRow = {
  itemCode: string;
  description: string;
  qtySold: number;
  grossSales: number;
  department?: string;
  subCategory?: string;
};

export type ProductCatalogRow = {
  itemCode: string;
  barcode: string;
  description: string;
  department: string;
  category: string;
  price: number;
  cost: number;
  reorderPoint: number;
  currentStock: number;
};

export type KpiOverview = {
  totalGrossSales: number;
  totalNetProfit: number;
  totalUnitsSold: number;
  discountPercent: number;
  transactionCount: number;
  averageTransactionValue: number;
};

export type QuickInsights = {
  topSellingItem: string;
  bestCashier: string;
  highestSalesDate: string;
};

export type SalesTrendPoint = {
  date: string;
  grossSales: number;
  netProfit: number;
  units: number;
};

export type TopProductPoint = {
  item: string;
  qtySold: number;
};

export type DepartmentBreakdownPoint = {
  department: string;
  value: number;
};

export type OverviewCharts = {
  salesTrend: SalesTrendPoint[];
  topProducts: TopProductPoint[];
  departmentBreakdown: DepartmentBreakdownPoint[];
};

export type ReportParseResult = {
  type: ReportType;
  summary: UploadedReportSummary;
  salesRows?: SalesRow[];
  fastMovingRows?: FastMovingRow[];
  productRows?: ProductCatalogRow[];
};
