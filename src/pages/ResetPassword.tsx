import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import {
  PASSWORD_HELPER_TEXT,
  validatePassword,
  mapSupabasePasswordError,
} from "@/lib/passwordValidation";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "request" | "sent" | "reset";

const meta: Record<Step, { title: string; description: string }> = {
  request: {
    title: "Reset your password — Cobbli",
    description:
      "Forgot your Cobbli password? Enter your email to receive a secure reset link and get back to managing your shoe repair orders in NYC.",
  },
  sent: {
    title: "Check your inbox — Cobbli",
    description:
      "We've sent you a password reset link. Check your inbox to securely set a new password for your Cobbli account and continue your shoe repairs.",
  },
  reset: {
    title: "Reset password — Cobbli",
    description:
      "Set a new password for your Cobbli account so you can sign in and manage your NYC shoe repair orders, addresses and payment methods.",
  },
};

const ResetPassword = () => {
  const navigate = useNavigate();

  // Detect Supabase recovery hash on mount
  const [step, setStep] = useState<Step>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || hash.includes("access_token")) return "reset";
    }
    return "request";
  });

  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  usePageMeta(meta[step]);

  // Listen for the PASSWORD_RECOVERY event Supabase fires after a recovery link sets the session
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStep("reset");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
      intervalRef.current = window.setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [cooldown]);

  const emailValid = useMemo(() => emailRegex.test(email.trim()), [email]);

  const sendReset = async (target: string) => {
    return supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  };

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValid || submitting) return;
    setRequestError(null);
    setSubmitting(true);
    try {
      const { error } = await sendReset(email.trim());
      if (error) {
        setRequestError(error.message);
        return;
      }
      setSubmittedEmail(email.trim());
      setCooldown(60);
      setStep("sent");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !submittedEmail) return;
    setCooldown(60);
    await sendReset(submittedEmail);
  };

  const livePwdError = newPwd.length > 0 ? validatePassword(newPwd) : null;
  const canSubmitReset =
    newPwd.length > 0 &&
    confirmPwd.length > 0 &&
    validatePassword(newPwd) === null &&
    newPwd === confirmPwd &&
    !submitting;

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    const validationError = validatePassword(newPwd);
    if (validationError) {
      setPwdError(validationError);
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) {
        setPwdError(mapSupabasePasswordError(error.message) ?? error.message);
        return;
      }
      // Clear lockout for this user
      if (userRes.user?.id) {
        await supabase.rpc("reset_failed_attempts", { _user_id: userRes.user.id });
      }
      // Send password-updated confirmation email (best-effort; don't block on failure)
      try {
        await supabase.functions.invoke("send-password-updated");
      } catch (e) {
        console.warn("send-password-updated invocation failed", e);
      }
      await supabase.auth.signOut();
      navigate("/signin", {
        replace: true,
        state: { resetSuccess: "Your password has been updated. Please sign in with your new password." },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-md py-12 md:py-16">
          {step === "request" && (
            <section className="space-y-6">
              <h1 className="text-2xl md:text-3xl font-semibold">Reset your password</h1>
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
                {requestError && <p className="text-sm text-destructive">{requestError}</p>}
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!emailValid || submitting}>
                  {submitting ? "Sending…" : "Send reset link"}
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
            <section className="space-y-6">
              <h1 className="text-2xl md:text-3xl font-semibold">Check your inbox</h1>
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
            <section className="space-y-6">
              <h1 className="text-2xl md:text-3xl font-semibold">Reset password</h1>
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
                </div>

                {pwdError && <p className="text-sm text-destructive">{pwdError}</p>}

                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!canSubmitReset}>
                  {submitting ? "Updating…" : "Update password"}
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

export default ResetPassword;
