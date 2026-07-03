import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const select = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => select() }) },
}));

import { usePricingConfig, PRICING_CONFIG_DEFAULTS } from "@/hooks/usePricingConfig";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => vi.clearAllMocks());

describe("usePricingConfig", () => {
  it("falls back to defaults before data resolves", () => {
    select.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => usePricingConfig(), { wrapper });
    expect(result.current.fee("courier_fee_cents")).toBe(PRICING_CONFIG_DEFAULTS.courier_fee_cents);
    expect(result.current.fee("assessment_deposit_cents")).toBe(
      PRICING_CONFIG_DEFAULTS.assessment_deposit_cents,
    );
  });

  it("prefers fetched values over defaults", async () => {
    select.mockResolvedValue({
      data: [
        { key: "courier_fee_cents", value_cents: 999 },
        { key: "assessment_deposit_cents", value_cents: 3000 },
      ],
      error: null,
    });
    const { result } = renderHook(() => usePricingConfig(), { wrapper });
    await waitFor(() => expect(result.current.fee("courier_fee_cents")).toBe(999));
    expect(result.current.fee("assessment_deposit_cents")).toBe(3000);
    // A key not present in the fetched rows still falls back to its default.
    expect(result.current.fee("free_courier_threshold_cents")).toBe(
      PRICING_CONFIG_DEFAULTS.free_courier_threshold_cents,
    );
  });

  it("falls back to defaults when the query errors", async () => {
    select.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { result } = renderHook(() => usePricingConfig(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.fee("courier_fee_cents")).toBe(PRICING_CONFIG_DEFAULTS.courier_fee_cents);
  });
});
