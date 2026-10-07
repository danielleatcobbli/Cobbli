import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, describe, it, expect, vi } from "vitest";
import AdminOrderDetail from "./AdminOrderDetail";
const mocks = vi.hoisted(() => ({ fetchOrderDetail: vi.fn() }));
vi.mock("./adminData", () => ({ fetchOrderDetail: mocks.fetchOrderDetail }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
afterEach(cleanup);
const show = () => render(<MemoryRouter initialEntries={["/admin/order/missing"]}><Routes><Route path="/admin/order/:id" element={<AdminOrderDetail />} /></Routes></MemoryRouter>);
describe("order lookup", () => {
  it("does not invent an order when no record exists", async () => {
    mocks.fetchOrderDetail.mockResolvedValue(null);
    show();
    expect(await screen.findByText(/Order not found/)).toBeInTheDocument();
    expect(screen.queryByText("Customer Name")).toBeNull();
    expect(screen.queryByText(/ORD-2026/)).toBeNull();
  });
  it("distinguishes a failed fetch from a missing record", async () => {
    mocks.fetchOrderDetail.mockRejectedValue(new Error("Connection unavailable"));
    show();
    expect(await screen.findByText(/Couldn't load this order: Connection unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/Order not found/)).toBeNull();
  });
});
