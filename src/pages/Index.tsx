import Header from "@/components/cobbli/Header";
import Hero from "@/components/cobbli/Hero";
import Services from "@/components/cobbli/Services";
import HowItWorks from "@/components/cobbli/HowItWorks";
import TrustSignals from "@/components/cobbli/TrustSignals";
import CTA from "@/components/cobbli/CTA";
import Footer from "@/components/cobbli/Footer";
import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    document.title = "Cobbli — Expert shoe repair, delivered to your doorstep";
    const desc = "Cobbli collects, restores and returns your favourite shoes. Master cobblers, free UK collection, 90-day quality guarantee.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.origin + "/");
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <Header />
      <Hero />
      <Services />
      <HowItWorks />
      <TrustSignals />
      <CTA />
      <Footer />
    </main>
  );
};

export default Index;
