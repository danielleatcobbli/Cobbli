import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mocks = vi.hoisted(() => ({ coverage: vi.fn(), insert: vi.fn() }));
vi.mock("@/hooks/useServiceableZips", () => ({ useServiceableZips: () => ({ isServiceable: mocks.coverage }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert: mocks.insert }) } }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/cobbli/Header", () => ({ default: () => null }));
vi.mock("@/components/cobbli/Footer", () => ({ default: () => null }));
import { CoverageRequestForm } from "./Faqs";
const check = (zip: string) => {
  render(<MemoryRouter><CoverageRequestForm /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("ZIP code"), { target: { value: zip } });
  fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
};
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.insert.mockResolvedValue({ error: null }); });
describe("FAQ availability", () => {
  it("validates incomplete ZIPs without recording them", () => {
    check("100");
    expect(screen.getByText("Enter a valid 5-digit ZIP code.")).toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("links covered customers to the repair form without recording demand", () => {
    mocks.coverage.mockReturnValue(true); check("10001");
    expect(screen.getByRole("link", { name: /Start a repair/ })).toHaveAttribute("href", "/start-repair/assessment");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("does not mislabel unknown coverage as unsupported", () => {
    mocks.coverage.mockReturnValue(null); check("10002");
    expect(screen.getByText(/couldn’t check availability/)).toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("records unsupported interest only once on repeated checks", async () => {
    mocks.coverage.mockReturnValue(false); check("11201");
    await screen.findByText(/Thanks for helping/);
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledWith({ zip_code: "11201", email: null });
  });
  it("keeps the coverage answer if saving fails and permits a retry", async () => {
    mocks.coverage.mockReturnValue(false); mocks.insert.mockResolvedValueOnce({ error: new Error("offline") }); check("11202");
    await waitFor(() => expect(screen.getByRole("button", { name: "Check availability" })).toBeEnabled());
    expect(screen.getByText("We’re not in your area yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Thanks for helping/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    await screen.findByText(/Thanks for helping/);
    expect(mocks.insert).toHaveBeenCalledTimes(2);
  });
});
