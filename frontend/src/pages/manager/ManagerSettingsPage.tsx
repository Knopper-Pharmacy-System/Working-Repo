import ManagerPageLayout from "../../components/manager/ManagerPageLayout";

export default function ManagerSettingsPage() {
  return (
    <ManagerPageLayout
      activeItem="Settings"
      title="Settings"
      subtitle="Branch preferences, offline behavior, and dashboard configuration can be managed here."
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
        <p className="text-sm text-slate-600">
          Settings will be expanded here next. Your branch-aware offline data model is already active.
        </p>
      </section>
    </ManagerPageLayout>
  );
}
