import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

// Routes where a newly-detected session (e.g. email verification completed in
// another tab) should auto-redirect the user into their account. Password
// recovery intentionally stays on /reset-password so users can set a new one.
const AUTH_ENTRY_ROUTES = ["/signup", "/signin"];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Track whether we previously had no session, so we can detect a fresh sign-in.
  const hadSessionRef = useRef<boolean>(false);
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    // Set up listener BEFORE reading session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") {
        window.sessionStorage.setItem("cobbli-password-recovery", "1");
      }

      // Cross-tab email-verification handoff: if a session appears while we
      // had none (and the user is sitting on an auth-entry page like /signup),
      // send them to /account with a verified flag so we can show the toast.
      const wasSignedOut = !hadSessionRef.current;
      const isSignedInNow = !!s;

      if (
        isSignedInNow &&
        wasSignedOut &&
        (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")
      ) {
        const path = locationRef.current.pathname;
        if (AUTH_ENTRY_ROUTES.some((p) => path === p || path.startsWith(`${p}/`))) {
          navigate("/account?verified=1", { replace: true });
        }
      }

      hadSessionRef.current = isSignedInNow;
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      hadSessionRef.current = !!data.session;
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
