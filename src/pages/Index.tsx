import Header from "@/components/cobbli/Header";
import Hero from "@/components/cobbli/Hero";
import Services from "@/components/cobbli/Services";
import HowItWorks from "@/components/cobbli/HowItWorks";
import Reviews from "@/components/cobbli/Reviews";
import GetToKnowUs from "@/components/cobbli/GetToKnowUs";

import Footer from "@/components/cobbli/Footer";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";

const Index = () => {
  const location = useLocation();

  usePageMeta({
    title: "Cobbli — Expert shoe repair, delivered to your doorstep",
    description:
      "Cobbli picks up, repairs and returns your favorite shoes across NYC. Master cobblers, free courier on orders over $100, easy online booking.",
    canonicalPath: "/",
  });

  useEffect(() => {
    if (location.hash === "#how-it-works") {
      const timer = setTimeout(() => {
        const el = document.getElementById("how-it-works");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location]);

  // LocalBusiness structured data for the homepage
  useEffect(() => {
    const id = "cobbli-localbusiness-jsonld";
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    const data = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "Cobbli",
      description:
        "Door-to-door shoe repair in NYC. Cobbli picks up, repairs and returns your favorite shoes.",
      url: window.location.origin,
      email: "support@cobbli.com",
      areaServed: { "@type": "City", name: "New York" },
      address: {
        "@type": "PostalAddress",
        addressLocality: "New York",
        addressRegion: "NY",
        addressCountry: "US",
      },
      priceRange: "$$",
    };
    script.textContent = JSON.stringify(data);
    return () => {
      script?.remove();
    };
  }, []);

  return (
    <main className="min-h-screen bg-white">
      {/* Header floats directly on the hero photo (goodgirlsnacks.com-style
          "no menu bar" look), 2026-08-25 (Danielle's call, previewing) —
          needs Header + Hero sharing a `relative` wrapper so the absolutely
          positioned header lays over the hero image instead of pushing it
          down. Revert by dropping the wrapper div and the `transparent`
          prop to go back to the solid sticky bar. */}
      <div className="relative">
        <Header transparent />
        <Hero />
      </div>
      <Services />
      <HowItWorks />
      {/* Reviews replaces the old "Why Cobbli" trust-signals section here
          2026-08-26 (Danielle's call, matches her homepage mockup) —
          TrustSignals.tsx is untouched, just no longer rendered on the
          homepage. Revert by swapping the import/JSX back if needed. */}
      <Reviews />
      <GetToKnowUs />

      <Footer />
    </main>
  );
};

export default Index;
