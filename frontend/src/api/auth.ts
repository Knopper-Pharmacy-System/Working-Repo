// src/api/auth.ts
const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  role: string;
  // branch?: number;   // optional – your backend doesn't send it yet
};

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = {};
      }
      throw new Error(errorData.message || `Login failed (${response.status})`);
    }

    const data = await response.json();

    if (!data.access_token || !data.role) {
      throw new Error("Invalid response from server: missing token or role");
    }

    return data as LoginResponse;
  } catch (err: any) {
    console.error("[auth.ts] Login error:", err);
    throw new Error(err.message || "Cannot reach login server. Login online first for offline access.");
  }
}