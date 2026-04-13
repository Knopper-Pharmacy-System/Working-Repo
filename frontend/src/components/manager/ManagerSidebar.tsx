import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../hooks/useAuth";
import { useSalesAnalyticsStore } from "../../features/salesAnalytics/store/useSalesAnalyticsStore";
import {
  Building2,
  ChevronRight,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  PackageSearch,
  Settings,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

interface ManagerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeItem?: string;
  onNavigate?: (item: string) => void;
}

type NavItem = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active: boolean;
};

const getItemStyle = (active: boolean) => ({
  background: active ? "rgba(255,255,255,0.12)" : "transparent",
  borderColor: active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
});

function NavButton({ label, icon, active, onClick }: NavItem) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition hover:bg-white/8"
      style={getItemStyle(active)}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? "bg-white/15" : "bg-white/8"}`}>
        {icon}
      </span>
      <span className={`text-sm font-semibold ${active ? "text-white" : "text-slate-200"}`}>
        {label}
      </span>
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/7 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100/90">{title}</p>
      </div>
      {children}
    </section>
  );
}

export default function ManagerSidebar({
  isOpen,
  onClose,
  activeItem = "Dashboard",
  onNavigate,
}: ManagerSidebarProps) {
  const navigate = useNavigate();
  const branches = useSalesAnalyticsStore((state) => state.branches);
  const selectedBranchId = useSalesAnalyticsStore((state) => state.selectedBranchId);
  const setSelectedBranch = useSalesAnalyticsStore((state) => state.setSelectedBranch);

  const closeAnd = (item: string, action: () => void) => {
    onNavigate?.(item);
    action();
    onClose();
  };

  const goToDashboard = () => {
    navigate("/manager");
  };

  const goToUpload = () => {
    navigate("/manager/upload-reports");
  };

  const goToCatalog = () => {
    navigate("/manager/product-catalog");
  };

  const goToInventory = () => {
    navigate("/manager/inventory-insights");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
    onClose();
  };

  return (
    <>
      {isOpen ? <button type="button" aria-label="Close navigation overlay" className="fixed inset-0 z-40 cursor-default bg-slate-950/55" onClick={onClose} /> : null}

      <aside
        className="fixed left-0 top-0 z-50 flex h-full w-[320px] max-w-[88vw] flex-col border-r border-white/10 bg-[#08214f] text-white shadow-2xl transition-transform duration-300"
        style={{ transform: isOpen ? "translateX(0)" : "translateX(-102%)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-100/80">Manager Console</p>
            <h2 className="mt-1 text-lg font-bold">Knopper Pharmacy</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/8 p-2 text-white transition hover:bg-white/12"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <SectionCard title="Navigation">
            <div className="space-y-2">
              <NavButton
                label="Dashboard"
                icon={<LayoutDashboard size={18} className={activeItem === "Dashboard" ? "text-blue-50" : "text-slate-300"} />}
                active={activeItem === "Dashboard"}
                onClick={() => closeAnd("Dashboard", goToDashboard)}
              />
              <NavButton
                label="Upload Reports"
                icon={<UploadCloud size={18} className={activeItem === "Upload Reports" ? "text-blue-50" : "text-slate-300"} />}
                active={activeItem === "Upload Reports"}
                onClick={() => closeAnd("Upload Reports", goToUpload)}
              />
              <NavButton
                label="Branches"
                icon={<Building2 size={18} className={activeItem === "Branches" ? "text-blue-50" : "text-slate-300"} />}
                active={activeItem === "Branches"}
                onClick={() => closeAnd("Branches", () => navigate("/manager/branches"))}
              />
              <NavButton
                label="Staff / Cashiers"
                icon={<Users size={18} className={activeItem === "Staff / Cashiers" ? "text-blue-50" : "text-slate-300"} />}
                active={activeItem === "Staff / Cashiers"}
                onClick={() => closeAnd("Staff / Cashiers", () => navigate("/manager/cashiers"))}
              />
              <NavButton
                label="Upload History"
                icon={<History size={18} className={activeItem === "Upload History" ? "text-blue-50" : "text-slate-300"} />}
                active={activeItem === "Upload History"}
                onClick={() => closeAnd("Upload History", () => navigate("/manager/upload-history"))}
              />
              <NavButton
                label="Product Catalog"
                icon={<ClipboardList size={18} className={activeItem === "Product Catalog" ? "text-blue-50" : "text-slate-300"} />}
                active={activeItem === "Product Catalog"}
                onClick={() => closeAnd("Product Catalog", goToCatalog)}
              />
              <NavButton
                label="Inventory Insights"
                icon={<PackageSearch size={18} className={activeItem === "Inventory Insights" ? "text-blue-50" : "text-slate-300"} />}
                active={activeItem === "Inventory Insights"}
                onClick={() => closeAnd("Inventory Insights", goToInventory)}
              />
              <NavButton
                label="Settings"
                icon={<Settings size={18} className={activeItem === "Settings" ? "text-blue-50" : "text-slate-300"} />}
                active={activeItem === "Settings"}
                onClick={() => closeAnd("Settings", () => navigate("/manager/settings"))}
              />
            </div>
          </SectionCard>

          <SectionCard title="Branches">
            <div className="space-y-2">
              {branches.length > 0 ? (
                branches.map((branch) => {
                  const isSelected = branch.id === selectedBranchId;
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => {
                        setSelectedBranch(branch.id);
                        onClose();
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left transition ${
                        isSelected ? "bg-white/14" : "bg-white/6 hover:bg-white/10"
                      }`}
                      style={{ borderColor: isSelected ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)" }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{branch.name}</p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-blue-100/80">{branch.code}</p>
                      </div>
                      {isSelected ? <ChevronRight size={16} className="text-blue-100" /> : null}
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-slate-200">No branches created yet.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => closeAnd("Branches", () => navigate("/manager/branches"))}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Building2 size={16} />
              Create New Branch
            </button>
          </SectionCard>
        </div>

        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-3 py-2.5 text-left transition hover:bg-red-500/10"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
              <LogOut size={18} className="text-red-200" />
            </span>
            <span className="text-sm font-semibold text-white">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
