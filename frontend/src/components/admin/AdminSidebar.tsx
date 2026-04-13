import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../hooks/useAuth";
import {
  LayoutDashboard,
  Package,
  BarChart2,
  Building2,
  Users,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  LogOut,
  ClipboardList,
  Truck,
} from "lucide-react";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeItem?: string;
  onNavigate?: (item: string) => void;
}

// --- Route map ---------------------------------------------------------------

const ROUTE_MAP: Record<string, string> = {
  Dashboard: "/admin",
  Overview: "/admin",
  "Audit Sheet": "/admin/audit-sheet",
  Inventory: "/admin/inventory",
  "View Inventory": "/admin/inventory",
  "Stock Transfer": "/admin/stock-transfer",
  "Sales Reports": "/admin/sales-analytics",
  Branches: "/admin/branches",
  Products: "/admin/products",
  Users: "/admin/users",
  "Purchase Order": "/admin/purchase-order",
  Ordering: "/admin/purchase-orders",
  "PO List": "/admin/purchase-orders",
  "New Purchase Order": "/admin/purchase-order",
  "Receive Delivery": "/admin/receive-delivery",
  Settings: "/admin/settings",
};

// --- Sub-components ----------------------------------------------------------

function Divider() {
  return (
    <div
      className="w-full h-px my-1"
      style={{ background: "rgba(255,255,255,0.2)" }}
    />
  );
}

function SidebarItem({
  label,
  icon,
  active = false,
  chevron = "none",
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  chevron?: "down" | "right" | "none";
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center w-full h-10.5 rounded-[7px] px-3.5 transition-colors"
      style={{
        background: active ? "rgba(3,53,175,0.6)" : "transparent",
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.05)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background =
            "transparent";
      }}
    >
      <div className="flex items-center gap-5 flex-1 min-w-0">
        {icon && (
          <span className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
            {icon}
          </span>
        )}
        <span
          className="text-sm leading-3.5 whitespace-nowrap"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            color: active ? "#CB3CFF" : "#D6D6D6",
          }}
        >
          {label}
        </span>
      </div>
      {chevron !== "none" && (
        <span className="ml-auto shrink-0 opacity-80 flex items-center">
          {chevron === "down" ? (
            <ChevronDown size={14} color="#AEB9E1" />
          ) : (
            <ChevronRight size={14} color="#D6D6D6" />
          )}
        </span>
      )}
    </button>
  );
}

function UserProfile({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      onClick={onLogout}
      className="flex items-center w-full px-1.5 py-1.5 rounded-[7px] transition-colors"
      style={{ background: "transparent", border: "none", cursor: "pointer" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(255,80,80,0.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: "rgba(203,60,255,0.2)" }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L2 7L12 12L22 7L12 2Z"
            stroke="#CB3CFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 17L12 22L22 17"
            stroke="#CB3CFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 12L12 17L22 12"
            stroke="#CB3CFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Text */}
      <div className="ml-2.5 flex flex-col text-left">
        <span
          className="text-sm leading-3.5 whitespace-nowrap"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            color: "#FFFFFF",
          }}
        >
          Knopper Pharmacy
        </span>
        <span
          className="text-xs leading-3.5 mt-1 whitespace-nowrap"
          style={{ fontFamily: "'Inter', sans-serif", color: "#AEB9E1" }}
        >
          Account settings
        </span>
      </div>

      {/* Logout icon */}
      <span className="ml-auto shrink-0 opacity-80 flex items-center">
        <LogOut size={14} color="rgba(255,100,100,0.9)" />
      </span>
    </button>
  );
}

// --- Main Component ----------------------------------------------------------

