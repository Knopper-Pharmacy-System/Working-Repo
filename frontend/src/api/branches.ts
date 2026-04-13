// src/api/branches.ts
const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

export interface Branch {
  branch_id: number;
  branch_name: string;
  branch_code: string;
}

export interface BranchSummary {
  branch_id: number;
  branch_name: string;
  branch_code: string;
  total_users: number;
  active_users: number;
  manager_count: number;
  inventory_items: number;
  total_units: number;
  low_stock_count: number;
  critical_count: number;
  inventory_value: number;
}

export interface CreateBranchRequest {
  branch_id: number;
  branch_name: string;
  branch_code: string;
}

export async function getAllBranches(): Promise<Branch[]> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/branches`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch branches: ${response.status}`);
  }

  return response.json();
}

export async function getBranchSummary(): Promise<BranchSummary[]> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/branches/summary`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch branch summary: ${response.status}`);
  }

  return response.json();
}

export async function createBranch(branchData: CreateBranchRequest): Promise<{ message: string; branch: Branch }> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/create-branch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(branchData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Failed to create branch: ${response.status}`);
  }

  return response.json();
}

export async function updateBranch(branchId: number, branchData: Partial<CreateBranchRequest>): Promise<{ message: string }> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/update-branch/${branchId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(branchData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Failed to update branch: ${response.status}`);
  }

  return response.json();
}

export async function deleteBranch(branchId: number): Promise<{ message: string }> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No authentication token found');

  const response = await fetch(`${API_BASE_URL}/delete-branch/${branchId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Failed to delete branch: ${response.status}`);
  }

  return response.json();
}