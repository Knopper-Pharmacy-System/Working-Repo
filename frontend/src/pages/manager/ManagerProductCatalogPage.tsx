import ManagerPageLayout from "../../components/manager/ManagerPageLayout";
import AnalyticsErrorBoundary from "../../features/salesAnalytics/components/AnalyticsErrorBoundary";
import ProductCatalogView from "../../features/salesAnalytics/components/ProductCatalogView";

export default function ManagerProductCatalogPage() {
  return (
    <ManagerPageLayout
      activeItem="Product Catalog"
      title="Product Catalog"
      subtitle="Search, filter, and paginate your product list by branch in a dedicated full-page workspace."
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
          <ProductCatalogView />
        </section>
      </AnalyticsErrorBoundary>
    </ManagerPageLayout>
  );
}
