import Header from "@/components/cobbli/Header";
import Hero from "@/components/cobbli/Hero";
import Services from "@/components/cobbli/Services";
import HowItWorks from "@/components/cobbli/HowItWorks";
import TrustSignals from "@/components/cobbli/TrustSignals";

import Footer from "@/components/cobbli/Footer";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";

const Index = () => {
  usePageMeta({
    title: "Cobbli — Expert shoe repair, delivered to your doorstep",
    description:
      "Cobbli picks up, repairs and returns your favorite shoes across NYC. Master cobblers, free courier on orders over $100, easy online booking.",
    canonicalPath: "/",
  });

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
      <Header />
      <Hero />
      <Services />
      <HowItWorks />
      <TrustSignals />
      
      <Footer />
    </main>
  );
};

export default Index;
