import { useState, useEffect, useRef, useCallback } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  LoaderCircle,
  LogIn,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  Building2,
} from "lucide-react";
import bannerLogo from "../assets/banner_logo.png";
import logoOutline from "../assets/logo_outline.png";
import { login } from "../api/auth.js";
import { getStoredRole, isAuthenticated, useAuth } from "../hooks/useAuth";

type AllowedRole = "admin" | "cashier" | "staff" | "manager";

type FieldErrors = {
  branch: boolean;
  username: boolean;
  password: boolean;
};

const BRANCHES = [
  {
    value: "BMC MAIN",
    label: "BMC MAIN",
    address: "#6A J. Miranda Ave., Concepcion Pequeña, Naga City",
  },
  {
    value: "DIVERSION BRANCH",
    label: "DIVERSION BRANCH",
    address: "Roxas Avenue, Diversion Road, Triangulo, Naga City",
  },
  {
    value: "PANGANIBAN BRANCH",
    label: "PANGANIBAN BRANCH",
    address:
      "Door 11 & 12, Pavilion 7, Panganiban Drive Concepcion Pequeña, Naga City",
  },
];

const normalizeRole = (role: string): AllowedRole | "" => {
  const n = role.trim().toLowerCase();
  if (n === "admin") return "admin";
  if (n === "cashier") return "cashier";
  if (n === "staff") return "staff";
  if (n === "manager") return "manager";
  if (n === "omvb_manager") return "manager"; // Map old role to new
  return "";
};

const roleHomePath = (role: string) => {
  switch (normalizeRole(role)) {
    case "admin":
      return "/admin";
    case "cashier":
      return "/pos";
    case "staff":
      return "/staff";
    case "manager":
      return "/manager";
    default:
      return "/";
  }
};

