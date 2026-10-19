import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RequestList from "./RequestList";
import { referenceFor, type RequestRow } from "./requestData";
import { stageFor } from "./requestStage";

const fetchRequests = vi.fn();
const createSignedUrls = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrls: (...args: unknown[]) => createSignedUrls(...args) }) },
  },
}));

vi.mock("./requestData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./requestData")>()),
  fetchRequests: () => fetchRequests(),
}));
// The layout pulls in auth/role hooks that are irrelevant here.
vi.mock("@/components/admin/AdminLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const make = (over: Partial<RequestRow> & { id: string }): RequestRow => ({
  user_id: null,
  status: "pending",
  created_at: "2026-10-12T10:00:00Z",
  updated_at: "2026-10-12T10:00:00Z",
  pairs: [{ id: "b1" }],
  order: null,
  profile: null,
  guest_email: `${over.id}@example.com`,
  ...over,
});

const ROWS: RequestRow[] = [
  make({
    id: "11111111-aaaa-bbbb-cccc-000000000001",
    status: "pending",
    profile: { first_name: "Danielle", last_name: "Roe", phone: null },
  }),
  make({ id: "22222222-aaaa-bbbb-cccc-000000000002", status: "quote_ready", profile: { first_name: "Sam", last_name: "Lee", phone: null } }),
  make({ id: "33333333-aaaa-bbbb-cccc-000000000003", status: "needs_more_info" }),
];

const renderList = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <RequestList />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  fetchRequests.mockReset();
  createSignedUrls.mockReset();
});

const WITH_PHOTOS: RequestRow[] = [
  make({
    id: "44444444-aaaa-bbbb-cccc-000000000004",
    pairs: [
      { id: "b1", photoPaths: ["u/bag1-a.jpg", "u/bag1-b.jpg"] },
      { id: "b2", photoPaths: ["u/bag2-a.jpg"] },
    ],
  }),
];

describe("RequestList", () => {
  it("shows an error with Retry, never an empty list or a zero count, when the load fails", async () => {
    fetchRequests.mockRejectedValueOnce(new Error("Bad gateway (502)"));
    renderList();
    expect(await screen.findByText("Could not load requests")).toBeInTheDocument();
    expect(screen.queryByText(/No requests/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing 0 of 0/)).not.toBeInTheDocument();

    fetchRequests.mockResolvedValueOnce(ROWS);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Showing 3 of 3 requests")).toBeInTheDocument();
  });

  it("lists every request with who acts next", async () => {
    fetchRequests.mockResolvedValue(ROWS);
    renderList();
    expect(await screen.findByText(referenceFor(ROWS[0].id))).toBeInTheDocument();
    expect(screen.getByText("Review photos and send recommendations")).toBeInTheDocument();
    expect(screen.getByText("Waiting for the customer to review and book")).toBeInTheDocument();
  });

  it("shows one thumbnail per bag, its first photo, signed in one batch", async () => {
    fetchRequests.mockResolvedValue(WITH_PHOTOS);
    createSignedUrls.mockResolvedValue({
      data: [
        { path: "u/bag1-a.jpg", signedUrl: "https://signed/bag1", error: null },
        { path: "u/bag2-a.jpg", signedUrl: "https://signed/bag2", error: null },
      ],
      error: null,
    });
    renderList();
    expect(await screen.findByAltText("Bag 1")).toHaveAttribute("src", "https://signed/bag1");
    expect(screen.getByAltText("Bag 2")).toHaveAttribute("src", "https://signed/bag2");
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith(["u/bag1-a.jpg", "u/bag2-a.jpg"], 3600);
  });

  it("still shows the list when thumbnail signing fails", async () => {
    fetchRequests.mockResolvedValue(WITH_PHOTOS);
    createSignedUrls.mockResolvedValue({ data: null, error: new Error("storage down") });
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderList();
    expect(await screen.findByText("Showing 1 of 1 requests")).toBeInTheDocument();
    await waitFor(() => expect(createSignedUrls).toHaveBeenCalled());
    expect(screen.queryByAltText("Bag 1")).not.toBeInTheDocument();
    expect(screen.getByTitle("Bag 1: photo unavailable")).toBeInTheDocument();
  });

  it("searches by reference and by customer name", async () => {
    fetchRequests.mockResolvedValue(ROWS);
    renderList();
    await screen.findByText("Showing 3 of 3 requests");
    const box = screen.getByLabelText("Search requests");

    fireEvent.change(box, { target: { value: "danielle" } });
    await waitFor(() => expect(screen.getByText("Showing 1 of 3 requests")).toBeInTheDocument());

    fireEvent.change(box, { target: { value: referenceFor(ROWS[1].id).toLowerCase() } });
    await waitFor(() => expect(screen.getByText("Showing 1 of 3 requests")).toBeInTheDocument());
    expect(screen.getByText(referenceFor(ROWS[1].id))).toBeInTheDocument();

    fireEvent.change(box, { target: { value: "nobody-matches" } });
    expect(await screen.findByText("No requests match your search and filters.")).toBeInTheDocument();
  });
});

describe("stageFor", () => {
  const base = make({ id: "x" });

  it("maps request statuses to a stage and owner", () => {
    expect(stageFor({ ...base, status: "pending" })).toMatchObject({ id: "new", owner: "cobbli" });
    expect(stageFor({ ...base, status: "needs_more_info" })).toMatchObject({ id: "needs_info", owner: "customer" });
    expect(stageFor({ ...base, status: "quote_ready" })).toMatchObject({ id: "recommendations_sent", owner: "customer" });
    expect(stageFor({ ...base, status: "declined" })).toMatchObject({ id: "closed", owner: "none" });
  });

  it("uses the linked order once the customer has booked", () => {
    const order = (status: string) => ({ id: "o", order_number: "CB-1", status });
    expect(stageFor({ ...base, status: "booked", order: order("in-repair") })).toMatchObject({ id: "booked", owner: "cobbli" });
    expect(stageFor({ ...base, status: "booked", order: order("completed") })).toMatchObject({ id: "completed", owner: "none" });
    expect(stageFor({ ...base, status: "booked", order: order("cancelled") })).toMatchObject({ id: "closed" });
  });

  it("surfaces a booked request with no linked order instead of hiding it", () => {
    expect(stageFor({ ...base, status: "booked", order: null })).toMatchObject({ id: "booked", label: "Booked (no order linked)" });
  });

  it("never drops an unknown status", () => {
    expect(stageFor({ ...base, status: "mystery" })).toMatchObject({ id: "other" });
  });
});
