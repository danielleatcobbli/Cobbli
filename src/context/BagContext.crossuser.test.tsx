import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { BagProvider, useBag, type BagService } from "@/context/BagContext";
import { LAST_USER_ID_KEY, GUEST_EMAIL_KEY } from "@/lib/bagOwnership";

// This jsdom build ships an incomplete localStorage (no removeItem/clear), so
// install a minimal in-memory store for deterministic tests.
const makeStorage = (): Storage => {
  let map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => {
      map = new Map();
    },
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  } as Storage;
};
Object.defineProperty(window, "localStorage", { value: makeStorage(), writable: true });

// Capture the onAuthStateChange callback so tests can drive auth events.
let authCb: ((event: string, session: unknown) => void) | null = null;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authCb = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));

const svc: BagService[] = [{ id: "shine", name: "Shine", price: 1000 }];

// Small harness exposing bag count + an add button.
const Harness = () => {
  const { itemCount, addPair } = useBag();
  return (
    <div>
      <span data-testid="count">{itemCount}</span>
      <button onClick={() => addPair(svc, "pair-1")}>add</button>
    </div>
  );
};

const signIn = (id: string, email: string) =>
  act(() => {
    authCb?.("SIGNED_IN", { user: { id, email } });
  });

const fire = (event: string, id: string, email: string) =>
  act(() => {
    authCb?.(event, { user: { id, email } });
  });

beforeEach(() => {
  authCb = null;
  window.localStorage.clear();
});

const renderBag = () => render(<BagProvider><Harness /></BagProvider>);

const addItem = () => act(() => { screen.getByText("add").click(); });
const count = () => screen.getByTestId("count").textContent;

describe("BagContext cross-user protection", () => {
  it("clears the bag when a different user signs in", () => {
    window.localStorage.setItem(LAST_USER_ID_KEY, "user-a");
    renderBag();
    addItem();
    expect(count()).toBe("1");

    signIn("user-b", "b@example.com");
    expect(count()).toBe("0");
  });

  it("keeps the bag when the same user signs in again (return visit)", () => {
    window.localStorage.setItem(LAST_USER_ID_KEY, "user-a");
    renderBag();
    addItem();

    signIn("user-a", "a@example.com");
    expect(count()).toBe("1");
  });

  it("keeps the bag when there was no previous user (guest → own account)", () => {
    renderBag(); // no LAST_USER_ID_KEY set
    addItem();

    signIn("user-a", "a@example.com");
    expect(count()).toBe("1");
  });

  it("does NOT clear on TOKEN_REFRESHED / INITIAL_SESSION for a different id (avoids wiping on refresh)", () => {
    window.localStorage.setItem(LAST_USER_ID_KEY, "user-a");
    renderBag();
    addItem();

    // These events fire on tab focus/reload and must never clear the bag.
    fire("TOKEN_REFRESHED", "user-b", "b@example.com");
    fire("INITIAL_SESSION", "user-b", "b@example.com");
    expect(count()).toBe("1");
  });

  it("migrates a guest bag when the sign-in email matches the stored guest email", () => {
    window.localStorage.setItem(LAST_USER_ID_KEY, "user-a");
    window.localStorage.setItem(GUEST_EMAIL_KEY, "guest@example.com");
    renderBag();
    addItem();

    signIn("user-b", "guest@example.com");
    expect(count()).toBe("1");
  });

  it("records the new user id and consumes the guest email after sign-in", () => {
    window.localStorage.setItem(GUEST_EMAIL_KEY, "guest@example.com");
    renderBag();
    addItem();

    signIn("user-a", "a@example.com");
    expect(window.localStorage.getItem(LAST_USER_ID_KEY)).toBe("user-a");
    expect(window.localStorage.getItem(GUEST_EMAIL_KEY)).toBeNull();
  });
});
