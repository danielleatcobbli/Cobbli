import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LoadState from "./LoadState";

describe("LoadState", () => {
  it("renders children only after a successful load", () => {
    render(
      <LoadState isLoading={false} error={null} onRetry={() => {}} what="requests">
        <p>3 requests</p>
      </LoadState>,
    );
    expect(screen.getByText("3 requests")).toBeInTheDocument();
  });

  it("does not render children while loading", () => {
    render(
      <LoadState isLoading error={null} onRetry={() => {}} what="requests">
        <p>0 requests</p>
      </LoadState>,
    );
    expect(screen.queryByText("0 requests")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loading requests")).toBeInTheDocument();
  });

  it("shows the error and Retry, never the children, when the load failed", () => {
    const onRetry = vi.fn();
    render(
      <LoadState isLoading={false} error={new Error("boom (502)")} onRetry={onRetry} what="requests">
        <p>0 requests</p>
      </LoadState>,
    );
    expect(screen.queryByText("0 requests")).not.toBeInTheDocument();
    expect(screen.getByText("Could not load requests")).toBeInTheDocument();
    expect(screen.getByText("boom (502)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
