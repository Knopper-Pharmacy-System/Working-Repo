import * as XLSX from "xlsx";
import type {
  FastMovingRow,
  ProductCatalogRow,
  ReportParseResult,
  ReportType,
  SalesRow,
  UploadedReportSummary,
} from "../types";

const PURPOSE_BY_TYPE: Record<ReportType, string> = {
  sales: "This sales report helps you see daily performance and profit.",
  fastMoving: "Fast-moving report shows your best-selling items this week.",
  productCatalog: "Product details report powers your catalog and inventory insights.",
};

const FILENAME_HINTS: Record<ReportType, string[]> = {
  sales: ["sales", "transaction", "cashier", "sales-report"],
  fastMoving: ["fast", "top sales", "top-sales", "moving"],
  productCatalog: ["product", "master", "details", "catalog"],
};

const HEADER_HINTS: Record<ReportType, string[]> = {
  sales: ["date", "time", "cashier", "trx no", "item code", "qty sold", "gross sales", "net profit"],
  fastMoving: ["item code", "description", "qty sold", "gross sales", "department", "rank"],
  productCatalog: ["id", "barcode", "generic", "classification", "unitcost", "regular price", "reorder point"],
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const safeNum = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value ?? "").trim();
  if (!text) return 0;

  const cleaned = text.replace(/,/g, "").replace(/[^0-9().-]/g, "");
  if (!cleaned) return 0;

  const isParenNegative = cleaned.startsWith("(") && cleaned.endsWith(")");
  const numeric = Number(cleaned.replace(/[()]/g, ""));
  if (!Number.isFinite(numeric)) return 0;

  return isParenNegative ? -numeric : numeric;
};

const cleanString = (value: unknown) => String(value ?? "").trim();

const normalizeItemCode = (value: unknown) => {
  const text = cleanString(value).replace(/\s+/g, " ").toUpperCase();
  return text.replace(/\.0+$/, "");
};

type SheetCandidate = {
  sheetName: string;
  headers: string[];
  rawRows: Record<string, unknown>[];
  headerScore: number;
};

const MAX_HEADER_SCAN_ROWS = 12;

const isNonEmpty = (value: unknown) => String(value ?? "").trim().length > 0;

const readSheetMatrix = (sheet: XLSX.WorkSheet): unknown[][] => {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];
};

const toHeaderStrings = (row: unknown[]): string[] =>
  row.map((cell, index) => {
    const text = cleanString(cell);
    return text || `column_${index + 1}`;
  });

const materializeRows = (headers: string[], dataRows: unknown[][]): Record<string, unknown>[] => {
  return dataRows
    .map((row) => {
      const mapped: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        const value = row[index];
        if (isNonEmpty(value)) {
          mapped[header] = value;
        }
      });

      return mapped;
    })
    .filter((row) => Object.keys(row).length > 0);
};

const findBestHeaderRow = (matrix: unknown[][]): { headerRowIndex: number; headers: string[]; score: number } => {
  let bestHeaderRowIndex = -1;
  let bestHeaders: string[] = [];
  let bestScore = -1;
  let bestNonEmptyCount = 0;

  matrix.slice(0, MAX_HEADER_SCAN_ROWS).forEach((row, index) => {
    const headers = toHeaderStrings(row);
    const nonEmptyCount = row.filter(isNonEmpty).length;
    if (nonEmptyCount < 2) return;

    const detected = detectByHeaders(headers);
    const score = detected.score;

    if (score > bestScore || (score === bestScore && nonEmptyCount > bestNonEmptyCount)) {
      bestHeaderRowIndex = index;
      bestHeaders = headers;
      bestScore = score;
      bestNonEmptyCount = nonEmptyCount;
    }
  });

  if (bestHeaderRowIndex === -1 && matrix.length > 0) {
    const fallbackHeaders = toHeaderStrings(matrix[0]);
    return {
      headerRowIndex: 0,
      headers: fallbackHeaders,
      score: 0,
    };
  }

  return {
    headerRowIndex: bestHeaderRowIndex,
    headers: bestHeaders,
    score: bestScore,
  };
};

const collectSheetCandidates = (workbook: XLSX.WorkBook): SheetCandidate[] => {
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = readSheetMatrix(sheet);
    const { headerRowIndex, headers, score } = findBestHeaderRow(matrix);
    const rawRows = headerRowIndex >= 0 ? materializeRows(headers, matrix.slice(headerRowIndex + 1)) : [];

    return {
      sheetName,
      headers,
      rawRows,
      headerScore: score,
    };
  }).filter((candidate) => candidate.rawRows.length > 0 || candidate.headerScore > 0);
};

