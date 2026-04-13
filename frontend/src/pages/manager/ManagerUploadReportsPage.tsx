import ManagerPageLayout from "../../components/manager/ManagerPageLayout";
import SmartReportUploader from "../../features/salesAnalytics/components/SmartReportUploader";

export default function ManagerUploadReportsPage() {
  return (
    <ManagerPageLayout
      activeItem="Upload Reports"
      title="Upload Reports"
      subtitle="Use the branch selector and upload logs to keep every branch synchronized offline."
    >
      <section
        className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
      >
        <SmartReportUploader />
      </section>
    </ManagerPageLayout>
  );
}
