import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { usePageMeta } from "@/hooks/usePageMeta";

const NotFound = () => {
  const location = useLocation();

  usePageMeta({
    title: "Page not found — Cobbli",
    description:
"The page you're looking for doesn't exist. Head back to Cobbli's homepage to start a shoe repair or browse our NYC door-to-door services.",
  });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Restyled 2026-08-26 (Danielle's call) — cream page bg + amber text.
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1
            className="mb-4 text-4xl"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
          >
            404
          </h1>
          <p className="mb-4 text-xl" style={{ color: "#fdb600", opacity: 0.85, fontFamily: "'Instrument Sans', sans-serif" }}>Oops! Page not found</p>
          <a href="/" className="underline" style={{ color: "#fdb600" }}>
            Return to Home
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