function LoginPage() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [branch, setBranch] = useState(() => localStorage.getItem("lastBranch") || "");
  const [currentDateTime, setCurrentDateTime] = useState({ date: "", time: "" });
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    branch: false,
    username: false,
    password: false,
  });
  const [toast, setToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedBranch = BRANCHES.find((b) => b.value === branch);

  // Toast
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(roleHomePath(getStoredRole()), { replace: true });
    }
  }, [navigate]);

  // Save last branch
  useEffect(() => {
    if (branch) localStorage.setItem("lastBranch", branch);
  }, [branch]);

  // Online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime({
        date: now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        time: now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: false }));
    }
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLInputElement | null> | null
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextRef?.current) {
        nextRef.current.focus();
      } else {
        formRef.current?.requestSubmit();
      }
    }
  };

  const handlePasswordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Detect caps lock
    const capsLock = e.getModifierState("CapsLock");
    setCapsLockOn(capsLock);
    
    // Handle enter key
    handleKeyDown(e, null);
  };

  const validateForm = () => {
    const errors: FieldErrors = {
      branch: !branch,
      username: !credentials.username.trim(),
      password: !credentials.password.trim(),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({ branch: false, username: false, password: false });

    if (!validateForm()) {
      const missing = [];
      if (!branch) missing.push("Branch");
      if (!credentials.username.trim()) missing.push("User ID");
      if (!credentials.password.trim()) missing.push("Password");

      showToast(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setIsLoading(true);

    try {
      const data = await login({
        username: credentials.username.trim(),
        password: credentials.password.trim(),
      });

      authLogin(data.access_token, data.role, credentials.password.trim());
      localStorage.setItem("cashier_username", credentials.username.trim());

      const destination = roleHomePath(data.role);
      if (destination === "/") {
        showToast(`Unsupported role: ${data.role}`);
        return;
      }

      showToast("Login successful! Redirecting...");
      setTimeout(() => navigate(destination, { replace: true }), 800);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : typeof err === "string" ? err : "";
      let msg = "Login failed. Please try again.";
      if (errorMessage.includes("401") || errorMessage.toLowerCase().includes("invalid")) {
        msg = "Invalid username or password";
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        msg = "Cannot connect to server. Please check your connection.";
      }
      showToast(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-[100dvh] bg-gradient-to-br from-[#081427] via-[#0d1f42] to-[#163566] flex items-center justify-center p-3 sm:p-4 lg:p-6 overflow-hidden relative">
        {/* Background accent - animated */}
        <div className="hidden lg:block absolute inset-0 bg-[radial-gradient(at_top_right,rgba(59,130,246,0.3)_0%,transparent_50%)]" />
        <div className="hidden lg:block absolute inset-0 bg-[radial-gradient(at_bottom_left,rgba(99,102,241,0.2)_0%,transparent_60%)]" />

        {/* Toast */}
        {toast && (
          <div className="fixed top-3 left-3 right-3 sm:top-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 glass rounded-2xl px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-3 shadow-2xl border border-red-500/30 max-w-md">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-white text-xs sm:text-sm font-medium">{toast}</p>
            <button onClick={() => setToast(null)} className="ml-auto text-white/60 hover:text-white">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="w-full max-w-screen-2xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Mobile/Tablet View - No glass container */}
          <div className="lg:hidden">
            <div className="flex flex-col gap-6 items-center">
              {/* Left Side - Branding */}
              <div className="flex w-full text-center space-y-3 fade-in flex-col items-center">
                <div className="flex justify-center">
                  <img
                    src={bannerLogo}
                    alt="Knopper Banner"
                    className="w-56 sm:w-64 drop-shadow-2xl"
                  />
                </div>
              </div>

              {/* Right Side - Login Card */}
              <div className="w-full max-w-[520px] fade-in" style={{ animationDelay: "150ms" }}>
                <div className="glass rounded-[28px] p-6 sm:p-8 shadow-2xl border border-white/20">
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div>
                      <img
                        src={bannerLogo}
                        alt="Knopper"
                        className="h-12 sm:h-16 object-contain mb-2 sm:mb-3"
                      />
                      <p className="text-blue-200/80 mt-1 sm:mt-2 text-xs sm:text-sm">Log-in to your account</p>
                    </div>

                    {/* Online Status */}
                    <div className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold tracking-wide ${isOnline ? "bg-emerald-500/25 text-emerald-300" : "bg-orange-500/25 text-orange-300"}`}>
                      <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-orange-400"}`} />
                      {isOnline ? "ONLINE" : "OFFLINE"}
                    </div>
                  </div>

                  <form ref={formRef} onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                    {/* Branch Selector */}
                    <div>
                      <label className="block text-white/80 text-sm font-semibold mb-3 flex items-center gap-2 tracking-wide">
                        <Building2 size={18} className="text-blue-400" />
                        SELECT BRANCH
                      </label>
                      <div className="relative border border-white/20 rounded-xl">
                        <select
                          value={branch}
                          onChange={(e) => {
                            setBranch(e.target.value);
                            setFieldErrors((p) => ({ ...p, branch: false }));
                          }}
                          disabled={isLoading}
                          className={`login-select-no-glow w-full input-base border ${fieldErrors.branch ? "border-red-500" : "border-blue-500/30"} rounded-xl px-4 py-3 sm:px-5 sm:py-3.5 text-white text-base focus:outline-none focus:ring-0 transition-all appearance-none font-medium ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <option value="" className="bg-[#0a1428] text-white/50">
                            Choose your branch
                          </option>
                          {BRANCHES.map((b) => (
                            <option key={b.value} value={b.value} className="bg-[#0a1428]">
                              {b.label}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-blue-400/60">
                          ▼
                        </div>
                      </div>
                      {selectedBranch && (
                        <p className="mt-2 text-[11px] sm:text-xs text-blue-300/70 pl-1 font-medium">
                          {selectedBranch.address}
                        </p>
                      )}
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-white/80 text-xs sm:text-sm font-semibold mb-2 sm:mb-3 tracking-wide">
                        USER ID
                      </label>
                      <div className={`input-focus flex h-14 w-full max-w-full items-center input-base border ${fieldErrors.username ? "border-red-500 ring-2 ring-red-500/30" : "border-blue-500/30"} rounded-xl px-3 sm:px-4 border-white/20`}>
                        <input
                          ref={usernameRef}
                          type="text"
                          name="username"
                          value={credentials.username}
                          onChange={handleChange}
                          onKeyDown={(e) => handleKeyDown(e, passwordRef)}
                          placeholder="Enter your User ID"
                          autoComplete="username"
                          autoFocus
                          disabled={isLoading}
                          className={`login-clean-input min-w-0 flex-1 w-full min-h-0 h-full bg-transparent outline-none text-white placeholder:text-white/35 text-[15px] font-sans font-medium ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px' }}
                        />
                      </div>
                      {capsLockOn && (
                        <p className="mt-1 text-xs text-orange-300 flex items-center gap-1">
                          <AlertCircle size={12} />
                          Caps Lock is on
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-white/80 text-xs sm:text-sm font-semibold mb-2 sm:mb-3 tracking-wide">
                        PASSWORD
                      </label>
                      <div className={`input-focus flex h-14 w-full max-w-full items-center input-base border ${fieldErrors.password ? "border-red-500 ring-2 ring-red-500/30" : "border-blue-500/30"} rounded-xl px-3 sm:px-4 border-white/20`}>
                        <input
                          ref={passwordRef}
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={credentials.password}
                          onChange={handleChange}
                          onKeyDown={(e) => handlePasswordKeyDown(e)}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          disabled={isLoading}
                          className={`login-clean-input min-w-0 flex-1 w-full min-h-0 h-full bg-transparent outline-none text-white placeholder:text-white/35 text-[15px] font-sans font-medium ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isLoading}
                          className={`inline-flex items-center justify-center shrink-0 min-w-14 h-14 w-14 ml-2 p-0 rounded-lg border border-transparent bg-transparent text-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-0 transition-all ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <EyeOff size={24} strokeWidth={2.25} /> : <Eye size={24} strokeWidth={2.25} />}
                        </button>
                      </div>
                    </div>

                    {/* Login Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full mt-6 sm:mt-8 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-500 active:scale-95 transition-all font-bold text-white text-base sm:text-lg py-3.5 sm:py-4 rounded-xl flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <LoaderCircle className="animate-spin w-5 h-5" />
                          AUTHENTICATING...
                        </>
                      ) : (
                        <>
                          SIGN IN
                          <LogIn size={22} />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Footer Info */}
                  {/* <div className="mt-6 sm:mt-8 hidden sm:flex items-center justify-center gap-4 text-xs text-white/35 font-medium tracking-wide">
                    <div>Core Node v2.4.0</div>
                    <div className="w-1 h-1 bg-blue-500/50 rounded-full" />
                    <div>AES-256 Encrypted</div>
                  </div> */}
                </div>

                {/* Live Date & Time */}
                <div className="mt-4 sm:mt-6 text-center text-white/50 text-xs sm:text-sm">
                  {currentDateTime.date} • {currentDateTime.time}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop View - With glass container */}
          <div className="hidden lg:block glass rounded-[32px] p-6 sm:p-8 lg:p-16 shadow-2xl border border-white/20">
            <div className="flex flex-row gap-16 items-center">
              {/* Left Side - Branding */}
              <div className="flex w-5/12 text-left space-y-8 fade-in flex-col items-start">
                <div className="flex justify-start">
                  <img
                    src={logoOutline}
                    alt="Knopper Logo"
                    className="w-[32rem] drop-shadow-2xl"
                  />
                </div>
              </div>

              {/* Right Side - Login Card */}
              <div className="w-full max-w-[520px] fade-in" style={{ animationDelay: "150ms" }}>
                <div className="glass rounded-[28px] p-12 shadow-2xl">
                  <div className="flex items-start justify-between gap-3 mb-10">
                    <div>
                      <img
                        src={bannerLogo}
                        alt="Knopper"
                        className="h-20 object-contain mb-4"
                      />
                      <p className="text-blue-200/80 text-lg">Log-in to your account</p>
                    </div>

                    {/* Online Status */}
                    <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold tracking-wide ${isOnline ? "bg-emerald-500/25 text-emerald-300" : "bg-orange-500/25 text-orange-300"}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-orange-400"}`} />
                      {isOnline ? "ONLINE" : "OFFLINE"}
                    </div>
                  </div>

                  <form ref={formRef} onSubmit={handleLogin} className="space-y-6">
                    {/* Branch Selector */}
                    <div>
                      <label className="block text-white/80 text-sm font-semibold mb-3 flex items-center gap-2 tracking-wide">
                        <Building2 size={18} className="text-blue-400" />
                        SELECT BRANCH
                      </label>
                      <div className="relative border border-white/20 rounded-xl">
                        <select
                          value={branch}
                          onChange={(e) => {
                            setBranch(e.target.value);
                            setFieldErrors((p) => ({ ...p, branch: false }));
                          }}
                          disabled={isLoading}
                          className={`login-select-no-glow w-full input-base border ${fieldErrors.branch ? "border-red-500" : "border-blue-500/30"} rounded-xl px-5 py-3.5 text-white text-base focus:outline-none focus:ring-0 transition-all appearance-none font-medium ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          <option value="" className="bg-[#0a1428] text-white/50">
                            Choose your branch
                          </option>
                          {BRANCHES.map((b) => (
                            <option key={b.value} value={b.value} className="bg-[#0a1428]">
                              {b.label}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-blue-400/60">
                          ▼
                        </div>
                      </div>
                      {selectedBranch && (
                        <p className="mt-2 text-sm text-blue-300/70 pl-1 font-medium">
                          {selectedBranch.address}
                        </p>
                      )}
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-white/80 text-sm font-semibold mb-3 tracking-wide">
                        USER ID
                      </label>
                      <div className={`input-focus flex h-14 w-full max-w-full items-center input-base border ${fieldErrors.username ? "border-red-500 ring-2 ring-red-500/30" : "border-blue-500/30"} rounded-xl px-4 border-white/20`}>
                        <input
                          ref={usernameRef}
                          type="text"
                          name="username"
                          value={credentials.username}
                          onChange={handleChange}
                          onKeyDown={(e) => handleKeyDown(e, passwordRef)}
                          placeholder="Enter your User ID"
                          autoComplete="username"
                          autoFocus
                          disabled={isLoading}
                          className={`login-clean-input min-w-0 flex-1 w-full min-h-0 h-full bg-transparent outline-none text-white placeholder:text-white/35 text-[15px] font-sans font-medium ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px' }}
                        />
                      </div>
                      {capsLockOn && (
                        <p className="mt-1 text-xs text-orange-300 flex items-center gap-1">
                          <AlertCircle size={12} />
                          Caps Lock is on
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-white/80 text-sm font-semibold mb-3 tracking-wide">
                        PASSWORD
                      </label>
                      <div className={`input-focus flex h-14 w-full max-w-full items-center input-base border ${fieldErrors.password ? "border-red-500 ring-2 ring-red-500/30" : "border-blue-500/30"} rounded-xl px-4 border-white/20`}>
                        <input
                          ref={passwordRef}
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={credentials.password}
                          onChange={handleChange}
                          onKeyDown={(e) => handlePasswordKeyDown(e)}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          disabled={isLoading}
                          className={`login-clean-input min-w-0 flex-1 w-full min-h-0 h-full bg-transparent outline-none text-white placeholder:text-white/35 text-[15px] font-sans font-medium ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                          style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isLoading}
                          className={`inline-flex items-center justify-center shrink-0 min-w-14 h-14 w-14 ml-2 p-0 rounded-lg border border-transparent bg-transparent text-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-0 transition-all ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <EyeOff size={24} strokeWidth={2.25} /> : <Eye size={24} strokeWidth={2.25} />}
                        </button>
                      </div>
                    </div>

                    {/* Login Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full mt-8 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-500 active:scale-95 transition-all font-bold text-white text-lg py-4 rounded-xl flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <LoaderCircle className="animate-spin w-5 h-5" />
                          AUTHENTICATING...
                        </>
                      ) : (
                        <>
                          SIGN IN
                          <LogIn size={22} />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Footer Info */}
                  {/* <div className="mt-10 hidden sm:flex items-center justify-center gap-4 text-xs text-white/35 font-medium tracking-wide">
                    <div>Core Node v2.4.0</div>
                    <div className="w-1 h-1 bg-blue-500/50 rounded-full" />
                    <div>AES-256 Encrypted</div>
                  </div> */}
                </div>

                {/* Live Date & Time */}
                <div className="mt-6 text-center text-white/50 text-sm">
                  {currentDateTime.date} • {currentDateTime.time}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