const pickDetectionHeaders = (candidates: SheetCandidate[]): string[] => {
  if (!candidates.length) return [];

  return [...candidates]
    .sort((a, b) => {
      if (b.headerScore !== a.headerScore) return b.headerScore - a.headerScore;
      if (b.rawRows.length !== a.rawRows.length) return b.rawRows.length - a.rawRows.length;
      return b.headers.length - a.headers.length;
    })[0].headers;
};

const scoreParsedRows = (
  type: ReportType,
  rows: SalesRow[] | FastMovingRow[] | ProductCatalogRow[],
) => {
  if (type === "sales") {
    return (rows as SalesRow[]).reduce((score, row) => {
      return (
        score +
        (row.grossSales > 0 ? 2 : 0) +
        (row.qtySold > 0 ? 2 : 0) +
        (row.transactionNo ? 1 : 0) +
        (row.cashier ? 1 : 0) +
        (row.date ? 1 : 0)
      );
    }, 0);
  }

  if (type === "fastMoving") {
    return (rows as FastMovingRow[]).reduce(
      (score, row) =>
        score + (row.qtySold > 0 ? 2 : 0) + (row.grossSales > 0 ? 2 : 0) + (row.itemCode || row.description ? 1 : 0),
      0,
    );
  }

  return (rows as ProductCatalogRow[]).reduce(
    (score, row) => score + (row.itemCode || row.barcode ? 2 : 0) + (row.description ? 2 : 0) + (row.price > 0 ? 1 : 0),
    0,
  );
};

const pickBestCandidate = (candidates: SheetCandidate[], type: ReportType) => {
  if (!candidates.length) return null;

  const parser =
    type === "sales" ? parseSalesRows : type === "fastMoving" ? parseFastMovingRows : parseProductRows;

  let bestCandidate: SheetCandidate | null = null;
  let bestRows: SalesRow[] | FastMovingRow[] | ProductCatalogRow[] = [];
  let bestQualityScore = -1;

  candidates.forEach((candidate) => {
    const parsedRows = parser(candidate.rawRows as Record<string, unknown>[]);
    const qualityScore = scoreParsedRows(type, parsedRows);
    if (
      qualityScore > bestQualityScore ||
      (qualityScore === bestQualityScore && parsedRows.length > bestRows.length) ||
      (qualityScore === bestQualityScore &&
        parsedRows.length === bestRows.length &&
        candidate.headerScore > (bestCandidate?.headerScore ?? -1))
    ) {
      bestCandidate = candidate;
      bestRows = parsedRows;
      bestQualityScore = qualityScore;
    }
  });

  return bestCandidate ? { candidate: bestCandidate, rows: bestRows } : null;
};

