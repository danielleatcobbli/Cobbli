import { Link, useLocation } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";

const LinkExpired = () => {
  usePageMeta({
    title: "Link expired — Cobbli",
    description:
      "Your password reset link has expired. Request a new reset link to securely set a new password for your Cobbli account.",
  });

  // Forward the email address embedded in the expired link's URL so the user
  // does not need to re-type it on the request form.
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const email = (params.get("email") ?? "").trim();
  const target = email ? `/reset-password?email=${encodeURIComponent(email)}` : "/reset-password";

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
              <Link to={target}>Request a new link</Link>
            </Button>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LinkExpired;
