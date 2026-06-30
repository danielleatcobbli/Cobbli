import { describe, it, expect } from "vitest";
import { extractEmailParam, resolveInitialEmail } from "@/lib/resetEmail";

describe("extractEmailParam", () => {
  it("returns a valid email from the query string", () => {
    expect(extractEmailParam("?email=jane%40example.com", "")).toBe("jane@example.com");
  });

  it("returns a valid email from the hash fragment", () => {
    expect(extractEmailParam("", "#email=jane%40example.com&type=recovery")).toBe(
      "jane@example.com",
    );
  });

  it("prefers the query string over the hash when both are present", () => {
    expect(extractEmailParam("?email=query%40example.com", "#email=hash%40example.com")).toBe(
      "query@example.com",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(extractEmailParam("?email=%20jane%40example.com%20", "")).toBe("jane@example.com");
  });

  it("returns null when the email param is missing", () => {
    expect(extractEmailParam("?token_hash=abc&type=recovery", "")).toBeNull();
  });

  it("returns null when the email param is not a valid email", () => {
    expect(extractEmailParam("?email=not-an-email", "")).toBeNull();
  });

  it("returns null for empty inputs", () => {
    expect(extractEmailParam("", "")).toBeNull();
  });

  it("tolerates a missing leading ? or #", () => {
    expect(extractEmailParam("email=jane%40example.com", "")).toBe("jane@example.com");
  });
});

describe("resolveInitialEmail", () => {
  it("prefers a valid state email above all else", () => {
    expect(
      resolveInitialEmail({ stateEmail: "state@example.com", urlEmail: "url@example.com" }),
    ).toBe("state@example.com");
  });

  it("falls back to the URL email when state email is absent", () => {
    expect(resolveInitialEmail({ stateEmail: null, urlEmail: "url@example.com" })).toBe(
      "url@example.com",
    );
  });

  it("ignores an invalid state email and uses the URL email", () => {
    expect(resolveInitialEmail({ stateEmail: "garbage", urlEmail: "url@example.com" })).toBe(
      "url@example.com",
    );
  });

  it("returns an empty string when nothing usable is available", () => {
    expect(resolveInitialEmail({ stateEmail: null, urlEmail: null })).toBe("");
  });

  it("returns an empty string when both inputs are invalid", () => {
    expect(resolveInitialEmail({ stateEmail: "nope", urlEmail: "also-nope" })).toBe("");
  });

  it("trims a valid state email", () => {
    expect(resolveInitialEmail({ stateEmail: "  state@example.com  ", urlEmail: null })).toBe(
      "state@example.com",
    );
  });
});
