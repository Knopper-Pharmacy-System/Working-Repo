import { useState, useEffect, useCallback } from "react";
import {
  Search,
  UserPlus,
  Users,
  UserCheck,
  ShieldCheck,
  UserCog,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminFooter from "../../components/admin/AdminFooter";
import CreateUserModal from "../../components/admin/CreateUserModal";
import { getToken } from "../../hooks/useAuth";

const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "Admin" | "Manager" | "Cashier" | "Staff";
type Status = "Active" | "Inactive";

interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: Role;
  branch: string;
  status: Status;
  lastLogin: string;
}

interface ApiUserRecord {
  user_id: number;
  username: string;
  full_name: string;
  role: string;
  branch: string;
  status: string;
}

interface EditableUser {
  id: number;
  user_id: string;
  branch_id: string;
  full_name: string;
  username: string;
  role: string;
  status: Status;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: Array<"All" | Role> = [
  "All",
  "Admin",
  "Manager",
  "Cashier",
  "Staff",
];
const STATUS_OPTIONS: Array<"All" | Status> = ["All", "Active", "Inactive"];

const INITIAL_USERS: UserRecord[] = [];

const BRANCH_ID_BY_NAME: Record<string, string> = {
  "BMC MAIN": "1",
  "DIVERSION BRANCH": "2",
  "PANGANIBAN BRANCH": "3",
};

const ROLE_TO_API: Record<Role, string> = {
  Admin: "admin",
  Manager: "manager",
  Cashier: "cashier",
  Staff: "staff",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  Admin: { bg: "rgba(203,60,255,0.15)", text: "#cb3cff" },
  Manager: { bg: "rgba(0,59,205,0.13)", text: "#3b6eff" },
  Cashier: { bg: "rgba(0,191,44,0.13)", text: "#00bf2c" },
  Staff: { bg: "rgba(236,108,0,0.13)", text: "#d37b13" },
};

const normalizeRole = (role: string): Role => {
  const normalized = role.trim().toLowerCase();
  if (normalized === "admin") return "Admin";
  if (normalized === "manager") return "Manager";
  if (normalized === "cashier") return "Cashier";
  return "Staff";
};

const normalizeStatus = (status: string): Status =>
  status.trim().toLowerCase() === "active" ? "Active" : "Inactive";

const STATUS_COLORS: Record<Status, { bg: string; text: string; dot: string }> =
  {
    Active: {
      bg: "rgba(0,191,44,0.12)",
      text: "#00bf2c",
      dot: "#00bf2c",
    },
    Inactive: {
      bg: "rgba(180,180,180,0.15)",
      text: "#888",
      dot: "#aaa",
    },
  };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const [search, setSearch] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<"All" | Role>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editUser, setEditUser] = useState<EditableUser | null>(null);
  const [isFetchingUsers, setIsFetchingUsers] = useState<boolean>(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsFetchingUsers(true);
    setUsersError(null);

    try {
      const token = getToken();
      if (!token) {
        setUsersError("No auth token found. Please log in again.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        setUsersError(data.message || data.error || "Failed to load users.");
        return;
      }

      const mapped: UserRecord[] = (data as ApiUserRecord[]).map((user) => ({
        id: Number(user.user_id),
        name: user.full_name || user.username,
        email: user.username,
        role: normalizeRole(user.role),
        branch: user.branch || "—",
        status: normalizeStatus(user.status),
        lastLogin: "—",
      }));

      setUsers(mapped);
      setLastSync(new Date());
    } catch {
      setUsersError("Network error while loading users.");
    } finally {
      setIsFetchingUsers(false);
    }
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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClick = () => setOpenMenuId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "All" || u.role === roleFilter;
    const matchStatus = statusFilter === "All" || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "Active").length;
  const adminCount = users.filter((u) => u.role === "Admin").length;
  const cashierCount = users.filter((u) => u.role === "Cashier").length;

  const handleToggleStatus = async (id: number) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;

    const nextActive = target.status !== "Active";

    try {
      const token = getToken();
      if (!token) {
        setUsersError("No auth token found. Please log in again.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/update-users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: nextActive }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUsersError(
          data.message || data.error || "Failed to update user status.",
        );
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? { ...u, status: nextActive ? "Active" : "Inactive" }
            : u,
        ),
      );
      setLastSync(new Date());
    } catch {
      setUsersError("Network error while updating user.");
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = getToken();
      if (!token) {
        setUsersError("No auth token found. Please log in again.");
        return;
      }

      // Backend has no DELETE endpoint — deactivate the user instead
      const res = await fetch(`${API_BASE_URL}/update-users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUsersError(data.message || data.error || "Failed to deactivate user.");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: "Inactive" as Status } : u)),
      );
      setLastSync(new Date());
    } catch {
      setUsersError("Network error while deactivating user.");
    } finally {
      setOpenMenuId(null);
    }
  };

  const openEditModal = (user: UserRecord) => {
    const normalizedBranch = user.branch.trim().toUpperCase();
    setEditUser({
      id: user.id,
      user_id: String(user.id),
      branch_id: BRANCH_ID_BY_NAME[normalizedBranch] || "1",
      full_name: user.name,
      username: user.email,
      role: ROLE_TO_API[user.role],
      status: user.status,
    });
    setOpenMenuId(null);
  };

  return (
    <div
      className="min-h-screen w-full overflow-y-auto overflow-x-hidden"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 60% -10%, rgba(99,145,255,0.18) 0%, transparent 70%), linear-gradient(160deg, #041e6e 0%, #062d8c 35%, #0b3fbe 65%, #1d57d2 100%)",
      }}
    >
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItem="Users"
      />

      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        mode="create"
        onSuccess={() => {
          fetchUsers();
          setCreateModalOpen(false);
        }}
      />

      <CreateUserModal
        isOpen={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        mode="edit"
        initialUser={editUser}
        onSuccess={() => {
          fetchUsers();
          setEditUser(null);
        }}
      />

      <div className="w-full max-w-450 mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 sm:py-6 flex flex-col gap-4 sm:gap-5">
        {/* ── Header Card ──────────────────────────────────────────────────── */}
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          lastSync={lastSync}
          isOnline={isOnline}
        />

        {/* ── User Management Bar ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2
              className="font-bold text-xl sm:text-xl tracking-wide"
              style={{ color: "rgba(193,227,255,0.9)" }}
            >
              User Management
            </h2>
            <p className="text-xs sm:text-xs mt-0.5" style={{ color: "rgba(193,227,255,0.5)" }}>
              Manage accounts, roles, and access across all branches
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={isFetchingUsers}
            className="flex items-center gap-2 h-9 sm:h-9 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-opacity hover:opacity-80 self-start sm:self-auto"
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "rgba(193,227,255,0.9)",
              border: "1px solid rgba(193,227,255,0.2)",
              cursor: isFetchingUsers ? "not-allowed" : "pointer",
              opacity: isFetchingUsers ? 0.6 : 1,
            }}
          >
            <UserCog size={13} className="sm:w-4 sm:h-4" />
            {isFetchingUsers ? "Syncing..." : "Refresh"}
          </button>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Users */}
          <div
            className="rounded-xl p-3 sm:p-4 lg:p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(233,241,255,0.96) 100%)",
              border: "1px solid rgba(77,108,196,0.24)",
              boxShadow: "0 18px 42px rgba(1,24,84,0.18), inset 0 1px 0 rgba(255,255,255,0.88)",
            }}
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg, #3b6eff 0%, #7da8ff 100%)" }} />
            <div
              className="absolute top-3 right-3 p-1.5 rounded-lg"
              style={{ background: "rgba(0,59,205,0.1)" }}
            >
              <Users size={16} className="sm:w-5 sm:h-5" style={{ color: "#003bcd" }} />
            </div>
            <p className="text-sm sm:text-base font-extrabold tracking-wide uppercase" style={{ color: "#062d8c" }}>TOTAL USERS</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: "#636363" }}>All registered accounts</p>
            <p className="font-extrabold mt-2 leading-none" style={{ color: "#003bcd", fontSize: "clamp(1.5rem, 6vw, 3rem)" }}>
              {isFetchingUsers ? "—" : totalUsers}
            </p>
            <div className="flex items-center gap-1 mt-3">
              <span style={{ color: "#636363", fontSize: "10px" }}>Across all branches</span>
            </div>
          </div>

          {/* Active Users */}
          <div
            className="rounded-xl p-3 sm:p-4 lg:p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(233,241,255,0.96) 100%)",
              border: "1px solid rgba(77,108,196,0.24)",
              boxShadow: "0 18px 42px rgba(1,24,84,0.18), inset 0 1px 0 rgba(255,255,255,0.88)",
            }}
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg, #00bf2c 0%, #6effa0 100%)" }} />
            <div
              className="absolute top-3 right-3 p-1.5 rounded-lg"
              style={{ background: "rgba(0,191,44,0.1)" }}
            >
              <UserCheck size={16} className="sm:w-5 sm:h-5" style={{ color: "#00bf2c" }} />
            </div>
            <p className="text-sm sm:text-base font-extrabold tracking-wide uppercase" style={{ color: "#062d8c" }}>ACTIVE</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: "#636363" }}>Currently active accounts</p>
            <p className="font-extrabold mt-2 leading-none" style={{ color: "#00bf2c", fontSize: "clamp(1.5rem, 6vw, 3rem)" }}>
              {isFetchingUsers ? "—" : activeUsers}
            </p>
            <div className="flex items-center gap-1 mt-3">
              <span className="font-bold" style={{ color: "#00bf2c", fontSize: "10px" }}>
                {isFetchingUsers ? "" : `${totalUsers - activeUsers} inactive`}
              </span>
            </div>
          </div>

          {/* Admins */}
          <div
            className="rounded-xl p-3 sm:p-4 lg:p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(233,241,255,0.96) 100%)",
              border: "1px solid rgba(77,108,196,0.24)",
              boxShadow: "0 18px 42px rgba(1,24,84,0.18), inset 0 1px 0 rgba(255,255,255,0.88)",
            }}
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg, #cb3cff 0%, #e89dff 100%)" }} />
            <div
              className="absolute top-3 right-3 p-1.5 rounded-lg"
              style={{ background: "rgba(203,60,255,0.1)" }}
            >
              <ShieldCheck size={16} className="sm:w-5 sm:h-5" style={{ color: "#cb3cff" }} />
            </div>
            <p className="text-sm sm:text-base font-extrabold tracking-wide uppercase" style={{ color: "#062d8c" }}>ADMINS</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: "#636363" }}>Administrator accounts</p>
            <p className="font-extrabold mt-2 leading-none" style={{ color: "#cb3cff", fontSize: "clamp(1.5rem, 6vw, 3rem)" }}>
              {isFetchingUsers ? "—" : adminCount}
            </p>
            <div className="flex items-center gap-1 mt-3">
              <span style={{ color: "#636363", fontSize: "10px" }}>Full system access</span>
            </div>
          </div>

          {/* Cashiers */}
          <div
            className="rounded-xl p-3 sm:p-4 lg:p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(233,241,255,0.96) 100%)",
              border: "1px solid rgba(77,108,196,0.24)",
              boxShadow: "0 18px 42px rgba(1,24,84,0.18), inset 0 1px 0 rgba(255,255,255,0.88)",
            }}
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: "linear-gradient(90deg, #e6a800 0%, #ffd166 100%)" }} />
            <div
              className="absolute top-3 right-3 p-1.5 rounded-lg"
              style={{ background: "rgba(179,147,49,0.1)" }}
            >
              <UserCog size={16} className="sm:w-5 sm:h-5" style={{ color: "#b39331" }} />
            </div>
            <p className="text-sm sm:text-base font-extrabold tracking-wide uppercase" style={{ color: "#062d8c" }}>CASHIERS</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: "#636363" }}>POS operator accounts</p>
            <p className="font-extrabold mt-2 leading-none" style={{ color: "#b39331", fontSize: "clamp(1.5rem, 6vw, 3rem)" }}>
              {isFetchingUsers ? "—" : cashierCount}
            </p>
            <div className="flex items-center gap-1 mt-3">
              <span style={{ color: "#636363", fontSize: "10px" }}>POS access only</span>
            </div>
          </div>
        </div>

        {/* ── Users Table Card ──────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-4 sm:p-6"
          style={{
            border: "1px solid rgba(115,139,205,0.24)",
            background: "linear-gradient(180deg, #ffffff 0%, #f4f7ff 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(11,37,97,0.09)",
          }}
        >
          {usersError && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "rgba(230,4,4,0.12)",
                color: "#a30000",
                border: "1px solid rgba(230,4,4,0.25)",
              }}
            >
              {usersError}
            </div>
          )}

          {/* Table Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="font-bold text-base" style={{ color: "#062d8c" }}>
              All Users
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div
                className="flex items-center gap-2 px-3 h-9 rounded-lg"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                <Search size={14} style={{ color: "#888" }} />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-sm outline-none bg-transparent"
                  style={{ color: "#333", width: "180px" }}
                />
              </div>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as "All" | Role)}
                className="h-9 px-3 rounded-lg text-sm font-semibold outline-none cursor-pointer"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.15)",
                  color: "#062d8c",
                }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r === "All" ? "All Roles" : r}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "All" | Status)
                }
                className="h-9 px-3 rounded-lg text-sm font-semibold outline-none cursor-pointer"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.15)",
                  color: "#062d8c",
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "All" ? "All Status" : s}
                  </option>
                ))}
              </select>

              {/* Add User */}
              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
                style={{
                  background: "#1133f2",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <UserPlus size={15} />
                Add User
              </button>
            </div>
          </div>

          {/* Table */}
          <div
            className="overflow-x-auto rounded-xl"
            style={{ border: "1px solid rgba(0,0,0,0.1)" }}
          >
            <table
              className="w-full text-sm"
              style={{ borderCollapse: "collapse" }}
            >
              <thead>
                <tr style={{ background: "#062d8c" }}>
                  {["Name", "Role", "Branch", "Status", ""].map(
                    (col) => (
                      <th
                        key={col}
                        className="text-left px-4 py-3 font-semibold text-xs tracking-wider uppercase whitespace-nowrap"
                        style={{ color: "rgba(193,227,255,0.85)" }}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-10 text-sm"
                      style={{ color: "#999", background: "#fff" }}
                    >
                      {isFetchingUsers ? "Loading users..." : "No users found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((user, idx) => (
                    <tr
                      key={user.id}
                      style={{
                        background: idx % 2 === 0 ? "#fff" : "#f7f7fb",
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      {/* Name + Email */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              background: ROLE_COLORS[user.role].bg,
                              color: ROLE_COLORS[user.role].text,
                            }}
                          >
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")}
                          </div>
                          <div>
                            <p
                              className="font-semibold"
                              style={{ color: "#1a1a2e" }}
                            >
                              {user.name}
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "#888" }}
                            >
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{
                            background: ROLE_COLORS[user.role].bg,
                            color: ROLE_COLORS[user.role].text,
                          }}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Branch */}
                      <td
                        className="px-4 py-3 text-xs font-medium whitespace-nowrap"
                        style={{ color: "#444" }}
                      >
                        {user.branch}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              background: STATUS_COLORS[user.status].dot,
                            }}
                          />
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{
                              background: STATUS_COLORS[user.status].bg,
                              color: STATUS_COLORS[user.status].text,
                            }}
                          >
                            {user.status}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(
                                openMenuId === user.id ? null : user.id,
                              );
                            }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                            }}
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.background = "rgba(0,0,0,0.07)";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.background = "transparent";
                            }}
                          >
                            <MoreVertical size={16} style={{ color: "#555" }} />
                          </button>

                          {openMenuId === user.id && (
                            <div
                              className="absolute right-0 top-8 z-10 rounded-xl overflow-hidden"
                              style={{
                                background: "#fff",
                                border: "1px solid rgba(0,0,0,0.12)",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                                minWidth: "160px",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium transition-colors"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#333",
                                }}
                                onClick={() => openEditModal(user)}
                                onMouseEnter={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.background = "rgba(0,0,0,0.05)";
                                }}
                                onMouseLeave={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.background = "transparent";
                                }}
                              >
                                <Pencil
                                  size={14}
                                  style={{ color: "#1133f2" }}
                                />
                                Edit User
                              </button>
                              <button
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium transition-colors"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#333",
                                }}
                                onClick={() => handleToggleStatus(user.id)}
                                onMouseEnter={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.background = "rgba(0,0,0,0.05)";
                                }}
                                onMouseLeave={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.background = "transparent";
                                }}
                              >
                                {user.status === "Active" ? (
                                  <>
                                    <XCircle
                                      size={14}
                                      style={{ color: "#e60404" }}
                                    />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2
                                      size={14}
                                      style={{ color: "#00bf2c" }}
                                    />
                                    Activate
                                  </>
                                )}
                              </button>
                              <div
                                className="w-full h-px"
                                style={{ background: "rgba(0,0,0,0.08)" }}
                              />
                              <button
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium transition-colors"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#e60404",
                                }}
                                onClick={() => handleDelete(user.id)}
                                onMouseEnter={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.background = "rgba(230,4,4,0.07)";
                                }}
                                onMouseLeave={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.background = "transparent";
                                }}
                              >
                                <Trash2 size={14} />
                                Deactivate User
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs" style={{ color: "#888" }}>
              Showing {filtered.length} of {totalUsers} users
            </p>
          </div>
        </div>

        <AdminFooter lastSync={lastSync} />
      </div>
    </div>
  );
}
