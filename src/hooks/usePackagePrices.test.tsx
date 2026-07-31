import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const eq = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq }),
    }),
  },
}));

import {
  canonicalPackageSlug,
  usePackagePrices,
} from "@/hooks/usePackagePrices";

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

beforeEach(() => vi.clearAllMocks());

describe("usePackagePrices", () => {
  it("loads authoritative package prices", async () => {
    eq.mockResolvedValue({
      data: [
        { slug: "full-restoration", price_cents: 25000 },
        { slug: "upper-repair", price_cents: 10000 },
      ],
      error: null,
    });

    const { result } = renderHook(() => usePackagePrices(), { wrapper });

    await waitFor(() =>
      expect(result.current.data?.["full-restoration"]).toBe(25000),
    );
    expect(result.current.data?.["upper-repair"]).toBe(10000);
  });

  it("normalizes package IDs created by the legacy detail page", () => {
    expect(canonicalPackageSlug("standard-repair-sole-upper-interior")).toBe(
      "standard-service",
    );
    expect(canonicalPackageSlug("upper-repair")).toBe("upper-repair");
  });
});
