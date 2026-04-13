import { useEffect, useState } from "react";
import { X, Eye, EyeOff, UserPlus, Loader2 } from "lucide-react";
import { getToken } from "../../hooks/useAuth";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

const BRANCH_OPTIONS = [
  { label: "BMC MAIN", value: 1 },
  { label: "DIVERSION BRANCH", value: 2 },
  { label: "PANGANIBAN BRANCH", value: 3 },
];

const ROLE_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Staff", value: "staff" },
  { label: "Manager", value: "manager" },
  { label: "Cashier", value: "cashier" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: "create" | "edit";
  initialUser?: {
    id: number;
    user_id: string;
    branch_id: string;
    full_name: string;
    username: string;
    role: string;
    status: "Active" | "Inactive";
  } | null;
}

interface FormState {
  user_id: string;
  branch_id: string;
  full_name: string;
  username: string;
  password: string;
  role: string;
}

interface FormErrors {
  user_id?: string;
  branch_id?: string;
  full_name?: string;
  username?: string;
  password?: string;
  role?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateUserModal({
  isOpen,
  onClose,
  onSuccess,
  mode = "create",
  initialUser = null,
}: CreateUserModalProps) {
  const emptyForm: FormState = {
    user_id: "",
    branch_id: "",
    full_name: "",
    username: "",
    password: "",
    role: "",
  };

  const [form, setForm] = useState<FormState>({
    ...emptyForm,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialUser) {
      setForm({
        user_id: initialUser.user_id,
        branch_id: initialUser.branch_id,
        full_name: initialUser.full_name,
        username: initialUser.username,
        password: "",
        role: initialUser.role,
      });
    } else {
      setForm(emptyForm);
    }

    setErrors({});
    setSuccessMsg(null);
    setErrorMsg(null);
    setShowPassword(false);
  }, [isOpen, mode, initialUser]);

  if (!isOpen) return null;

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (mode === "create" && !form.user_id.trim()) {
      newErrors.user_id = "User ID is required.";
    }
    if (!form.branch_id) newErrors.branch_id = "Branch is required.";
    if (!form.full_name.trim()) newErrors.full_name = "Full name is required.";
    if (!form.username.trim()) newErrors.username = "Username is required.";
    if (!form.password) {
      if (mode === "create") {
        newErrors.password = "Password is required.";
      }
    } else if (form.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }
    if (!form.role) newErrors.role = "Role is required.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleClose = () => {
    setForm(emptyForm);
    setErrors({});
    setSuccessMsg(null);
    setErrorMsg(null);
    setShowPassword(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!validate()) return;

    setLoading(true);
    try {
      const isEditMode = mode === "edit" && initialUser;
      const endpoint = isEditMode
        ? `${API_BASE_URL}/update-users/${initialUser.id}`
        : `${API_BASE_URL}/create-user`;

      const payload = isEditMode
        ? {
            branch_id: Number(form.branch_id),
            full_name: form.full_name.trim(),
            username: form.username.trim(),
            role: form.role,
            is_active: initialUser.status === "Active",
            ...(form.password ? { password: form.password } : {}),
          }
        : {
            user_id: form.user_id.trim(),
            branch_id: Number(form.branch_id),
            full_name: form.full_name.trim(),
            username: form.username.trim(),
            password: form.password,
            role: form.role,
          };

      const res = await fetch(endpoint, {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(
          data.message ||
            data.error ||
            (isEditMode ? "Failed to update user." : "Failed to create user."),
        );
      } else {
        setSuccessMsg(
          data.message ||
            (isEditMode
              ? `User ${form.username} updated successfully.`
              : `User ${form.username} created successfully.`),
        );
        if (!isEditMode) {
          setForm(emptyForm);
        }
        setErrors({});
        onSuccess?.();
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={handleClose}
    >
      {/* Modal Card */}
      <div
        className="relative w-full max-w-lg rounded-2xl flex flex-col"
        style={{
          background: "#f0f0f0",
          border: "1px solid rgba(0,0,0,0.65)",
          boxShadow: "0 0 40px 5px rgba(0,0,0,0.25)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ─────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
          style={{
            background: "#062d8c",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <UserPlus size={18} style={{ color: "#c9d9ff" }} />
            </div>
            <div>
              <h2
                className="font-extrabold text-base tracking-wide uppercase"
                style={{ color: "#c9d9ff" }}
              >
                {mode === "edit" ? "Edit User" : "Create New User"}
              </h2>
              <p
                className="text-xs mt-0.5"
                style={{ color: "rgba(185,224,255,0.7)" }}
              >
                {mode === "edit"
                  ? "Update user profile and permissions"
                  : "Fill in all fields to register a new account"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.1)";
            }}
          >
            <X size={16} style={{ color: "#c9d9ff" }} />
          </button>
        </div>

        {/* ── Form Body ────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="px-6 py-5 flex flex-col gap-4"
        >
          {/* Success / Error banners */}
          {successMsg && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "rgba(0,191,44,0.12)",
                color: "#00882e",
                border: "1px solid rgba(0,191,44,0.3)",
              }}
            >
              <span>✓</span> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "rgba(230,4,4,0.08)",
                color: "#c00",
                border: "1px solid rgba(230,4,4,0.25)",
              }}
            >
              <span>✕</span> {errorMsg}
            </div>
          )}

