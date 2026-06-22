// Tiny helper to call the new FastAPI backend.
// Usage:
//   import { apiFetch } from "@/integrations/api/client";
//   const res = await apiFetch("/checkout", { method: "POST", body: JSON.stringify(...) });
//
// Until the backend is deployed everywhere, prefer Edge Functions and only call
// this for endpoints that have been migrated.

import { supabase } from "@/integrations/supabase/client";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!API_URL) {
    throw new ApiError(0, null, "VITE_API_URL not configured");
  }

  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers ?? {});
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const res = await fetch(url, { ...init, headers });
  return res;
}

export async function apiFetchJson<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // leave body null
    }
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as T;
}