export default function AdminSidebar({
  isOpen,
  onClose,
  activeItem = "Dashboard",
  onNavigate,
}: AdminSidebarProps) {
  const navigate = useNavigate();

  const [prevActiveItem, setPrevActiveItem] = useState(activeItem);
  const [dashboardExpanded, setDashboardExpanded] = useState(
    ["Dashboard", "Overview", "Products"].includes(activeItem),
  );
  const [inventoryExpanded, setInventoryExpanded] = useState(
    ["Inventory", "View Inventory", "Stock Transfer"].includes(activeItem),
  );
  const [orderingExpanded, setOrderingExpanded] = useState(
    ["Ordering", "PO List", "New Purchase Order", "Receive Delivery"].includes(
      activeItem,
    ),
  );

  if (activeItem !== prevActiveItem) {
    setPrevActiveItem(activeItem);
    setDashboardExpanded(
      ["Dashboard", "Overview", "Products"].includes(activeItem),
    );
    setInventoryExpanded(
      ["Inventory", "View Inventory", "Stock Transfer"].includes(activeItem),
    );
    setOrderingExpanded(
      [
        "Ordering",
        "PO List",
        "New Purchase Order",
        "Receive Delivery",
      ].includes(activeItem),
    );
  }

  const handleNav = (item: string) => {
    onNavigate?.(item);
    if (ROUTE_MAP[item]) navigate(ROUTE_MAP[item]);
    onClose();
  };

  const handleLogout = () => {
    console.log("Logging out...");
    logout();
    navigate("/");
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <div
        className="fixed top-0 left-0 h-full z-50 shadow-2xl transition-transform duration-300 flex flex-col"
        style={{
          width: "300px",
          background: "#0321A0",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Search Bar */}
        <div className="px-7 pt-7 pb-4">
          <div
            className="flex items-center gap-2 px-3.5 h-10.5 rounded-sm"
            style={{
              background: "#F0F0F0",
              border: "0.6px solid #343B4F",
            }}
          >
            <Search size={14} color="#062D8C" />
            <span
              className="text-sm leading-[1.2] whitespace-nowrap"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                color: "#062D8C",
              }}
            >
              Search for...
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-7 flex flex-col gap-1">
          {/* Dashboard (expandable) */}
          <div className="flex flex-col gap-1">
            <div
              className="flex items-center w-full h-10.5 rounded-[7px] transition-colors"
              style={{
                background:
                  activeItem === "Dashboard"
                    ? "rgba(3,53,175,0.6)"
                    : "transparent",
              }}
              onMouseEnter={(e) => {
                if (activeItem !== "Dashboard")
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                if (activeItem !== "Dashboard")
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <button
                onClick={() => handleNav("Dashboard")}
                className="flex items-center gap-5 flex-1 px-3.5 h-full rounded-l-[7px]"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                  <LayoutDashboard
                    size={14}
                    color={activeItem === "Dashboard" ? "#CB3CFF" : "#D6D6D6"}
                  />
                </span>
                <span
                  className="text-sm leading-[1.2]"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    color: activeItem === "Dashboard" ? "#CB3CFF" : "#D6D6D6",
                  }}
                >
                  Dashboard
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDashboardExpanded((p) => !p);
                }}
                className="shrink-0 px-3.5 h-full flex items-center rounded-r-[7px] opacity-80"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {dashboardExpanded ? (
                  <ChevronDown
                    size={14}
                    color={activeItem === "Dashboard" ? "#CB3CFF" : "#D6D6D6"}
                  />
                ) : (
                  <ChevronRight
                    size={14}
                    color={activeItem === "Dashboard" ? "#CB3CFF" : "#D6D6D6"}
                  />
                )}
              </button>
            </div>

            {dashboardExpanded && (
              <div className="flex flex-col py-2">
                {["Overview", "Products"].map((sub) => (
                  <button
                    key={sub}
                    onClick={() => handleNav(sub)}
                    className="flex items-center py-2 w-full h-10.5 rounded-[7px] px-3.5 transition-colors"
                    style={{
                      background:
                        activeItem === sub
                          ? "rgba(255,255,255,0.08)"
                          : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (activeItem !== sub)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "rgba(255,255,255,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      if (activeItem !== sub)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "transparent";
                    }}
                  >
                    <span
                      className="text-sm leading-[1.2] whitespace-nowrap"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 500,
                        color: activeItem === sub ? "#CB3CFF" : "#D6D6D6",
                      }}
                    >
                      {sub}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sales Reports */}
          <SidebarItem
            label="Sales Reports"
            icon={
              <BarChart2
                size={14}
                color={activeItem === "Sales Reports" ? "#CB3CFF" : "#D6D6D6"}
              />
            }
            active={activeItem === "Sales Reports"}
            onClick={() => handleNav("Sales Reports")}
          />

          {/* Branches */}
          <SidebarItem
            label="Branches"
            icon={
              <Building2
                size={14}
                color={activeItem === "Branches" ? "#CB3CFF" : "#D6D6D6"}
              />
            }
            active={activeItem === "Branches"}
            onClick={() => handleNav("Branches")}
          />

          {/* Users */}
          <SidebarItem
            label="Users"
            icon={
              <Users
                size={14}
                color={activeItem === "Users" ? "#CB3CFF" : "#D6D6D6"}
              />
            }
            active={activeItem === "Users"}
            onClick={() => handleNav("Users")}
          />

          {/* Inventory (expandable) */}
          <div className="flex flex-col gap-1 py-1">
            <div
              className="flex items-center w-full h-10.5 rounded-[7px] transition-colors"
              style={{
                background:
                  activeItem === "Inventory"
                    ? "rgba(3,53,175,0.6)"
                    : "transparent",
              }}
              onMouseEnter={(e) => {
                if (activeItem !== "Inventory")
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                if (activeItem !== "Inventory")
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <button
                onClick={() => handleNav("Inventory")}
                className="flex items-center gap-5 flex-1 px-3.5 h-full rounded-l-[7px]"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                  <Package
                    size={14}
                    color={activeItem === "Inventory" ? "#CB3CFF" : "#D6D6D6"}
                  />
                </span>
                <span
                  className="text-sm leading-[1.2]"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    color: activeItem === "Inventory" ? "#CB3CFF" : "#D6D6D6",
                  }}
                >
                  Inventory
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInventoryExpanded((p) => !p);
                }}
                className="shrink-0 px-3.5 h-full flex items-center rounded-r-[7px] opacity-80"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {inventoryExpanded ? (
                  <ChevronDown
                    size={14}
                    color={activeItem === "Inventory" ? "#CB3CFF" : "#D6D6D6"}
                  />
                ) : (
                  <ChevronRight
                    size={14}
                    color={activeItem === "Inventory" ? "#CB3CFF" : "#D6D6D6"}
                  />
                )}
              </button>
            </div>

            {inventoryExpanded && (
              <div className="flex flex-col py-2">
                {["View Inventory", "Stock Transfer"].map((sub) => (
                  <button
                    key={sub}
                    onClick={() => handleNav(sub)}
                    className="flex items-center w-full h-10.5 py-2 rounded-[7px] px-3.5 transition-colors"
                    style={{
                      background:
                        activeItem === sub
                          ? "rgba(255,255,255,0.08)"
                          : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (activeItem !== sub)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "rgba(255,255,255,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      if (activeItem !== sub)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "transparent";
                    }}
                  >
                    <span
                      className="text-sm leading-[1.2] whitespace-nowrap"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 500,
                        color: activeItem === sub ? "#CB3CFF" : "#D6D6D6",
                      }}
                    >
                      {sub}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Audit Sheet */}
          <SidebarItem
            label="Audit Sheet"
            icon={
              <ClipboardList
                size={14}
                color={activeItem === "Audit Sheet" ? "#CB3CFF" : "#D6D6D6"}
              />
            }
            active={activeItem === "Audit Sheet"}
            onClick={() => handleNav("Audit Sheet")}
          />

          {/* Ordering (expandable) */}
          <div className="flex flex-col gap-1 py-1">
            <div
              className="flex items-center w-full h-10.5 rounded-[7px] transition-colors"
              style={{
                background:
                  activeItem === "Ordering"
                    ? "rgba(3,53,175,0.6)"
                    : "transparent",
              }}
              onMouseEnter={(e) => {
                if (activeItem !== "Ordering")
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                if (activeItem !== "Ordering")
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <button
                onClick={() => handleNav("Ordering")}
                className="flex items-center gap-5 flex-1 px-3.5 h-full rounded-l-[7px]"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                  <Truck
                    size={14}
                    color={activeItem === "Ordering" ? "#CB3CFF" : "#D6D6D6"}
                  />
                </span>
                <span
                  className="text-sm leading-[1.2]"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    color: activeItem === "Ordering" ? "#CB3CFF" : "#D6D6D6",
                  }}
                >
                  Ordering
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOrderingExpanded((p) => !p);
                }}
                className="shrink-0 px-3.5 h-full flex items-center rounded-r-[7px] opacity-80"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {orderingExpanded ? (
                  <ChevronDown
                    size={14}
                    color={activeItem === "Ordering" ? "#CB3CFF" : "#D6D6D6"}
                  />
                ) : (
                  <ChevronRight
                    size={14}
                    color={activeItem === "Ordering" ? "#CB3CFF" : "#D6D6D6"}
                  />
                )}
              </button>
            </div>

            {orderingExpanded && (
              <div className="flex flex-col py-2">
                {["PO List", "New Purchase Order", "Receive Delivery"].map(
                  (sub) => (
                    <button
                      key={sub}
                      onClick={() => handleNav(sub)}
                      className="flex items-center w-full h-10.5 py-2 rounded-[7px] px-3.5 transition-colors"
                      style={{
                        background:
                          activeItem === sub
                            ? "rgba(255,255,255,0.08)"
                            : "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (activeItem !== sub)
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "rgba(255,255,255,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        if (activeItem !== sub)
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "transparent";
                      }}
                    >
                      <span
                        className="text-sm leading-[1.2] whitespace-nowrap"
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 500,
                          color: activeItem === sub ? "#CB3CFF" : "#D6D6D6",
                        }}
                      >
                        {sub}
                      </span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-6" />
        </div>

        {/* Bottom Section */}
        <div className="px-7 pb-7 flex flex-col gap-4">
          <Divider />

          <SidebarItem
            label="Settings"
            icon={
              <Settings
                size={14}
                color={activeItem === "Settings" ? "#CB3CFF" : "#D6D6D6"}
              />
            }
            active={activeItem === "Settings"}
            onClick={() => handleNav("Settings")}
          />

          <Divider />

          <UserProfile onLogout={handleLogout} />
        </div>
      </div>
    </>
  );
}
