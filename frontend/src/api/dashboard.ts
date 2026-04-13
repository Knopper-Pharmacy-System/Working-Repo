// src/api/dashboard.ts
const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

export interface DashboardMetrics {
  lowStockCount: number;
  nearExpiryCount: number;
  totalItemUnits: number;
  inventoryValue: number;
}

export interface LowStockItem {
  inventoryId: number;
  name: string;
  quantity: number;
  reorder: number;
  status: "Critical" | "Low";
}

export interface NearExpiryItem {
  inventoryId: number;
  name: string;
  expiry: string;
  daysLeft: number;
}

export interface SalesTrendData {
  day: string;
  sales: number;
}

export interface StockDistributionData {
  name: string;
  value: number;
  color: string;
}

export async function getDashboardMetrics(branchId: number): Promise<DashboardMetrics> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/dashboard/metrics/${branchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard metrics: ${response.status}`);
  }

  return response.json();
}

export async function getLowStockItems(branchId: number): Promise<LowStockItem[]> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/dashboard/low-stock/${branchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch low stock items: ${response.status}`);
  }

  return response.json();
}

export async function getNearExpiryItems(branchId: number): Promise<NearExpiryItem[]> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/dashboard/near-expiry/${branchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch near expiry items: ${response.status}`);
  }

  return response.json();
}

export async function getSalesTrend(branchId: number, period: 'week' | 'month' | 'year' = 'week'): Promise<SalesTrendData[]> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/dashboard/sales-trend/${branchId}?period=${period}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sales trend: ${response.status}`);
  }

  return response.json();
}

export async function getStockDistribution(branchId: number): Promise<StockDistributionData[]> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/dashboard/stock-distribution/${branchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stock distribution: ${response.status}`);
  }

  return response.json();
}