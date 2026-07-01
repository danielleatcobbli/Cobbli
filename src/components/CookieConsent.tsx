import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getConsent, setConsent } from "@/lib/consent";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const choose = (v: "accepted" | "declined") => {
    setConsent(v);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
      style={{ fontFamily: "'Albert Sans', sans-serif" }}
    >
      <div
        className="mx-auto max-w-3xl rounded-lg shadow-lg p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 text-white"
        style={{ backgroundColor: "#3d1700" }}
      >
        <p className="text-sm leading-relaxed flex-1">
          We use essential cookies to run this site and, with your permission, analytics
          cookies to understand how it's used. See our{" "}
          <Link to="/cookie-policy" className="underline">
            Cookie Policy
          </Link>{" "}
          and{" "}
          <Link to="/privacy-policy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:shrink-0">
          <button
            type="button"
            onClick={() => choose("declined")}
            className="h-10 px-4 rounded-md text-sm font-semibold border border-white/40 hover:bg-white/10 transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="h-10 px-4 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
