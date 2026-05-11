import { usePageMeta } from "@/hooks/usePageMeta";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

const PrivacyPolicy = () => {
  usePageMeta({
    title: "Privacy policy — Cobbli",
    description:
      "Read Cobbli's privacy policy: how we collect, use and protect personal information when you book shoe repairs and use our door-to-door service.",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-6 md:px-12 py-12 text-left">
          <h1
            className="text-3xl md:text-4xl font-semibold"
            style={{ color: "#3d1700" }}
          >
            Privacy Policy
          </h1>
          <p
            className="mt-2"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 400,
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            Effective Date: Month Day, Year | Last Updated: Month Day, Year
          </p>
          <div className="mt-8 text-foreground/90 leading-relaxed">
            Text here
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
