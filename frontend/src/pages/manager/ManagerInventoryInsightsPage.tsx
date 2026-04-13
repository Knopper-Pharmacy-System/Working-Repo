import ManagerPageLayout from "../../components/manager/ManagerPageLayout";
import AnalyticsErrorBoundary from "../../features/salesAnalytics/components/AnalyticsErrorBoundary";
import InventoryInsightsView from "../../features/salesAnalytics/components/InventoryInsightsView";

export default function ManagerInventoryInsightsPage() {
  return (
    <ManagerPageLayout
      activeItem="Inventory Insights"
      title="Inventory Insights"
      subtitle="Review stock risk, reorder watchlists, and inventory trends for the selected branch."
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
          <InventoryInsightsView />
        </section>
      </AnalyticsErrorBoundary>
    </ManagerPageLayout>
  );
}
