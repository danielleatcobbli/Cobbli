import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Tab = "signin" | "signup";

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    // Mock sign-in: accept any non-empty credentials
    navigate(redirectTo, { replace: true });
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
              aria-selected={tab === "signin"}
              onClick={() => setTab("signin")}
              className={cn(
                "h-11 rounded-md text-sm font-semibold transition-colors",
                tab === "signin"
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              Sign In
            </button>
            <button
              role="tab"
              aria-selected={tab === "signup"}
              onClick={() => setTab("signup")}
              className={cn(
                "h-11 rounded-md text-sm font-semibold transition-colors",
                tab === "signup"
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              Create An Account
            </button>
          </div>

          {tab === "signin" ? (
            <section aria-labelledby="signin-heading">
              <h1 id="signin-heading" className="text-2xl md:text-3xl font-semibold mb-6">
                Sign in
              </h1>

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
                  />
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
                  <div className="flex justify-end">
                    <Link
                      to="/reset-password"
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={!canSubmit}
                >
                  Sign In
                </Button>
              </form>
            </section>
          ) : (
            <section aria-labelledby="signup-heading" className="text-center py-12">
              <h2 id="signup-heading" className="text-xl font-semibold mb-2">
                Create an account
              </h2>
              <p className="text-muted-foreground">Coming soon.</p>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SignIn;
