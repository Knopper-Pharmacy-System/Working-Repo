// src/api/sales.ts
const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

export interface SalesReport {
  date: string;
  total_sales: number;
  total_transactions: number;
  total_items: number;
  cash_sales: number;
  card_sales: number;
  returns: number;
}

export interface DailySalesData {
  date: string;
  total_sales: number;
  transaction_count: number;
  item_count: number;
}

export interface SalesAnalyticsData {
  total_revenue: number;
  total_transactions: number;
  average_transaction: number;
  top_products: Array<{
    product_name: string;
    quantity_sold: number;
    revenue: number;
  }>;
  sales_by_hour: Array<{
    hour: number;
    sales: number;
  }>;
  sales_trend: Array<{
    date: string;
    sales: number;
  }>;
}

export async function getSalesReport(branchId: number, startDate?: string, endDate?: string): Promise<SalesReport[]> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const response = await fetch(`${API_BASE_URL}/pos/sales-report?branch_id=${branchId}&${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sales report: ${response.status}`);
  }

  return response.json();
}

export async function getDailySales(branchId: number, date?: string): Promise<DailySalesData> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const params = date ? `?date=${date}` : '';

  const response = await fetch(`${API_BASE_URL}/pos/daily-sales?branch_id=${branchId}${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch daily sales: ${response.status}`);
  }

  return response.json();
}

export async function getSalesAnalytics(branchId: number, period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<SalesAnalyticsData> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/pos/sales-analytics?branch_id=${branchId}&period=${period}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sales analytics: ${response.status}`);
  }

  return response.json();
}