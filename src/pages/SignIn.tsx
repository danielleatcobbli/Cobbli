import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Mock demo credential (UI-only; account-level state mocked via localStorage)
const DEMO_EMAIL = "[email protected]";
const DEMO_PASSWORD = "Password123";
const MAX_ATTEMPTS = 5;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const attemptsKey = (email: string) => `cobbli:signin-attempts:${email.trim().toLowerCase()}`;
const lockedKey = (email: string) => `cobbli:signin-locked:${email.trim().toLowerCase()}`;

const getAttempts = (email: string): number => {
  if (!email) return 0;
  const v = localStorage.getItem(attemptsKey(email));
  return v ? parseInt(v, 10) || 0 : 0;
};
const setAttempts = (email: string, n: number) => {
  localStorage.setItem(attemptsKey(email), String(n));
};
const isLocked = (email: string): boolean => {
  if (!email) return false;
  return localStorage.getItem(lockedKey(email)) === "1";
};
const setLocked = (email: string, locked: boolean) => {
  if (locked) localStorage.setItem(lockedKey(email), "1");
  else localStorage.removeItem(lockedKey(email));
};

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { from?: string; resetSuccess?: string } | null;
  const from = navState?.from;
  const resetSuccess = navState?.resetSuccess;
  // Route after success: bag/checkout flow → /checkout, otherwise → /account
  const successRedirect = from === "/checkout" ? "/checkout" : "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [locked, setLockedState] = useState(false);

  useEffect(() => {
    document.title = "Sign In — Cobbli";
  }, []);

  // Re-check locked state whenever email changes
  useEffect(() => {
    setLockedState(isLocked(email));
  }, [email]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !locked;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);

    if (!emailRegex.test(email.trim())) {
      setEmailError("Please enter a valid email.");
      return;
    }

    if (isLocked(email)) {
      setLockedState(true);
      return;
    }

    const correct = email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;

    if (correct) {
      setAttempts(email, 0);
      setLocked(email, false);
      navigate(successRedirect, { replace: true });
      return;
    }

    const next = getAttempts(email) + 1;
    setAttempts(email, next);

    if (next >= MAX_ATTEMPTS) {
      setLocked(email, true);
      setLockedState(true);
      return;
    }

    if (next === MAX_ATTEMPTS - 1) {
      setPasswordError(
        "Incorrect password. Please try again. You have 1 attempt remaining before your account is locked.",
      );
    } else {
      setPasswordError("Incorrect password. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-md py-12 md:py-16">
          {/* Tabs */}
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
              onClick={() => navigate("/signup")}
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
                <Link to="/reset-password">Reset Password</Link>
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
                    aria-describedby={emailError ? "email-error" : undefined}
                  />
                  {emailError && (
                    <p id="email-error" className="text-sm text-destructive">
                      {emailError}
                    </p>
                  )}
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
                      aria-describedby={passwordError ? "password-error" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {passwordError && (
                    <p id="password-error" className="text-sm text-destructive">
                      {passwordError}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Link to="/reset-password" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!canSubmit}>
                  Sign In
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate("/signup")}
                >
                  Create an account
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
