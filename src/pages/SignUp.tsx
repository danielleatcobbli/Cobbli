import { useEffect, useState, type FormEvent } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/context/AuthContext";
import {
  PASSWORD_HELPER_TEXT,
  validatePassword,
  mapSupabasePasswordError,
} from "@/lib/passwordValidation";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SignUp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const from = (location.state as { from?: string } | null)?.from;
  const successRedirect = from === "/checkout" ? "/checkout" : "/account";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  usePageMeta({
    title: "Create an account — Cobbli",
    description:
      "Create a free Cobbli account to book shoe repairs, save your addresses and payment methods, and track your door-to-door pickups across NYC.",
  });

  useEffect(() => {
    if (user) navigate(successRedirect, { replace: true });
  }, [user, navigate, successRedirect]);

  const phoneDigits = phone.replace(/\D/g, "").slice(0, 10);

  // Live password validation
  const livePasswordError = password.length > 0 ? validatePassword(password) : null;

  const allValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    emailRegex.test(email.trim()) &&
    phoneDigits.length === 10 &&
    validatePassword(password) === null &&
    confirm.length > 0 &&
    password === confirm &&
    agree &&
    !submitting;

  const handleGoogle = async () => {
    setFormError(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setFormError("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate(successRedirect, { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setEmailError(null);
    setEmailExists(false);
    setPhoneError(null);
    setPasswordError(null);
    setConfirmError(null);

    let hasError = false;
    if (!emailRegex.test(email.trim())) {
      setEmailError("Please enter a valid email.");
      hasError = true;
    }
    if (phoneDigits.length !== 10) {
      setPhoneError("Invalid phone number");
      hasError = true;
    }
    if (password.length < 8) {
      setPasswordError("Password too short");
      hasError = true;
    }
    if (confirm !== password) {
      setConfirmError("Passwords don't match");
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/account`,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: `+1${phoneDigits}`,
          },
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered")) {
          setEmailExists(true);
        } else if (msg.includes("password")) {
          setPasswordError(error.message);
        } else {
          setFormError(error.message);
        }
        return;
      }
      // If email confirmation is required (no session returned), show confirmation prompt
      if (!data.session) {
        setConfirmEmailSent(true);
        return;
      }
      navigate(successRedirect, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const formatPhoneDisplay = (digits: string) => {
    const d = digits.slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-md py-12 md:py-16">
          <div role="tablist" aria-label="Authentication" className="grid grid-cols-2 gap-2 mb-8">
            <button
              role="tab"
              aria-selected={false}
              onClick={() => navigate("/signin", { state: { from } })}
              className={cn(
                "h-11 rounded-md text-sm font-semibold transition-colors",
                "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={true}
              className={cn(
                "h-11 rounded-md text-sm font-semibold transition-colors",
                "bg-primary text-primary-foreground shadow-soft",
              )}
            >
              Create an account
            </button>
          </div>

          {confirmEmailSent ? (
            <section className="space-y-6 text-center">
              <h1 className="text-2xl md:text-3xl font-semibold">Check your inbox</h1>
              <p className="text-foreground/80">
                We've sent a confirmation link to <strong>{email}</strong>. Click it to verify your email and finish
                setting up your account.
              </p>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link to="/signin">Back to sign in</Link>
              </Button>
            </section>
          ) : (
            <section aria-labelledby="signup-heading">
              <h1 id="signup-heading" className="text-2xl md:text-3xl font-semibold mb-2 text-center">
                Create an account
              </h1>
              <p className="text-sm text-foreground/80 mb-6 text-center">
                Already have an account?{" "}
                <Link to="/signin" state={{ from }} className="underline hover:text-primary">
                  Sign in
                </Link>
              </p>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!emailError || emailExists}
                  />
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                  {emailExists && (
                    <p className="text-sm text-destructive">
                      An account with this email already exists.{" "}
                      <Link to="/signin" state={{ from }} className="underline">
                        Sign in instead.
                      </Link>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="relative">
                    <span
                      className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none select-none"
                      aria-hidden="true"
                    >
                      +1
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      required
                      value={formatPhoneDisplay(phoneDigits)}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="pl-10"
                      placeholder="555-555-5555"
                      aria-invalid={!!phoneError}
                    />
                  </div>
                  {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum of 8 characters"
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Minimum of 8 characters"
                      className="pr-10"
                      aria-invalid={!!confirmError}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmError && <p className="text-sm text-destructive">{confirmError}</p>}
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="agree"
                    checked={agree}
                    onCheckedChange={(v) => setAgree(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="agree" className="text-sm font-normal leading-relaxed cursor-pointer">
                    I agree to the{" "}
                    <a href="/terms-conditions" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                      Terms & Conditions
                    </a>{" "}
                    and have reviewed the{" "}
                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                      Privacy Policy
                    </a>
                  </Label>
                </div>

                {formError && <p className="text-sm text-destructive">{formError}</p>}

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!allValid}>
                  {submitting ? "Creating account…" : "Create account"}
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

export default SignUp;
