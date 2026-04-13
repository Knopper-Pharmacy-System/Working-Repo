import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Circle,
  LoaderCircle,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useSalesAnalyticsStore } from "../store/useSalesAnalyticsStore";
import type { ReportType, UploadedReportSummary } from "../types";
import { MANAGER_PANEL_SOFT_STYLE, MANAGER_PANEL_STYLE } from "./theme";

const REPORT_LABELS: Record<ReportType, string> = {
  sales: "Sales Transaction Report",
  fastMoving: "Fast Moving / Top Sales Report",
  productCatalog: "Product Details / Master List",
};

const REPORT_HELPER: Record<ReportType, string> = {
  sales: "This sales report helps you see daily performance and profit.",
  fastMoving: "Fast-moving report shows your best-selling items this week.",
  productCatalog: "Product details report powers your catalog and inventory insights.",
};

const statusBadge = (summary: UploadedReportSummary) => {
  if (summary.status === "error") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (summary.status === "warning") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }

  return "bg-emerald-100 text-emerald-700 border-emerald-200";
};

type UploaderProps = {
  className?: string;
};

export default function SmartReportUploader({ className = "" }: UploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const branches = useSalesAnalyticsStore((state) => state.branches);
  const summaries = useSalesAnalyticsStore((state) => state.summaries);
  const isUploading = useSalesAnalyticsStore((state) => state.isUploading);
  const uploadError = useSalesAnalyticsStore((state) => state.uploadError);
  const ingestFiles = useSalesAnalyticsStore((state) => state.ingestFiles);
  const clearAll = useSalesAnalyticsStore((state) => state.clearAll);
  const getLoadedReportTypes = useSalesAnalyticsStore((state) => state.getLoadedReportTypes);
  const getMissingReportTypes = useSalesAnalyticsStore((state) => state.getMissingReportTypes);
  const selectedBranchId = useSalesAnalyticsStore((state) => state.selectedBranchId);
  const selectedBranch = useSalesAnalyticsStore((state) => state.selectedBranch);
  const setSelectedBranch = useSalesAnalyticsStore((state) => state.setSelectedBranch);

  const loadedCount = useMemo(
    () => summaries.filter((summary) => summary.status !== "error").length,
    [summaries],
  );

  const loadedTypes = getLoadedReportTypes();
  const missingTypes = getMissingReportTypes();

  const onFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
      const files = Array.from(fileList).filter((file) => /\.xlsx?$/.test(file.name.toLowerCase()));
      if (!files.length) return;
      await ingestFiles(files, { suppressWarnings: true, branchId: selectedBranchId });
    },
    [ingestFiles, selectedBranchId],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      await onFiles(event.dataTransfer.files);
    },
    [onFiles],
  );

  const handleBrowse = useCallback(async () => {
    if (!inputRef.current) return;
    inputRef.current.click();
  }, []);

  return (
    <section className={`rounded-3xl p-5 ${className}`} style={MANAGER_PANEL_STYLE}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Smart Upload</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-800">Upload your Excel reports</h2>
          <p className="mt-1 text-sm text-slate-600">
            Drop one or more files. We will detect each report type and prepare your dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {summaries.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Trash2 size={16} />
              Clear all
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleBrowse}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E40AF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3B82F6]"
          >
            <UploadCloud size={16} />
            Browse files
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:max-w-sm">
        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
          Select Branch
        </label>
        <select
          value={selectedBranchId}
          onChange={(event) => setSelectedBranch(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-transparent transition focus:ring-2 focus:ring-blue-300"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} ({branch.code})
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">Uploaded reports and logs are saved for this branch.</p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={`mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition ${
          isDragActive
            ? "border-[#3B82F6] bg-blue-50"
            : "border-slate-300 bg-slate-50"
        }`}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E40AF] text-white shadow-lg shadow-blue-500/20">
          {isUploading ? <LoaderCircle className="animate-spin" size={24} /> : <FileSpreadsheet size={24} />}
        </div>
        <p className="mt-4 text-base font-semibold text-slate-800">Drag and drop Excel files here</p>
        <p className="mt-1 text-sm text-slate-600">Accepted format: .xlsx, .xls</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={async (event) => {
          await onFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {uploadError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4" style={MANAGER_PANEL_SOFT_STYLE}>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">
            <CheckCircle2 size={14} />
            Successfully loaded
          </p>
          {loadedTypes.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm text-slate-900">
              {loadedTypes.map((type) => (
                <li key={type} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="inline-flex items-center gap-2 font-semibold">
                    <Circle size={8} className="fill-[#10B981] text-[#10B981]" />
                    {REPORT_LABELS[type]}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Branch: {selectedBranch}</p>
                  <p className="text-xs text-slate-600">{REPORT_HELPER[type]}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-700">No files loaded yet.</p>
          )}
        </article>

        <article className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4" style={MANAGER_PANEL_SOFT_STYLE}>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-700">
            <Sparkles size={14} />
            {missingTypes.length > 0 ? "Recommended next upload" : "Upload logs"}
          </p>
          {missingTypes.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm text-slate-900">
              {missingTypes.map((type) => (
                <li key={type} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="inline-flex items-center gap-2 font-semibold text-slate-800">
                    <ArrowRight size={14} className="text-[#3B82F6]" />
                    {REPORT_LABELS[type]}
                  </p>
                  <p className="text-xs text-slate-600">{REPORT_HELPER[type]}</p>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {summaries.length === 0 ? (
                <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">No upload activity yet.</li>
              ) : (
                summaries.slice(0, 6).map((summary) => (
                  <li key={summary.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-slate-800">{summary.fileName}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge(summary)}`}>
                        {summary.status === "success" ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                        {summary.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(summary.uploadedAt).toLocaleString()} • {summary.rowsLoaded.toLocaleString()} rows • {summary.detectedBy} • Branch: {summary.branchName || selectedBranch}
                    </p>
                  </li>
                ))
              )}
            </ul>
          )}
        </article>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700" style={MANAGER_PANEL_SOFT_STYLE}>
        {loadedCount === 0
          ? "No report loaded yet. Upload at least a Sales Transaction report to unlock KPIs."
          : `${loadedCount} report type(s) ready. Your analytics dashboard is now available below.`}
      </div>
    </section>
  );
}
