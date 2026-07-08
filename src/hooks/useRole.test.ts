import { describe, it, expect } from "vitest";
import { __roleTestables } from "@/hooks/useRole";

const { normalizeRole, bestRole } = __roleTestables;

describe("normalizeRole", () => {
  it("passes through the three canonical roles", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("staff")).toBe("staff");
    expect(normalizeRole("customer")).toBe("customer");
  });

  it("maps legacy owner → admin", () => {
    expect(normalizeRole("owner")).toBe("admin");
  });

  it("maps legacy user → customer", () => {
    expect(normalizeRole("user")).toBe("customer");
  });

  it("falls back to customer for anything unrecognized", () => {
    expect(normalizeRole("banana")).toBe("customer");
  });
});

describe("bestRole", () => {
  it("returns the highest-privilege role when several are held", () => {
    expect(bestRole(["customer", "admin"])).toBe("admin");
    expect(bestRole(["staff", "customer"])).toBe("staff");
    expect(bestRole(["admin", "staff"])).toBe("admin");
  });

  it("resolves legacy admin+owner rows to admin", () => {
    expect(bestRole(["admin", "owner"])).toBe("admin");
  });

  it("defaults to customer for an empty set", () => {
    expect(bestRole([])).toBe("customer");
  });
});