const excelDateToIso = (value: unknown) => {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${month}-${day}`;
    }
  }

  const asString = cleanString(value);
  if (!asString) return "";

  const dmyMatch = asString.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const yearRaw = Number(dmyMatch[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;

    const day = first > 12 ? first : second;
    const month = first > 12 ? second : first;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) return asString;
  return parsed.toISOString().slice(0, 10);
};

const extractHour = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1) {
      return Math.min(23, Math.max(0, Math.floor(value * 24)));
    }
    return Math.min(23, Math.max(0, Math.floor(value)));
  }

  const text = cleanString(value);
  const matched = text.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!matched) return 0;
  const hour = Number(matched[1]);
  return Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 0;
};

const detectByFileName = (fileName: string): ReportType | null => {
  const normalizedName = normalize(fileName);
  let bestType: ReportType | null = null;
  let bestScore = 0;

  (Object.keys(FILENAME_HINTS) as ReportType[]).forEach((type) => {
    const score = FILENAME_HINTS[type].reduce((count, token) => {
      return normalizedName.includes(normalize(token)) ? count + 1 : count;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  });

  return bestScore > 0 ? bestType : null;
};

const detectByHeaders = (headers: string[]): { type: ReportType; score: number } => {
  const normalizedHeaders = headers.map(normalize);

  let bestType: ReportType = "sales";
  let bestScore = -1;

  (Object.keys(HEADER_HINTS) as ReportType[]).forEach((type) => {
    const score = HEADER_HINTS[type].reduce((count, token) => {
      return normalizedHeaders.some((header) => header.includes(normalize(token)))
        ? count + 1
        : count;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  });

  return { type: bestType, score: Math.max(bestScore, 0) };
};

const detectFileType = (
  fileName: string,
  headers: string[],
): {
  detectedType: ReportType;
  detectedBy: UploadedReportSummary["detectedBy"];
  detectionConfidence: number;
} => {
  const byName = detectByFileName(fileName);
  const byHeaders = detectByHeaders(headers);

  if (byName && byName === byHeaders.type) {
    return {
      detectedType: byName,
      detectedBy: "filename",
      detectionConfidence: 0.96,
    };
  }

  if (byName) {
    return {
      detectedType: byName,
      detectedBy: "filename",
      detectionConfidence: 0.82,
    };
  }

  if (headers.length > 0) {
    const maxHeaderHints = Math.max(
      ...Object.values(HEADER_HINTS).map((hintList) => hintList.length),
    );
    const confidence = Math.max(0.55, Math.min(0.9, byHeaders.score / maxHeaderHints));

    return {
      detectedType: byHeaders.type,
      detectedBy: "headers",
      detectionConfidence: confidence,
    };
  }

  return {
    detectedType: "sales",
    detectedBy: "fallback",
    detectionConfidence: 0.4,
  };
};

const getValue = (row: Record<string, unknown>, ...keys: string[]) => {
  const mapped = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalize(k), v]),
  );

  for (const key of keys) {
    const value = mapped[normalize(key)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
};

const isEmptySalesSourceRow = (row: Record<string, unknown>) => {
  const fieldsToCheck = [
    getValue(row, "date", "sales date", "transaction date", "doc date", "transaction date/time"),
    getValue(row, "time", "hour", "transaction time", "sales time"),
    getValue(row, "cashier", "cashier name", "user", "employee", "served by"),
    getValue(row, "trx no.", "trx no", "trx", "transaction", "transaction no", "invoice", "invoice no."),
    getValue(row, "item code", "item", "sku", "product code", "id"),
    getValue(row, "description", "item description", "product", "item name", "item", "product name"),
    getValue(row, "qty sold", "quantity", "qty", "units", "pieces"),
    getValue(row, "gross sales", "gross amount", "amount", "sales", "sales amount", "total sales"),
    getValue(row, "net profit", "profit", "net", "gross profit"),
  ];

  return fieldsToCheck.every((value) => cleanString(value).length === 0);
};

export const parseAndCleanSalesData = (rawRows: Record<string, unknown>[]): SalesRow[] => {
  const cleaned: SalesRow[] = [];
  let lastKnownDate = "";

  rawRows.forEach((row) => {
    if (isEmptySalesSourceRow(row)) return;

    const transactionNo = cleanString(
      getValue(
        row,
        "trx no.",
        "trx no",
        "trx",
        "transaction",
        "transaction no",
        "invoice",
        "invoice no.",
      ),
    );

    if (!transactionNo || /total/i.test(transactionNo)) return;

    const dateRaw = getValue(row, "date", "sales date", "transaction date", "doc date", "transaction date/time");
    const parsedDate = excelDateToIso(dateRaw);
    if (parsedDate) {
      lastKnownDate = parsedDate;
    }

    // Forward-fill date for row groups where date only appears once in the block.
    const date = parsedDate || lastKnownDate;
    if (!date) return;

    const cashier = cleanString(getValue(row, "cashier", "cashier name", "user", "employee", "served by"));
    if (!cashier || normalize(cashier) === "nan") return;

    const itemCode = normalizeItemCode(getValue(row, "item code", "item", "sku", "product code", "id"));
    if (!itemCode) return;

    const qtySold = safeNum(getValue(row, "qty sold", "quantity", "qty", "units", "pieces"));
    if (!(qtySold > 0)) return;

    const grossSales = safeNum(
      getValue(
        row,
        "gross sales",
        "gross amount",
        "amount",
        "sales",
        "sales amount",
        "total sales",
      ),
    );
    const grossCost = safeNum(getValue(row, "gross cost", "cost", "total cost"));
    const discountAmount = safeNum(getValue(row, "discount amt", "discount amount", "discount"));
    const netProfitRaw = getValue(row, "net profit", "profit", "net", "gross profit");
    const netProfit = cleanString(netProfitRaw)
      ? safeNum(netProfitRaw)
      : Math.max(0, grossSales - grossCost - discountAmount);

    cleaned.push({
      date,
      hour: extractHour(getValue(row, "time", "hour", "transaction time", "sales time")),
      cashier,
      transactionNo,
      itemCode,
      description: cleanString(
        getValue(row, "description", "item description", "product", "item name", "item", "product name"),
      ),
      qtySold,
      grossSales,
      netProfit,
      discountAmount,
    });
  });

  return cleaned;
};

const parseSalesRows = (rawRows: Record<string, unknown>[]): SalesRow[] => parseAndCleanSalesData(rawRows);

const parseFastMovingRows = (rawRows: Record<string, unknown>[]): FastMovingRow[] => {
  return rawRows
    .map((row) => ({
      itemCode: normalizeItemCode(getValue(row, "item code", "item", "sku", "id")),
      description: cleanString(getValue(row, "description", "product", "item description")),
      qtySold: safeNum(getValue(row, "qty sold", "quantity", "qty")),
      grossSales: safeNum(getValue(row, "gross sales", "sales", "amount")),
      department: cleanString(getValue(row, "department", "dept", "classification")),
      subCategory: cleanString(getValue(row, "sub-category", "sub category", "subcategory", "category")),
    }))
    .filter((row) => (row.description || row.itemCode) && (row.qtySold > 0 || row.grossSales > 0));
};

const parseProductRows = (rawRows: Record<string, unknown>[]): ProductCatalogRow[] => {
  return rawRows
    .map((row) => ({
      itemCode: normalizeItemCode(getValue(row, "item code", "sku", "product code", "id", "item id")),
      barcode: cleanString(getValue(row, "barcode", "bar code")),
      description: cleanString(
        getValue(row, "description", "product", "item description", "generic", "product name", "item name"),
      ),
      department: cleanString(getValue(row, "department", "dept", "classification")),
      category: cleanString(getValue(row, "category", "classification")),
      price: safeNum(getValue(row, "srp", "price", "selling price", "regular price")),
      cost: safeNum(getValue(row, "cost", "unit cost", "unitcost")),
      reorderPoint: safeNum(getValue(row, "reorder point", "reorder", "min stock")),
      currentStock: safeNum(getValue(row, "stock", "qty on hand", "on hand", "current stock", "quantity")),
    }))
    .filter((row) => row.description && (row.itemCode || row.barcode));
};

const createWarnings = (
  type: ReportType,
  salesRows: SalesRow[],
  rowsLoaded: number,
): string[] => {
  const warnings: string[] = [];

  if (rowsLoaded === 0) {
    warnings.push("No valid records were detected. Please verify this file format.");
  }

  if (type === "sales" && salesRows.length > 0) {
    const uniqueDates = new Set(salesRows.map((row) => row.date).filter(Boolean));
    if (uniqueDates.size > 0 && uniqueDates.size <= 3) {
      warnings.push(`Sales data for ${uniqueDates.size} day(s) only. Trends may be limited.`);
    }

    const cashierCount = new Set(salesRows.map((row) => row.cashier).filter(Boolean)).size;
    if (cashierCount === 0) {
      warnings.push("Cashier names were not detected. Cashier comparison may be incomplete.");
    }

    const withProfit = salesRows.filter((row) => row.netProfit !== 0).length;
    if (withProfit === 0) {
      warnings.push("Net profit column appears empty. Profit KPIs may be inaccurate.");
    }
  }

  if (type === "fastMoving" && rowsLoaded > 0 && rowsLoaded < 5) {
    warnings.push("Only a few fast-moving rows were found. Top-product insights may be limited.");
  }

  if (type === "productCatalog" && rowsLoaded > 0 && rowsLoaded < 20) {
    warnings.push("Small product catalog detected. Inventory insight quality may be limited.");
  }

  return warnings;
};

const buildSummary = (
  type: ReportType,
  fileName: string,
  rowsLoaded: number,
  warnings: string[],
  detectedBy: UploadedReportSummary["detectedBy"],
  detectionConfidence: number,
): UploadedReportSummary => {
  const status = rowsLoaded > 0 ? (warnings.length ? "warning" : "success") : "error";

  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    fileName,
    purpose: PURPOSE_BY_TYPE[type],
    rowsLoaded,
    status,
    warnings,
    detectedBy,
    detectionConfidence,
    uploadedAt: new Date().toISOString(),
  };
};

export const parseExcelReport = async (file: File): Promise<ReportParseResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetCandidates = collectSheetCandidates(workbook);
  const detectionHeaders = pickDetectionHeaders(sheetCandidates);

  const { detectedType, detectedBy, detectionConfidence } = detectFileType(file.name, detectionHeaders);
  const bestCandidate = pickBestCandidate(sheetCandidates, detectedType);
  const rawRows = bestCandidate?.rows ?? [];

  if (detectedType === "sales") {
    const salesRows = rawRows as SalesRow[];
    const warnings = createWarnings("sales", salesRows, salesRows.length);
    return {
      type: "sales",
      summary: buildSummary(
        "sales",
        file.name,
        salesRows.length,
        warnings,
        detectedBy,
        detectionConfidence,
      ),
      salesRows,
    };
  }

  if (detectedType === "fastMoving") {
    const fastMovingRows = rawRows as FastMovingRow[];
    const warnings = createWarnings("fastMoving", [], fastMovingRows.length);
    return {
      type: "fastMoving",
      summary: buildSummary(
        "fastMoving",
        file.name,
        fastMovingRows.length,
        warnings,
        detectedBy,
        detectionConfidence,
      ),
      fastMovingRows,
    };
  }

  const productRows = rawRows as ProductCatalogRow[];
  const warnings = createWarnings("productCatalog", [], productRows.length);
  return {
    type: "productCatalog",
    summary: buildSummary(
      "productCatalog",
      file.name,
      productRows.length,
      warnings,
      detectedBy,
      detectionConfidence,
    ),
    productRows,
  };
};
