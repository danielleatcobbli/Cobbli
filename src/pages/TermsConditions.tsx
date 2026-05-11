import { usePageMeta } from "@/hooks/usePageMeta";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

const TermsConditions = () => {
  usePageMeta({
    title: "Terms & conditions — Cobbli",
    description:
      "The terms and conditions that govern your use of Cobbli's NYC shoe repair service, including pickup, return, payment and order guarantees.",
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
            Terms & Conditions
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

export default TermsConditions;
