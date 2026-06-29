import { Link, useLocation } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import { extractEmailParam, resolveInitialEmail } from "@/lib/resetEmail";

const LinkExpired = () => {
  const location = useLocation();

  usePageMeta({
    title: "Link expired — Cobbli",
    description:
      "Your password reset link has expired. Request a new reset link to securely set a new password for your Cobbli account.",
  });

  // Carry the email (from the reset flow's hand-off or the expired link URL)
  // through to the "request a new link" screen so it stays pre-populated.
  const stateEmail = (location.state as { prefillEmail?: string } | null)?.prefillEmail ?? null;
  const urlEmail =
    typeof window === "undefined"
      ? null
      : extractEmailParam(window.location.search, window.location.hash);
  const prefillEmail = resolveInitialEmail({ stateEmail, urlEmail });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-md py-12 md:py-16">
          <section className="space-y-6 text-center">
            <h1 className="text-2xl md:text-3xl font-semibold">Link expired</h1>
            <p className="text-muted-foreground">
              Your password reset link has expired. Reset links are valid for 24 hours. Please request a new one.
            </p>
            <Button asChild className="w-full">
              <Link to="/reset-password" state={{ prefillEmail }}>Request a new link</Link>
            </Button>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LinkExpired;
