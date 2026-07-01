import { describe, it, expect } from "vitest";
import { decideBagAction } from "@/lib/bagOwnership";

describe("decideBagAction", () => {
  it("keeps the bag when there is no previously authenticated user (fresh device / guest → account)", () => {
    expect(
      decideBagAction({
        previousUserId: null,
        newUserId: "user-a",
        newUserEmail: "a@example.com",
        guestEmail: null,
      }),
    ).toBe("keep");
  });

  it("keeps the bag when the same user signs in again (token refresh / return visit)", () => {
    expect(
      decideBagAction({
        previousUserId: "user-a",
        newUserId: "user-a",
        newUserEmail: "a@example.com",
        guestEmail: null,
      }),
    ).toBe("keep");
  });

  it("clears the bag when a different user signs in", () => {
    expect(
      decideBagAction({
        previousUserId: "user-a",
        newUserId: "user-b",
        newUserEmail: "b@example.com",
        guestEmail: null,
      }),
    ).toBe("clear");
  });

  it("keeps the bag on guest → own account when the sign-in email matches the guest email", () => {
    // No previous authenticated user, and the guest email matches: migration.
    expect(
      decideBagAction({
        previousUserId: null,
        newUserId: "user-a",
        newUserEmail: "guest@example.com",
        guestEmail: "guest@example.com",
      }),
    ).toBe("keep");
  });

  it("matches guest email case-insensitively and ignores surrounding whitespace", () => {
    expect(
      decideBagAction({
        previousUserId: "user-a",
        newUserId: "user-b",
        newUserEmail: "  Guest@Example.com ",
        guestEmail: "guest@example.com",
      }),
    ).toBe("keep");
  });

  it("clears when a different user signs in and the guest email does NOT match", () => {
    expect(
      decideBagAction({
        previousUserId: "user-a",
        newUserId: "user-b",
        newUserEmail: "b@example.com",
        guestEmail: "someone-else@example.com",
      }),
    ).toBe("clear");
  });

  it("treats an empty-string previous user id as no previous user (keep)", () => {
    expect(
      decideBagAction({
        previousUserId: "",
        newUserId: "user-a",
        newUserEmail: "a@example.com",
        guestEmail: null,
      }),
    ).toBe("keep");
  });

  it("does not migrate on a blank/whitespace guest email", () => {
    expect(
      decideBagAction({
        previousUserId: "user-a",
        newUserId: "user-b",
        newUserEmail: "b@example.com",
        guestEmail: "   ",
      }),
    ).toBe("clear");
  });
});
