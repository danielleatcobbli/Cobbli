import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Gate depends on useAuth + a supabase user_roles query. Mock both so we can
// assert owners get through and non-owners are denied.
const authState = { user: null as { id: string; email: string } | null, loading: false };
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/components/cobbli/BrandSpinner", () => ({ default: () => <div>spinner</div> }));

const maybeSingle = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: () => maybeSingle() }),
        }),
      }),
    }),
  },
}));

import OwnerRoute from "@/components/OwnerRoute";

const renderGuarded = () =>
  render(
    <OwnerRoute>
      <div>secret settings</div>
    </OwnerRoute>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = null;
  authState.loading = false;
});

describe("OwnerRoute gating", () => {
  it("denies access when signed out", async () => {
    authState.user = null;
    renderGuarded();
    await screen.findByText(/access denied — owner role required/i);
    expect(screen.queryByText("secret settings")).not.toBeInTheDocument();
  });

  it("denies a signed-in non-owner (no owner row)", async () => {
    authState.user = { id: "u1", email: "admin@example.com" };
    maybeSingle.mockResolvedValue({ data: null, error: null });
    renderGuarded();
    await screen.findByText(/access denied — owner role required/i);
    expect(screen.queryByText("secret settings")).not.toBeInTheDocument();
  });

  it("grants access to an owner", async () => {
    authState.user = { id: "u1", email: "owner@example.com" };
    maybeSingle.mockResolvedValue({ data: { role: "owner" }, error: null });
    renderGuarded();
    await screen.findByText("secret settings");
    expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
  });

  it("denies when the role query errors (fails closed)", async () => {
    authState.user = { id: "u1", email: "owner@example.com" };
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    renderGuarded();
    await waitFor(() =>
      expect(screen.getByText(/access denied — owner role required/i)).toBeInTheDocument(),
    );
  });
});
