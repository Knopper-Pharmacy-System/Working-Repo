// src/api/procurement.ts
const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

export interface PurchaseOrder {
  order_id: number;
  order_date: string;
  status: string;
  total_amount: number;
  supplier: string;
  branch: string;
  created_by: string;
  approved_by: string;
  date_received: string;
  date_cancelled: string;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  po_item_id: number;
  product_name: string;
  quantity_ordered: number;
  uom: string;
  cost_at_time_of_order: number;
  item_status: string;
}

export interface CreatePurchaseOrderRequest {
  supplier_id: number;
  branch_id: number;
  items: Array<{
    product_id: number;
    quantity_ordered: number;
    uom: string;
    cost_at_time_of_order: number;
  }>;
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/procurement`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch purchase orders: ${response.status}`);
  }

  return response.json();
}

export async function getPurchaseOrder(orderId: number): Promise<PurchaseOrderDetail> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/procurement/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch purchase order: ${response.status}`);
  }

  return response.json();
}

export async function createPurchaseOrder(orderData: CreatePurchaseOrderRequest): Promise<{ message: string; order_id: number }> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/procurement`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Failed to create purchase order: ${response.status}`);
  }

  return response.json();
}

export async function updatePurchaseOrderStatus(orderId: number, status: string, notes?: string): Promise<{ message: string }> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/procurement/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, notes }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Failed to update purchase order: ${response.status}`);
  }

  return response.json();
}

export async function receivePurchaseOrder(orderId: number, receivedItems: Array<{
  po_item_id: number;
  quantity_received: number;
  notes?: string;
}>): Promise<{ message: string }> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/procurement/${orderId}/receive`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items: receivedItems }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Failed to receive purchase order: ${response.status}`);
  }

  return response.json();
}