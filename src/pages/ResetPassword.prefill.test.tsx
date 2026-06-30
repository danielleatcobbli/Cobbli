import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Leaf modules that pull in assets / context / network are stubbed so the test
// focuses on the email pre-population wiring.
vi.mock("@/components/cobbli/Header", () => ({ default: () => null }));
vi.mock("@/components/cobbli/Footer", () => ({ default: () => null }));
vi.mock("@/hooks/usePageMeta", () => ({ usePageMeta: () => {} }));
vi.mock("@/integrations/api/client", () => ({ apiFetch: vi.fn() }));

const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      verifyOtp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
    },
  },
}));

import ResetPassword from "@/pages/ResetPassword";
import LinkExpired from "@/pages/LinkExpired";

const emailInput = () => screen.findByLabelText(/email address/i) as Promise<HTMLInputElement>;

beforeEach(() => {
  vi.clearAllMocks();
  // No active session and no recovery marker -> request screen renders.
  getSession.mockResolvedValue({ data: { session: null } });
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/reset-password");
});

const renderAt = (entry: string | { pathname: string; search?: string; state?: unknown }) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/link-expired" element={<LinkExpired />} />
      </Routes>
    </MemoryRouter>,
  );

describe("ResetPassword email pre-population", () => {
  it("pre-fills from router state (lockout / forgot-password hand-off)", async () => {
    renderAt({ pathname: "/reset-password", state: { prefillEmail: "locked@example.com" } });
    const input = await emailInput();
    await waitFor(() => expect(input.value).toBe("locked@example.com"));
  });

  it("pre-fills from the ?email= URL param (expired-link bounce)", async () => {
    window.history.replaceState({}, "", "/reset-password?email=urluser%40example.com");
    renderAt({ pathname: "/reset-password", search: "?email=urluser%40example.com" });
    const input = await emailInput();
    await waitFor(() => expect(input.value).toBe("urluser@example.com"));
  });

  it("prefers router state over the URL param", async () => {
    window.history.replaceState({}, "", "/reset-password?email=url%40example.com");
    renderAt({ pathname: "/reset-password", search: "?email=url%40example.com", state: { prefillEmail: "state@example.com" } });
    const input = await emailInput();
    await waitFor(() => expect(input.value).toBe("state@example.com"));
  });

  it("leaves the field empty (never blocks) when no email is available", async () => {
    renderAt({ pathname: "/reset-password" });
    const input = await emailInput();
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("leaves the field empty when the provided email is malformed", async () => {
    renderAt({ pathname: "/reset-password", state: { prefillEmail: "not-an-email" } });
    const input = await emailInput();
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("keeps the pre-filled field editable", async () => {
    renderAt({ pathname: "/reset-password", state: { prefillEmail: "locked@example.com" } });
    const input = await emailInput();
    await waitFor(() => expect(input.value).toBe("locked@example.com"));
    expect(input).not.toBeDisabled();
    expect(input).not.toHaveAttribute("readonly");
  });
});

describe("LinkExpired → ResetPassword passthrough", () => {
  it("hands the email from the expired-link screen to the request screen", async () => {
    renderAt({ pathname: "/link-expired", state: { prefillEmail: "expired@example.com" } });

    const requestNew = await screen.findByRole("link", { name: /request a new link/i });
    fireEvent.click(requestNew);

    const input = await emailInput();
    await waitFor(() => expect(input.value).toBe("expired@example.com"));
  });
});
