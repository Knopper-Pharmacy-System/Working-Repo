import { Clock3, History, RotateCcw } from "lucide-react";
import ManagerPageLayout from "../../components/manager/ManagerPageLayout";
import { useSalesAnalyticsStore } from "../../features/salesAnalytics/store/useSalesAnalyticsStore";

export default function ManagerUploadHistoryPage() {
  const uploads = useSalesAnalyticsStore((state) => state.uploadHistory);
  const restoreUpload = useSalesAnalyticsStore((state) => state.restoreUpload);

  return (
    <ManagerPageLayout
      activeItem="Upload History"
      title="Upload History"
      subtitle="Review every upload by branch, file type, and row count. Click an entry to restore it into the active branch."
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">History log</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">All uploads</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            <History size={16} />
            {uploads.length} record{uploads.length === 1 ? "" : "s"}
          </div>
        </div>

        {uploads.length > 0 ? (
          <div className="mt-5 grid gap-3">
            {uploads.map((upload) => (
              <button
                key={upload.id}
                type="button"
                onClick={() => restoreUpload(upload.id)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{upload.fileName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {upload.branchName} • {upload.fileType} • {upload.rowsLoaded.toLocaleString()} rows
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {upload.status}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={13} />
                    {new Date(upload.uploadedAt).toLocaleString()}
                  </span>
                  <span>Branch code: {upload.branchCode}</span>
                  <span>Detected by {upload.detectedBy}</span>
                </div>

                <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                  <RotateCcw size={15} />
                  Restore this upload
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
            No uploads have been saved yet.
          </div>
        )}
      </section>
    </ManagerPageLayout>
  );
}
