import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/components/cobbli/Header", () => ({ default: () => null }));
vi.mock("@/components/cobbli/Footer", () => ({ default: () => null }));
vi.mock("@/hooks/usePageMeta", () => ({ usePageMeta: () => {} }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

const rpc = vi.fn();
const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
      signInWithOAuth: vi.fn(),
    },
    rpc: (...a: unknown[]) => rpc(...a),
  },
}));

import SignIn from "@/pages/SignIn";

const renderSignIn = () =>
  render(
    <MemoryRouter initialEntries={["/signin"]}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
      </Routes>
    </MemoryRouter>,
  );

// Drives the form into the locked state: enter email + password, submit, and
// have the is_account_locked pre-check return true.
const reachLockedScreen = async (email: string) => {
  rpc.mockImplementation((fn: string) => {
    if (fn === "is_account_locked") return Promise.resolve({ data: true });
    return Promise.resolve({ data: null });
  });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "whatever" } });
  fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
  await screen.findByRole("heading", { name: /account locked/i });
};

beforeEach(() => {
  vi.clearAllMocks();
  resetPasswordForEmail.mockResolvedValue({ error: null });
});

describe("SignIn account-lockout reset flow", () => {
  it("shows a single 'Reset my password' button and no email input on the locked screen", async () => {
    renderSignIn();
    await reachLockedScreen("locked@example.com");

    expect(screen.getByRole("button", { name: /reset my password/i })).toBeInTheDocument();
    // The email must not be re-requested — no email field on the locked screen.
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  });

  it("sends the reset email to the on-file address and advances to check-inbox", async () => {
    renderSignIn();
    await reachLockedScreen("locked@example.com");

    fireEvent.click(screen.getByRole("button", { name: /reset my password/i }));

    await waitFor(() =>
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "locked@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/reset-password?email=locked%40example.com"),
        }),
      ),
    );
    await screen.findByRole("heading", { name: /check your inbox/i });
  });

  it("does not double-send while a send is in flight", async () => {
    let resolve!: (v: { error: null }) => void;
    resetPasswordForEmail.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderSignIn();
    await reachLockedScreen("locked@example.com");

    const btn = screen.getByRole("button", { name: /reset my password/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    resolve({ error: null });

    await screen.findByRole("heading", { name: /check your inbox/i });
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });

  it("surfaces an error and stays on the locked screen if the send fails", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: "boom" } });
    renderSignIn();
    await reachLockedScreen("locked@example.com");

    fireEvent.click(screen.getByRole("button", { name: /reset my password/i }));

    await screen.findByText(/couldn't send the reset email/i);
    expect(screen.getByRole("heading", { name: /account locked/i })).toBeInTheDocument();
  });
});
