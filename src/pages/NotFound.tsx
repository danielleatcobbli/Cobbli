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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="mb-4 text-4xl">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
