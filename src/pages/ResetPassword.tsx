import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageMeta } from "@/hooks/usePageMeta";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "request" | "sent" | "reset" | "expired";

const meta: Record<Step, { title: string; description: string }> = {
  request: {
    title: "Reset your password — Cobbli",
    description: "Forgot your Cobbli password? Enter your email to receive a secure reset link and get back to managing your shoe repair orders in NYC.",
  },
  sent: {
    title: "Check your inbox — Cobbli",
    description: "We've sent you a password reset link. Check your inbox to securely set a new password for your Cobbli account and continue your shoe repairs.",
  },
  reset: {
    title: "Reset password — Cobbli",
    description: "Set a new password for your Cobbli account so you can sign in and manage your NYC shoe repair orders, addresses and payment methods.",
  },
  expired: {
    title: "Link expired — Cobbli",
    description: "Your Cobbli password reset link has expired. Request a new secure link to set a new password and get back to your shoe repair orders.",
  },
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Determine step from query params:
  //   ?step=reset&token=...  → reset password screen
  //   ?step=expired          → link expired screen
  //   (default)              → request reset link screen / sent state
  const initialStep: Step =
    params.get("step") === "reset"
      ? "reset"
      : params.get("step") === "expired"
        ? "expired"
        : "request";

  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Reset password fields
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  usePageMeta(meta[step]);

  // Cooldown timer for resend
  const intervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (cooldown <= 0) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (intervalRef.current === null) {
      intervalRef.current = window.setInterval(() => {
        setCooldown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cooldown]);

  const emailValid = useMemo(() => emailRegex.test(email.trim()), [email]);

  const handleRequest = (e: FormEvent) => {
    e.preventDefault();
    if (!emailValid) return;
    setSubmittedEmail(email.trim());
    setCooldown(60);
    setStep("sent");
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    setCooldown(60);
  };

  const canSubmitReset = newPwd.length > 0 && confirmPwd.length > 0;

  const handleResetSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    if (newPwd.length < 8) {
      setPwdError("Minimum of 8 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("Passwords don't match.");
      return;
    }
    // Reset lockout counters for any locked accounts (mock)
    Object.keys(localStorage)
      .filter((k) => k.startsWith("cobbli:signin-locked:") || k.startsWith("cobbli:signin-attempts:"))
      .forEach((k) => localStorage.removeItem(k));
    navigate("/signin", {
      replace: true,
      state: { resetSuccess: "Your password has been updated. Please sign in with your new password." },
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-md py-12 md:py-16">
          {step === "request" && (
            <section aria-labelledby="reset-heading" className="space-y-6">
              <h1 id="reset-heading" className="text-2xl md:text-3xl font-semibold">
                Reset your password
              </h1>
              <form onSubmit={handleRequest} className="space-y-5" noValidate>
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
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!emailValid}>
                  Send reset link
                </Button>
                <div className="text-center">
                  <Link to="/signin" className="text-sm text-primary hover:underline">
                    Back to sign in
                  </Link>
                </div>
              </form>
            </section>
          )}

          {step === "sent" && (
            <section aria-labelledby="sent-heading" className="space-y-6">
              <h1 id="sent-heading" className="text-2xl md:text-3xl font-semibold">
                Check your inbox
              </h1>
              <p className="text-foreground/80">
                If an account exists for {submittedEmail}, a reset link is on its way. Check your spam folder if it
                doesn't arrive within a minute.
              </p>
              <Button
                type="button"
                variant="hero"
                size="lg"
                className="w-full"
                onClick={handleResend}
                disabled={cooldown > 0}
              >
                {cooldown > 0 ? `Resend reset link in ${cooldown}s` : "Resend reset link"}
              </Button>
              <div className="text-center">
                <Link to="/signin" className="text-sm text-primary hover:underline">
                  Back to sign in
                </Link>
              </div>
            </section>
          )}

          {step === "reset" && (
            <section aria-labelledby="newpwd-heading" className="space-y-6">
              <h1 id="newpwd-heading" className="text-2xl md:text-3xl font-semibold">
                Reset password
              </h1>
              <form onSubmit={handleResetSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="new-pwd">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-pwd"
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      aria-label={showNew ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum of 8 characters</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-pwd">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-pwd"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      className="pr-10"
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
                  <p className="text-xs text-muted-foreground">Minimum of 8 characters</p>
                </div>

                {pwdError && <p className="text-sm text-destructive">{pwdError}</p>}

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!canSubmitReset}>
                  Update password
                </Button>
              </form>
            </section>
          )}

          {step === "expired" && (
            <section aria-labelledby="expired-heading" className="space-y-6">
              <h1 id="expired-heading" className="text-2xl md:text-3xl font-semibold">
                Link expired
              </h1>
              <p className="text-foreground/80">
                Your password reset link has expired. Reset links are valid for 24 hours. Please request a new one.
              </p>
              <Button
                type="button"
                variant="hero"
                size="lg"
                className="w-full"
                onClick={() => {
                  setStep("request");
                  navigate("/reset-password", { replace: true });
                }}
              >
                Request a new link
              </Button>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResetPassword;
