import { useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Plus } from "lucide-react";
import ManagerPageLayout from "../../components/manager/ManagerPageLayout";
import { useSalesAnalyticsStore } from "../../features/salesAnalytics/store/useSalesAnalyticsStore";

export default function ManagerBranchesPage() {
  const branches = useSalesAnalyticsStore((state) => state.branches);
  const selectedBranchId = useSalesAnalyticsStore((state) => state.selectedBranchId);
  const setSelectedBranch = useSalesAnalyticsStore((state) => state.setSelectedBranch);
  const createBranch = useSalesAnalyticsStore((state) => state.createBranch);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const branch = createBranch({ name, code });

    if (branch) {
      setNotice(`Branch ${branch.name} is ready.`);
      setName("");
      setCode("");
      return;
    }

    setNotice("Enter both a branch name and short code.");
  };

  return (
    <ManagerPageLayout
      activeItem="Branches"
      title="Branch Management"
      subtitle="Create, switch, and manage branch-level datasets without losing your uploaded history."
    >
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Active branches</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Branch list</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              <Building2 size={16} />
              {branches.length} branch{branches.length === 1 ? "" : "es"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {branches.map((branch) => {
              const active = branch.id === selectedBranchId;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => setSelectedBranch(branch.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    active ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{branch.name}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Code: {branch.code}
                      </p>
                    </div>
                    {active ? <CheckCircle2 size={18} className="text-emerald-600" /> : null}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Created {new Date(branch.createdAt).toLocaleDateString()}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Create branch</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">New branch form</h2>
          <p className="mt-2 text-sm text-slate-600">
            Add a new location with a short code. The dashboard will keep its data separate.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Branch name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: BMC Annex"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Short code</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Example: BMC-ANN"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </label>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E40AF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#3B82F6]"
            >
              <Plus size={16} />
              Create New Branch
            </button>
          </form>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>
          ) : null}
        </section>
      </div>
    </ManagerPageLayout>
  );
}
