import { useEffect, useState, type ReactNode } from "react";
import AdminHeader from "../admin/AdminHeader";
import ManagerSidebar from "./ManagerSidebar";
import { useSalesAnalyticsStore } from "../../features/salesAnalytics/store/useSalesAnalyticsStore";
import DateRangeFilter from "../../features/salesAnalytics/components/DateRangeFilter";

type ManagerPageLayoutProps = {
  activeItem: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  showDateFilter?: boolean;
};

export default function ManagerPageLayout({
  activeItem,
  title,
  subtitle,
  children,
  showDateFilter = false,
}: ManagerPageLayoutProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentBranchName = useSalesAnalyticsStore((state) => state.selectedBranch);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden overflow-y-auto"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,0.2) 0%, transparent 28%), radial-gradient(circle at top right, rgba(30,64,175,0.24) 0%, transparent 34%), linear-gradient(180deg, #0f172a 0%, #111f3d 46%, #10244b 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96"
        style={{
          background: "linear-gradient(180deg, rgba(148,163,184,0.14) 0%, rgba(148,163,184,0) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-16 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "rgba(59, 130, 246, 0.18)" }}
      />
      <div
        className="pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "rgba(30, 64, 175, 0.24)" }}
      />

      <ManagerSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeItem={activeItem}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <AdminHeader
          onMenuClick={() => setIsSidebarOpen((previous) => !previous)}
          currentTime={currentTime}
          isOnline={isOnline}
          role="MANAGER"
          currentBranchName={currentBranchName}
        />

        <section className="flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em]" style={{ color: "rgba(191,219,254,0.8)" }}>
            Manager Workspace
          </p>
          <h1 className="text-2xl font-bold tracking-wide" style={{ color: "rgba(248,250,252,0.98)" }}>
            {title}
          </h1>
          <p className="text-sm" style={{ color: "rgba(203,213,225,0.9)" }}>
            {subtitle}
          </p>
        </section>

        {showDateFilter ? <DateRangeFilter /> : null}

        {children}
      </div>
    </div>
  );
}
