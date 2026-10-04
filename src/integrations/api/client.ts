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

  const headers = new Headers(init.headers ?? {});
  // Callers that already hold the current session can provide its token and
  // avoid another asynchronous auth lookup on latency-sensitive request paths.
  if (!headers.has("Authorization")) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  }
  // Let the browser set multipart boundaries for FormData bodies; only default
  // to JSON for other (string) bodies.
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!headers.has("Content-Type") && init.body && !isFormData) {
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
    // FastAPI puts the human-readable reason in `detail`; surface it so the UI
    // and console say *why* a request failed, not just its status code.
    const detail =
      body && typeof body === "object" && "detail" in body
        ? (body as { detail: unknown }).detail
        : null;
    const reason =
      typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : null;
    console.error("[api] request failed", {
      method: init.method ?? "GET",
      path,
      status: res.status,
      body,
    });
    throw new ApiError(
      res.status,
      body,
      reason ? `${reason} (${res.status})` : undefined,
    );
  }
  return (await res.json()) as T;
}
