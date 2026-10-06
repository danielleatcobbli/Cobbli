import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import KpiDashboard from "./KpiDashboard";
const state = vi.hoisted(() => ({ value: {} as any }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => state.value }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
afterEach(cleanup);
describe("report failures", () => {
  it("shows retry instead of metrics or exports when fetching fails", () => {
    const refetch = vi.fn();
    state.value = { error: new Error("Failed to fetch"), isLoading: false, refetch, isFetching: false };
    render(<KpiDashboard />);
    expect(screen.getByRole("alert")).toHaveTextContent("Reports unavailable");
    expect(screen.queryByText(/Export/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it("shows loading before any data is available", () => {
    state.value = { isLoading: true, refetch: vi.fn() };
    render(<KpiDashboard />);
    expect(screen.getByText("Loading KPIs…")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
