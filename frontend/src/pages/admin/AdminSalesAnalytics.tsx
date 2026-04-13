import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminFooter from "../../components/admin/AdminFooter";
import AnalyticsTabs from "../../features/salesAnalytics/components/AnalyticsTabs";
import OverviewDashboard from "../../features/salesAnalytics/components/OverviewDashboard";
import SmartReportUploader from "../../features/salesAnalytics/components/SmartReportUploader";
import { useSalesAnalyticsStore } from "../../features/salesAnalytics/store/useSalesAnalyticsStore";

function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </section>
  );
}

export default function AdminSalesAnalytics() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime] = useState(new Date());
  const [isOnline] = useState(navigator.onLine);

  const activeTab = useSalesAnalyticsStore((state) => state.activeTab);
  const salesRows = useSalesAnalyticsStore((state) => state.salesRows);

  const hasSalesData = salesRows.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-emerald-50">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItem="Sales Analytics"
      />

      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          currentTime={currentTime}
          isOnline={isOnline}
        />

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Smart Analytics</p>
              <h1 className="text-2xl font-bold text-slate-900">Sales Intelligence Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">
                Upload your reports once and instantly get KPI cards, quick insights, and clean visual summaries.
              </p>
            </div>
          </div>
        </section>

        <SmartReportUploader />

        <AnalyticsTabs />

        {activeTab === "overview" ? <OverviewDashboard /> : null}

        {activeTab === "sales" ? (
          <PlaceholderPanel
            title="Sales Analytics"
            description="Suggested content: cashier comparison, hourly sales trends, and discount behavior by date range. This tab can reuse the same parsed sales dataset from the store."
          />
        ) : null}

        {activeTab === "top-products" ? (
          <PlaceholderPanel
            title="Top Products"
            description="Suggested content: blended ranking from fast-moving and sales files, with quantity, revenue, and category tags for each item."
          />
        ) : null}

        {activeTab === "catalog" ? (
          <PlaceholderPanel
            title="Product Catalog"
            description="Suggested content: searchable and sortable product table from Product Details report, including barcode, department, SRP, and reorder point."
          />
        ) : null}

        {activeTab === "inventory" ? (
          <PlaceholderPanel
            title="Inventory Insights"
            description="Suggested content: low stock risk list using reorder points plus recent sales velocity. Highlight products likely to stock out soon."
          />
        ) : null}

        {!hasSalesData ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Upload at least one Sales Transaction report to unlock KPI cards and chart analytics in the Overview tab.
          </section>
        ) : null}

        <AdminFooter />
      </div>
    </div>
  );
}
