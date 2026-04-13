import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import LoginPage from "./pages/LoginPage";
import CashierPosPage from "./pages/pos/CashierPosPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import UsersPage from "./pages/admin/UsersPage";
import AdminAuditSheet from "./pages/admin/AdminAuditSheetPage";
import SettingsPage from "./pages/admin/SettingsPage";
import AdminSalesReportPage from "./pages/admin/AdminSalesReportPage";
import AdminBranchesPage from "./pages/admin/AdminBranchesPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminTransactionsPage from "./pages/admin/AdminTransactionsPage";
import AdminAlertsPage from "./pages/admin/AdminAlertsPage";
import AdminPurchaseOrderPage from "./pages/admin/AdminPurchaseOrderPage";
import AdminPurchaseOrderListPage from "./pages/admin/AdminPurchaseOrderListPage";
import AdminPurchaseOrderDetailPage from "./pages/admin/AdminPurchaseOrderDetailPage";
import AdminReceiveDeliveryPage from "./pages/admin/AdminReceiveDeliveryPage";
import AdminStockTransfersPage from "./pages/admin/AdminStockTransfersPage";
import AdminSalesAnalytics from "./pages/admin/AdminSalesAnalytics";
import ManagerDashboardPage from "./pages/manager/ManagerDashboardPage";
import ManagerBranchesPage from "./pages/manager/ManagerBranchesPage";
import ManagerUploadHistoryPage from "./pages/manager/ManagerUploadHistoryPage";
import ManagerCashiersPage from "./pages/manager/ManagerCashiersPage";
import ManagerSettingsPage from "./pages/manager/ManagerSettingsPage";
import ManagerUploadReportsPage from "./pages/manager/ManagerUploadReportsPage";
import ManagerProductCatalogPage from "./pages/manager/ManagerProductCatalogPage";
import ManagerInventoryInsightsPage from "./pages/manager/ManagerInventoryInsightsPage";
import { getStoredRole, isAuthenticated, logout } from "./hooks/useAuth";
import "./App.css";

import AdminInventoryPage from "./pages/admin/AdminInventoryPage";

type AllowedRole = "admin" | "cashier" | "staff" | "manager";

const normalizeRole = (role: string): AllowedRole | "" => {
  const normalized = role.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "cashier") return "cashier";
  if (normalized === "staff") return "staff";
  if (normalized === "manager") return "manager";
  if (normalized === "omvb_manager") return "manager"; // Map old role to new
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

function ProtectedRoute({
  expectedRole,
  children,
}: {
  expectedRole: AllowedRole;
  children: ReactNode;
}) {
  if (!isAuthenticated()) return <Navigate to="/" replace />;

  const currentRole = normalizeRole(getStoredRole());
  if (currentRole !== expectedRole) {
    return <Navigate to={roleHomePath(currentRole)} replace />;
  }

  return <>{children}</>;
}

function RolePage({ title }: { title: string }) {
  return (
    <main className="role-page">
      <h1>{title}</h1>
      <p>Logged in as: {getStoredRole()}</p>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root route: show login for unauthenticated, redirect authenticated to their dashboard */}
        <Route
          path="/"
          element={
            isAuthenticated() ? (
              <Navigate to={roleHomePath(getStoredRole())} replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute expectedRole="admin">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-sheet"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminAuditSheet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute expectedRole="admin">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminInventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/stock-transfer"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminStockTransfersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/branches"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminBranchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminTransactionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/alerts"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminAlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sales-analytics"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminSalesAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sales-reports"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminSalesReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/purchase-orders"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminPurchaseOrderListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/purchase-order"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminPurchaseOrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/purchase-order/:id"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminPurchaseOrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/receive-delivery"
          element={
            <ProtectedRoute expectedRole="admin">
              <AdminReceiveDeliveryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute expectedRole="cashier">
              <CashierPosPage />
            </ProtectedRoute>
          }
        />
        <Route path="/cashier" element={<Navigate to="/pos" replace />} />
        <Route
          path="/staff"
          element={
            <ProtectedRoute expectedRole="staff">
              <RolePage title="Staff Interface" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute expectedRole="manager">
              <ManagerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/upload-reports"
          element={
            <ProtectedRoute expectedRole="manager">
              <ManagerUploadReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/excel-uploader"
          element={<Navigate to="/manager/upload-reports" replace />}
        />
        <Route
          path="/manager/product-catalog"
          element={
            <ProtectedRoute expectedRole="manager">
              <ManagerProductCatalogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/inventory-insights"
          element={
            <ProtectedRoute expectedRole="manager">
              <ManagerInventoryInsightsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/products"
          element={<Navigate to="/manager" replace />}
        />
        <Route
          path="/manager/sales-reports"
          element={<Navigate to="/manager" replace />}
        />
        <Route
          path="/manager/branches"
          element={
            <ProtectedRoute expectedRole="manager">
              <ManagerBranchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/upload-history"
          element={
            <ProtectedRoute expectedRole="manager">
              <ManagerUploadHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/cashiers"
          element={
            <ProtectedRoute expectedRole="manager">
              <ManagerCashiersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/settings"
          element={
            <ProtectedRoute expectedRole="manager">
              <ManagerSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inv-manager"
          element={<Navigate to="/manager" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
