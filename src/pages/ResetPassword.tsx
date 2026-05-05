import { useEffect } from "react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

const ResetPassword = () => {
  useEffect(() => {
    document.title = "Reset Password — Cobbli";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container max-w-md py-12 md:py-16">
          <h1 className="text-2xl md:text-3xl font-semibold mb-4">Reset your password</h1>
          <p className="text-muted-foreground">Coming soon.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResetPassword;
