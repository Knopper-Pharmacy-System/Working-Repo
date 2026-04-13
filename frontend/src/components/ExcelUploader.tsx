import { useState } from "react";
import { useSalesAnalyticsStore } from "../features/salesAnalytics/store/useSalesAnalyticsStore";

export default function ExcelUploader() {
  const [message, setMessage] = useState("");
  const ingestFiles = useSalesAnalyticsStore((state) => state.ingestFiles);
  const salesRows = useSalesAnalyticsStore((state) => state.salesRows);
  const fastMovingRows = useSalesAnalyticsStore((state) => state.fastMovingRows);
  const productRows = useSalesAnalyticsStore((state) => state.productRows);
  const isUploading = useSalesAnalyticsStore((state) => state.isUploading);
  const uploadError = useSalesAnalyticsStore((state) => state.uploadError);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setMessage("");

    try {
      const excelFiles = Array.from(files).filter((file) => /\.xlsx?$/.test(file.name.toLowerCase()));
      if (!excelFiles.length) {
        setMessage("Please upload valid Excel files (.xlsx or .xls).");
        return;
      }

      await ingestFiles(excelFiles, { suppressWarnings: true });
      setMessage("Files processed successfully. Data is now synced to the analytics store.");
    } catch (error) {
      console.error("Error reading file:", error);
      setMessage("Error reading Excel file. Please check the file format.");
    }

    event.target.value = "";
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-center text-3xl font-bold text-slate-900">
        Knopper - Pharmacy Analytics
      </h1>

      <div className="rounded-xl border-2 border-dashed border-slate-300 p-10 text-center">
        <input
          type="file"
          multiple
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="inline-block cursor-pointer rounded-lg bg-slate-900 px-8 py-4 text-white hover:bg-slate-800"
        >
          {isUploading ? "Processing..." : "Click to Upload Excel Files"}
        </label>
        <p className="mt-4 text-slate-500">
          You can upload all 3 files at once:
          <br />
          Sales-report.xlsx
          <br />
          fast-moving-report.xlsx
          <br />
          product-details.xlsx
        </p>
      </div>

      {message ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          {message}
        </div>
      ) : null}

      {uploadError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {uploadError}
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        {salesRows.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
            Sales Data Loaded: {salesRows.length} rows
          </div>
        ) : null}

        {fastMovingRows.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
            Fast Moving Data Loaded: {fastMovingRows.length} rows
          </div>
        ) : null}

        {productRows.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
            Product Catalog Loaded: {productRows.length} rows
          </div>
        ) : null}
      </div>
    </div>
  );
}
