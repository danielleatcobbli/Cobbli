import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProposalBuilder, { type ProposalAssessment } from "./ProposalBuilder";

const servicesResult = vi.fn();
const apiFetchJson = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => servicesResult(),
  };
  return { supabase: { from: () => chain } };
});
vi.mock("@/integrations/api/client", () => ({
  apiFetchJson: (...args: unknown[]) => apiFetchJson(...args),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const SERVICES = [
  { id: "s1", slug: "strap-repair", name: "Strap repair", base_price_cents: 4500, is_coming_soon: false },
  { id: "s2", slug: "zipper-replacement", name: "Zipper replacement", base_price_cents: 6000, is_coming_soon: true },
];

const renderBuilder = (assessment: ProposalAssessment, onSaved = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProposalBuilder assessment={assessment} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return onSaved;
};

beforeEach(() => {
  servicesResult.mockReset();
  apiFetchJson.mockReset();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("ProposalBuilder", () => {
  it("saves one line per service per bag, with the bags, as quote_ready", async () => {
    servicesResult.mockResolvedValue({ data: SERVICES, error: null });
    apiFetchJson.mockResolvedValue({ data: {} });
    const onSaved = renderBuilder({
      id: "a1",
      pairs: [{ id: "b1", photoPaths: ["x.jpg"] }],
      proposed_services: [],
    });

    fireEvent.click(await screen.findByLabelText("Strap repair"));
    fireEvent.click(screen.getByRole("button", { name: "Save & copy link" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [path, init] = apiFetchJson.mock.calls[0];
    expect(path).toBe("/ops/assessments/a1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      proposed_services: [
        {
          recommendation_id: "b1:s1",
          service_id: "s1",
          slug: "strap-repair",
          name: "Strap repair",
          price_cents: 4500,
          tier: "essential",
          pair_id: "b1",
        },
      ],
      pairs: [{ id: "b1", photoPaths: ["x.jpg"] }],
      status: "quote_ready",
      complimentary: false,
    });
  });

  it("starts from the saved proposal and never allows coming-soon services", async () => {
    servicesResult.mockResolvedValue({ data: SERVICES, error: null });
    renderBuilder({
      id: "a1",
      pairs: [{ id: "b1" }],
      proposed_services: [
        { service_id: "s1", slug: "strap-repair", name: "Strap repair", price_cents: 5000, tier: "recommended", pair_id: "b1" },
      ],
    });
    expect(await screen.findByLabelText("Strap repair")).toBeChecked();
    expect(screen.getByLabelText("Zipper replacement")).toBeDisabled();
    expect(screen.getByText("1 service selected")).toBeInTheDocument();
  });

  it("shows an error with Retry, not 'No active services', when services fail to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    servicesResult.mockResolvedValue({ data: null, error: new Error("db down") });
    renderBuilder({ id: "a1", pairs: [{ id: "b1" }] });
    expect(await screen.findByText("Could not load services")).toBeInTheDocument();
    expect(screen.queryByText("No active services available.")).not.toBeInTheDocument();
  });
});
