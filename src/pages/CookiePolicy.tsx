import { usePageMeta } from "@/hooks/usePageMeta";
import { getConsent, setConsent, type ConsentValue } from "@/lib/consent";
import { useEffect, useState } from "react";

const CookiePolicy = () => {
  usePageMeta({
    title: "Cookie policy — Cobbli",
    description:
      "Learn how Cobbli uses essential and analytics cookies, and manage your cookie preferences for our door-to-door shoe repair service.",
    canonicalPath: "/cookie-policy",
  });

  const [current, setCurrent] = useState<ConsentValue | null>(null);
  useEffect(() => setCurrent(getConsent()), []);

  const update = (v: ConsentValue) => {
    setConsent(v);
    setCurrent(v);
  };

  return (
    <main
      className="min-h-screen px-6 py-12 md:py-16"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <article className="max-w-3xl mx-auto text-left">
        <h1 className="text-3xl md:text-4xl font-semibold" style={{ color: "#3d1700" }}>
          Cookie Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: Month Day, Year
        </p>

        <section className="mt-8 space-y-4 text-foreground/90 leading-relaxed">
          <p>
            Cobbli uses cookies and similar technologies to operate this website and to
            understand how visitors use it. This page explains what we use and how you can
            control your preferences.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ color: "#3d1700" }}>
            Essential cookies
          </h2>
          <p>
            These are required for core site functionality such as remembering your bag,
            keeping you signed in, and securing form submissions. They cannot be disabled.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ color: "#3d1700" }}>
            Analytics cookies (Google Analytics 4)
          </h2>
          <p>
            With your permission, we use GA4 to measure aggregate, anonymized traffic so we
            can improve the experience. These cookies are only set after you click
            <strong> Accept</strong>.
          </p>

          <h2 className="text-xl font-semibold mt-8" style={{ color: "#3d1700" }}>
            Manage your preferences
          </h2>
          <p className="text-sm text-muted-foreground">
            Current setting:{" "}
            <strong>{current === "accepted" ? "Accepted" : current === "declined" ? "Declined" : "Not set"}</strong>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <button
              type="button"
              onClick={() => update("accepted")}
              className="h-10 px-4 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
            >
              Accept analytics cookies
            </button>
            <button
              type="button"
              onClick={() => update("declined")}
              className="h-10 px-4 rounded-md text-sm font-semibold border transition-colors hover:bg-muted"
              style={{ borderColor: "#3d1700", color: "#3d1700" }}
            >
              Decline analytics cookies
            </button>
          </div>

          <h2 className="text-xl font-semibold mt-8" style={{ color: "#3d1700" }}>
            Contact
          </h2>
          <p>
            Questions? Email us at{" "}
            <a href="mailto:support@cobbli.com" className="underline">
              support@cobbli.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
};

export default CookiePolicy;
