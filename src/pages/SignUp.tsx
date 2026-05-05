import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mock: emails already registered (UI-only)
const EXISTING_EMAILS = new Set<string>(["[email protected]"]);

const SignUp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const successRedirect = from === "/checkout" ? "/checkout" : "/account";

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Create an account — Cobbli";
  }, []);

  const phoneDigits = phone.replace(/\D/g, "").slice(0, 10);

  const allValid =
    emailRegex.test(email.trim()) &&
    phoneDigits.length === 10 &&
    password.length >= 8 &&
    confirm.length >= 8 &&
    password === confirm &&
    agree;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailExists(false);
    setPhoneError(null);
    setPasswordError(null);
    setConfirmError(null);

    let hasError = false;

    if (!emailRegex.test(email.trim())) {
      setEmailError("Please enter a valid email.");
      hasError = true;
    } else if (EXISTING_EMAILS.has(email.trim().toLowerCase())) {
      setEmailExists(true);
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

    navigate(successRedirect, { replace: true });
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
          {/* Tabs */}
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
              {/* Email */}
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
                  aria-describedby={emailError || emailExists ? "email-error" : undefined}
                />
                {emailError && (
                  <p id="email-error" className="text-sm text-destructive">
                    {emailError}
                  </p>
                )}
                {emailExists && (
                  <p id="email-error" className="text-sm text-destructive">
                    An account with this email already exists.{" "}
                    <Link to="/signin" state={{ from }} className="underline">
                      Sign in instead.
                    </Link>
                  </p>
                )}
              </div>

              {/* Phone */}
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
                    aria-describedby={phoneError ? "phone-error" : undefined}
                  />
                </div>
                {phoneError && (
                  <p id="phone-error" className="text-sm text-destructive">
                    {phoneError}
                  </p>
                )}
              </div>

              {/* Password */}
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
              </div>

              {/* Confirm password */}
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
                    aria-describedby={confirmError ? "confirm-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    aria-pressed={showConfirm}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmError && (
                  <p id="confirm-error" className="text-sm text-destructive">
                    {confirmError}
                  </p>
                )}
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="agree"
                  checked={agree}
                  onCheckedChange={(v) => setAgree(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="agree" className="text-sm font-normal leading-relaxed cursor-pointer">
                  I agree to the{" "}
                  <a
                    href="/terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary"
                  >
                    Terms & Conditions
                  </a>{" "}
                  and have reviewed the{" "}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary"
                  >
                    Privacy Policy
                  </a>
                </Label>
              </div>

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!allValid}>
                Create account
              </Button>
            </form>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SignUp;
