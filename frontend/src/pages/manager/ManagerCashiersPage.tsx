import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, Users, UserRoundCog, ShieldCheck, Trash2 } from "lucide-react";
import ManagerPageLayout from "../../components/manager/ManagerPageLayout";
import { useSalesAnalyticsStore } from "../../features/salesAnalytics/store/useSalesAnalyticsStore";

type StaffRole = "Cashier" | "Pharmacist" | "Supervisor";
type StaffStatus = "Active" | "Inactive";

type StaffMember = {
  id: string;
  fullName: string;
  username: string;
  role: StaffRole;
  status: StaffStatus;
  branchId: string;
  createdAt: string;
};

const STORAGE_KEY = "knopper-manager-staff-v1";

const createStaffId = () => `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const loadStaff = (): StaffMember[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StaffMember[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStaff = (members: StaffMember[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
};

export default function ManagerCashiersPage() {
  const branches = useSalesAnalyticsStore((state) => state.branches);
  const selectedBranchId = useSalesAnalyticsStore((state) => state.selectedBranchId);

  const [members, setMembers] = useState<StaffMember[]>(() => loadStaff());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StaffStatus>("all");
  const [branchFilter, setBranchFilter] = useState<string>(selectedBranchId || "all");

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<StaffRole>("Cashier");
  const [branchId, setBranchId] = useState<string>(selectedBranchId || "");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    saveStaff(members);
  }, [members]);

  useEffect(() => {
    if (!branchId && selectedBranchId) {
      setBranchId(selectedBranchId);
    }
    if (branchFilter === "all" && selectedBranchId) {
      setBranchFilter(selectedBranchId);
    }
  }, [selectedBranchId, branchId, branchFilter]);

  const filteredMembers = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return members
      .filter((member) => (branchFilter === "all" ? true : member.branchId === branchFilter))
      .filter((member) => (statusFilter === "all" ? true : member.status === statusFilter))
      .filter((member) => {
        if (!keyword) return true;
        return [member.fullName, member.username, member.role].join(" ").toLowerCase().includes(keyword);
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [members, query, statusFilter, branchFilter]);

  const activeCount = useMemo(
    () => filteredMembers.filter((member) => member.status === "Active").length,
    [filteredMembers],
  );

  const addMember = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanName = fullName.trim();
    const cleanUsername = username.trim();

    if (!cleanName || !cleanUsername || !branchId) {
      setNotice("Please complete name, username, and branch.");
      return;
    }

    const duplicate = members.some(
      (member) => member.username.toLowerCase() === cleanUsername.toLowerCase(),
    );
    if (duplicate) {
      setNotice("That username already exists. Use a different username.");
      return;
    }

    const next: StaffMember = {
      id: createStaffId(),
      fullName: cleanName,
      username: cleanUsername,
      role,
      status: "Active",
      branchId,
      createdAt: new Date().toISOString(),
    };

    setMembers((previous) => [next, ...previous]);
    setFullName("");
    setUsername("");
    setRole("Cashier");
    setNotice(`Added ${next.fullName}.`);
  };

  const toggleStatus = (id: string) => {
    setMembers((previous) =>
      previous.map((member) => {
        if (member.id !== id) return member;
        return {
          ...member,
          status: member.status === "Active" ? "Inactive" : "Active",
        };
      }),
    );
  };

  const removeMember = (id: string) => {
    setMembers((previous) => previous.filter((member) => member.id !== id));
  };

  const findBranchName = (id: string) => branches.find((branch) => branch.id === id)?.name || "Unknown branch";

  return (
    <ManagerPageLayout
      activeItem="Staff / Cashiers"
      title="Staff / Cashiers"
      subtitle="Manage branch staff accounts, assign roles, and track active vs inactive users."
    >
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Add user</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Create staff account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Accounts are saved offline in your browser and grouped by branch.
          </p>

          <form className="mt-5 space-y-4" onSubmit={addMember}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Full name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Example: Maria Dela Cruz"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Example: mdelacruz"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Role</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as StaffRole)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  <option value="Cashier">Cashier</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Supervisor">Supervisor</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Branch</span>
                <select
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  <option value="">Select branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E40AF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3B82F6]"
            >
              <UserPlus size={16} />
              Add Staff Member
            </button>
          </form>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Staff registry</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Team members</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              <Users size={16} />
              {filteredMembers.length} total • {activeCount} active
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, username, or role"
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </label>

            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
            >
              <option value="all">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | StaffStatus)}
              className="rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
            >
              <option value="all">All status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{member.fullName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        @{member.username} • {member.role}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{findBranchName(member.branchId)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          member.status === "Active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        <ShieldCheck size={13} />
                        {member.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleStatus(member.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <UserRoundCog size={13} />
                        Toggle
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
                No staff members found for this filter.
              </div>
            )}
          </div>
        </section>
      </div>
    </ManagerPageLayout>
  );
}
