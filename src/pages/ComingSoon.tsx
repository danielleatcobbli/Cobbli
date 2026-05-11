import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import logo from "@/assets/logo-cobbli.svg";
import instagram from "@/assets/icons/instagram.svg";
import tiktok from "@/assets/icons/tiktok.svg";

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Please enter your email address." })
  .max(254, { message: "Email is too long." })
  .email({ message: "Please enter a valid email address." });

const socials = [
  {
    src: instagram,
    label: "Instagram",
    href: "https://www.instagram.com/cobblidotcom?igsh=bmJ1MGYxY251ZG9l&utm_source=qr",
  },
  {
    src: tiktok,
    label: "TikTok",
    href: "https://www.tiktok.com/@cobblidotcom?_r=1&_t=ZP-95dDXUo1ht8",
  },
];

const ComingSoon = () => {
  usePageMeta({
    title: "Coming Soon — Cobbli",
    description:
      "Cobbli is coming soon to Manhattan. Expert shoe and leather repair, picked up and delivered to your door. Join the waitlist to be the first to know.",
    canonicalPath: "/",
  });

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const trimmed = email.trim();
  const isValid = emailSchema.safeParse(trimmed).success;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(trimmed);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase
      .from("waitlist")
      .insert({ email: parsed.data.toLowerCase(), source: "coming_soon_page" });
    setSubmitting(false);

    // Treat duplicate as success — they're already on the list
    if (insertError && insertError.code !== "23505") {
      setError("Something went wrong. Please try again.");
      return;
    }

    setSuccess(true);
    setEmail("");
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-between px-6 py-10 text-white"
      style={{ backgroundColor: "#3d1700", fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="w-full flex justify-center">
        <img src={logo} alt="Cobbli" className="h-20 md:h-24 w-auto" />
      </div>

      <section className="flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto py-10">
        <h1
          className="text-3xl md:text-5xl font-semibold leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Expert shoe & leather repair, delivered to your door.
        </h1>
        <p className="mt-5 text-base md:text-lg text-white/85">
          Cobbli is coming soon to Manhattan. Be the first to know when we launch.
        </p>

        {success ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-8 text-base md:text-lg font-medium"
            style={{ color: "#fdb600" }}
          >
            You're on the list! We'll be in touch soon.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 w-full flex flex-col sm:flex-row gap-3"
            noValidate
          >
            <label htmlFor="waitlist-email" className="sr-only">
              Email address
            </label>
            <input
              id="waitlist-email"
              type="email"
              required
              autoComplete="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={!!error}
              aria-describedby={error ? "waitlist-email-error" : undefined}
              className="flex-1 h-12 rounded-md px-4 text-base text-[#3d1700] bg-white placeholder:text-[#3d1700]/60 focus:outline-none focus:ring-2 focus:ring-[#fdb600]"
            />
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="h-12 rounded-md px-6 font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
            >
              {submitting ? "Submitting…" : "Notify me"}
            </button>
          </form>
        )}

        {error && (
          <p
            id="waitlist-email-error"
            role="alert"
            className="mt-3 text-sm"
            style={{ color: "#fdb600" }}
          >
            {error}
          </p>
        )}
      </section>

      <div className="flex items-center gap-4">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            aria-label={s.label}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <img
              src={s.src}
              alt=""
              className="h-7 w-7"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </a>
        ))}
      </div>
    </main>
  );
};

export default ComingSoon;
