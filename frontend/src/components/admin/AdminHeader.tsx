import { useEffect, useState } from "react";
import { Menu, Bell, Wifi, WifiOff } from "lucide-react";
import bannerLogo from "../../assets/banner_logo.png";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AdminHeaderProps {
  onMenuClick: () => void;
  currentTime?: Date;
  lastSync?: Date;
  isOnline: boolean;
  role?: "ADMIN" | "MANAGER";
  currentBranchName?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatTime = (date: Date): string =>
  date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AdminHeader({
  onMenuClick,
  currentTime,
  isOnline,
  role = "ADMIN",
  currentBranchName,
}: AdminHeaderProps) {
  const [internalNow, setInternalNow] = useState<Date>(new Date());

  useEffect(() => {
    if (currentTime) return;
    const timer = setInterval(() => setInternalNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [currentTime]);

  const displayTime = currentTime ?? internalNow;

  return (
    <div
      className="rounded-2xl px-3 sm:px-4 lg:px-5 py-3 sm:py-4 lg:py-5"
      style={{
        background:
          "linear-gradient(135deg, #0a2f9d 0%, #0e46c4 50%, #1a64de 100%)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow:
          "0 24px 50px rgba(0,14,61,0.28), inset 0 1px 0 rgba(255,255,255,0.14)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Menu + Logo */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <button
            onClick={onMenuClick}
            className="p-1.5 rounded-lg transition-colors shrink-0"
            style={{
              color: "rgba(255,255,255,0.8)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Menu size={20} className="sm:w-6 sm:h-6" />
          </button>
          <div className="flex flex-col min-w-0">
            <img
              src={bannerLogo}
              alt="Knopper Logo"
              className="h-7 sm:h-8 lg:h-9 object-contain object-left"
              style={{ opacity: 0.85 }}
            />
            {currentBranchName ? (
              <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                <span className="truncate">{currentBranchName}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Middle: Date, Time, Terminal Info */}
        <div className="hidden lg:flex items-center gap-3 justify-center flex-1 tabular-nums">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: "rgba(190,140,0,0.85)" }}
            >
              Date
            </span>
            <span
              className="text-xs font-semibold whitespace-nowrap"
              style={{ color: "rgba(255,255,255,0.95)" }}
            >
              {formatDate(displayTime)}
            </span>
          </div>

          <span
            className="text-xs font-semibold"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            |
          </span>

          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: "rgba(190,140,0,0.85)" }}
            >
              Time
            </span>
            <span
              className="text-xs font-semibold whitespace-nowrap"
              style={{ color: "rgba(255,255,255,0.95)" }}
            >
              {formatTime(displayTime)}
            </span>
          </div>

          <span
            className="text-xs font-semibold"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            |
          </span>

          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold tracking-wide"
              style={{ color: "rgba(228,226,226,0.86)" }}
            >
              TERMINAL ID:
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: "rgba(255,255,255,0.95)" }}
            >
              000
            </span>
          </div>

          <span
            className="text-xs font-semibold"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            |
          </span>

          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold tracking-wide"
              style={{ color: "rgba(228,226,226,0.86)" }}
            >
              ROLE:
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: "rgba(255,255,255,0.95)" }}
            >
              {role}
            </span>
          </div>
        </div>

        {/* Right: Status + Online + Bell */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span
            className="text-xs font-semibold hidden sm:inline"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            STATUS:
          </span>
          <div
            className={`relative flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4 rounded-xl ${
              isOnline ? "bg-[#0c8628]" : "bg-[#cc5500]"
            }`}
          >
            <div className="absolute inset-0 border border-[#062d8c] pointer-events-none rounded-xl shadow-[0_0_40px_rgba(3,31,99,0.1)]" />
            {isOnline ? (
              <Wifi size={14} className="sm:w-4 sm:h-4" />
            ) : (
              <WifiOff size={14} className="sm:w-4 sm:h-4" />
            )}
            <span
              className={`text-xs sm:text-sm font-semibold tracking-wider whitespace-nowrap ${
                isOnline ? "text-[#acf9be]" : "text-white"
              }`}
            >
              {isOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          <button
            className="hidden sm:flex p-1.5 sm:p-2 rounded-lg transition-colors"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.12) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Bell size={18} className="sm:w-5 sm:h-5" style={{ color: "#fff" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
