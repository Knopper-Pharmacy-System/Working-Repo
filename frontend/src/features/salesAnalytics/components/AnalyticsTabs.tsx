import { BarChart3, Boxes, ClipboardList, LayoutGrid, PackageSearch } from "lucide-react";
import { useSalesAnalyticsStore } from "../store/useSalesAnalyticsStore";
import { MANAGER_PANEL_SOFT_STYLE } from "./theme";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "sales", label: "Sales Analytics", icon: BarChart3 },
  { id: "top-products", label: "Top Products", icon: Boxes },
  { id: "catalog", label: "Product Catalog", icon: ClipboardList },
  { id: "inventory", label: "Inventory Insights", icon: PackageSearch },
];

export default function AnalyticsTabs() {
  const activeTab = useSalesAnalyticsStore((state) => state.activeTab);
  const setActiveTab = useSalesAnalyticsStore((state) => state.setActiveTab);

  return (
    <nav className="rounded-2xl p-2" style={MANAGER_PANEL_SOFT_STYLE}>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;

          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-emerald-50 text-emerald-700 shadow-sm"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
                style={{ border: "1px solid rgba(203, 213, 225, 0.9)" }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