          {/* Row: User ID + Branch */}
          <div className="grid grid-cols-2 gap-4">
            {/* User ID */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                User ID
              </label>
              <input
                type="text"
                name="user_id"
                value={form.user_id}
                onChange={handleChange}
                placeholder="e.g. U-001"
                disabled={mode === "edit"}
                className="rounded-xl px-3 h-10 text-sm outline-none w-full"
                style={{
                  background: mode === "edit" ? "#f5f5f5" : "#fff",
                  border: errors.user_id
                    ? "1.5px solid #e60404"
                    : "1px solid rgba(0,0,0,0.15)",
                  color: mode === "edit" ? "#666" : "#1a1a2e",
                }}
              />
              {errors.user_id && (
                <span className="text-xs" style={{ color: "#e60404" }}>
                  {errors.user_id}
                </span>
              )}
            </div>

            {/* Branch */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Branch
              </label>
              <select
                name="branch_id"
                value={form.branch_id}
                onChange={handleChange}
                className="rounded-xl px-3 h-10 text-sm outline-none cursor-pointer w-full"
                style={{
                  background: "#fff",
                  border: errors.branch_id
                    ? "1.5px solid #e60404"
                    : "1px solid rgba(0,0,0,0.15)",
                  color: form.branch_id ? "#1a1a2e" : "#999",
                }}
              >
                <option value="" disabled>
                  Select branch...
                </option>
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              {errors.branch_id && (
                <span className="text-xs" style={{ color: "#e60404" }}>
                  {errors.branch_id}
                </span>
              )}
            </div>
          </div>

          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-extrabold tracking-wide uppercase"
              style={{ color: "#062d8c" }}
            >
              Full Name
            </label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="e.g. Juan Dela Cruz"
              className="rounded-xl px-3 h-10 text-sm outline-none w-full"
              style={{
                background: "#fff",
                border: errors.full_name
                  ? "1.5px solid #e60404"
                  : "1px solid rgba(0,0,0,0.15)",
                color: "#1a1a2e",
              }}
            />
            {errors.full_name && (
              <span className="text-xs" style={{ color: "#e60404" }}>
                {errors.full_name}
              </span>
            )}
          </div>

          {/* Row: Username + Role */}
          <div className="grid grid-cols-2 gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Username
              </label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="e.g. jdelacruz"
                className="rounded-xl px-3 h-10 text-sm outline-none w-full"
                style={{
                  background: "#fff",
                  border: errors.username
                    ? "1.5px solid #e60404"
                    : "1px solid rgba(0,0,0,0.15)",
                  color: "#1a1a2e",
                }}
              />
              {errors.username && (
                <span className="text-xs" style={{ color: "#e60404" }}>
                  {errors.username}
                </span>
              )}
            </div>

            {/* Role */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-extrabold tracking-wide uppercase"
                style={{ color: "#062d8c" }}
              >
                Role
              </label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="rounded-xl px-3 h-10 text-sm outline-none cursor-pointer w-full"
                style={{
                  background: "#fff",
                  border: errors.role
                    ? "1.5px solid #e60404"
                    : "1px solid rgba(0,0,0,0.15)",
                  color: form.role ? "#1a1a2e" : "#999",
                }}
              >
                <option value="" disabled>
                  Select role...
                </option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {errors.role && (
                <span className="text-xs" style={{ color: "#e60404" }}>
                  {errors.role}
                </span>
              )}
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-extrabold tracking-wide uppercase"
              style={{ color: "#062d8c" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                className="rounded-xl px-3 pr-10 h-10 text-sm outline-none w-full"
                style={{
                  background: "#fff",
                  border: errors.password
                    ? "1.5px solid #e60404"
                    : "1px solid rgba(0,0,0,0.15)",
                  color: "#1a1a2e",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#888",
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password ? (
              <span className="text-xs" style={{ color: "#e60404" }}>
                {errors.password}
              </span>
            ) : (
              <span className="text-xs" style={{ color: "#636363" }}>
                {mode === "edit"
                  ? "Leave blank to keep current password."
                  : "Must be at least 8 characters."}
              </span>
            )}
          </div>

          {/* ── Divider ──────────────────────────────────────────────── */}
          <div
            className="w-full h-px"
            style={{ background: "rgba(0,0,0,0.1)" }}
          />

          {/* ── Action Buttons ───────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="h-10 px-5 rounded-xl text-sm font-bold transition-colors"
              style={{
                background: "transparent",
                border: "1.5px solid rgba(0,0,0,0.2)",
                color: "#636363",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-bold transition-opacity"
              style={{
                background: loading ? "rgba(17,51,242,0.6)" : "#1133f2",
                color: "#fff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {mode === "edit" ? "Saving..." : "Creating..."}
                </>
              ) : (
                <>
                  <UserPlus size={15} />
                  {mode === "edit" ? "Save Changes" : "Create User"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
