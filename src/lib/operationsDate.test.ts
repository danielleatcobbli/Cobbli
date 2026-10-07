import { describe, it, expect } from "vitest";
import { operationsDate } from "./operationsDate";
describe("operations calendar", () => {
  it("uses New York's date before local midnight", () => {
    expect(operationsDate(0, new Date("2026-10-02T02:00:00Z"))).toBe("2026-10-01");
  });
  it("advances calendar days across daylight saving and year boundaries", () => {
    expect(operationsDate(1, new Date("2026-03-08T06:00:00Z"))).toBe("2026-03-09");
    expect(operationsDate(1, new Date("2026-12-31T18:00:00Z"))).toBe("2027-01-01");
  });
});
