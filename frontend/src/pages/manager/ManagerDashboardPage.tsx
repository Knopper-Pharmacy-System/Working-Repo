import AdminFooter from "../../components/admin/AdminFooter";
import OverviewDashboard from "../../features/salesAnalytics/components/OverviewDashboard";
import AnalyticsErrorBoundary from "../../features/salesAnalytics/components/AnalyticsErrorBoundary";
import ManagerPageLayout from "../../components/manager/ManagerPageLayout";
import { useSalesAnalyticsStore } from "../../features/salesAnalytics/store/useSalesAnalyticsStore";

export default function ManagerDashboardPage() {
  const filteredSalesRows = useSalesAnalyticsStore((state) => state.getFilteredSalesRows());

  return (
    <ManagerPageLayout
      activeItem="Dashboard"
      title="Manager Sales Intelligence"
      subtitle="Overview KPIs and charts for the currently selected branch."
      showDateFilter
    >
      <AnalyticsErrorBoundary>
        <section
          className="rounded-3xl p-4 sm:p-5"
          style={{
            background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
            border: "1px solid rgba(203, 213, 225, 0.9)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.92), 0 10px 22px rgba(15, 23, 42, 0.16)",
          }}
        >
          <OverviewDashboard />
        </section>
      </AnalyticsErrorBoundary>

      {filteredSalesRows.length === 0 ? (
        <section
          className="rounded-2xl p-4 text-sm"
          style={{
            color: "#92400e",
            background: "linear-gradient(180deg, #fffbeb 0%, #fff7d8 100%)",
            border: "1px solid rgba(245, 208, 104, 0.72)",
            boxShadow: "0 8px 18px rgba(13, 37, 84, 0.08)",
          }}
        >
          Upload at least one Sales Transaction report for the selected branch and date range to unlock KPI cards and charts in Overview.
        </section>
      ) : (
        <section
          className="rounded-2xl p-4 text-sm"
          style={{
            color: "#065f46",
            background: "linear-gradient(180deg, #ecfdf5 0%, #dff9ef 100%)",
            border: "1px solid rgba(110, 231, 183, 0.72)",
            boxShadow: "0 8px 18px rgba(13, 37, 84, 0.08)",
          }}
        >
          Sales data detected. Your overview dashboard is now active and ready for analysis.
        </section>
      )}

      <AdminFooter />
    </ManagerPageLayout>
  );
}
