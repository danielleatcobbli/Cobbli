import { useEffect, useState, type FormEvent } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/hooks/useRole";
import { consumeReturnTo, peekReturnTo, saveReturnTo } from "@/lib/authRedirect";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const navState = location.state as { from?: string; resetSuccess?: string } | null;
  const fromState = navState?.from;
  const resetSuccess = navState?.resetSuccess;
  // Persist any router-provided "from" so it survives full-page OAuth redirects.
  if (fromState) saveReturnTo(fromState);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  usePageMeta({
    title: "Sign in — Cobbli",
    description:
      "Sign in to your Cobbli account to manage shoe repair orders, saved addresses and payment methods for fast door-to-door checkout across NYC.",
  });

  // Redirect already-signed-in users
  // Role-based post-login routing. A pending deep-link (returnTo) always wins;
  // otherwise admin/staff land on the ops dashboard and customers on their
  // account. Wait for the role to resolve so we don't misroute on first paint.
  useEffect(() => {
    if (!user || roleLoading) return;
    const pending = peekReturnTo();
    if (pending) {
      consumeReturnTo();
      navigate(pending, { replace: true });
      return;
    }
    const target = role === "admin" || role === "staff" ? "/admin/orders" : "/account";
    navigate(target, { replace: true });
  }, [user, role, roleLoading, navigate]);

  // Reset the locked-screen state whenever the user re-navigates to /signin
  // (e.g. clicking the header account icon from the locked screen).
  useEffect(() => {
    setLocked(false);
    setEmailError(null);
    setPasswordError(null);
  }, [location.key]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !locked && !submitting;

  const handleGoogle = async () => {
    setEmailError(null);
    setPasswordError(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setPasswordError("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    // Redirect is handled by the role-aware effect once `user` is set.
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);

    if (!emailRegex.test(email.trim())) {
      setEmailError("Please enter a valid email.");
      return;
    }

    setSubmitting(true);
    try {
      // Pre-check lockout
      const { data: lockedRes } = await supabase.rpc("is_account_locked", { _email: email.trim() });
      if (lockedRes) {
        setLocked(true);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const { data: rec } = await supabase.rpc("record_failed_signin", { _email: email.trim() });
        const r = rec as { locked?: boolean; attempts?: number } | null;
        if (r?.locked) {
          setLocked(true);
          return;
        }
        const attempts = r?.attempts ?? 0;
        if (attempts === 4) {
          setPasswordError(
            "Incorrect password. Please try again. You have 1 attempt remaining before your account is locked.",
          );
        } else {
          setPasswordError("Incorrect email or password. Please try again.");
        }
        return;
      }
      // Redirect is handled by the role-aware effect once `user` is set.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-md py-12 md:py-16">
          <div role="tablist" aria-label="Authentication" className="grid grid-cols-2 gap-2 mb-8">
            <button
              role="tab"
              aria-selected={true}
              className={cn(
                "h-11 rounded-md text-sm font-semibold transition-colors",
                "bg-primary text-primary-foreground shadow-soft",
              )}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={false}
              onClick={() => navigate("/signup", { state: { from: fromState } })}
              className={cn(
                "h-11 rounded-md text-sm font-semibold transition-colors",
                "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              Create an account
            </button>
          </div>

          {locked ? (
            <section aria-labelledby="locked-heading" className="space-y-6">
              <h1 id="locked-heading" className="text-2xl md:text-3xl font-semibold">
                Account locked
              </h1>
              <p className="text-foreground/80">
                For your security, we've locked your account after too many incorrect sign in attempts. Reset your
                password to regain access.
              </p>
              <Button asChild variant="hero" size="lg" className="w-full">
                <Link to="/reset-password" state={{ prefillEmail: email.trim() }}>Reset Password</Link>
              </Button>
            </section>
          ) : (
            <section aria-labelledby="signin-heading">
              <h1 id="signin-heading" className="text-2xl md:text-3xl font-semibold mb-6 text-center">
                Sign in
              </h1>

              {resetSuccess && (
                <div
                  role="status"
                  className="mb-5 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground"
                >
                  {resetSuccess}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!emailError}
                  />
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      aria-invalid={!!passwordError}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                  <div className="flex justify-end">
                    <Link to="/reset-password" state={{ prefillEmail: email.trim() }} className="text-sm text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!canSubmit}>
                  {submitting ? "Signing in…" : "Sign In"}
                </Button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <Button type="button" variant="outline" size="lg" className="w-full" onClick={handleGoogle}>
                  Continue with Google
                </Button>
              </form>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SignIn;
